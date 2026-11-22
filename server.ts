import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import { getNodeDataset } from './src/lib/datasetNode';
import {
  DAY_NAMES_EN,
  generateDeterministicWeeklyPlan,
  getEligibleDishesForConstraints,
  validateAndEnrichGeminiPlan,
  type GeminiMealSlotInput,
} from './src/lib/planner';
import { resolveRegionalContext } from './src/lib/psgc';
import {
  calculateSlotServings,
  getEffectiveConstraintsForParticipants,
  getParticipatingMembers,
  isDayActiveInSchedule,
} from './src/lib/schedule';
import { migrateProfile } from './src/lib/storage';
import { matchIngredientByName } from './src/lib/fridge';
import type { MealSlot, UserProfile, WeeklyMealPlan } from './src/types';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

app.get('/api/health', (_req, res) => {
  const dataset = getNodeDataset();
  res.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    datasetCounts: dataset.validationReport.counts,
    datasetValid: dataset.validationReport.isValid,
  });
});

app.get('/api/dataset-report', (_req, res) => {
  const dataset = getNodeDataset();
  res.json(dataset.validationReport);
});

/**
 * Generates a household-aware Filipino meal plan using Gemini structured JSON (responseSchema)
 * strictly bounded to eligible, allergen-safe dish_ids from dishes.csv and ONLY for
 * selected days and slots with participating household members.
 */
app.post('/api/meal-plan/generate', async (req, res) => {
  const dataset = getNodeDataset();
  const {
    profile: rawProfile,
    existingPlan,
    optimizeForBudget,
    allowRelaxCookTime,
    allowRelaxRegional,
    allowShorterPlan,
  } = req.body as {
    profile?: Partial<UserProfile>;
    existingPlan?: WeeklyMealPlan | null;
    optimizeForBudget?: boolean;
    allowRelaxCookTime?: boolean;
    allowRelaxRegional?: boolean;
    allowShorterPlan?: boolean;
  };

  if (!rawProfile || !rawProfile.location) {
    res.status(400).json({ error: 'Invalid or missing household profile.' });
    return;
  }

  const profile = migrateProfile(rawProfile);
  const relaxationOpts = {
    allowRelaxCookTime: Boolean(allowRelaxCookTime),
    allowRelaxRegional: Boolean(allowRelaxRegional),
    allowShorterPlan: Boolean(allowShorterPlan),
  };

  // If user requested explicit budget optimization, run deterministic budget-first planner directly for guaranteed cost focus
  if (optimizeForBudget) {
    const plan = generateDeterministicWeeklyPlan(profile, dataset, {
      existingPlan,
      optimizeForBudget: true,
      ...relaxationOpts,
    });
    res.json({ plan });
    return;
  }

  const ai = createGeminiClient();
  if (!ai) {
    const plan = generateDeterministicWeeklyPlan(profile, dataset, {
      existingPlan,
      ...relaxationOpts,
      fallbackReason:
        'Live AI planner is currently unavailable, so UlamWise generated your schedule using our verified Filipino regional dataset engine.',
    });
    res.json({ plan });
    return;
  }

  try {
    const regional = resolveRegionalContext(profile.location, dataset);
    const allSlots: MealSlot[] = ['B', 'L', 'D', 'M'];

    // Identify ONLY scheduled (dayIndex, slot) pairs that have participating members
    const requiredSlots: Array<{
      dayIndex: number;
      dayName: string;
      slot: MealSlot;
      servings: number;
      peopleCount: number;
    }> = [];
    const dishSlotMap = new Map<
      string,
      { id: string; name: string; protein: string; tier: string; zones: string[]; slots: Set<MealSlot> }
    >();
    let anySlotHasZeroCandidates = false;

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      if (!isDayActiveInSchedule(profile, dayIndex)) continue;
      for (const slot of allSlots) {
        const participants = getParticipatingMembers(profile, dayIndex, slot);
        if (participants.length === 0) continue;
        const { servings } = calculateSlotServings(participants);
        requiredSlots.push({
          dayIndex,
          dayName: DAY_NAMES_EN[dayIndex],
          slot,
          servings,
          peopleCount: participants.length,
        });

        const constraints = getEffectiveConstraintsForParticipants(participants, profile);
        const { dishes } = getEligibleDishesForConstraints(slot, constraints, profile, dataset, {
          allowRelaxCookTime: relaxationOpts.allowRelaxCookTime,
        });
        if (dishes.length === 0) {
          anySlotHasZeroCandidates = true;
        }
        for (const d of dishes) {
          const existing = dishSlotMap.get(d.dish_id);
          if (existing) {
            existing.slots.add(slot);
          } else {
            dishSlotMap.set(d.dish_id, {
              id: d.dish_id,
              name: d.name_local,
              protein: d.main_protein,
              tier: d.cost_tier,
              zones: d.cuisine_zones,
              slots: new Set([slot]),
            });
          }
        }
      }
    }

    // Short-circuit cleanly if no slots scheduled OR mathematically insufficient unique dishes for full week
    if (
      requiredSlots.length === 0 ||
      anySlotHasZeroCandidates ||
      dishSlotMap.size < requiredSlots.length
    ) {
      const plan = generateDeterministicWeeklyPlan(profile, dataset, {
        existingPlan,
        ...relaxationOpts,
      });
      res.json({ plan });
      return;
    }

    const compactCatalog = Array.from(dishSlotMap.values())
      .map(
        (d) =>
          `${d.id}|${d.name}|${d.protein}|${d.tier}|${d.zones.join(',')}|${Array.from(d.slots).join(',')}`
      )
      .join('\n');

    const lockedSummary: Array<{ dayIndex: number; slot: MealSlot; dishId: string }> = [];
    if (existingPlan) {
      for (const d of existingPlan.days) {
        for (const m of d.meals) {
          if (m.locked) {
            lockedSummary.push({ dayIndex: d.dayIndex, slot: m.slot, dishId: m.dishId });
          }
        }
      }
    }

    const scheduleSpec = requiredSlots
      .map((s) => `d${s.dayIndex}(${s.dayName.slice(0, 3)})-${s.slot}:${s.peopleCount}p/${s.servings}srv`)
      .join(', ');

    const prompt = [
      `Plan a Filipino household meal schedule for ${profile.location.cityName}, ${profile.location.provinceName} (${regional.region.region_name}).`,
      `Cuisine zone: ${regional.primaryCuisineZone} (${regional.coastalProfile}). Mode: ${profile.mealMode}. Budget: ${profile.budgetPreset} (PHP ${profile.weeklyBudgetPhp}/wk — prioritize affordable meals first).`,
      `ONLY generate meals for these exact scheduled (dayIndex, slot) pairs: ${scheduleSpec}. Do NOT output meals for unselected days or unscheduled slots.`,
      !relaxationOpts.allowRelaxRegional && regional.boostDishIds.length > 0
        ? `Regional favorites to prioritize if eligible: ${regional.boostDishIds.join(', ')}.`
        : '',
      lockedSummary.length > 0 ? `Locked slots (keep exact): ${JSON.stringify(lockedSummary)}.` : '',
      `STRICT RULES (NEVER VIOLATE): 1) Only pick dish_id values from the list below matching the required slot. 2) Zero duplicate dish_ids across the week. 3) Max 2 dishes with same protein in any 3 consecutive days. 4) Max 1 fried-rice/silog variant per week.`,
      `Format: dish_id|name|protein|tier|zones|allowed_slots`,
      compactCatalog,
    ]
      .filter(Boolean)
      .join('\n');

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a Filipino meal scheduler for UlamWise. Return strictly valid JSON matching the schema. Only pick dishIds from the provided eligible list and only for the requested scheduled slots.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              meals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayIndex: { type: Type.INTEGER },
                    slot: { type: Type.STRING },
                    dishId: { type: Type.STRING },
                    leftoverNote: { type: Type.STRING },
                  },
                  required: ['dayIndex', 'slot', 'dishId'],
                },
              },
            },
            required: ['meals'],
          },
        },
      }),
      14000
    );

    const rawText = (response.text ?? '').trim();
    const parsed = JSON.parse(rawText) as { meals?: GeminiMealSlotInput[] };
    if (!parsed || !Array.isArray(parsed.meals) || parsed.meals.length === 0) {
      throw new Error('Empty structured response from Gemini');
    }

    const plan = validateAndEnrichGeminiPlan(
      parsed.meals,
      profile,
      dataset,
      existingPlan,
      relaxationOpts
    );
    res.json({ plan });
  } catch (err) {
    console.warn(
      '[UlamWise] Gemini meal planner fallback triggered:',
      err instanceof Error ? err.message : err
    );
    const plan = generateDeterministicWeeklyPlan(profile, dataset, {
      existingPlan,
      ...relaxationOpts,
      fallbackReason:
        'Live AI planner was slow or unavailable, so UlamWise generated your schedule using our verified Filipino regional dataset engine.',
    });
    res.json({ plan });
  }
});

/**
 * Phase 2: Fridge & Pantry Image Scanning via Gemini Vision.
 * Returns tentative detected ingredients with confidence levels so the user can confirm/edit/remove.
 */
app.post('/api/fridge/scan', async (req, res) => {
  const dataset = getNodeDataset();
  const { imageBase64, mimeType } = req.body as {
    imageBase64?: string;
    mimeType?: string;
  };

  if (!imageBase64 || !mimeType) {
    res.status(400).json({ error: 'Please upload a valid fridge or pantry image.' });
    return;
  }

  const ai = createGeminiClient();
  if (!ai) {
    res.status(503).json({
      error:
        'Gemini Vision is not currently configured on the server. You can still add your fridge/pantry items manually below to get instant Filipino dish recommendations.',
    });
    return;
  }

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text:
                'Identify visible raw or packaged cooking ingredients in this Filipino kitchen, fridge, or pantry photo. Return concise ingredient names (English or common Filipino names like talong, itlog, bawang, kangkong, toyo) and honest confidence ("high", "medium", or "low"). Do not guess items you cannot actually see.',
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    confidence: { type: Type.STRING },
                  },
                  required: ['name', 'confidence'],
                },
              },
            },
            required: ['items'],
          },
        },
      }),
      25000
    );

    const parsed = JSON.parse((response.text ?? '{"items":[]}').trim()) as {
      items?: Array<{ name: string; confidence: string }>;
    };

    const detected = (parsed.items ?? []).slice(0, 20).map((it, idx) => {
      const matched = matchIngredientByName(it.name, dataset);
      const conf =
        it.confidence === 'high' || it.confidence === 'medium' ? it.confidence : 'low';
      return {
        id: `det-${Date.now()}-${idx}`,
        name: matched ? `${matched.name_fil} (${matched.name_en})` : it.name,
        matchedIngredientId: matched?.ingredient_id,
        confidence: conf,
        confirmed: conf === 'high', // never auto-confirm uncertain detections
      };
    });

    res.json({ items: detected });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Vision scan failed';
    res.status(502).json({
      error: `Could not scan image (${msg}). You can still add ingredients manually below.`,
    });
  }
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UlamWise server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start UlamWise server:', err);
  process.exit(1);
});

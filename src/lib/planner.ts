import type {
  AllergenId,
  DayPlan,
  DietaryPrefId,
  Dish,
  HouseholdMember,
  InsufficientRecipesDiagnostics,
  MealSlot,
  PlannedMeal,
  PlanRelaxationOptions,
  RecipeExclusionDiagnostics,
  UlamWiseDataset,
  UserProfile,
  WeeklyMealPlan,
} from '../types';
import {
  checkDishAllergens,
  computeRecipeExclusionDiagnostics,
  getDishSlotSuitability,
  isDishEligibleForConstraints,
} from './allergens';
import { generateGroceryList } from './grocery';
import { getDishNutritionPerServing } from './nutrition';
import { calculateDishCost } from './pricing';
import { resolveRegionalContext, type ResolvedRegionalContext } from './psgc';
import {
  calculateSlotServings,
  getEffectiveConstraintsForParticipants,
  getParticipatingMembers,
  isDayActiveInSchedule,
} from './schedule';
import {
  getTrackedMainProtein,
  isFriedRiceVariant,
  validateCompleteWeeklyPlan,
  wouldSatisfyVariety,
} from './variety';

export const DAY_NAMES_EN = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const DAY_NAMES_TL = [
  'Lunes',
  'Martes',
  'Miyerkules',
  'Huwebes',
  'Biyernes',
  'Sabado',
  'Linggo',
];

export interface GeminiMealSlotInput {
  dayIndex: number;
  slot: MealSlot;
  dishId: string;
  instructions?: string[];
  leftoverNote?: string;
}

interface ScheduledSlotTask {
  dayIndex: number;
  slot: MealSlot;
  participants: HouseholdMember[];
  servings: number;
  constraints: {
    allergies: AllergenId[];
    dietaryPrefs: DietaryPrefId[];
    dislikes: string[];
  };
  candidates: Dish[];
}

const SLOT_ORDER: Record<MealSlot, number> = { B: 0, L: 1, D: 2, M: 3 };
const ALL_SLOTS: MealSlot[] = ['B', 'L', 'D', 'M'];
const MAX_BACKTRACK_NODES_PER_RESTART = 3500;
const MAX_BACKTRACK_RESTARTS = 4;

/**
 * Splits a dish's method_hint into clean, actionable Filipino home-cooking steps
 * when Gemini instructions are not provided.
 */
export function buildDefaultInstructions(dish: Dish, dataset: UlamWiseDataset): string[] {
  const ingRows = dataset.dishIngredientsByDishId.get(dish.dish_id) ?? [];
  const mainNames = ingRows
    .filter((r) => r.role === 'main')
    .slice(0, 5)
    .map((r) => r.ingredient_name);

  const steps: string[] = [];
  if (mainNames.length > 0) {
    steps.push(`Prepare and wash the main ingredients: ${mainNames.join(', ')}.`);
  }
  const hintParts = dish.method_hint
    .split(/[.;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
  for (const part of hintParts) {
    steps.push(part.charAt(0).toUpperCase() + part.slice(1) + '.');
  }
  if (dish.rice_pairing === 'yes') {
    steps.push('Serve hot with steamed kanin (cooked rice).');
  }
  return steps;
}

/**
 * Enriches a canonical dish_id into a trusted, participation-aware PlannedMeal
 * using dataset nutrition, actual participating household members, and regional/store pricing.
 */
export function buildPlannedMeal(
  dish: Dish,
  slot: MealSlot,
  participants: HouseholdMember[],
  profile: UserProfile,
  dataset: UlamWiseDataset,
  regional: ResolvedRegionalContext,
  options?: {
    locked?: boolean;
    instructions?: string[];
    leftoverNote?: string;
  }
): PlannedMeal {
  const effectiveParticipants = participants.length > 0 ? participants : profile.household;
  const { servings, memberPortions } = calculateSlotServings(effectiveParticipants);
  const nutrition = getDishNutritionPerServing(dish, dataset);
  const cost = calculateDishCost(
    dish,
    servings,
    regional.region,
    profile.preferredStore,
    dataset
  );

  const instructions =
    options?.instructions && options.instructions.length > 0
      ? options.instructions
      : buildDefaultInstructions(dish, dataset);

  const leftoverNote =
    options?.leftoverNote ??
    (dish.tags.includes('leftover_friendly')
      ? 'Great for leftovers — flavors deepen overnight and reheat well for next-day baon.'
      : undefined);

  return {
    slot,
    dishId: dish.dish_id,
    locked: Boolean(options?.locked),
    instructions,
    leftoverNote,
    nutritionSource: nutrition.source,
    participatingMemberIds: effectiveParticipants.map((m) => m.id),
    participatingMemberNames: effectiveParticipants.map((m) => m.label),
    servings,
    memberPortions,
    costPerServingPhp: cost.costPerServingPhp,
    totalMealCostPhp: cost.totalMealCostPhp,
    kcalPerServing: nutrition.kcal,
    proteinPerServing: nutrition.protein_g,
    carbsPerServing: nutrition.carbs_g,
    fatPerServing: nutrition.fat_g,
  };
}

/**
 * Scores a candidate dish for a specific profile, participant serving count, regional context,
 * budget pacing, coastal/inland access, pantry reuse, and seeded variety jitter.
 * Never deterministically traps selection on the cheapest or first eligible recipe.
 */
function scoreDishCandidate(
  dish: Dish,
  slot: MealSlot,
  servings: number,
  targetSlotBudgetPhp: number,
  profile: UserProfile,
  dataset: UlamWiseDataset,
  regional: ResolvedRegionalContext,
  usedIngredientIds: Set<string>,
  seedJitter: number,
  optimizeForBudget = false,
  allowRelaxRegional = false
): number {
  let score = 50;

  // Mild preference for primary slot classification while preserving full L/D and B flexibility
  const suitability = getDishSlotSuitability(dish, slot);
  if (suitability === 'primary') score += 4;

  if (!allowRelaxRegional) {
    const isCityBoost = regional.cityOverride?.boost_dish_ids.includes(dish.dish_id) ?? false;
    const isRegionSig = regional.region.signature_dish_ids.includes(dish.dish_id);
    const matchesPrimaryZone = dish.cuisine_zones.includes(regional.primaryCuisineZone);
    const matchesSecondaryZone = dish.cuisine_zones.some((z) =>
      regional.secondaryCuisineZones.includes(z)
    );
    const isNational = dish.cuisine_zones.includes('national');

    // Bounded regional preference so local dishes are prioritized without locking out variety
    let regionalBonus = 0;
    if (profile.mealMode === 'local_specialties') {
      if (isCityBoost) regionalBonus += 12;
      if (isRegionSig) regionalBonus += 8;
      if (matchesPrimaryZone) regionalBonus += 8;
      else if (matchesSecondaryZone) regionalBonus += 4;
      else if (isNational) regionalBonus += 2;
      regionalBonus = Math.min(20, regionalBonus);
    } else {
      if (isNational) regionalBonus += 10;
      if (matchesPrimaryZone) regionalBonus += 5;
      if (isCityBoost) regionalBonus += 4;
      if (dish.tags.includes('classic') || dish.tags.includes('budget')) regionalBonus += 4;
      regionalBonus = Math.min(16, regionalBonus);
    }
    score += regionalBonus;

    // Coastal vs inland fish & seafood availability
    const isFreshSeafood = dish.main_protein === 'fish' || dish.main_protein === 'seafood';
    if (regional.coastalProfile === 'inland' && isFreshSeafood) {
      const rows = dataset.dishIngredientsByDishId.get(dish.dish_id) ?? [];
      const usesRiverOrPantry = rows.some((r) =>
        ['tilapia', 'sardines_tomato', 'tuna_canned', 'tuyo'].includes(r.ingredient_id)
      );
      score += usesRiverOrPantry ? 2 : -10;
    } else if (regional.coastalProfile === 'coastal' && isFreshSeafood) {
      score += 5;
    }
  }

  // Budget pacing based on actual servings & remaining per-slot budget
  const cost = calculateDishCost(
    dish,
    servings,
    regional.region,
    profile.preferredStore,
    dataset
  );
  const safeTarget = Math.max(25, targetSlotBudgetPhp);
  const budgetRatio = cost.totalMealCostPhp / safeTarget;

  if (optimizeForBudget || profile.budgetPreset === 'tipid') {
    if (dish.cost_tier === 'tipid') score += 9;
    else if (dish.cost_tier === 'balanced') score += 5;
    else score -= 18;

    if (budgetRatio <= 0.9) score += 8;
    else if (budgetRatio <= 1.1) score += 4;
    else score -= Math.min(22, (budgetRatio - 1.05) * 18);
  } else if (profile.budgetPreset === 'balanced') {
    if (dish.cost_tier === 'tipid') score += 6;
    else if (dish.cost_tier === 'balanced') score += 8;
    else score -= 5;

    if (budgetRatio <= 1.0) score += 7;
    else if (budgetRatio <= 1.2) score += 3;
    else score -= Math.min(18, (budgetRatio - 1.15) * 16);
  } else {
    if (dish.cost_tier === 'sagana') score += 9;
    if (dish.cost_tier === 'balanced') score += 9;
    if (dish.tags.includes('special') || dish.tags.includes('classic')) score += 5;
    if (budgetRatio > 1.35) score -= Math.min(16, (budgetRatio - 1.3) * 14);
  }

  // Smart ingredient reuse & pantry bonus
  const dishIngs = dataset.dishIngredientsByDishId.get(dish.dish_id) ?? [];
  const pantryIds = new Set(
    profile.pantry.map((p) => p.ingredientId).filter((id): id is string => Boolean(id))
  );
  let reuseHits = 0;
  let pantryHits = 0;
  for (const row of dishIngs) {
    if (row.role === 'main' && usedIngredientIds.has(row.ingredient_id)) reuseHits++;
    if (pantryIds.has(row.ingredient_id)) pantryHits++;
  }
  score += Math.min(8, reuseHits * 2);
  score += Math.min(7, pantryHits * 2);

  score += seedJitter;
  return score;
}

function deterministicHash(str: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Returns strictly eligible, allergen-safe candidate dishes for a meal slot and participant constraints.
 * Hard rules (allergies, dietary restrictions, dislikes, equipment, slot type) are NEVER relaxed.
 * Cooking time is ONLY relaxed when the user explicitly opts in via options.allowRelaxCookTime === true.
 */
export function getEligibleDishesForConstraints(
  slot: MealSlot,
  constraints: {
    allergies: AllergenId[];
    dietaryPrefs: DietaryPrefId[];
    dislikes: string[];
  },
  profile: UserProfile,
  dataset: UlamWiseDataset,
  options?: { allowRelaxCookTime?: boolean }
): { dishes: Dish[]; relaxedNote?: string } {
  const allowRelaxCookTime = Boolean(options?.allowRelaxCookTime);
  const strict = dataset.dishes.filter(
    (d) =>
      isDishEligibleForConstraints(
        d,
        slot,
        constraints,
        profile.equipment,
        profile.maxCookTime,
        dataset,
        { relaxTime: allowRelaxCookTime }
      ).eligible
  );
  return { dishes: strict };
}

/**
 * Convenience wrapper for getting strictly eligible dishes across the entire household's combined constraints.
 */
export function getEligibleDishesForSlot(
  slot: MealSlot,
  profile: UserProfile,
  dataset: UlamWiseDataset,
  options?: { allowRelaxCookTime?: boolean }
): { dishes: Dish[]; relaxedNote?: string } {
  const constraints = getEffectiveConstraintsForParticipants(profile.household, profile);
  return getEligibleDishesForConstraints(slot, constraints, profile, dataset, options);
}

/**
 * Builds clean 7-day shell honoring active schedule days and strictly valid locked meals.
 * Invalid, duplicate, allergen-conflicting, or variety-violating locked meals are NOT preserved.
 */
function buildInitialDaysWithValidLocks(
  profile: UserProfile,
  dataset: UlamWiseDataset,
  regional: ResolvedRegionalContext,
  existingPlan: WeeklyMealPlan | null | undefined,
  allowRelaxCookTime: boolean,
  allowedDayIndices?: Set<number>
): DayPlan[] {
  const days: DayPlan[] = Array.from({ length: 7 }, (_, dayIndex) => ({
    dayIndex,
    dayName: DAY_NAMES_EN[dayIndex],
    isPlannedDay:
      isDayActiveInSchedule(profile, dayIndex) &&
      (!allowedDayIndices || allowedDayIndices.has(dayIndex)),
    meals: [],
  }));

  if (!existingPlan) return days;

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    if (!days[dayIndex].isPlannedDay) continue;
    const existingDay = existingPlan.days[dayIndex];
    if (!existingDay) continue;

    for (const m of existingDay.meals) {
      if (!m.locked) continue;
      if (days[dayIndex].meals.some((x) => x.slot === m.slot)) continue;

      const participants = getParticipatingMembers(profile, dayIndex, m.slot);
      if (participants.length === 0) continue;

      const dish = dataset.dishesById.get(m.dishId);
      if (!dish) continue;

      const constraints = getEffectiveConstraintsForParticipants(participants, profile);
      const eligible = isDishEligibleForConstraints(
        dish,
        m.slot,
        constraints,
        profile.equipment,
        profile.maxCookTime,
        dataset,
        { relaxTime: allowRelaxCookTime }
      ).eligible;
      if (!eligible) continue;

      const varietyOk = wouldSatisfyVariety(dish, dayIndex, m.slot, days, dataset).ok;
      if (!varietyOk) continue;

      days[dayIndex].meals.push(
        buildPlannedMeal(dish, m.slot, participants, profile, dataset, regional, {
          locked: true,
          instructions: m.instructions,
          leftoverNote: m.leftoverNote,
        })
      );
    }
  }

  return days;
}

/**
 * Collects all unassigned scheduled slots for the active days in `days` along with their strict candidate pools.
 */
function collectScheduledTasks(
  days: DayPlan[],
  profile: UserProfile,
  dataset: UlamWiseDataset,
  allowRelaxCookTime: boolean
): ScheduledSlotTask[] {
  const tasks: ScheduledSlotTask[] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    if (!days[dayIndex].isPlannedDay) continue;
    for (const slot of ALL_SLOTS) {
      if (days[dayIndex].meals.some((m) => m.slot === slot)) continue;
      const participants = getParticipatingMembers(profile, dayIndex, slot);
      if (participants.length === 0) continue;

      const constraints = getEffectiveConstraintsForParticipants(participants, profile);
      const { servings } = calculateSlotServings(participants);
      const { dishes } = getEligibleDishesForConstraints(slot, constraints, profile, dataset, {
        allowRelaxCookTime,
      });

      tasks.push({
        dayIndex,
        slot,
        participants,
        servings,
        constraints,
        candidates: dishes,
      });
    }
  }

  return tasks;
}

/**
 * Bounded MRV (Minimum Remaining Values) + forward-checking backtracking solver.
 * Guarantees:
 * - Zero duplicate canonical dishes across the week.
 * - Max 2 dishes per primary protein in every rolling 3-day calendar window.
 * - Max 1 fried-rice / silog variant per week.
 * - Diverse, regionally aware, budget-paced candidate ordering (never stuck on cheapest/first recipe).
 * - Strictly bounded search nodes and restarts to prevent infinite loops.
 */
function solveScheduleWithBacktracking(
  baseDays: DayPlan[],
  tasks: ScheduledSlotTask[],
  profile: UserProfile,
  dataset: UlamWiseDataset,
  regional: ResolvedRegionalContext,
  options: {
    seed: number;
    optimizeForBudget: boolean;
    allowRelaxRegional: boolean;
    maxNodesPerRestart?: number;
    maxRestarts?: number;
  }
): DayPlan[] | null {
  if (tasks.length === 0) {
    return baseDays.map((d) => ({
      ...d,
      meals: [...d.meals].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]),
    }));
  }

  // Extract initial state from already-placed (locked / accepted) meals
  const initialUsedDishIds = new Set<string>();
  let initialSilogCount = 0;
  const initialProteinByDay: Array<Map<string, number>> = Array.from({ length: 7 }, () => new Map());
  const initialProteinTotals = new Map<string, number>();
  const initialUsedIngredients = new Set<string>();
  let initialCostPhp = 0;

  for (const day of baseDays) {
    for (const m of day.meals) {
      initialUsedDishIds.add(m.dishId);
      initialCostPhp += m.totalMealCostPhp;
      const dish = dataset.dishesById.get(m.dishId);
      if (dish) {
        if (isFriedRiceVariant(dish)) initialSilogCount++;
        const protein = getTrackedMainProtein(dish, m.slot);
        if (protein) {
          initialProteinByDay[day.dayIndex].set(
            protein,
            (initialProteinByDay[day.dayIndex].get(protein) ?? 0) + 1
          );
          initialProteinTotals.set(protein, (initialProteinTotals.get(protein) ?? 0) + 1);
        }
      }
      const rows = dataset.dishIngredientsByDishId.get(m.dishId) ?? [];
      for (const r of rows) initialUsedIngredients.add(r.ingredient_id);
    }
  }

  // Early mathematical feasibility checks (pigeonhole principle including max-1 silog rule)
  const remainingSilogAllowance = Math.max(0, 1 - initialSilogCount);
  const allNonSilogIds = new Set<string>();
  const allSilogIds = new Set<string>();
  const tasksCountBySlot: Record<MealSlot, number> = { B: 0, L: 0, D: 0, M: 0 };
  const nonSilogBySlot: Record<MealSlot, Set<string>> = {
    B: new Set(),
    L: new Set(),
    D: new Set(),
    M: new Set(),
  };
  const silogBySlot: Record<MealSlot, Set<string>> = {
    B: new Set(),
    L: new Set(),
    D: new Set(),
    M: new Set(),
  };

  for (const task of tasks) {
    tasksCountBySlot[task.slot]++;
    let countForTask = 0;
    for (const d of task.candidates) {
      if (initialUsedDishIds.has(d.dish_id)) continue;
      const isSilog = isFriedRiceVariant(d);
      if (isSilog && remainingSilogAllowance === 0) continue;
      countForTask++;
      if (isSilog) {
        allSilogIds.add(d.dish_id);
        silogBySlot[task.slot].add(d.dish_id);
      } else {
        allNonSilogIds.add(d.dish_id);
        nonSilogBySlot[task.slot].add(d.dish_id);
      }
    }
    if (countForTask === 0) return null;
  }

  const maxTotalUsableDishes =
    allNonSilogIds.size + Math.min(remainingSilogAllowance, allSilogIds.size);
  if (maxTotalUsableDishes < tasks.length) {
    return null;
  }
  for (const slot of ALL_SLOTS) {
    if (tasksCountBySlot[slot] === 0) continue;
    const maxSlotUsable =
      nonSilogBySlot[slot].size + Math.min(remainingSilogAllowance, silogBySlot[slot].size);
    if (maxSlotUsable < tasksCountBySlot[slot]) {
      return null;
    }
  }

  const totalScheduledServings = tasks.reduce((sum, t) => sum + t.servings, 0);
  const usableDishBudgetPhp = Math.max(200, (profile.weeklyBudgetPhp || 2000) * 0.86);
  const avgTargetPerServing =
    totalScheduledServings > 0
      ? Math.max(25, (usableDishBudgetPhp - initialCostPhp) / totalScheduledServings)
      : 60;

  const maxNodes = options.maxNodesPerRestart ?? MAX_BACKTRACK_NODES_PER_RESTART;
  const maxRestarts = options.maxRestarts ?? MAX_BACKTRACK_RESTARTS;

  for (let restart = 0; restart < maxRestarts; restart++) {
    const attemptSeed = options.seed + restart * 7919;
    const diversityFirstMode = restart >= 2;

    const usedDishIds = new Set<string>(initialUsedDishIds);
    let silogCount = initialSilogCount;
    const proteinByDay: Array<Map<string, number>> = initialProteinByDay.map(
      (m) => new Map(m)
    );
    const proteinTotals = new Map<string, number>(initialProteinTotals);

    // Precompute base scores for every (taskIdx, dish) once per restart
    const baseScores: Map<string, number>[] = tasks.map((task) => {
      const scoreMap = new Map<string, number>();
      const targetSlotBudget = avgTargetPerServing * task.servings;
      for (const dish of task.candidates) {
        const jitterScale = diversityFirstMode
          ? 56
          : options.optimizeForBudget
          ? 24
          : 48;
        const jitter =
          deterministicHash(`${dish.dish_id}-${task.dayIndex}-${task.slot}-${restart}`, attemptSeed) *
          jitterScale;
        const base = scoreDishCandidate(
          dish,
          task.slot,
          task.servings,
          targetSlotBudget,
          profile,
          dataset,
          regional,
          initialUsedIngredients,
          jitter,
          diversityFirstMode ? false : options.optimizeForBudget,
          options.allowRelaxRegional || diversityFirstMode
        );
        scoreMap.set(dish.dish_id, base);
      }
      return scoreMap;
    });

    const assignments: Array<Dish | null> = new Array(tasks.length).fill(null);
    let nodesVisited = 0;

    const canAssign = (dish: Dish, dayIndex: number, slot: MealSlot): boolean => {
      if (usedDishIds.has(dish.dish_id)) return false;
      if (isFriedRiceVariant(dish) && silogCount >= 1) return false;

      const protein = getTrackedMainProtein(dish, slot);
      if (protein) {
        const winStartMin = Math.max(0, dayIndex - 2);
        const winStartMax = Math.min(4, dayIndex);
        for (let start = winStartMin; start <= winStartMax; start++) {
          const countInWindow =
            (proteinByDay[start].get(protein) ?? 0) +
            (proteinByDay[start + 1].get(protein) ?? 0) +
            (proteinByDay[start + 2].get(protein) ?? 0);
          if (countInWindow + 1 > 2) {
            return false;
          }
        }
      }
      return true;
    };

    const dfs = (assignedCount: number): boolean => {
      if (assignedCount === tasks.length) return true;
      if (++nodesVisited > maxNodes) return false;

      // MRV + Forward Checking: choose the unassigned task with the fewest currently valid candidates
      let bestTaskIdx = -1;
      let bestCandidates: Dish[] | null = null;

      for (let i = 0; i < tasks.length; i++) {
        if (assignments[i] !== null) continue;
        const task = tasks[i];
        const validForTask: Dish[] = [];
        for (const dish of task.candidates) {
          if (canAssign(dish, task.dayIndex, task.slot)) {
            validForTask.push(dish);
          }
        }
        if (validForTask.length === 0) {
          // Dead end detected immediately via forward checking
          return false;
        }
        if (bestCandidates === null || validForTask.length < bestCandidates.length) {
          bestTaskIdx = i;
          bestCandidates = validForTask;
          if (validForTask.length === 1) break; // Forced move
        }
      }

      if (bestTaskIdx === -1 || !bestCandidates) return false;

      const task = tasks[bestTaskIdx];
      const taskBaseScores = baseScores[bestTaskIdx];

      // Order candidates dynamically by base score + protein diversity balance
      bestCandidates.sort((a, b) => {
        const pA = getTrackedMainProtein(a, task.slot);
        const pB = getTrackedMainProtein(b, task.slot);
        const usedA = pA ? proteinTotals.get(pA) ?? 0 : 0;
        const usedB = pB ? proteinTotals.get(pB) ?? 0 : 0;
        const proteinWeight = diversityFirstMode ? 12 : 5;
        const scoreA = (taskBaseScores.get(a.dish_id) ?? 0) - usedA * proteinWeight;
        const scoreB = (taskBaseScores.get(b.dish_id) ?? 0) - usedB * proteinWeight;
        return scoreB - scoreA;
      });

      for (const dish of bestCandidates) {
        const protein = getTrackedMainProtein(dish, task.slot);
        const isSilog = isFriedRiceVariant(dish);

        assignments[bestTaskIdx] = dish;
        usedDishIds.add(dish.dish_id);
        if (isSilog) silogCount++;
        if (protein) {
          proteinByDay[task.dayIndex].set(
            protein,
            (proteinByDay[task.dayIndex].get(protein) ?? 0) + 1
          );
          proteinTotals.set(protein, (proteinTotals.get(protein) ?? 0) + 1);
        }

        if (dfs(assignedCount + 1)) {
          return true;
        }

        // Backtrack
        assignments[bestTaskIdx] = null;
        usedDishIds.delete(dish.dish_id);
        if (isSilog) silogCount--;
        if (protein) {
          const prevDay = (proteinByDay[task.dayIndex].get(protein) ?? 1) - 1;
          if (prevDay <= 0) proteinByDay[task.dayIndex].delete(protein);
          else proteinByDay[task.dayIndex].set(protein, prevDay);

          const prevTotal = (proteinTotals.get(protein) ?? 1) - 1;
          if (prevTotal <= 0) proteinTotals.delete(protein);
          else proteinTotals.set(protein, prevTotal);
        }
      }

      return false;
    };

    if (dfs(0)) {
      const solvedDays: DayPlan[] = baseDays.map((d) => ({
        ...d,
        meals: [...d.meals],
      }));

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const chosen = assignments[i];
        if (!chosen) return null;
        solvedDays[task.dayIndex].meals.push(
          buildPlannedMeal(chosen, task.slot, task.participants, profile, dataset, regional)
        );
      }

      for (const d of solvedDays) {
        d.meals.sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
      }

      return solvedDays;
    }
  }

  return null;
}

/**
 * Picks `k` evenly spaced elements from `arr` to maximize calendar spacing
 * across 3-day rolling protein windows when a contiguous prefix is infeasible.
 */
function pickSpacedSubset(arr: number[], k: number): number[] {
  if (k <= 0) return [];
  if (k >= arr.length) return [...arr];
  if (k === 1) return [arr[0]];
  const result: number[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.round((i * (arr.length - 1)) / (k - 1));
    result.push(arr[idx]);
  }
  return Array.from(new Set(result));
}

/**
 * Searches for the largest valid subset of the user's selected days (from N-1 down to 1)
 * that can be scheduled with 100% hard-constraint compliance.
 */
function findBestShorterValidPlan(
  profile: UserProfile,
  dataset: UlamWiseDataset,
  regional: ResolvedRegionalContext,
  existingPlan: WeeklyMealPlan | null | undefined,
  options: {
    seed: number;
    optimizeForBudget: boolean;
    allowRelaxCookTime: boolean;
    allowRelaxRegional: boolean;
    quickDiagnosticOnly?: boolean;
  }
): { days: DayPlan[]; plannedDaysCount: number } | null {
  const activeDaysWithMeals: number[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    if (!isDayActiveInSchedule(profile, dayIndex)) continue;
    const hasAnySlot = ALL_SLOTS.some(
      (slot) => getParticipatingMembers(profile, dayIndex, slot).length > 0
    );
    if (hasAnySlot) activeDaysWithMeals.push(dayIndex);
  }

  if (activeDaysWithMeals.length <= 1) {
    // Try single day if requested days === 1? Already tried full schedule, so no shorter subset exists.
    return null;
  }

  const maxNodes = options.quickDiagnosticOnly ? 900 : 2500;
  const maxRestarts = options.quickDiagnosticOnly ? 2 : 3;

  for (let k = activeDaysWithMeals.length - 1; k >= 1; k--) {
    const candidateSubsets: number[][] = [
      activeDaysWithMeals.slice(0, k), // Prefer contiguous earliest selected days
    ];
    const spaced = pickSpacedSubset(activeDaysWithMeals, k);
    if (spaced.length === k && spaced.join(',') !== candidateSubsets[0].join(',')) {
      candidateSubsets.push(spaced);
    }

    for (const subset of candidateSubsets) {
      const allowedSet = new Set<number>(subset);
      const baseDays = buildInitialDaysWithValidLocks(
        profile,
        dataset,
        regional,
        existingPlan,
        options.allowRelaxCookTime,
        allowedSet
      );
      const tasks = collectScheduledTasks(baseDays, profile, dataset, options.allowRelaxCookTime);
      const solved = solveScheduleWithBacktracking(baseDays, tasks, profile, dataset, regional, {
        seed: options.seed,
        optimizeForBudget: options.optimizeForBudget,
        allowRelaxRegional: options.allowRelaxRegional,
        maxNodesPerRestart: maxNodes,
        maxRestarts,
      });

      if (solved) {
        const validation = validateCompleteWeeklyPlan(solved, profile, dataset, {
          allowRelaxCookTime: options.allowRelaxCookTime,
          allowShorterPlan: true,
        });
        if (validation.valid && validation.plannedDaysCount > 0) {
          return { days: solved, plannedDaysCount: validation.plannedDaysCount };
        }
      }
    }
  }

  return null;
}

/**
 * Builds clear, non-technical diagnostics explaining why a full schedule could not be generated
 * without breaking hard constraints, and which explicit user actions can resolve it.
 */
function buildInsufficientRecipesDiagnostics(
  profile: UserProfile,
  dataset: UlamWiseDataset,
  regional: ResolvedRegionalContext,
  existingPlan: WeeklyMealPlan | null | undefined,
  options: {
    seed: number;
    optimizeForBudget: boolean;
    allowRelaxCookTime: boolean;
    allowRelaxRegional: boolean;
  }
): InsufficientRecipesDiagnostics {
  const activeDays: number[] = [];
  const requiredBySlot: Record<MealSlot, number> = { B: 0, L: 0, D: 0, M: 0 };
  const eligibleIdsBySlot: Record<MealSlot, Set<string>> = {
    B: new Set(),
    L: new Set(),
    D: new Set(),
    M: new Set(),
  };
  const uniqueEligible = new Set<string>();
  const proteinSet = new Set<string>();

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    if (!isDayActiveInSchedule(profile, dayIndex)) continue;
    let dayHasSlot = false;
    for (const slot of ALL_SLOTS) {
      const participants = getParticipatingMembers(profile, dayIndex, slot);
      if (participants.length === 0) continue;
      dayHasSlot = true;
      requiredBySlot[slot]++;

      const constraints = getEffectiveConstraintsForParticipants(participants, profile);
      const { dishes } = getEligibleDishesForConstraints(slot, constraints, profile, dataset, {
        allowRelaxCookTime: options.allowRelaxCookTime,
      });
      for (const d of dishes) {
        eligibleIdsBySlot[slot].add(d.dish_id);
        uniqueEligible.add(d.dish_id);
        const p = getTrackedMainProtein(d, slot);
        if (p) proteinSet.add(p);
      }
    }
    if (dayHasSlot) activeDays.push(dayIndex);
  }

  const requiredSlots = requiredBySlot.B + requiredBySlot.L + requiredBySlot.D + requiredBySlot.M;
  const eligibleCountBySlot: Record<MealSlot, number> = {
    B: eligibleIdsBySlot.B.size,
    L: eligibleIdsBySlot.L.size,
    D: eligibleIdsBySlot.D.size,
    M: eligibleIdsBySlot.M.size,
  };

  const reasons: string[] = [];
  if (uniqueEligible.size < requiredSlots) {
    reasons.push(
      `Only ${uniqueEligible.size} unique ${uniqueEligible.size === 1 ? 'recipe matches' : 'recipes match'} your active allergy, dietary, equipment, and cooking-time settings, while your schedule requires ${requiredSlots} distinct meals.`
    );
  }

  const slotLabels: Record<MealSlot, string> = {
    B: 'Breakfast',
    L: 'Lunch',
    D: 'Dinner',
    M: 'Merienda',
  };
  for (const slot of ALL_SLOTS) {
    if (requiredBySlot[slot] > 0) {
      let silogInSlot = 0;
      let nonSilogInSlot = 0;
      for (const id of eligibleIdsBySlot[slot]) {
        const d = dataset.dishesById.get(id);
        if (d && isFriedRiceVariant(d)) silogInSlot++;
        else nonSilogInSlot++;
      }
      const effectiveSlotCapacity = nonSilogInSlot + Math.min(1, silogInSlot);
      if (eligibleCountBySlot[slot] < requiredBySlot[slot]) {
        reasons.push(
          `${slotLabels[slot]} has ${eligibleCountBySlot[slot]} matching ${eligibleCountBySlot[slot] === 1 ? 'recipe' : 'recipes'} for ${requiredBySlot[slot]} scheduled ${requiredBySlot[slot] === 1 ? 'slot' : 'slots'}.`
        );
      } else if (effectiveSlotCapacity < requiredBySlot[slot]) {
        reasons.push(
          `${slotLabels[slot]} has only ${effectiveSlotCapacity} usable ${effectiveSlotCapacity === 1 ? 'option' : 'options'} after applying the max-1 fried-rice/silog weekly rule for ${requiredBySlot[slot]} scheduled mornings.`
        );
      }
    }
  }

  if (reasons.length === 0) {
    reasons.push(
      `The ${uniqueEligible.size} eligible recipes do not have enough protein variety (${proteinSet.size} protein ${proteinSet.size === 1 ? 'group' : 'groups'}) to fill all ${activeDays.length} days without repeating a main protein more than twice in 3 consecutive days.`
    );
  }

  // Check whether explicitly allowing longer cooking times unlocks additional eligible dishes
  let canRelaxCookTime = false;
  if (!options.allowRelaxCookTime) {
    const relaxedUnique = new Set<string>();
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      if (!isDayActiveInSchedule(profile, dayIndex)) continue;
      for (const slot of ALL_SLOTS) {
        const participants = getParticipatingMembers(profile, dayIndex, slot);
        if (participants.length === 0) continue;
        const constraints = getEffectiveConstraintsForParticipants(participants, profile);
        const { dishes } = getEligibleDishesForConstraints(slot, constraints, profile, dataset, {
          allowRelaxCookTime: true,
        });
        dishes.forEach((d) => relaxedUnique.add(d.dish_id));
      }
    }
    canRelaxCookTime = relaxedUnique.size > uniqueEligible.size;
  }

  // Check if a shorter valid plan (at least 1 day) can be generated without breaking any hard rule
  const shorterProbe = findBestShorterValidPlan(profile, dataset, regional, existingPlan, {
    seed: options.seed,
    optimizeForBudget: options.optimizeForBudget,
    allowRelaxCookTime: options.allowRelaxCookTime,
    allowRelaxRegional: options.allowRelaxRegional,
    quickDiagnosticOnly: true,
  });

  const suggestedMaxDays = shorterProbe?.plannedDaysCount ?? 0;

  const householdConstraints = getEffectiveConstraintsForParticipants(profile.household, profile);
  const exclusionBySlot: Record<MealSlot, RecipeExclusionDiagnostics> = {
    B: computeRecipeExclusionDiagnostics(
      'B',
      householdConstraints,
      profile.equipment,
      profile.maxCookTime,
      dataset,
      { relaxTime: options.allowRelaxCookTime }
    ),
    L: computeRecipeExclusionDiagnostics(
      'L',
      householdConstraints,
      profile.equipment,
      profile.maxCookTime,
      dataset,
      { relaxTime: options.allowRelaxCookTime }
    ),
    D: computeRecipeExclusionDiagnostics(
      'D',
      householdConstraints,
      profile.equipment,
      profile.maxCookTime,
      dataset,
      { relaxTime: options.allowRelaxCookTime }
    ),
    M: computeRecipeExclusionDiagnostics(
      'M',
      householdConstraints,
      profile.equipment,
      profile.maxCookTime,
      dataset,
      { relaxTime: options.allowRelaxCookTime }
    ),
  };

  return {
    requiredSlots,
    requestedDays: activeDays.length,
    fillableDays: suggestedMaxDays,
    eligibleCountBySlot,
    uniqueEligibleCount: uniqueEligible.size,
    reasons,
    canRelaxCookTime,
    canGenerateShorterPlan: suggestedMaxDays > 0,
    suggestedMaxDays,
    exclusionBySlot,
  };
}

function buildEmptyDays(profile: UserProfile): DayPlan[] {
  return Array.from({ length: 7 }, (_, dayIndex) => ({
    dayIndex,
    dayName: DAY_NAMES_EN[dayIndex],
    isPlannedDay: isDayActiveInSchedule(profile, dayIndex),
    meals: [],
  }));
}

function buildValidStatusMessage(
  plannedDaysCount: number,
  requestedDaysCount: number,
  relaxedByUser?: WeeklyMealPlan['relaxedByUser']
): string {
  if (plannedDaysCount === 0) {
    return 'No active meal days are currently selected in your weekly schedule.';
  }
  const dayLabel = plannedDaysCount === 1 ? '1-day' : `${plannedDaysCount}-day`;
  const parts: string[] = [];
  if (relaxedByUser?.shorterPlan && plannedDaysCount < requestedDaysCount) {
    parts.push(
      `Valid ${dayLabel} meal plan generated (${plannedDaysCount} of ${requestedDaysCount} requested days) — all variety, allergy, and dietary rules passed.`
    );
  } else {
    parts.push(
      `Valid ${dayLabel} meal plan generated — zero repeated dishes, balanced protein rotation, and all allergy and dietary rules passed.`
    );
  }
  if (relaxedByUser?.cookTime) {
    parts.push('Longer cooking times were allowed by your selection.');
  }
  return parts.join(' ');
}

/**
 * Generates a household-aware, schedule-respecting weekly Filipino meal plan
 * deterministically from the trusted CSV dataset.
 *
 * Pipeline:
 * Generate candidates -> Apply household, allergy, dietary, equipment & cook-time filters
 * -> Select varied dishes via bounded MRV backtracking -> Validate complete schedule
 * -> Accept ONLY if every hard constraint passes.
 *
 * Never silently relaxes hard constraints or fills slots with invalid repeated dishes.
 */
export function generateDeterministicWeeklyPlan(
  profile: UserProfile,
  dataset: UlamWiseDataset,
  options?: PlanRelaxationOptions & {
    existingPlan?: WeeklyMealPlan | null;
    seed?: number;
    fallbackReason?: string;
    optimizeForBudget?: boolean;
  }
): WeeklyMealPlan {
  const seed = options?.seed ?? Date.now();
  const optimizeForBudget = Boolean(options?.optimizeForBudget);
  const allowRelaxCookTime = Boolean(options?.allowRelaxCookTime);
  const allowRelaxRegional = Boolean(options?.allowRelaxRegional);
  const allowShorterPlan = Boolean(options?.allowShorterPlan);
  const regional = resolveRegionalContext(profile.location, dataset);

  const requestedDaysCount = Array.from({ length: 7 }, (_, idx) => idx).filter(
    (dayIndex) =>
      isDayActiveInSchedule(profile, dayIndex) &&
      ALL_SLOTS.some((slot) => getParticipatingMembers(profile, dayIndex, slot).length > 0)
  ).length;

  // 1. Preserve only strictly valid locked meals
  const baseDays = buildInitialDaysWithValidLocks(
    profile,
    dataset,
    regional,
    options?.existingPlan,
    allowRelaxCookTime
  );

  // 2. Collect scheduled slots & strict candidates
  const tasks = collectScheduledTasks(baseDays, profile, dataset, allowRelaxCookTime);

  // 3. Solve with bounded MRV + forward-checking backtracking.
  // For budget-first weekly optimization, evaluate up to 3 strictly valid candidate weeks
  // using actual grocery checkout cost, bulk savings, and leftover waste — NEVER relaxing variety or safety.
  const candidateSeedOffsets =
    optimizeForBudget || profile.budgetPreset === 'tipid'
      ? [0, 104729, 224737]
      : profile.budgetPreset === 'balanced'
      ? [0, 104729]
      : [0];

  let bestSolvedDays: DayPlan[] | null = null;
  let bestBasketObjective = Number.POSITIVE_INFINITY;

  for (const offset of candidateSeedOffsets) {
    const candidateDays = solveScheduleWithBacktracking(baseDays, tasks, profile, dataset, regional, {
      seed: seed + offset,
      optimizeForBudget,
      allowRelaxRegional,
    });
    if (!candidateDays) continue;

    const validation = validateCompleteWeeklyPlan(candidateDays, profile, dataset, {
      allowRelaxCookTime,
      allowShorterPlan: false,
    });
    if (!validation.valid) continue;

    if (candidateSeedOffsets.length === 1) {
      bestSolvedDays = candidateDays;
      break;
    }

    const probePlan: WeeklyMealPlan = {
      id: 'probe',
      createdAt: '',
      source: 'deterministic',
      mealMode: profile.mealMode,
      warnings: [],
      days: candidateDays,
    };
    const basket = generateGroceryList(probePlan, profile, dataset);
    // Objective balances actual retail checkout cost, low leftover waste, and bulk purchase efficiency
    const objective =
      basket.totalCheckoutCostPhp +
      basket.totalLeftoverInventoryValuePhp * 0.35 -
      basket.bulkSavingsPhp * 0.4;

    if (objective < bestBasketObjective) {
      bestBasketObjective = objective;
      bestSolvedDays = candidateDays;
    }
  }

  // 4. Validate complete schedule before accepting
  if (bestSolvedDays) {
    const validation = validateCompleteWeeklyPlan(bestSolvedDays, profile, dataset, {
      allowRelaxCookTime,
      allowShorterPlan: false,
    });
    if (validation.valid) {
      const relaxedByUser =
        allowRelaxCookTime || allowRelaxRegional
          ? {
              cookTime: allowRelaxCookTime || undefined,
              regional: allowRelaxRegional || undefined,
            }
          : undefined;
      const householdConstraints = getEffectiveConstraintsForParticipants(profile.household, profile);
      const exclusionBySlot: Record<MealSlot, RecipeExclusionDiagnostics> = {
        B: computeRecipeExclusionDiagnostics(
          'B',
          householdConstraints,
          profile.equipment,
          profile.maxCookTime,
          dataset,
          { relaxTime: allowRelaxCookTime }
        ),
        L: computeRecipeExclusionDiagnostics(
          'L',
          householdConstraints,
          profile.equipment,
          profile.maxCookTime,
          dataset,
          { relaxTime: allowRelaxCookTime }
        ),
        D: computeRecipeExclusionDiagnostics(
          'D',
          householdConstraints,
          profile.equipment,
          profile.maxCookTime,
          dataset,
          { relaxTime: allowRelaxCookTime }
        ),
        M: computeRecipeExclusionDiagnostics(
          'M',
          householdConstraints,
          profile.equipment,
          profile.maxCookTime,
          dataset,
          { relaxTime: allowRelaxCookTime }
        ),
      };

      return {
        id: `plan-${Date.now()}`,
        createdAt: new Date().toISOString(),
        source: 'deterministic',
        fallbackReason: options?.fallbackReason,
        mealMode: profile.mealMode,
        warnings: [],
        validationStatus: 'valid',
        statusMessage: buildValidStatusMessage(
          validation.plannedDaysCount,
          requestedDaysCount,
          relaxedByUser
        ),
        relaxedByUser,
        eligibilitySummary: {
          eligibleCountBySlot: {
            B: exclusionBySlot.B.eligibleCount,
            L: exclusionBySlot.L.eligibleCount,
            D: exclusionBySlot.D.eligibleCount,
            M: exclusionBySlot.M.eligibleCount,
          },
          exclusionBySlot,
        },
        days: bestSolvedDays,
      };
    }
  }

  // 5. If user explicitly opted in to a shorter valid plan, return the maximal valid subset of days
  if (allowShorterPlan) {
    const shorter = findBestShorterValidPlan(profile, dataset, regional, options?.existingPlan, {
      seed,
      optimizeForBudget,
      allowRelaxCookTime,
      allowRelaxRegional,
    });
    if (shorter) {
      const relaxedByUser = {
        cookTime: allowRelaxCookTime || undefined,
        regional: allowRelaxRegional || undefined,
        shorterPlan: true,
      };
      return {
        id: `plan-${Date.now()}`,
        createdAt: new Date().toISOString(),
        source: 'deterministic',
        fallbackReason: options?.fallbackReason,
        mealMode: profile.mealMode,
        warnings: [],
        validationStatus: 'valid',
        statusMessage: buildValidStatusMessage(
          shorter.plannedDaysCount,
          requestedDaysCount,
          relaxedByUser
        ),
        relaxedByUser,
        days: shorter.days,
      };
    }
  }

  // 6. Insufficient eligible recipes: NEVER generate an invalid schedule just to fill slots
  const diagnostics = buildInsufficientRecipesDiagnostics(
    profile,
    dataset,
    regional,
    options?.existingPlan,
    {
      seed,
      optimizeForBudget,
      allowRelaxCookTime,
      allowRelaxRegional,
    }
  );

  const summaryMsg =
    diagnostics.canGenerateShorterPlan
      ? `Not enough matching recipes for all ${diagnostics.requestedDays} scheduled days without repeating dishes or breaking protein and safety rules. Adjust your preferences or generate a valid ${diagnostics.suggestedMaxDays}-day plan instead.`
      : `Not enough matching recipes satisfy your current allergy, dietary, equipment, and cooking-time settings without repeating dishes or breaking safety rules. Please adjust your preferences in Settings.`;

  return {
    id: `plan-${Date.now()}`,
    createdAt: new Date().toISOString(),
    source: 'deterministic',
    fallbackReason: options?.fallbackReason,
    mealMode: profile.mealMode,
    warnings: [],
    validationStatus: 'insufficient_recipes',
    statusMessage: summaryMsg,
    insufficientRecipes: diagnostics,
    days: buildEmptyDays(profile),
  };
}

/**
 * Validates and enriches a Gemini-generated weekly plan using the EXACT SAME hard constraints
 * and bounded backtracking completion pipeline as the deterministic local engine.
 *
 * - Never silently relaxes cooking time, allergies, dietary rules, or variety rules.
 * - Accepts ONLY schedules that pass validateCompleteWeeklyPlan with zero violations.
 */
export function validateAndEnrichGeminiPlan(
  geminiSlots: GeminiMealSlotInput[],
  profile: UserProfile,
  dataset: UlamWiseDataset,
  existingPlan?: WeeklyMealPlan | null,
  options?: PlanRelaxationOptions & {
    seed?: number;
    optimizeForBudget?: boolean;
  }
): WeeklyMealPlan {
  const seed = options?.seed ?? Date.now();
  const allowRelaxCookTime = Boolean(options?.allowRelaxCookTime);
  const allowRelaxRegional = Boolean(options?.allowRelaxRegional);
  const allowShorterPlan = Boolean(options?.allowShorterPlan);
  const optimizeForBudget = Boolean(options?.optimizeForBudget);
  const regional = resolveRegionalContext(profile.location, dataset);

  const requestedDaysCount = Array.from({ length: 7 }, (_, idx) => idx).filter(
    (dayIndex) =>
      isDayActiveInSchedule(profile, dayIndex) &&
      ALL_SLOTS.some((slot) => getParticipatingMembers(profile, dayIndex, slot).length > 0)
  ).length;

  // Track original user-locked slots so final plan preserves exact user lock flags
  const userLockedKeys = new Set<string>();
  if (existingPlan) {
    for (const d of existingPlan.days) {
      for (const m of d.meals) {
        if (m.locked) userLockedKeys.add(`${d.dayIndex}-${m.slot}`);
      }
    }
  }

  // 1. Start with strictly validated user-locked meals
  const daysWithGemini = buildInitialDaysWithValidLocks(
    profile,
    dataset,
    regional,
    existingPlan,
    allowRelaxCookTime
  );

  // 2. Accept ONLY strictly valid Gemini picks (same hard rules as deterministic planner)
  let acceptedGeminiCount = 0;
  for (const item of geminiSlots) {
    if (item.dayIndex < 0 || item.dayIndex > 6) continue;
    if (!daysWithGemini[item.dayIndex].isPlannedDay) continue;

    const participants = getParticipatingMembers(profile, item.dayIndex, item.slot);
    if (participants.length === 0) continue;

    const day = daysWithGemini[item.dayIndex];
    if (day.meals.some((m) => m.slot === item.slot)) continue;

    const dish = dataset.dishesById.get(item.dishId);
    if (!dish) continue;

    const constraints = getEffectiveConstraintsForParticipants(participants, profile);
    const eligibility = isDishEligibleForConstraints(
      dish,
      item.slot,
      constraints,
      profile.equipment,
      profile.maxCookTime,
      dataset,
      { relaxTime: allowRelaxCookTime }
    );
    if (!eligibility.eligible) continue;

    const varietyCheck = wouldSatisfyVariety(dish, item.dayIndex, item.slot, daysWithGemini, dataset);
    if (!varietyCheck.ok) continue;

    day.meals.push(
      buildPlannedMeal(dish, item.slot, participants, profile, dataset, regional, {
        locked: false,
        instructions: item.instructions,
        leftoverNote: item.leftoverNote,
      })
    );
    acceptedGeminiCount++;
  }

  // 3. Complete any remaining slots with the bounded backtracking solver keeping valid Gemini picks
  const remainingTasks = collectScheduledTasks(
    daysWithGemini,
    profile,
    dataset,
    allowRelaxCookTime
  );
  const solvedWithGemini = solveScheduleWithBacktracking(
    daysWithGemini,
    remainingTasks,
    profile,
    dataset,
    regional,
    {
      seed,
      optimizeForBudget,
      allowRelaxRegional,
    }
  );

  if (solvedWithGemini) {
    const finalDays = solvedWithGemini.map((d) => ({
      ...d,
      meals: d.meals.map((m) => ({
        ...m,
        locked: userLockedKeys.has(`${d.dayIndex}-${m.slot}`),
      })),
    }));
    const validation = validateCompleteWeeklyPlan(finalDays, profile, dataset, {
      allowRelaxCookTime,
      allowShorterPlan: false,
    });
    if (validation.valid) {
      const relaxedByUser =
        allowRelaxCookTime || allowRelaxRegional
          ? {
              cookTime: allowRelaxCookTime || undefined,
              regional: allowRelaxRegional || undefined,
            }
          : undefined;
      return {
        id: `plan-${Date.now()}`,
        createdAt: new Date().toISOString(),
        source: acceptedGeminiCount > 0 ? 'gemini' : 'deterministic',
        mealMode: profile.mealMode,
        warnings: [],
        validationStatus: 'valid',
        statusMessage: buildValidStatusMessage(
          validation.plannedDaysCount,
          requestedDaysCount,
          relaxedByUser
        ),
        relaxedByUser,
        days: finalDays,
      };
    }
  }

  // 4. If Gemini's partial picks painted remaining slots into a dead end, solve cleanly from user locks only
  return generateDeterministicWeeklyPlan(profile, dataset, {
    existingPlan,
    seed,
    optimizeForBudget,
    allowRelaxCookTime,
    allowRelaxRegional,
    allowShorterPlan,
  });
}

/**
 * Regenerates or swaps ONE single meal slot without modifying any other meal in the week,
 * strictly enforcing participating members' allergies, dietary rules, cook-time rules,
 * and ALL weekly variety constraints (zero duplicates, max 2 per protein in 3 days, max 1 fried-rice).
 */
export function regenerateSingleMeal(
  plan: WeeklyMealPlan,
  dayIndex: number,
  slot: MealSlot,
  profile: UserProfile,
  dataset: UlamWiseDataset,
  specificDishId?: string
): { plan: WeeklyMealPlan; replaced: boolean; message?: string } {
  const regional = resolveRegionalContext(profile.location, dataset);
  const currentDay = plan.days[dayIndex];
  if (!currentDay) return { plan, replaced: false, message: 'Invalid day index' };
  const currentMeal = currentDay.meals.find((m) => m.slot === slot);
  const allowRelaxCookTime = Boolean(plan.relaxedByUser?.cookTime);
  const allowShorterPlan = Boolean(plan.relaxedByUser?.shorterPlan);

  const participants = getParticipatingMembers(profile, dayIndex, slot);
  const effectiveParticipants =
    participants.length > 0 ? participants : profile.household;
  const constraints = getEffectiveConstraintsForParticipants(effectiveParticipants, profile);
  const { servings } = calculateSlotServings(effectiveParticipants);

  if (specificDishId) {
    const targetDish = dataset.dishesById.get(specificDishId);
    if (!targetDish) return { plan, replaced: false, message: 'Dish not found in dataset' };
    const allergy = checkDishAllergens(targetDish, constraints.allergies, dataset);
    if (!allergy.safe) {
      return {
        plan,
        replaced: false,
        message: `Blocked for allergen safety: ${allergy.conflictingAllergens.join(', ')}`,
      };
    }
    const eligibility = isDishEligibleForConstraints(
      targetDish,
      slot,
      constraints,
      profile.equipment,
      profile.maxCookTime,
      dataset,
      { relaxTime: allowRelaxCookTime }
    );
    if (!eligibility.eligible) {
      return {
        plan,
        replaced: false,
        message: `Blocked by household rules: ${eligibility.reasons.join(', ')}`,
      };
    }
    const varietyCheck = wouldSatisfyVariety(targetDish, dayIndex, slot, plan.days, dataset);
    if (!varietyCheck.ok) {
      return {
        plan,
        replaced: false,
        message: `Blocked to keep weekly variety valid: ${varietyCheck.reason}.`,
      };
    }

    const newMeal = buildPlannedMeal(
      targetDish,
      slot,
      effectiveParticipants,
      profile,
      dataset,
      regional,
      { locked: currentMeal?.locked ?? false }
    );
    const nextDays = plan.days.map((d) =>
      d.dayIndex !== dayIndex
        ? d
        : {
            ...d,
            meals: d.meals.some((m) => m.slot === slot)
              ? d.meals.map((m) => (m.slot === slot ? newMeal : m))
              : [...d.meals, newMeal],
          }
    );

    const validation = validateCompleteWeeklyPlan(nextDays, profile, dataset, {
      allowRelaxCookTime,
      allowShorterPlan,
    });
    if (!validation.valid) {
      return {
        plan,
        replaced: false,
        message: 'Could not swap meal without violating a weekly rule.',
      };
    }

    return {
      plan: { ...plan, days: nextDays, validationStatus: 'valid', warnings: [] },
      replaced: true,
    };
  }

  const { dishes } = getEligibleDishesForConstraints(slot, constraints, profile, dataset, {
    allowRelaxCookTime,
  });
  const usedIngs = new Set<string>();
  for (const d of plan.days) {
    for (const m of d.meals) {
      (dataset.dishIngredientsByDishId.get(m.dishId) ?? []).forEach((r) =>
        usedIngs.add(r.ingredient_id)
      );
    }
  }

  const plannedMealsTotal = Math.max(
    1,
    plan.days.reduce((sum, d) => sum + d.meals.length, 0)
  );
  const targetSlotBudget = (profile.weeklyBudgetPhp || 2000) / plannedMealsTotal;

  const candidates = dishes
    .filter((d) => d.dish_id !== currentMeal?.dishId)
    .map((dish) => ({
      dish,
      score: scoreDishCandidate(
        dish,
        slot,
        servings,
        targetSlotBudget,
        profile,
        dataset,
        regional,
        usedIngs,
        Math.random() * 28
      ),
    }))
    .sort((a, b) => b.score - a.score);

  // NEVER fall back to a dish that violates weekly variety rules
  const validCandidate = candidates.find(
    (c) => wouldSatisfyVariety(c.dish, dayIndex, slot, plan.days, dataset).ok
  );

  if (!validCandidate) {
    return {
      plan,
      replaced: false,
      message:
        'No other eligible recipe can replace this meal without repeating a dish or exceeding the 3-day protein limit.',
    };
  }

  const newMeal = buildPlannedMeal(
    validCandidate.dish,
    slot,
    effectiveParticipants,
    profile,
    dataset,
    regional,
    { locked: false }
  );

  const nextDays = plan.days.map((d) =>
    d.dayIndex !== dayIndex
      ? d
      : {
          ...d,
          meals: d.meals.some((m) => m.slot === slot)
            ? d.meals.map((m) => (m.slot === slot ? newMeal : m))
            : [...d.meals, newMeal],
        }
  );

  return {
    plan: { ...plan, days: nextDays, validationStatus: 'valid', warnings: [] },
    replaced: true,
  };
}

/**
 * Returns safe, strictly valid swap options for a specific meal slot
 * filtered for participating members and weekly variety rules.
 */
export function getSwapOptionsForSlot(
  plan: WeeklyMealPlan,
  dayIndex: number,
  slot: MealSlot,
  profile: UserProfile,
  dataset: UlamWiseDataset
): Array<{ dish: Dish; costPerServingPhp: number; satisfiesVariety: boolean }> {
  const regional = resolveRegionalContext(profile.location, dataset);
  const participants = getParticipatingMembers(profile, dayIndex, slot);
  const effectiveParticipants =
    participants.length > 0 ? participants : profile.household;
  const constraints = getEffectiveConstraintsForParticipants(effectiveParticipants, profile);
  const { servings } = calculateSlotServings(effectiveParticipants);
  const allowRelaxCookTime = Boolean(plan.relaxedByUser?.cookTime);

  const currentMeal = plan.days[dayIndex]?.meals.find((m) => m.slot === slot);
  const { dishes } = getEligibleDishesForConstraints(slot, constraints, profile, dataset, {
    allowRelaxCookTime,
  });

  return dishes
    .filter((d) => d.dish_id !== currentMeal?.dishId)
    .map((dish) => {
      const variety = wouldSatisfyVariety(dish, dayIndex, slot, plan.days, dataset);
      const cost = calculateDishCost(
        dish,
        servings,
        regional.region,
        profile.preferredStore,
        dataset
      );
      return {
        dish,
        costPerServingPhp: cost.costPerServingPhp,
        satisfiesVariety: variety.ok,
      };
    })
    .filter((opt) => opt.satisfiesVariety)
    .sort((a, b) => a.costPerServingPhp - b.costPerServingPhp);
}

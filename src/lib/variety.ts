import type {
  DayPlan,
  Dish,
  MealSlot,
  PlanValidationIssue,
  UlamWiseDataset,
  UserProfile,
  WeeklyMealPlan,
} from '../types';
import {
  checkDishAllergens,
  checkDishDietaryEligibility,
  checkDishEquipmentEligibility,
  isDishSuitableForSlot,
} from './allergens';
import {
  getEffectiveConstraintsForParticipants,
  getParticipatingMembers,
  isDayActiveInSchedule,
} from './schedule';

export const FRIED_RICE_SILOG_IDS = new Set<string>([
  'tapsilog',
  'tosilog',
  'longsilog',
  'hotsilog',
  'spamsilog',
  'cornsilog',
  'dangsilog',
]);

export function isFriedRiceVariant(dish: Dish): boolean {
  if (FRIED_RICE_SILOG_IDS.has(dish.dish_id)) return true;
  const combined = `${dish.dish_id} ${dish.name_en} ${dish.name_local} ${dish.method_hint}`.toLowerCase();
  return (
    combined.includes('silog') ||
    combined.includes('sinangag') ||
    combined.includes('fried rice') ||
    combined.includes('garlic rice')
  );
}

export function getTrackedMainProtein(dish: Dish, slot: MealSlot | string): string | null {
  if (slot === 'M') return null;
  const protein = dish.main_protein.trim().toLowerCase();
  if (!protein || protein === 'snack' || protein === 'grain') return null;
  return protein;
}

export interface VarietyViolation {
  rule: 'no_duplicate_dish' | 'max_protein_3day_window' | 'max_one_fried_rice';
  message: string;
  dishIds: string[];
  dayIndices: number[];
}

export interface VarietyValidationResult {
  valid: boolean;
  violations: VarietyViolation[];
}

export interface CompletePlanValidationResult {
  valid: boolean;
  issues: PlanValidationIssue[];
  totalMeals: number;
  plannedDaysCount: number;
}

/**
 * Enforces strict weekly variety rules:
 * 1. No dish_id may appear more than once during the 7-day plan.
 * 2. No more than two dishes with the same main_protein may appear within any consecutive 3-day window.
 * 3. Only one fried-rice / silog variant may appear per week.
 */
export function validateWeeklyVariety(
  days: DayPlan[],
  dataset: UlamWiseDataset
): VarietyValidationResult {
  const violations: VarietyViolation[] = [];

  // Index by calendar dayIndex (0..6) so rolling 3-day windows always evaluate true consecutive calendar days
  const byDayIndex = new Map<number, DayPlan>();
  for (const day of days) {
    byDayIndex.set(day.dayIndex, day);
  }

  // Rule 1: No duplicate dish across the entire week
  const seenDishes = new Map<string, number[]>();
  for (const day of days) {
    for (const meal of day.meals) {
      const list = seenDishes.get(meal.dishId) ?? [];
      list.push(day.dayIndex);
      seenDishes.set(meal.dishId, list);
    }
  }
  for (const [dishId, dayIndices] of seenDishes.entries()) {
    if (dayIndices.length > 1) {
      const name = dataset.dishesById.get(dishId)?.name_en ?? dishId;
      violations.push({
        rule: 'no_duplicate_dish',
        message: `"${name}" appears ${dayIndices.length} times in the week (max 1).`,
        dishIds: [dishId],
        dayIndices,
      });
    }
  }

  // Rule 3: Only one fried-rice / silog variant per week
  const friedRiceHits: Array<{ dishId: string; dayIndex: number }> = [];
  for (const day of days) {
    for (const meal of day.meals) {
      const dish = dataset.dishesById.get(meal.dishId);
      if (dish && isFriedRiceVariant(dish)) {
        friedRiceHits.push({ dishId: meal.dishId, dayIndex: day.dayIndex });
      }
    }
  }
  if (friedRiceHits.length > 1) {
    violations.push({
      rule: 'max_one_fried_rice',
      message: `${friedRiceHits.length} fried-rice / silog variants scheduled this week (max 1 allowed).`,
      dishIds: friedRiceHits.map((h) => h.dishId),
      dayIndices: friedRiceHits.map((h) => h.dayIndex),
    });
  }

  // Rule 2: No more than 2 dishes with the same main_protein within any consecutive 3-day calendar window (0-2, 1-3, 2-4, 3-5, 4-6)
  for (let start = 0; start <= 4; start++) {
    const proteinMap = new Map<string, Array<{ dishId: string; dayIndex: number }>>();
    for (let dIdx = start; dIdx <= start + 2; dIdx++) {
      const day = byDayIndex.get(dIdx);
      if (!day) continue;
      for (const meal of day.meals) {
        const dish = dataset.dishesById.get(meal.dishId);
        if (!dish) continue;
        const protein = getTrackedMainProtein(dish, meal.slot);
        if (!protein) continue;
        const entries = proteinMap.get(protein) ?? [];
        entries.push({ dishId: dish.dish_id, dayIndex: day.dayIndex });
        proteinMap.set(protein, entries);
      }
    }
    for (const [protein, entries] of proteinMap.entries()) {
      if (entries.length > 2) {
        violations.push({
          rule: 'max_protein_3day_window',
          message: `Main protein "${protein}" appears ${entries.length} times across Days ${start + 1}–${start + 3} (max 2 in 3 consecutive days).`,
          dishIds: entries.map((e) => e.dishId),
          dayIndices: entries.map((e) => e.dayIndex),
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Checks whether assigning candidateDish to (dayIndex, slot) preserves all weekly variety rules
 * against all currently planned meals (excluding the target slot itself).
 */
export function wouldSatisfyVariety(
  candidateDish: Dish,
  targetDayIndex: number,
  targetSlot: string,
  days: DayPlan[],
  dataset: UlamWiseDataset
): { ok: boolean; reason?: string } {
  const candidateIsSilog = isFriedRiceVariant(candidateDish);
  const candidateProtein = getTrackedMainProtein(candidateDish, targetSlot);

  let silogCount = candidateIsSilog ? 1 : 0;

  for (const day of days) {
    for (const meal of day.meals) {
      if (day.dayIndex === targetDayIndex && meal.slot === targetSlot) continue;
      if (meal.dishId === candidateDish.dish_id) {
        return { ok: false, reason: 'Duplicate dish in week' };
      }
      const existingDish = dataset.dishesById.get(meal.dishId);
      if (existingDish && isFriedRiceVariant(existingDish)) {
        silogCount++;
      }
    }
  }

  if (silogCount > 1) {
    return { ok: false, reason: 'Only one fried-rice / silog variant allowed per week' };
  }

  if (candidateProtein) {
    const byDayIndex = new Map<number, DayPlan>();
    for (const d of days) byDayIndex.set(d.dayIndex, d);

    const windowStarts = [targetDayIndex - 2, targetDayIndex - 1, targetDayIndex].filter(
      (s) => s >= 0 && s <= 4
    );
    for (const start of windowStarts) {
      let count = 1; // include candidate
      for (let d = start; d <= start + 2; d++) {
        const day = byDayIndex.get(d);
        if (!day) continue;
        for (const meal of day.meals) {
          if (day.dayIndex === targetDayIndex && meal.slot === targetSlot) continue;
          const existingDish = dataset.dishesById.get(meal.dishId);
          if (existingDish && getTrackedMainProtein(existingDish, meal.slot) === candidateProtein) {
            count++;
          }
        }
      }
      if (count > 2) {
        return {
          ok: false,
          reason: `Exceeds max 2 "${candidateProtein}" dishes in 3 consecutive days`,
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Full deterministic schedule validator shared by BOTH Gemini and local deterministic engines
 * as well as localStorage cache validation.
 *
 * Enforces every hard rule without exception:
 * 1. Zero duplicate canonical dishes across the week.
 * 2. Max 2 dishes per primary protein in every rolling consecutive 3-day window.
 * 3. Max 1 fried-rice / silog variant per week.
 * 4. Zero allergy violations (household + participating members, including hidden allergens).
 * 5. Zero dietary restriction or dislike violations.
 * 6. Slot compatibility & kitchen equipment compatibility.
 * 7. Cooking-time limit enforcement (ONLY relaxed when user explicitly passed allowRelaxCookTime).
 * 8. Household schedule & attendance compliance (zero meals on unselected days/slots;
 *    all scheduled slots filled unless user explicitly opted into allowShorterPlan).
 */
export function validateCompleteWeeklyPlan(
  days: DayPlan[],
  profile: UserProfile,
  dataset: UlamWiseDataset,
  options?: {
    allowRelaxCookTime?: boolean;
    allowShorterPlan?: boolean;
  }
): CompletePlanValidationResult {
  const issues: PlanValidationIssue[] = [];
  const allSlots: MealSlot[] = ['B', 'L', 'D', 'M'];
  const allowRelaxCookTime = Boolean(options?.allowRelaxCookTime);
  const allowShorterPlan = Boolean(options?.allowShorterPlan);

  // 1-3: Variety rules
  const variety = validateWeeklyVariety(days, dataset);
  for (const v of variety.violations) {
    issues.push({
      rule: v.rule,
      message: v.message,
      dishIds: v.dishIds,
      dayIndices: v.dayIndices,
    });
  }

  const byDayIndex = new Map<number, DayPlan>();
  for (const d of days) {
    byDayIndex.set(d.dayIndex, d);
  }

  let totalMeals = 0;
  let plannedDaysCount = 0;
  let expectedScheduledSlots = 0;

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const day = byDayIndex.get(dayIndex);
    const activeDay = isDayActiveInSchedule(profile, dayIndex);
    const meals = day?.meals ?? [];

    if (meals.length > 0) {
      plannedDaysCount++;
    }

    if (!activeDay && meals.length > 0) {
      issues.push({
        rule: 'attendance_mismatch',
        message: `Meals scheduled on unselected day index ${dayIndex}.`,
        dishIds: meals.map((m) => m.dishId),
        dayIndices: [dayIndex],
      });
    }

    // Check every scheduled slot on active days
    const scheduledSlotsOnDay = new Set<MealSlot>();
    if (activeDay) {
      for (const slot of allSlots) {
        const participants = getParticipatingMembers(profile, dayIndex, slot);
        if (participants.length > 0) {
          scheduledSlotsOnDay.add(slot);
          expectedScheduledSlots++;
        }
      }
    }

    const presentSlots = new Set<MealSlot>();

    for (const meal of meals) {
      totalMeals++;
      presentSlots.add(meal.slot);

      const participants = getParticipatingMembers(profile, dayIndex, meal.slot);
      if (activeDay && participants.length === 0) {
        issues.push({
          rule: 'attendance_mismatch',
          message: `Meal ${meal.slot} on day ${dayIndex + 1} has no participating household members.`,
          dishIds: [meal.dishId],
          dayIndices: [dayIndex],
        });
        continue;
      }

      const dish = dataset.dishesById.get(meal.dishId);
      if (!dish) {
        issues.push({
          rule: 'slot_mismatch',
          message: `Unknown dish_id "${meal.dishId}" on day ${dayIndex + 1}.`,
          dishIds: [meal.dishId],
          dayIndices: [dayIndex],
        });
        continue;
      }

      if (!isDishSuitableForSlot(dish, meal.slot)) {
        issues.push({
          rule: 'slot_mismatch',
          message: `"${dish.name_en}" is not suitable for ${meal.slot}.`,
          dishIds: [dish.dish_id],
          dayIndices: [dayIndex],
        });
      }

      const effectiveParticipants = participants.length > 0 ? participants : profile.household;
      const constraints = getEffectiveConstraintsForParticipants(effectiveParticipants, profile);

      // Allergen check
      const allergy = checkDishAllergens(dish, constraints.allergies, dataset);
      if (!allergy.safe) {
        issues.push({
          rule: 'allergen_violation',
          message: `"${dish.name_en}" conflicts with allergy: ${allergy.conflictingAllergens.join(', ')}.`,
          dishIds: [dish.dish_id],
          dayIndices: [dayIndex],
        });
      }

      // Dietary & dislikes check
      const diet = checkDishDietaryEligibility(
        dish,
        constraints.dietaryPrefs,
        constraints.dislikes,
        dataset,
        { ketoMaxCarbsPerDayG: constraints.ketoMaxCarbsPerDayG }
      );
      if (!diet.eligible) {
        issues.push({
          rule: 'dietary_violation',
          message: `"${dish.name_en}" violates dietary restriction: ${diet.reasons.join(', ')}.`,
          dishIds: [dish.dish_id],
          dayIndices: [dayIndex],
        });
      }

      // Equipment check
      if (!checkDishEquipmentEligibility(dish, profile.equipment)) {
        issues.push({
          rule: 'equipment_violation',
          message: `"${dish.name_en}" requires unavailable equipment.`,
          dishIds: [dish.dish_id],
          dayIndices: [dayIndex],
        });
      }

      // Cooking-time limit check (only enforced when cookTimeMode === 'strict' and not relaxed by user)
      if ((profile.cookTimeMode ?? 'flexible') === 'strict' && !allowRelaxCookTime && meal.slot !== 'M') {
        const maxMin = profile.maxCookTime[meal.slot];
        if (maxMin && dish.time_min > maxMin) {
          issues.push({
            rule: 'cook_time_violation',
            message: `"${dish.name_en}" (${dish.time_min}m) exceeds ${maxMin}m ${meal.slot} limit.`,
            dishIds: [dish.dish_id],
            dayIndices: [dayIndex],
          });
        }
      }
    }

    // Ensure every scheduled slot on an active day is filled (unless user accepted shorter plan and skipped this whole day)
    if (activeDay && scheduledSlotsOnDay.size > 0) {
      const skippedEntireDayInShorterPlan = allowShorterPlan && meals.length === 0;
      if (!skippedEntireDayInShorterPlan) {
        for (const slot of scheduledSlotsOnDay) {
          if (!presentSlots.has(slot)) {
            issues.push({
              rule: 'missing_scheduled_slot',
              message: `Missing scheduled ${slot} meal on day ${dayIndex + 1}.`,
              dishIds: [],
              dayIndices: [dayIndex],
            });
          }
        }
      }
    }
  }

  // If shorter plan was accepted and schedule expects meals, require at least 1 planned day
  if (allowShorterPlan && expectedScheduledSlots > 0 && totalMeals === 0) {
    issues.push({
      rule: 'missing_scheduled_slot',
      message: 'Shorter meal plan contains zero valid meals.',
      dishIds: [],
      dayIndices: [],
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    totalMeals,
    plannedDaysCount,
  };
}

/**
 * Validates whether a cached WeeklyMealPlan from localStorage is clean and compliant
 * with all current household hard constraints and contains no legacy raw violation dumps.
 */
export function isCachedMealPlanValid(
  plan: WeeklyMealPlan,
  profile: UserProfile,
  dataset: UlamWiseDataset
): boolean {
  if (!plan || !Array.isArray(plan.days) || plan.days.length !== 7) {
    return false;
  }

  // Reject stale plans carrying legacy raw internal violation warnings
  const legacyViolationPattern =
    /(appears \d+ times in the week|max 2 in 3 consecutive days|required relaxing a variety rule|cooking-time limits were relaxed slightly|Expanded [BLDM] choices across other meal-time)/i;
  if (Array.isArray(plan.warnings) && plan.warnings.some((w) => legacyViolationPattern.test(w))) {
    return false;
  }

  // An insufficient_recipes response has no scheduled meals and should not masquerade as a cached valid plan
  if (plan.validationStatus === 'insufficient_recipes') {
    return false;
  }

  const check = validateCompleteWeeklyPlan(plan.days, profile, dataset, {
    allowRelaxCookTime: Boolean(plan.relaxedByUser?.cookTime),
    allowShorterPlan: Boolean(plan.relaxedByUser?.shorterPlan),
  });

  return check.valid;
}

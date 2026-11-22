import type {
  ActivityLevel,
  CalorieConfig,
  Dish,
  HouseholdMember,
  PortionPreference,
  UlamWiseDataset,
} from '../types';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (1.2×)',
  light: 'Lightly active (1.375×)',
  moderate: 'Moderately active (1.55×)',
  active: 'Very active (1.725×)',
  very_active: 'Extremely active (1.9×)',
};

export const PORTION_MULTIPLIERS: Record<PortionPreference, number> = {
  small: 0.8,
  regular: 1.0,
  large: 1.25,
};

export interface CalorieEstimateResult {
  bmr: number | null;
  tdee: number;
  dailyTargetKcal: number;
  isMinor: boolean;
  isRestrictiveWarning: boolean;
  warningMessage?: string;
  minorGuidanceMessage?: string;
}

/**
 * Returns a gentle general energy estimate for minors (<18) when no manual target is entered.
 * Adult Mifflin-St Jeor is NEVER applied to household members under 18.
 */
export function getMinorReferenceKcal(age: number): number {
  if (age <= 3) return 1100;
  if (age <= 6) return 1350;
  if (age <= 10) return 1600;
  if (age <= 13) return 1850;
  return 2100;
}

/**
 * Calculates BMR using the Mifflin-St Jeor equation for adults (18+),
 * applies the selected activity multiplier to estimate TDEE, and applies the goal adjustment.
 * For members under 18, skips adult Mifflin-St Jeor and returns age-appropriate guidance.
 */
export function calculateCalorieTarget(config: CalorieConfig): CalorieEstimateResult {
  const age = Number.isFinite(config.age) ? config.age : 30;
  const isMinor = age < 18;

  if (isMinor) {
    const manual =
      config.mode === 'manual' && config.manualTargetKcal >= 700
        ? Math.round(config.manualTargetKcal)
        : getMinorReferenceKcal(age);
    const minMinorSafe = age <= 3 ? 900 : age <= 10 ? 1100 : 1300;
    const restrictive = manual < minMinorSafe;
    return {
      bmr: null,
      tdee: manual,
      dailyTargetKcal: manual,
      isMinor: true,
      isRestrictiveWarning: restrictive,
      minorGuidanceMessage:
        'Adult Mifflin-St Jeor equations do not apply to children and teens under 18. Growing energy needs vary widely — use a pediatrician or nutritionist-guided manual target if available.',
      warningMessage: restrictive
        ? `Target (${manual} kcal/day) may be too low for a growing ${age}-year-old. Please consult a pediatrician or registered nutritionist-dietitian.`
        : undefined,
    };
  }

  if (config.mode === 'manual') {
    const manual = Math.max(800, Math.round(config.manualTargetKcal || 2000));
    const restrictive = manual < 1200;
    return {
      bmr: null,
      tdee: manual,
      dailyTargetKcal: manual,
      isMinor: false,
      isRestrictiveWarning: restrictive,
      warningMessage: restrictive
        ? 'Targets below 1,200 kcal/day may be overly restrictive. Please consult a registered nutritionist-dietitian.'
        : undefined,
    };
  }

  const w = Math.max(30, config.weightKg || 60);
  const h = Math.max(110, config.heightCm || 165);
  const a = Math.max(18, age);

  let bmr: number;
  if (config.sex === 'male') {
    bmr = 10 * w + 6.25 * h - 5 * a + 5;
  } else if (config.sex === 'female') {
    bmr = 10 * w + 6.25 * h - 5 * a - 161;
  } else {
    // Midpoint between male (+5) and female (-161) Mifflin-St Jeor equations
    bmr = 10 * w + 6.25 * h - 5 * a - 78;
  }

  const mult = ACTIVITY_MULTIPLIERS[config.activityLevel] ?? 1.375;
  const tdee = bmr * mult;

  const adjustment = Number.isFinite(config.goalAdjustmentKcal)
    ? config.goalAdjustmentKcal
    : config.goal === 'lose'
    ? -350
    : config.goal === 'gain'
    ? 300
    : 0;

  const target = Math.max(1000, Math.round(tdee + adjustment));
  const minSafe = config.sex === 'male' ? 1500 : 1200;
  const isRestrictiveWarning = target < minSafe || adjustment < -750;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    dailyTargetKcal: target,
    isMinor: false,
    isRestrictiveWarning,
    warningMessage: isRestrictiveWarning
      ? `Estimated target (${target} kcal/day) is quite low relative to typical adult energy needs. Consider a gentler deficit or consult a registered nutritionist-dietitian.`
      : undefined,
  };
}

/**
 * Calculates an individual household member's daily estimated calorie target independently.
 */
export function calculateMemberCalorieTarget(member: HouseholdMember): CalorieEstimateResult {
  return calculateCalorieTarget({
    mode: member.age < 18 ? 'manual' : member.calorieMode,
    age: member.age,
    sex: member.sex,
    heightCm: member.heightCm,
    weightKg: member.weightKg,
    activityLevel: member.activityLevel,
    goal: member.goal,
    goalAdjustmentKcal: member.goalAdjustmentKcal,
    manualTargetKcal: member.manualTargetKcal,
  });
}

/**
 * Computes a single household member's effective serving portion factor,
 * combining age-based energy proportion and configurable portion preference (small/regular/large).
 */
export function getMemberPortionFactor(member: HouseholdMember): number {
  const age = Number.isFinite(member.age) ? member.age : 28;
  let ageBase = 1.0;
  if (age <= 3) ageBase = 0.45;
  else if (age <= 10) ageBase = 0.7;
  else if (age <= 17) ageBase = 0.9;
  else if (age >= 65) ageBase = 0.85;

  const prefMult = PORTION_MULTIPLIERS[member.portionPreference ?? 'regular'] ?? 1.0;
  return Number(Math.max(0.35, ageBase * prefMult).toFixed(2));
}

/**
 * Converts a list of household members into an effective adult-equivalent serving count.
 */
export function calculateHouseholdServings(members: HouseholdMember[]): number {
  if (!members || members.length === 0) return 1;
  const total = members.reduce((sum, m) => sum + getMemberPortionFactor(m), 0);
  return Math.max(0.5, Number(total.toFixed(2)));
}

export interface DishNutritionEstimate {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: 'dataset_dish' | 'dataset_ingredients';
}

/**
 * Prefers trusted nutritional values in dishes.csv; falls back to summing ingredients.csv
 * according to each ingredient's nutrition_basis (per_100g, per_100ml, per_piece).
 */
export function getDishNutritionPerServing(
  dish: Dish,
  dataset: UlamWiseDataset
): DishNutritionEstimate {
  if (
    dish.kcal_per_serving !== null &&
    dish.protein_g !== null &&
    dish.carbs_g !== null &&
    dish.fat_g !== null
  ) {
    return {
      kcal: Math.round(dish.kcal_per_serving),
      protein_g: Number(dish.protein_g.toFixed(1)),
      carbs_g: Number(dish.carbs_g.toFixed(1)),
      fat_g: Number(dish.fat_g.toFixed(1)),
      source: 'dataset_dish',
    };
  }

  const rows = dataset.dishIngredientsByDishId.get(dish.dish_id) ?? [];
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  for (const row of rows) {
    const ing = dataset.ingredientsById.get(row.ingredient_id);
    if (!ing) continue;
    const factor =
      ing.nutrition_basis === 'per_piece'
        ? row.qty_for_base_servings
        : row.qty_for_base_servings / 100;
    kcal += ing.kcal * factor;
    protein += ing.protein_g * factor;
    carbs += ing.carbs_g * factor;
    fat += ing.fat_g * factor;
  }

  const base = Math.max(1, dish.base_servings);
  return {
    kcal: Math.round(kcal / base),
    protein_g: Number((protein / base).toFixed(1)),
    carbs_g: Number((carbs / base).toFixed(1)),
    fat_g: Number((fat / base).toFixed(1)),
    source: 'dataset_ingredients',
  };
}

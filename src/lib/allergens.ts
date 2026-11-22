import type {
  AllergenId,
  CookTimeMode,
  DietaryConflict,
  DietaryPrefCategory,
  DietaryPrefId,
  Dish,
  EquipmentId,
  Ingredient,
  MealSlot,
  UlamWiseDataset,
  UserProfile,
} from '../types';

export const ALLERGEN_LIST: Array<{
  id: AllergenId;
  labelEn: string;
  labelFil: string;
  examples: string;
}> = [
  { id: 'shellfish', labelEn: 'Shellfish', labelFil: 'Lamang-dagat (Shellfish)', examples: 'hipon, alimango, alimasag, pusit, bagoong alamang' },
  { id: 'fish', labelEn: 'Fish', labelFil: 'Isda', examples: 'bangus, tilapia, galunggong, patis, bagoong isda' },
  { id: 'egg', labelEn: 'Eggs', labelFil: 'Itlog', examples: 'itlog, salted egg, miki noodles, mayo' },
  { id: 'milk', labelEn: 'Milk & Dairy', labelFil: 'Gatas at Keso', examples: 'evaporada, condensada, keso, butter' },
  { id: 'peanut', labelEn: 'Peanuts', labelFil: 'Mani', examples: 'mani, peanut butter, kare-kare' },
  { id: 'tree_nut', labelEn: 'Tree Nuts', labelFil: 'Tree Nuts', examples: 'pili, kasoy, almond, cashew' },
  { id: 'soy', labelEn: 'Soy', labelFil: 'Soya / Toyo', examples: 'toyo, tokwa, taho, tausi, liquid seasoning' },
  { id: 'wheat', labelEn: 'Wheat & Gluten', labelFil: 'Trigo at Gluten', examples: 'harina, pandesal, pancit canton, pasta, toyo' },
];

export interface DietaryPrefDefinition {
  id: DietaryPrefId;
  category: DietaryPrefCategory;
  labelEn: string;
  labelFil: string;
  description?: string;
}

export const DIETARY_PREFS_LIST: DietaryPrefDefinition[] = [
  // Eating styles
  { id: 'halal', category: 'eating_style', labelEn: 'Halal', labelFil: 'Halal (Walang baboy)' },
  { id: 'vegetarian', category: 'eating_style', labelEn: 'Vegetarian', labelFil: 'Vegetarian' },
  { id: 'vegan', category: 'eating_style', labelEn: 'Vegan', labelFil: 'Vegan (Walang animal products)' },
  { id: 'plant_based', category: 'eating_style', labelEn: 'Plant-based', labelFil: 'Plant-based (Gulay at tokwa)' },
  { id: 'pescatarian', category: 'eating_style', labelEn: 'Pescatarian', labelFil: 'Pescatarian (Isda at gulay)' },
  { id: 'low_carb', category: 'eating_style', labelEn: 'Low-carb', labelFil: 'Low-carb (<=25g carbs/srv)' },
  { id: 'keto', category: 'eating_style', labelEn: 'Keto', labelFil: 'Keto (Strict carb target)' },
  { id: 'gluten_free', category: 'eating_style', labelEn: 'Gluten-free', labelFil: 'Gluten-free (Walang trigo)' },
  { id: 'dairy_free', category: 'eating_style', labelEn: 'Dairy-free', labelFil: 'Dairy-free (Walang gatas/keso)' },
  // Nutrition goals
  { id: 'diabetic_friendly', category: 'nutrition_goal', labelEn: 'Diabetic-friendly', labelFil: 'Diabetic-friendly (Mababa sa asukal)' },
  { id: 'low_sodium', category: 'nutrition_goal', labelEn: 'Low-sodium', labelFil: 'Low-sodium (Mababa sa alat)' },
  { id: 'high_protein', category: 'nutrition_goal', labelEn: 'High-protein', labelFil: 'High-protein (>=18g/srv)' },
  { id: 'low_fat', category: 'nutrition_goal', labelEn: 'Low-fat', labelFil: 'Low-fat (<=12g/srv)' },
  { id: 'high_fiber', category: 'nutrition_goal', labelEn: 'High-fiber', labelFil: 'High-fiber (Gulay at butil)' },
  { id: 'reduced_added_sugar', category: 'nutrition_goal', labelEn: 'Reduced added sugar', labelFil: 'Bawas dagdag na asukal' },
  { id: 'calorie_conscious', category: 'nutrition_goal', labelEn: 'Calorie-conscious', labelFil: 'Calorie-conscious (<=360 kcal/srv)' },
  // Food exclusions
  { id: 'no_pork', category: 'food_exclusion', labelEn: 'No pork', labelFil: 'Walang baboy' },
  { id: 'no_beef', category: 'food_exclusion', labelEn: 'No beef', labelFil: 'Walang baka' },
  { id: 'no_seafood', category: 'food_exclusion', labelEn: 'No seafood', labelFil: 'Walang isda at seafood' },
  { id: 'no_spicy', category: 'food_exclusion', labelEn: 'No spicy food', labelFil: 'Hindi maanghang' },
  { id: 'no_processed_meat', category: 'food_exclusion', labelEn: 'No processed meat', labelFil: 'Walang processed meat' },
];

export const DIETARY_CATEGORY_LABELS: Record<DietaryPrefCategory, { en: string; fil: string }> = {
  eating_style: { en: 'Eating Styles & Dietary Restrictions', fil: 'Uri ng Pagkain / Diet' },
  nutrition_goal: { en: 'Nutrition Goals', fil: 'Mga Layunin sa Nutrisyon' },
  food_exclusion: { en: 'Food Exclusions', fil: 'Mga Iniiwasang Pagkain' },
};

export function detectDietaryConflicts(prefs: DietaryPrefId[]): DietaryConflict[] {
  const set = new Set(prefs);
  const conflicts: DietaryConflict[] = [];

  if (set.has('vegan') && set.has('pescatarian')) {
    conflicts.push({
      severity: 'conflict',
      prefs: ['vegan', 'pescatarian'],
      message: 'Vegan excludes fish and seafood, while Pescatarian includes fish. Choose one eating style.',
    });
  }
  if (set.has('vegetarian') && set.has('pescatarian')) {
    conflicts.push({
      severity: 'conflict',
      prefs: ['vegetarian', 'pescatarian'],
      message: 'Vegetarian excludes fish, while Pescatarian includes fish. Choose one eating style.',
    });
  }
  if (set.has('pescatarian') && set.has('no_seafood')) {
    conflicts.push({
      severity: 'conflict',
      prefs: ['pescatarian', 'no_seafood'],
      message: 'Pescatarian relies on fish/seafood, which conflicts with No seafood. Consider Vegetarian or Plant-based instead.',
    });
  }
  if (set.has('keto') && set.has('low_fat')) {
    conflicts.push({
      severity: 'warning',
      prefs: ['keto', 'low_fat'],
      message: 'Keto and Low-fat together severely restrict both carbs and fat, leaving very few everyday Filipino dishes.',
    });
  }
  if (set.has('keto') && set.has('vegan')) {
    conflicts.push({
      severity: 'warning',
      prefs: ['keto', 'vegan'],
      message: 'Keto + Vegan leaves a very small pool of Filipino dishes (most vegan dishes rely on beans/vegetables with higher carbs).',
    });
  }
  if (set.has('keto') && set.has('high_fiber')) {
    conflicts.push({
      severity: 'warning',
      prefs: ['keto', 'high_fiber'],
      message: 'Strict Keto + High-fiber narrows recipes mainly to leafy greens paired with meat, fish, or tokwa.',
    });
  }
  if (set.has('halal') && set.has('no_pork')) {
    // Compatible (redundant), no conflict needed
  }
  return conflicts;
}

export const ALLERGEN_SAFETY_DISCLAIMER =
  'Always check product packaging and ingredient labels. Ingredient substitutions and food preparation may introduce cross-contact risks.';

export interface AllergenCheckResult {
  safe: boolean;
  definiteAllergens: string[];
  possibleAllergens: string[];
  conflictingAllergens: string[];
  matchedKeywords: string[];
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function containsWholePhrase(haystack: string, keyword: string): boolean {
  if (!keyword) return false;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i');
  return re.test(haystack);
}

/**
 * Deterministically inspects an individual ingredient against both its canonical allergen fields
 * and all 153 keyword aliases in hidden_allergens.csv.
 */
export function inspectIngredientAllergens(
  ingredient: Ingredient,
  dataset: UlamWiseDataset
): { definite: Set<string>; possible: Set<string>; matchedKeywords: string[] } {
  const definite = new Set<string>(ingredient.allergens.map((a) => a.toLowerCase()));
  const possible = new Set<string>(ingredient.may_contain.map((a) => a.toLowerCase()));
  const matchedKeywords: string[] = [];

  const text = normalizeText(
    `${ingredient.ingredient_id.replace(/_/g, ' ')} ${ingredient.name_en} ${ingredient.name_fil} ${ingredient.notes}`
  );

  for (const ha of dataset.hiddenAllergens) {
    if (containsWholePhrase(text, normalizeText(ha.keyword))) {
      matchedKeywords.push(ha.keyword);
      if (ha.confidence === 'definite') {
        definite.add(ha.allergen);
      } else {
        possible.add(ha.allergen);
      }
    }
  }

  return { definite, possible, matchedKeywords };
}

/**
 * Deterministic dish allergen validation using:
 * 1. dishes.csv allergens_strict / may_contain_strict / allergens_core / may_contain_core
 * 2. Every canonical dish_ingredients.csv entry -> ingredients.csv allergens & may_contain
 * 3. All 153 keyword rules in hidden_allergens.csv across dish names, method hints, and ingredients
 *
 * Conservative safety policy: if ANY selected user allergy appears as either definite OR possible
 * (may_contain / hidden alias), the dish is rejected.
 */
const dishAllergenCache = new WeakMap<
  UlamWiseDataset,
  Map<string, { definite: string[]; possible: string[]; matchedKeywords: string[] }>
>();

function getDishAllergenProfile(
  dish: Dish,
  dataset: UlamWiseDataset
): { definite: string[]; possible: string[]; matchedKeywords: string[] } {
  let perDataset = dishAllergenCache.get(dataset);
  if (!perDataset) {
    perDataset = new Map();
    dishAllergenCache.set(dataset, perDataset);
  }
  const cached = perDataset.get(dish.dish_id);
  if (cached) return cached;

  const definite = new Set<string>([
    ...dish.allergens_strict.map((a) => a.toLowerCase()),
    ...dish.allergens_core.map((a) => a.toLowerCase()),
  ]);
  const possible = new Set<string>([
    ...dish.may_contain_strict.map((a) => a.toLowerCase()),
    ...dish.may_contain_core.map((a) => a.toLowerCase()),
  ]);
  const matchedKeywords = new Set<string>();

  const rows = dataset.dishIngredientsByDishId.get(dish.dish_id) ?? [];
  for (const row of rows) {
    const ing = dataset.ingredientsById.get(row.ingredient_id);
    if (ing) {
      const res = inspectIngredientAllergens(ing, dataset);
      res.definite.forEach((a) => definite.add(a));
      res.possible.forEach((a) => possible.add(a));
      res.matchedKeywords.forEach((k) => matchedKeywords.add(k));
    } else {
      const rowText = normalizeText(`${row.ingredient_id.replace(/_/g, ' ')} ${row.ingredient_name}`);
      for (const ha of dataset.hiddenAllergens) {
        if (containsWholePhrase(rowText, normalizeText(ha.keyword))) {
          matchedKeywords.add(ha.keyword);
          if (ha.confidence === 'definite') definite.add(ha.allergen);
          else possible.add(ha.allergen);
        }
      }
    }
  }

  const dishText = normalizeText(`${dish.name_en} ${dish.name_local} ${dish.method_hint}`);
  for (const ha of dataset.hiddenAllergens) {
    if (containsWholePhrase(dishText, normalizeText(ha.keyword))) {
      matchedKeywords.add(ha.keyword);
      if (ha.confidence === 'definite') definite.add(ha.allergen);
      else possible.add(ha.allergen);
    }
  }

  for (const d of definite) {
    possible.delete(d);
  }

  const result = {
    definite: Array.from(definite).sort(),
    possible: Array.from(possible).sort(),
    matchedKeywords: Array.from(matchedKeywords),
  };
  perDataset.set(dish.dish_id, result);
  return result;
}

export function checkDishAllergens(
  dish: Dish,
  selectedAllergies: AllergenId[],
  dataset: UlamWiseDataset
): AllergenCheckResult {
  const profile = getDishAllergenProfile(dish, dataset);
  const definiteSet = new Set(profile.definite);
  const possibleSet = new Set(profile.possible);

  const conflictingAllergens: string[] = [];
  for (const allergy of selectedAllergies) {
    const key = allergy.toLowerCase();
    if (definiteSet.has(key) || possibleSet.has(key)) {
      conflictingAllergens.push(key);
    }
  }

  return {
    safe: conflictingAllergens.length === 0,
    definiteAllergens: profile.definite,
    possibleAllergens: profile.possible,
    conflictingAllergens,
    matchedKeywords: profile.matchedKeywords,
  };
}

export interface DishIngredientNutritionProfile {
  kcalPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  estimatedFiberPerServing: number;
  addedSugarPerServing: number;
  containsPork: boolean;
  containsBeef: boolean;
  containsMeatOrPoultry: boolean;
  containsSeafood: boolean;
  containsAnimalProduct: boolean;
  containsSpicy: boolean;
  containsProcessedMeat: boolean;
  containsStarchOrNoodleMain: boolean;
  containsKetoDisallowedIngredient: boolean;
}

const PORK_INGREDIENT_IDS = new Set([
  'pork_belly',
  'pork_shoulder',
  'pork_ribs',
  'pork_ground',
  'pork_pata',
  'pork_blood',
  'pork_liver',
  'tocino',
  'longganisa',
  'chicharon',
  'luncheon_meat',
  'hotdog',
]);

const BEEF_INGREDIENT_IDS = new Set([
  'beef_brisket',
  'beef_sirloin',
  'beef_shank',
  'beef_ground',
  'corned_beef',
]);

const POULTRY_INGREDIENT_IDS = new Set([
  'chicken_cutup',
  'chicken_breast',
  'chicken_thigh',
  'chicken_wings',
]);

const PROCESSED_MEAT_IDS = new Set([
  'hotdog',
  'tocino',
  'longganisa',
  'corned_beef',
  'luncheon_meat',
  'chicharon',
  'liver_spread',
]);

const SPICY_INGREDIENT_IDS = new Set(['siling_labuyo', 'green_chili', 'chili_flakes']);

const ADDED_SUGAR_INGREDIENT_IDS = new Set([
  'sugar_white',
  'sugar_brown',
  'condensed_milk',
  'banana_ketchup',
]);

const STARCH_NOODLE_MAIN_IDS = new Set([
  'rice_raw',
  'rice_cooked',
  'malagkit',
  'bihon',
  'pancit_canton',
  'sotanghon',
  'misua',
  'miki',
  'macaroni',
  'spaghetti',
  'pandesal',
  'flour',
]);

const KETO_DISALLOWED_STARCH_IDS = new Set([
  ...STARCH_NOODLE_MAIN_IDS,
  'potato',
  'kamote',
  'gabi',
  'cornstarch',
  'saging_saba',
  'banana_lakatan',
  'sugar_white',
  'sugar_brown',
  'condensed_milk',
  'banana_ketchup',
  'monggo',
  'kadyos',
  'sweet_corn',
]);

// Conservative USDA/FNRI-aligned fiber per 100g estimates for common Filipino produce & legumes
const FIBER_PER_100G_ESTIMATE: Record<string, number> = {
  monggo: 16.3,
  kadyos: 15.0,
  malunggay: 2.0,
  kangkong: 2.1,
  pechay: 1.5,
  pechay_baguio: 1.2,
  repolyo: 2.5,
  sitaw: 3.4,
  baguio_beans: 2.7,
  talong: 3.0,
  okra: 3.2,
  ampalaya: 2.8,
  kalabasa: 1.5,
  sayote: 1.7,
  upo: 1.2,
  patola: 1.5,
  labanos: 1.6,
  carrot: 2.8,
  potato: 2.2,
  kamote: 3.0,
  togue: 1.8,
  papaya_hilaw: 1.8,
  langka_hilaw: 1.5,
  dahon_gabi: 4.1,
  gabi: 4.1,
  saging_saba: 2.6,
  tomato: 1.2,
  onion: 1.7,
  tokwa: 1.0,
  sweet_corn: 2.4,
  peanut_butter: 6.0,
};

const dishNutritionCache = new WeakMap<
  UlamWiseDataset,
  Map<string, DishIngredientNutritionProfile>
>();

/**
 * Deterministically computes per-serving nutrition and ingredient-level dietary flags
 * directly from actual dish_ingredients.csv quantities and ingredients.csv nutrient baselines.
 */
export function computeDishIngredientNutrition(
  dish: Dish,
  dataset: UlamWiseDataset
): DishIngredientNutritionProfile {
  let perDataset = dishNutritionCache.get(dataset);
  if (!perDataset) {
    perDataset = new Map();
    dishNutritionCache.set(dataset, perDataset);
  }
  const cached = perDataset.get(dish.dish_id);
  if (cached) return cached;

  const rows = dataset.dishIngredientsByDishId.get(dish.dish_id) ?? [];
  const baseServings = Math.max(1, dish.base_servings || 1);

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;
  let totalAddedSugar = 0;

  const hasRows = rows.length > 0;
  let containsPork = !hasRows && dish.main_protein === 'pork';
  let containsBeef = !hasRows && dish.main_protein === 'beef';
  let containsMeatOrPoultry =
    !hasRows &&
    (dish.main_protein === 'pork' ||
      dish.main_protein === 'beef' ||
      dish.main_protein === 'chicken');
  let containsSeafood =
    !hasRows && (dish.main_protein === 'fish' || dish.main_protein === 'seafood');
  let containsAnimalProduct =
    containsMeatOrPoultry || containsSeafood || (!hasRows && dish.main_protein === 'egg');
  let containsSpicy = dish.tags.includes('spicy');
  let containsProcessedMeat = false;
  let containsStarchOrNoodleMain = false;
  let containsKetoDisallowedIngredient = false;

  for (const row of rows) {
    const ing = dataset.ingredientsById.get(row.ingredient_id);
    if (!ing) continue;

    const isOptional =
      row.role === 'optional' || dish.optional_ingredient_ids.includes(ing.ingredient_id);

    const factor =
      ing.nutrition_basis === 'per_piece'
        ? row.qty_for_base_servings
        : row.qty_for_base_servings / 100;

    totalKcal += ing.kcal * factor;
    totalProtein += ing.protein_g * factor;
    totalCarbs += ing.carbs_g * factor;
    totalFat += ing.fat_g * factor;

    const fiberPer100 =
      FIBER_PER_100G_ESTIMATE[ing.ingredient_id] ??
      (ing.grocery_section === 'Gulay' || ing.grocery_section === 'Prutas' ? 1.8 : 0);
    if (fiberPer100 > 0) {
      const weightG = ing.base_unit === 'pc' ? row.qty_for_base_servings * 80 : row.qty_for_base_servings;
      totalFiber += (weightG / 100) * fiberPer100;
    }

    if (ADDED_SUGAR_INGREDIENT_IDS.has(ing.ingredient_id)) {
      const sugarRatio =
        ing.ingredient_id === 'sugar_white' || ing.ingredient_id === 'sugar_brown'
          ? 1.0
          : ing.ingredient_id === 'condensed_milk'
          ? 0.54
          : 0.25;
      totalAddedSugar += row.qty_for_base_servings * sugarRatio;
    }

    // Optional garnishes (e.g., optional tuyo on champorado, optional pork/chicharon in monggo)
    // do not disqualify core-vegetarian / dietary-style dishes; allergen checks still inspect ALL rows.
    if (!isOptional) {
      if (PORK_INGREDIENT_IDS.has(ing.ingredient_id) || ing.diet_flags.includes('pork')) {
        containsPork = true;
        containsMeatOrPoultry = true;
        containsAnimalProduct = true;
      }
      if (BEEF_INGREDIENT_IDS.has(ing.ingredient_id) || ing.diet_flags.includes('beef')) {
        containsBeef = true;
        containsMeatOrPoultry = true;
        containsAnimalProduct = true;
      }
      if (
        POULTRY_INGREDIENT_IDS.has(ing.ingredient_id) ||
        ing.diet_flags.includes('chicken') ||
        ing.diet_flags.includes('poultry')
      ) {
        containsMeatOrPoultry = true;
        containsAnimalProduct = true;
      }
      if (
        ing.grocery_section === 'Isda at Seafood' ||
        ing.allergens.includes('fish') ||
        ing.allergens.includes('shellfish')
      ) {
        containsSeafood = true;
        containsAnimalProduct = true;
      }
      if (
        ing.allergens.includes('egg') ||
        ing.allergens.includes('milk') ||
        ing.ingredient_id === 'egg' ||
        ing.ingredient_id === 'salted_egg'
      ) {
        containsAnimalProduct = true;
      }
      if (SPICY_INGREDIENT_IDS.has(ing.ingredient_id)) {
        containsSpicy = true;
      }
      if (PROCESSED_MEAT_IDS.has(ing.ingredient_id)) {
        containsProcessedMeat = true;
      }
    }
    if (STARCH_NOODLE_MAIN_IDS.has(ing.ingredient_id) && row.qty_for_base_servings / baseServings >= 25) {
      containsStarchOrNoodleMain = true;
    }
    if (
      KETO_DISALLOWED_STARCH_IDS.has(ing.ingredient_id) &&
      row.qty_for_base_servings / baseServings >= 8
    ) {
      containsKetoDisallowedIngredient = true;
    }
  }

  // Fallback to dish-level fields only if ingredient rows were absent
  const profile: DishIngredientNutritionProfile = {
    kcalPerServing:
      rows.length > 0 ? Math.round(totalKcal / baseServings) : dish.kcal_per_serving ?? 0,
    proteinPerServing:
      rows.length > 0
        ? Math.round((totalProtein / baseServings) * 10) / 10
        : dish.protein_g ?? 0,
    carbsPerServing:
      rows.length > 0 ? Math.round((totalCarbs / baseServings) * 10) / 10 : dish.carbs_g ?? 0,
    fatPerServing:
      rows.length > 0 ? Math.round((totalFat / baseServings) * 10) / 10 : dish.fat_g ?? 0,
    estimatedFiberPerServing: Math.round((totalFiber / baseServings) * 10) / 10,
    addedSugarPerServing: Math.round((totalAddedSugar / baseServings) * 10) / 10,
    containsPork,
    containsBeef,
    containsMeatOrPoultry,
    containsSeafood,
    containsAnimalProduct,
    containsSpicy,
    containsProcessedMeat,
    containsStarchOrNoodleMain,
    containsKetoDisallowedIngredient,
  };

  perDataset.set(dish.dish_id, profile);
  return profile;
}

/**
 * Checks dietary restrictions, eating styles, nutrition goals, food exclusions, and dislikes
 * independently of allergen validation using actual ingredient quantities.
 */
export function checkDishDietaryEligibility(
  dish: Dish,
  dietaryPrefs: DietaryPrefId[],
  dislikes: string[],
  dataset: UlamWiseDataset,
  options?: { ketoMaxCarbsPerDayG?: number }
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const nut = computeDishIngredientNutrition(dish, dataset);
  const ketoDailyCap = Math.max(10, Math.min(60, options?.ketoMaxCarbsPerDayG ?? 25));
  // Per-meal keto net-carb ceiling scales directly with user's configured daily keto target (strictly tighter than low_carb)
  const ketoMealMaxCarbs = Math.max(4, Math.round((ketoDailyCap / 2.5) * 10) / 10);

  for (const pref of dietaryPrefs) {
    switch (pref) {
      case 'halal':
        if (!dish.halal_friendly || nut.containsPork) reasons.push('Not Halal-friendly');
        break;
      case 'vegetarian':
        if (!dish.vegetarian_ok || nut.containsMeatOrPoultry || nut.containsSeafood) {
          reasons.push('Not Vegetarian');
        }
        break;
      case 'vegan':
        if (!dish.vegan_ok || nut.containsAnimalProduct) {
          reasons.push('Not Vegan');
        }
        break;
      case 'plant_based':
        if (nut.containsMeatOrPoultry || nut.containsSeafood || nut.containsProcessedMeat) {
          reasons.push('Not Plant-based (contains meat or seafood)');
        }
        break;
      case 'pescatarian':
        if (!dish.pescatarian_ok || nut.containsMeatOrPoultry) {
          reasons.push('Not Pescatarian');
        }
        break;
      case 'gluten_free': {
        const wheatCheck = checkDishAllergens(dish, ['wheat'], dataset);
        if (!wheatCheck.safe) reasons.push('Contains wheat/gluten');
        break;
      }
      case 'dairy_free': {
        const milkCheck = checkDishAllergens(dish, ['milk'], dataset);
        if (!milkCheck.safe) reasons.push('Contains milk/dairy');
        break;
      }
      case 'low_carb':
        if (nut.carbsPerServing > 25 || nut.containsStarchOrNoodleMain || dish.high_sugar) {
          reasons.push(`Exceeds low-carb limit (${nut.carbsPerServing}g carbs/srv)`);
        }
        break;
      case 'keto': {
        const netCarbs = Math.max(0, Math.round((nut.carbsPerServing - nut.estimatedFiberPerServing) * 10) / 10);
        if (
          netCarbs > ketoMealMaxCarbs ||
          nut.containsKetoDisallowedIngredient ||
          dish.high_sugar ||
          nut.proteinPerServing + nut.fatPerServing < 12
        ) {
          reasons.push(
            `Exceeds Keto carb target (~${netCarbs}g net carbs/srv vs ${ketoMealMaxCarbs}g meal cap for ${ketoDailyCap}g/day)`
          );
        }
        break;
      }
      case 'diabetic_friendly':
        if (dish.high_sugar || nut.addedSugarPerServing > 6) {
          reasons.push('High sugar (not diabetic-friendly)');
        }
        break;
      case 'low_sodium':
        if (dish.high_sodium) reasons.push('High sodium');
        break;
      case 'high_protein': {
        const proteinCalRatio =
          nut.kcalPerServing > 0 ? (nut.proteinPerServing * 4) / nut.kcalPerServing : 0;
        if (nut.proteinPerServing < 18 && proteinCalRatio < 0.24) {
          reasons.push(`Below high-protein target (${nut.proteinPerServing}g/srv)`);
        }
        break;
      }
      case 'low_fat':
        if (nut.fatPerServing > 12) {
          reasons.push(`Exceeds low-fat limit (${nut.fatPerServing}g fat/srv)`);
        }
        break;
      case 'high_fiber':
        if (nut.estimatedFiberPerServing < 3.0) {
          reasons.push(`Below high-fiber target (~${nut.estimatedFiberPerServing}g fiber/srv)`);
        }
        break;
      case 'reduced_added_sugar':
        if (dish.high_sugar || nut.addedSugarPerServing > 3) {
          reasons.push(`Contains added sugar (~${nut.addedSugarPerServing}g/srv)`);
        }
        break;
      case 'calorie_conscious':
        if (nut.kcalPerServing > 360) {
          reasons.push(`Above calorie-conscious limit (${nut.kcalPerServing} kcal/srv)`);
        }
        break;
      case 'no_pork':
        if (nut.containsPork || !dish.halal_friendly) reasons.push('Contains pork');
        break;
      case 'no_beef':
        if (nut.containsBeef) reasons.push('Contains beef');
        break;
      case 'no_seafood':
        if (nut.containsSeafood) reasons.push('Contains fish or seafood');
        break;
      case 'no_spicy':
        if (nut.containsSpicy) reasons.push('Contains chili / spicy ingredients');
        break;
      case 'no_processed_meat':
        if (nut.containsProcessedMeat) reasons.push('Contains processed meat');
        break;
    }
  }

  if (dislikes.length > 0) {
    const ingRows = dataset.dishIngredientsByDishId.get(dish.dish_id) ?? [];
    const searchable = normalizeText(
      [
        dish.name_en,
        dish.name_local,
        dish.main_protein,
        ...ingRows.map((r) => {
          const ing = dataset.ingredientsById.get(r.ingredient_id);
          return `${r.ingredient_name} ${ing?.name_en ?? ''} ${ing?.name_fil ?? ''}`;
        }),
      ].join(' ')
    );
    for (const rawDislike of dislikes) {
      const term = normalizeText(rawDislike);
      if (term.length >= 2 && containsWholePhrase(searchable, term)) {
        reasons.push(`Contains disliked item "${rawDislike}"`);
      }
    }
  }

  return { eligible: reasons.length === 0, reasons };
}

/**
 * Checks whether a user's kitchen equipment can cook the dish.
 */
export function checkDishEquipmentEligibility(
  dish: Dish,
  userEquipment: EquipmentId[]
): boolean {
  if (!userEquipment || userEquipment.length === 0) return true;
  if (dish.equipment.length === 0 || dish.equipment.includes('none')) return true;

  const hasAnyStove =
    userEquipment.includes('gas_stove') || userEquipment.includes('one_burner_stove');
  const hasAirFryOrRoast =
    userEquipment.includes('air_fryer') ||
    userEquipment.includes('turbo_broiler') ||
    userEquipment.includes('oven');

  for (const req of dish.equipment) {
    if (req === 'stove') {
      // One-burner stove or gas stove handles stove recipes; rice cooker can handle simple soups/porridge
      if (hasAnyStove) return true;
      if (
        userEquipment.includes('rice_cooker') &&
        (dish.method === 'porridge' || dish.method === 'soup' || dish.tags.includes('one_burner_ok'))
      ) {
        return true;
      }
    } else if (req === 'air_fryer') {
      // Air-fryer dishes like bagnet/inasal/inihaw can also be done on stove/grill/oven/turbo broiler
      if (hasAirFryOrRoast || hasAnyStove) return true;
    } else if (req === 'oven') {
      if (userEquipment.includes('oven') || userEquipment.includes('turbo_broiler')) return true;
    }
  }

  return false;
}

/**
 * Evaluates meal-slot suitability instead of rigid single-category silos:
 * - 'primary': explicitly tagged for the slot in dishes.csv
 * - 'suitable': culturally appropriate secondary slot (e.g., Lunch <-> Dinner ulam/pancit/sinigang/tokwa/canned fish,
 *   or quick savory egg/fish/canned/tokwa/porridge dishes for Breakfast)
 * - 'unsuitable': culturally inappropriate (e.g., sweet merienda snacks for Dinner, or slow 90m fiesta stews for Breakfast)
 */
const BREAKFAST_EXCLUDED_METHODS = new Set(['stew', 'grill+chop', 'raw-cure']);
const BREAKFAST_EXCLUDED_IDS = new Set([
  'kare_kare',
  'bulalo',
  'dinuguan',
  'bagnet',
  'laing',
  'bicol_express',
  'humba',
  'kbl',
  'pochero',
  'paksiw_na_pata',
  'tiyula_itum',
  'beef_kaldereta',
  'pork_kaldereta',
  'beef_mechado',
  'kansi_ilonggo',
]);
const MERIENDA_SUITABLE_KEYWORDS = [
  'pancit',
  'lomi',
  'mami',
  'batchoy',
  'spaghetti',
  'sopas',
  'lugaw',
  'arroz_caldo',
  'champorado',
  'pandesal',
  'lumpia',
  'tokwat_baboy',
  'calamares',
  'palabok',
  'sotanghon',
];

export function getDishSlotSuitability(
  dish: Dish,
  slot: MealSlot
): 'primary' | 'suitable' | 'unsuitable' {
  if (dish.meal_types.includes(slot)) {
    return 'primary';
  }

  const protein = dish.main_protein.trim().toLowerCase();
  const isPureSnack = protein === 'snack';

  // Lunch <-> Dinner cross-suitability for all savory main dishes (ulam, pancit, soups, tokwa, canned fish)
  if (slot === 'L' || slot === 'D') {
    if (isPureSnack) return 'unsuitable';
    if (dish.meal_types.includes('L') || dish.meal_types.includes('D')) {
      return 'suitable';
    }
    // Hearty savory rice-paired breakfast viands (e.g., daing, corned beef, eggs, adobo, tinapa) also work for L/D
    if (dish.meal_types.includes('B') && dish.rice_pairing === 'yes' && protein !== 'grain') {
      return 'suitable';
    }
    return 'unsuitable';
  }

  // Breakfast suitability: quick savory everyday Filipino dishes (eggs, canned fish, tokwa, fried fish, stir-fries, porridge)
  if (slot === 'B') {
    if (isPureSnack) return 'unsuitable';
    if (BREAKFAST_EXCLUDED_IDS.has(dish.dish_id)) return 'unsuitable';
    if (dish.time_min <= 30 && !BREAKFAST_EXCLUDED_METHODS.has(dish.method)) {
      const isQuickSavory =
        protein === 'egg' ||
        dish.tags.includes('pantry_meal') ||
        dish.tags.includes('one_burner_ok') ||
        dish.method === 'pan-fry' ||
        dish.method === 'scramble' ||
        dish.method === 'fry' ||
        dish.method === 'porridge' ||
        dish.method === 'boil' ||
        dish.method === 'no-cook';
      if (isQuickSavory && !dish.tags.includes('party') && !dish.tags.includes('special')) {
        return 'suitable';
      }
    }
    return 'unsuitable';
  }

  // Merienda suitability: snacks, noodles, porridge, pandesal, finger foods
  if (slot === 'M') {
    if (isPureSnack) return 'suitable';
    const idAndName = `${dish.dish_id} ${dish.name_en}`.toLowerCase();
    if (MERIENDA_SUITABLE_KEYWORDS.some((kw) => idAndName.includes(kw))) {
      return 'suitable';
    }
    return 'unsuitable';
  }

  return 'unsuitable';
}

export function isDishSuitableForSlot(dish: Dish, slot: MealSlot): boolean {
  return getDishSlotSuitability(dish, slot) !== 'unsuitable';
}

/**
 * Checks whether a dish has complete canonical ingredient mappings in the dataset.
 */
export function hasCompleteCanonicalIngredients(
  dish: Dish,
  dataset: UlamWiseDataset
): boolean {
  const rows = dataset.dishIngredientsByDishId.get(dish.dish_id);
  if (!rows || rows.length === 0) return false;
  return rows.every((r) => dataset.ingredientsById.has(r.ingredient_id));
}

/**
 * Full deterministic eligibility check for a dish in a given meal slot given explicit constraints
 * (e.g. the combined union of allergies, dietary preferences, and dislikes across participating members).
 * Allergies and core dietary preferences are NEVER silently relaxed.
 */
export function isDishEligibleForConstraints(
  dish: Dish,
  slot: MealSlot,
  constraints: {
    allergies: AllergenId[];
    dietaryPrefs: DietaryPrefId[];
    dislikes: string[];
    ketoMaxCarbsPerDayG?: number;
  },
  equipment: EquipmentId[],
  maxCookTime: { B: number; L: number; D: number },
  dataset: UlamWiseDataset,
  options?: { relaxTime?: boolean; relaxLowSodium?: boolean; cookTimeMode?: CookTimeMode }
): { eligible: boolean; reasons: string[]; suitability: 'primary' | 'suitable' | 'unsuitable' } {
  const reasons: string[] = [];

  const suitability = getDishSlotSuitability(dish, slot);
  if (suitability === 'unsuitable') {
    reasons.push(`Not suitable for ${slot}`);
  }

  if (!hasCompleteCanonicalIngredients(dish, dataset)) {
    reasons.push('Missing canonical ingredient data');
  }

  // Allergies are NEVER relaxed
  const allergyCheck = checkDishAllergens(dish, constraints.allergies, dataset);
  if (!allergyCheck.safe) {
    reasons.push(`Allergen conflict: ${allergyCheck.conflictingAllergens.join(', ')}`);
  }

  const effectiveDietary = options?.relaxLowSodium
    ? constraints.dietaryPrefs.filter((d) => d !== 'low_sodium')
    : constraints.dietaryPrefs;
  const dietCheck = checkDishDietaryEligibility(
    dish,
    effectiveDietary,
    constraints.dislikes,
    dataset,
    { ketoMaxCarbsPerDayG: constraints.ketoMaxCarbsPerDayG }
  );
  if (!dietCheck.eligible) {
    reasons.push(...dietCheck.reasons);
  }

  if (!checkDishEquipmentEligibility(dish, equipment)) {
    reasons.push('Requires unavailable kitchen equipment');
  }

  // Cooking time is a preference by default ('flexible' or 'prefer_quick'); only 'strict' excludes slow dishes
  const cookTimeMode: CookTimeMode = options?.cookTimeMode ?? 'flexible';
  if (cookTimeMode === 'strict' && !options?.relaxTime && slot !== 'M') {
    const maxMin = maxCookTime[slot];
    if (maxMin && dish.time_min > maxMin) {
      reasons.push(`Cook time ${dish.time_min}m exceeds ${maxMin}m limit`);
    }
  }

  return { eligible: reasons.length === 0, reasons, suitability };
}

/**
 * Computes structured recipe exclusion diagnostics for a given slot and constraint set,
 * counting exactly how many recipes are excluded by each constraint category.
 */
export function computeRecipeExclusionDiagnostics(
  slot: MealSlot,
  constraints: {
    allergies: AllergenId[];
    dietaryPrefs: DietaryPrefId[];
    dislikes: string[];
    ketoMaxCarbsPerDayG?: number;
  },
  equipment: EquipmentId[],
  maxCookTime: { B: number; L: number; D: number },
  dataset: UlamWiseDataset,
  options?: { relaxTime?: boolean; cookTimeMode?: CookTimeMode }
): import('../types').RecipeExclusionDiagnostics {
  let eligibleCount = 0;
  let excludedByAllergy = 0;
  let excludedByDietary = 0;
  let excludedByDislike = 0;
  let excludedByCookTime = 0;
  let excludedByEquipment = 0;
  let excludedByMissingIngredients = 0;
  let excludedByMealSlot = 0;

  const cookTimeMode: CookTimeMode = options?.cookTimeMode ?? 'flexible';
  const enforceStrictTime = cookTimeMode === 'strict' && !options?.relaxTime;

  for (const dish of dataset.dishes) {
    const slotOk = isDishSuitableForSlot(dish, slot);
    const hasIngs = hasCompleteCanonicalIngredients(dish, dataset);
    const allergyOk = checkDishAllergens(dish, constraints.allergies, dataset).safe;
    const dietOnlyOk = checkDishDietaryEligibility(
      dish,
      constraints.dietaryPrefs,
      [],
      dataset,
      { ketoMaxCarbsPerDayG: constraints.ketoMaxCarbsPerDayG }
    ).eligible;
    const dislikeOk = checkDishDietaryEligibility(
      dish,
      [],
      constraints.dislikes,
      dataset
    ).eligible;
    const equipOk = checkDishEquipmentEligibility(dish, equipment);
    const timeOk =
      !enforceStrictTime ||
      slot === 'M' ||
      !maxCookTime[slot] ||
      dish.time_min <= maxCookTime[slot];

    if (!slotOk) excludedByMealSlot++;
    if (!hasIngs) excludedByMissingIngredients++;
    if (!allergyOk) excludedByAllergy++;
    if (!dietOnlyOk) excludedByDietary++;
    if (!dislikeOk) excludedByDislike++;
    if (!equipOk) excludedByEquipment++;
    if (!timeOk) excludedByCookTime++;

    if (slotOk && hasIngs && allergyOk && dietOnlyOk && dislikeOk && equipOk && timeOk) {
      eligibleCount++;
    }
  }

  return {
    totalRecipes: dataset.dishes.length,
    eligibleCount,
    excludedByAllergy,
    excludedByDietary,
    excludedByDislike,
    excludedByCookTime,
    excludedByEquipment,
    excludedByMissingIngredients,
    excludedByMealSlot,
  };
}

/**
 * Full deterministic eligibility check for a dish in a given meal slot against a UserProfile
 * (combining household-wide and all household members' constraints).
 */
export function isDishEligibleForProfile(
  dish: Dish,
  slot: MealSlot,
  profile: UserProfile,
  dataset: UlamWiseDataset,
  options?: { relaxTime?: boolean; relaxLowSodium?: boolean }
): { eligible: boolean; reasons: string[]; suitability: 'primary' | 'suitable' | 'unsuitable' } {
  const allergies = new Set<AllergenId>(profile.allergies ?? []);
  const dietaryPrefs = new Set<DietaryPrefId>(profile.dietaryPrefs ?? []);
  const dislikes = new Set<string>(profile.dislikes ?? []);
  let ketoCap = profile.ketoMaxCarbsPerDayG ?? 25;
  for (const m of profile.household ?? []) {
    for (const a of m.allergies ?? []) allergies.add(a);
    for (const d of m.dietaryPrefs ?? []) dietaryPrefs.add(d);
    for (const dl of m.dislikes ?? []) dislikes.add(dl);
    if ((m.dietaryPrefs ?? []).includes('keto') && typeof m.ketoMaxCarbsPerDayG === 'number') {
      ketoCap = Math.min(ketoCap, m.ketoMaxCarbsPerDayG);
    }
  }

  return isDishEligibleForConstraints(
    dish,
    slot,
    {
      allergies: Array.from(allergies),
      dietaryPrefs: Array.from(dietaryPrefs),
      dislikes: Array.from(dislikes),
      ketoMaxCarbsPerDayG: ketoCap,
    },
    profile.equipment,
    profile.maxCookTime,
    dataset,
    { ...options, cookTimeMode: profile.cookTimeMode ?? 'flexible' }
  );
}

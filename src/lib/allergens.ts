import type {
  AllergenId,
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

export const DIETARY_PREFS_LIST: Array<{
  id: DietaryPrefId;
  labelEn: string;
  labelFil: string;
}> = [
  { id: 'halal', labelEn: 'Halal', labelFil: 'Halal (Walang baboy)' },
  { id: 'vegetarian', labelEn: 'Vegetarian', labelFil: 'Vegetarian' },
  { id: 'pescatarian', labelEn: 'Pescatarian', labelFil: 'Pescatarian (Isda at gulay)' },
  { id: 'diabetic_friendly', labelEn: 'Diabetic-friendly', labelFil: 'Diabetic-friendly (Mababa sa asukal)' },
  { id: 'low_sodium', labelEn: 'Low-sodium', labelFil: 'Low-sodium (Mababa sa alat)' },
];

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

/**
 * Checks dietary restrictions independently of allergen validation.
 */
export function checkDishDietaryEligibility(
  dish: Dish,
  dietaryPrefs: DietaryPrefId[],
  dislikes: string[],
  dataset: UlamWiseDataset
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  for (const pref of dietaryPrefs) {
    if (pref === 'halal' && !dish.halal_friendly) {
      reasons.push('Not Halal-friendly');
    }
    if (pref === 'vegetarian' && !dish.vegetarian_ok) {
      reasons.push('Not Vegetarian');
    }
    if (pref === 'pescatarian' && !dish.pescatarian_ok) {
      reasons.push('Not Pescatarian');
    }
    if (pref === 'diabetic_friendly' && dish.high_sugar) {
      reasons.push('High sugar (not diabetic-friendly)');
    }
    if (pref === 'low_sodium' && dish.high_sodium) {
      reasons.push('High sodium');
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
  },
  equipment: EquipmentId[],
  maxCookTime: { B: number; L: number; D: number },
  dataset: UlamWiseDataset,
  options?: { relaxTime?: boolean; relaxLowSodium?: boolean }
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
    dataset
  );
  if (!dietCheck.eligible) {
    reasons.push(...dietCheck.reasons);
  }

  if (!checkDishEquipmentEligibility(dish, equipment)) {
    reasons.push('Requires unavailable kitchen equipment');
  }

  if (!options?.relaxTime && slot !== 'M') {
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
  },
  equipment: EquipmentId[],
  maxCookTime: { B: number; L: number; D: number },
  dataset: UlamWiseDataset,
  options?: { relaxTime?: boolean }
): import('../types').RecipeExclusionDiagnostics {
  let eligibleCount = 0;
  let excludedByAllergy = 0;
  let excludedByDietary = 0;
  let excludedByDislike = 0;
  let excludedByCookTime = 0;
  let excludedByEquipment = 0;
  let excludedByMissingIngredients = 0;
  let excludedByMealSlot = 0;

  for (const dish of dataset.dishes) {
    const slotOk = isDishSuitableForSlot(dish, slot);
    const hasIngs = hasCompleteCanonicalIngredients(dish, dataset);
    const allergyOk = checkDishAllergens(dish, constraints.allergies, dataset).safe;
    const dietOnlyOk = checkDishDietaryEligibility(
      dish,
      constraints.dietaryPrefs,
      [],
      dataset
    ).eligible;
    const dislikeOk = checkDishDietaryEligibility(
      dish,
      [],
      constraints.dislikes,
      dataset
    ).eligible;
    const equipOk = checkDishEquipmentEligibility(dish, equipment);
    const timeOk =
      Boolean(options?.relaxTime) ||
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
  for (const m of profile.household ?? []) {
    for (const a of m.allergies ?? []) allergies.add(a);
    for (const d of m.dietaryPrefs ?? []) dietaryPrefs.add(d);
    for (const dl of m.dislikes ?? []) dislikes.add(dl);
  }

  return isDishEligibleForConstraints(
    dish,
    slot,
    {
      allergies: Array.from(allergies),
      dietaryPrefs: Array.from(dietaryPrefs),
      dislikes: Array.from(dislikes),
    },
    profile.equipment,
    profile.maxCookTime,
    dataset,
    options
  );
}

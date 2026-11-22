export type LanguageCode = 'en' | 'tl' | 'taglish';

export type BudgetPreset = 'tipid' | 'balanced' | 'sagana';

export type StoreId =
  | 'palengke'
  | 'puregold'
  | 'sm_hypermarket'
  | 'robinsons'
  | 'walter_mart'
  | 'sari_sari';

export type MealSlot = 'B' | 'L' | 'D' | 'M';

export type MealSelectionMode = 'local_specialties' | 'everyday_pinoy';

export type PriceGroup = 'staples' | 'veg' | 'fish' | 'meat' | 'packaged';

export type GrocerySection =
  | 'Karne'
  | 'Isda at Seafood'
  | 'Gulay'
  | 'Prutas'
  | 'Bigas at Butil'
  | 'Itlog at Gatas'
  | 'Sangkap at Pampalasa'
  | 'De Lata'
  | 'Iba pa';

export const GROCERY_SECTIONS: GrocerySection[] = [
  'Karne',
  'Isda at Seafood',
  'Gulay',
  'Prutas',
  'Bigas at Butil',
  'Itlog at Gatas',
  'Sangkap at Pampalasa',
  'De Lata',
  'Iba pa',
];

export type AllergenId =
  | 'shellfish'
  | 'fish'
  | 'egg'
  | 'milk'
  | 'peanut'
  | 'tree_nut'
  | 'soy'
  | 'wheat';

export type DietaryPrefId =
  | 'halal'
  | 'vegetarian'
  | 'pescatarian'
  | 'diabetic_friendly'
  | 'low_sodium';

export type EquipmentId =
  | 'gas_stove'
  | 'one_burner_stove'
  | 'rice_cooker'
  | 'air_fryer'
  | 'turbo_broiler'
  | 'oven';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type WeightGoal = 'lose' | 'maintain' | 'gain';
export type BiologicalSexOption = 'male' | 'female' | 'average';

export interface Dish {
  dish_id: string;
  name_en: string;
  name_local: string;
  cuisine_zones: string[];
  meal_types: MealSlot[];
  main_protein: string;
  method: string;
  time_min: number;
  difficulty_1_3: number;
  equipment: string[];
  rice_pairing: 'yes' | 'no' | 'optional';
  tags: string[];
  base_servings: number;
  kcal_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  cost_php_per_serving_ncr: number | null;
  cost_tier: BudgetPreset;
  allergens_strict: string[];
  may_contain_strict: string[];
  allergens_core: string[];
  may_contain_core: string[];
  optional_ingredient_ids: string[];
  halal_friendly: boolean;
  pescatarian_ok: boolean;
  vegetarian_ok: boolean;
  vegan_ok: boolean;
  contains_coconut: boolean;
  high_sodium: boolean;
  high_sugar: boolean;
  diet_flags: string[];
  method_hint: string;
}

export interface Ingredient {
  ingredient_id: string;
  name_en: string;
  name_fil: string;
  grocery_section: GrocerySection;
  price_group: PriceGroup;
  base_unit: 'g' | 'ml' | 'pc';
  nutrition_basis: 'per_100g' | 'per_100ml' | 'per_piece';
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  price_php_ncr_palengke: number;
  price_basis: 'per_kg' | 'per_liter' | 'per_piece';
  pantry_staple: boolean;
  allergens: string[];
  may_contain: string[];
  diet_flags: string[];
  notes: string;
}

export interface DishIngredient {
  dish_id: string;
  ingredient_id: string;
  ingredient_name: string;
  qty_for_base_servings: number;
  unit: 'g' | 'ml' | 'pc';
  role: 'main' | 'pantry_staple' | 'optional';
}

export interface HiddenAllergen {
  keyword: string;
  allergen: string;
  confidence: 'definite' | 'possible';
  note: string;
}

export interface IngredientSwap {
  from_ingredient_id: string;
  to_ingredient_id: string;
  applies_when: string;
  quantity_ratio: number;
  note: string;
}

export interface ProvinceCuisine {
  province: string;
  region_key: string;
  cuisine_zone: string;
  coastal_profile: 'coastal' | 'inland';
}

export interface RegionRecord {
  region_key: string;
  region_name: string;
  name_aliases: string[];
  island_group: string;
  default_cuisine_zone: string;
  secondary_zones: string[];
  coastal_profile: string;
  food_notes: string;
  signature_dish_ids: string[];
  price_mult_staples: number;
  price_mult_veg: number;
  price_mult_fish: number;
  price_mult_meat: number;
  price_mult_packaged: number;
  price_notes: string;
}

export interface CityOverride {
  city: string;
  province: string;
  region_key: string;
  cuisine_zone: string;
  coastal_profile: 'coastal' | 'inland';
  local_food_notes: string;
  boost_dish_ids: string[];
  price_notes: string;
}

export interface DatasetValidationIssue {
  file: string;
  row: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface DatasetValidationReport {
  generatedAt: string;
  counts: {
    dishes: number;
    ingredients: number;
    dishIngredients: number;
    hiddenAllergens: number;
    ingredientSwaps: number;
    regions: number;
    provinceCuisineMap: number;
    cityOverrides: number;
  };
  invalidRowCount: number;
  brokenReferences: DatasetValidationIssue[];
  warnings: DatasetValidationIssue[];
  isValid: boolean;
}

export interface UlamWiseDataset {
  dishes: Dish[];
  dishesById: Map<string, Dish>;
  ingredients: Ingredient[];
  ingredientsById: Map<string, Ingredient>;
  dishIngredients: DishIngredient[];
  dishIngredientsByDishId: Map<string, DishIngredient[]>;
  hiddenAllergens: HiddenAllergen[];
  ingredientSwaps: IngredientSwap[];
  regions: RegionRecord[];
  regionsByKey: Map<string, RegionRecord>;
  provinceCuisineMap: ProvinceCuisine[];
  cityOverrides: CityOverride[];
  validationReport: DatasetValidationReport;
}

export interface PsgcRegion {
  code: string;
  regionKey: string;
  regionName: string;
  name: string;
}

export interface PsgcProvince {
  code: string;
  name: string;
  regionCode: string;
  isDistrict?: boolean;
  isIndependent?: boolean;
}

export interface PsgcCity {
  c: string; // PSGC code
  n: string; // name
  p: string; // province/district code
  r: string; // region code
  city: boolean;
}

export interface PsgcDataset {
  source: string;
  version: string;
  regions: PsgcRegion[];
  provinces: PsgcProvince[];
  cities: PsgcCity[];
}

export interface LocationSelection {
  regionCode: string;
  regionName: string;
  regionKey: string;
  provinceCode: string;
  provinceName: string;
  cityCode: string;
  cityName: string;
}

export type PortionPreference = 'small' | 'regular' | 'large';
export type WeeklySchedulePreset = 'everyday' | 'weekdays' | 'weekends' | 'custom';

export interface MemberDaySchedule {
  B: boolean;
  L: boolean;
  M: boolean;
  D: boolean;
}

export type MemberWeeklySchedule = Record<number, MemberDaySchedule>; // 0 (Mon) .. 6 (Sun)

export interface WeeklySchedule {
  weekStartDate: string; // ISO YYYY-MM-DD (Monday of current week)
  preset: WeeklySchedulePreset;
  selectedDays: number[]; // subset of 0..6 (Mon=0..Sun=6)
  memberSchedules: Record<string, MemberWeeklySchedule>; // keyed by member.id
}

export interface HouseholdMember {
  id: string;
  label: string; // Name or nickname
  age: number;
  sex: BiologicalSexOption;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: WeightGoal;
  goalAdjustmentKcal: number;
  calorieMode: 'auto' | 'manual';
  manualTargetKcal: number;
  portionPreference: PortionPreference;
  allergies: AllergenId[];
  dietaryPrefs: DietaryPrefId[];
  dislikes: string[];
}

export interface CalorieConfig {
  mode: 'auto' | 'manual';
  age: number;
  sex: BiologicalSexOption;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: WeightGoal;
  goalAdjustmentKcal: number; // e.g., -400, 0, +300
  manualTargetKcal: number;
}

export interface PantryItem {
  id: string;
  ingredientId?: string;
  name: string;
  quantity?: number;
  unit?: 'g' | 'ml' | 'pc' | 'kg' | 'L';
  sufficient: boolean;
}

export interface UserProfile {
  schemaVersion?: number;
  onboardingCompleted: boolean;
  onboardingStep: number;
  location: LocationSelection;
  language: LanguageCode;
  household: HouseholdMember[];
  weeklySchedule: WeeklySchedule;
  weeklyBudgetPhp: number;
  budgetPreset: BudgetPreset;
  preferredStore: StoreId;
  calories: CalorieConfig; // Retained for backward compatibility (synced with primary member)
  allergies: AllergenId[]; // Household-wide allergens (unioned with per-member allergens)
  dietaryPrefs: DietaryPrefId[]; // Household-wide dietary preferences
  dislikes: string[]; // Household-wide dislikes
  equipment: EquipmentId[];
  maxCookTime: {
    B: number;
    L: number;
    D: number;
  };
  pantry: PantryItem[];
  mealMode: MealSelectionMode;
  includeMerienda: boolean;
}

export interface PlannedMeal {
  slot: MealSlot;
  dishId: string;
  locked: boolean;
  instructions: string[];
  leftoverNote?: string;
  nutritionSource: 'dataset_dish' | 'dataset_ingredients';
  participatingMemberIds: string[];
  participatingMemberNames: string[];
  servings: number;
  memberPortions: Record<string, number>; // memberId -> effective portion (e.g., 0.8, 1.0, 1.25)
  costPerServingPhp: number;
  totalMealCostPhp: number;
  kcalPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
}

export interface DayPlan {
  dayIndex: number; // 0..6
  dayName: string;
  isPlannedDay: boolean;
  meals: PlannedMeal[];
}

export interface PlanRelaxationOptions {
  allowRelaxCookTime?: boolean;
  allowRelaxRegional?: boolean;
  allowShorterPlan?: boolean;
}

export interface RecipeExclusionDiagnostics {
  totalRecipes: number;
  eligibleCount: number;
  excludedByAllergy: number;
  excludedByDietary: number;
  excludedByDislike: number;
  excludedByCookTime: number;
  excludedByEquipment: number;
  excludedByMissingIngredients: number;
  excludedByMealSlot: number;
}

export interface InsufficientRecipesDiagnostics {
  requiredSlots: number;
  requestedDays: number;
  fillableDays: number;
  eligibleCountBySlot: Record<MealSlot, number>;
  uniqueEligibleCount: number;
  reasons: string[];
  canRelaxCookTime: boolean;
  canGenerateShorterPlan: boolean;
  suggestedMaxDays: number;
  exclusionBySlot?: Record<MealSlot, RecipeExclusionDiagnostics>;
}

export interface PlanValidationIssue {
  rule:
    | 'no_duplicate_dish'
    | 'max_protein_3day_window'
    | 'max_one_fried_rice'
    | 'allergen_violation'
    | 'dietary_violation'
    | 'equipment_violation'
    | 'cook_time_violation'
    | 'slot_mismatch'
    | 'attendance_mismatch'
    | 'missing_scheduled_slot';
  message: string;
  dishIds: string[];
  dayIndices: number[];
}

export interface WeeklyMealPlan {
  id: string;
  createdAt: string;
  /** Monday ISO date (YYYY-MM-DD, Asia/Manila) for this planning week */
  weekStartDate?: string;
  /** Sunday ISO date (YYYY-MM-DD, Asia/Manila) for this planning week */
  weekEndDate?: string;
  source: 'gemini' | 'deterministic';
  fallbackReason?: string;
  mealMode: MealSelectionMode;
  warnings: string[];
  validationStatus?: 'valid' | 'insufficient_recipes';
  statusMessage?: string;
  relaxedByUser?: {
    cookTime?: boolean;
    regional?: boolean;
    shorterPlan?: boolean;
  };
  insufficientRecipes?: InsufficientRecipesDiagnostics;
  eligibilitySummary?: {
    eligibleCountBySlot: Record<MealSlot, number>;
    exclusionBySlot: Record<MealSlot, RecipeExclusionDiagnostics>;
  };
  days: DayPlan[];
}

export interface SavedWeeklyPlan {
  id: string;
  title: string;
  savedAt: string;
  /** Monday ISO date (YYYY-MM-DD) associated with this saved week */
  weekStartDate?: string;
  /** Sunday ISO date (YYYY-MM-DD) associated with this saved week */
  weekEndDate?: string;
  locationLabel: string;
  weeklyBudgetPhp: number;
  estimatedTotalPhp: number;
  plan: WeeklyMealPlan;
}

export interface BulkPortionAllocation {
  dishId: string;
  dishName: string;
  requiredBaseQty: number;
  displayQty: string;
}

export interface BulkPurchasePlan {
  id: string;
  title: string;
  category: 'whole_chicken' | 'bulk_pork' | 'eggs' | 'rice' | 'tokwa' | 'staple_veg';
  retailPackageLabel: string;
  purchaseQtyLabel: string;
  estimatedBulkCostPhp: number;
  separateCutsCostPhp: number;
  estimatedSavingsPhp: number;
  edibleYieldLabel?: string;
  bonesOrByproductNote?: string;
  leftoverLabel?: string;
  leftoverValuePhp: number;
  storageNote: string;
  allocations: BulkPortionAllocation[];
  coveredIngredientIds: string[];
  isProvisional: boolean;
}

export interface LeftoverInventoryItem {
  ingredientId: string;
  nameEn: string;
  nameFil: string;
  leftoverBaseQty: number;
  baseUnit: 'g' | 'ml' | 'pc';
  leftoverDisplayLabel: string;
  leftoverValuePhp: number;
}

export interface GroceryItem {
  ingredientId: string;
  nameEn: string;
  nameFil: string;
  section: GrocerySection;
  priceGroup: PriceGroup;
  requiredBaseQty: number;
  pantryDeductedBaseQty: number;
  netBaseQty: number;
  baseUnit: 'g' | 'ml' | 'pc';
  displayQty: number;
  displayUnit: string;
  unitPricePhp: number;
  priceBasisLabel: string;
  /** Actual retail checkout cost for this item (same as packageCostPhp) */
  estimatedCostPhp: number;
  /** Exact proportional ingredient consumption cost for netBaseQty */
  consumptionCostPhp: number;
  /** Number of retail packages / bundles to buy */
  retailPackageCount: number;
  /** Base quantity inside one retail package */
  retailPackageSizeBase: number;
  /** Human-readable retail purchase unit, e.g. "1 pack (100 g)" or "2 cans (155 g)" */
  retailPackageLabel: string;
  /** Total base quantity purchased at retail */
  purchasedBaseQty: number;
  /** Provisional retail checkout cost for purchased packages (after any bulk tier) */
  packageCostPhp: number;
  /** Expected leftover base quantity remaining after cooking the week's recipes */
  leftoverBaseQty: number;
  /** Human-readable leftover quantity, e.g. "90 g" or "None" */
  leftoverDisplayLabel: string;
  /** Estimated peso value of the leftover inventory remaining after the week */
  leftoverValuePhp: number;
  /** Marks retail package estimates as provisional */
  isProvisionalPackagePrice: boolean;
  /** Set if this item is consolidated into a BulkPurchasePlan */
  bulkPlanId?: string;
  bulkNote?: string;
  coveredByPantry: boolean;
  swappedFromId?: string;
  swappedFromName?: string;
  usedInDishIds: string[];
}

export interface GrocerySectionSummary {
  section: GrocerySection;
  items: GroceryItem[];
  /** Actual checkout subtotal (sum of item.packageCostPhp) */
  subtotalPhp: number;
  /** Recipe-consumed ingredient cost subtotal */
  consumptionSubtotalPhp: number;
  /** Expected remaining inventory value subtotal */
  leftoverValueSubtotalPhp: number;
}

export interface BudgetSwapRecommendation {
  id: string;
  fromIngredientId: string;
  fromName: string;
  toIngredientId: string;
  toName: string;
  quantityRatio: number;
  currentCostPhp: number;
  projectedCostPhp: number;
  savingsPhp: number;
  note: string;
}

export interface GroceryListSummary {
  sections: GrocerySectionSummary[];
  pantryCoveredItems: GroceryItem[];
  /** Equals totalCheckoutCostPhp (actual retail packages to buy at checkout) */
  totalEstimatedPhp: number;
  /** 1. Estimated ingredient consumption cost (exact recipe quantities consumed after pantry deduction) */
  totalConsumptionCostPhp: number;
  /** 2. Estimated actual grocery checkout cost (sum of realistic retail packages & bulk buys) */
  totalCheckoutCostPhp: number;
  /** 3. Expected remaining inventory value carried over after this week's recipes */
  totalLeftoverInventoryValuePhp: number;
  /** Estimated savings achieved from bulk consolidations (whole chicken, trays, sacks, veg bundles) */
  bulkSavingsPhp: number;
  /** Structured weekly bulk-buying and dish-by-dish portion allocation plans */
  bulkPlans: BulkPurchasePlan[];
  /** Itemized leftover inventory carried over to pantry */
  leftoverInventoryItems: LeftoverInventoryItem[];
  weeklyBudgetPhp: number;
  remainingBudgetPhp: number;
  overBudgetAmountPhp: number;
  percentConsumed: number;
  plannedDaysCount: number;
  dailyEquivalentBudgetPhp: number;
  averageSpendPerPlannedDayPhp: number;
  estimatedCostPerMemberPhp: number;
  mostExpensiveItems: GroceryItem[];
  status: 'under' | 'approaching' | 'over';
  recommendedSwaps: BudgetSwapRecommendation[];
  storeIsProvisional: boolean;
  storeMultiplier: number;
}

export interface DetectedIngredient {
  id: string;
  name: string;
  matchedIngredientId?: string;
  confidence: 'high' | 'medium' | 'low';
  quantity?: number;
  unit?: 'g' | 'ml' | 'pc';
  confirmed: boolean;
}

export interface FridgeDishSuggestion {
  dish: Dish;
  matchedIngredientNames: string[];
  missingIngredientNames: string[];
  additionalEstimatedCostPhp: number;
  matchRatio: number;
}

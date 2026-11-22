import type {
  CalorieConfig,
  HouseholdMember,
  PantryItem,
  PsgcDataset,
  SavedWeeklyPlan,
  UlamWiseDataset,
  UserProfile,
  WeeklyMealPlan,
} from '../types';
import { getMinorReferenceKcal } from './nutrition';
import {
  createDefaultWeeklySchedule,
  ensureMemberSchedules,
  hydrateLegacyMealPlan,
} from './schedule';
import { isCachedMealPlanValid } from './variety';

export const PROFILE_SCHEMA_VERSION = 2;

export const STORAGE_KEYS = {
  profile: 'ulamwise_profile_v1',
  mealPlan: 'ulamwise_meal_plan_v1',
  weeklyPlansByWeek: 'ulamwise_weekly_plans_by_week_v1',
  checkedGrocery: 'ulamwise_checked_grocery_v1',
  appliedSwaps: 'ulamwise_applied_swaps_v1',
  savedPlans: 'ulamwise_saved_plans_v1',
  favorites: 'ulamwise_favorites_v1',
  theme: 'ulamwise_theme',
  customPsgc: 'ulamwise_custom_psgc_v1',
} as const;

export const QUICK_PANTRY_CHIPS: Array<{
  label: string;
  ingredientId?: string;
  defaultUnit: 'g' | 'ml' | 'pc' | 'kg' | 'L';
}> = [
  { label: 'Bigas', ingredientId: 'rice_raw', defaultUnit: 'kg' },
  { label: 'Itlog', ingredientId: 'egg', defaultUnit: 'pc' },
  { label: 'Toyo', ingredientId: 'soy_sauce', defaultUnit: 'ml' },
  { label: 'Suka', ingredientId: 'vinegar', defaultUnit: 'ml' },
  { label: 'Asin', ingredientId: 'salt', defaultUnit: 'g' },
  { label: 'Mantika', ingredientId: 'cooking_oil', defaultUnit: 'ml' },
  { label: 'Bawang', ingredientId: 'garlic', defaultUnit: 'g' },
  { label: 'Sibuyas', ingredientId: 'onion', defaultUnit: 'g' },
  { label: 'De lata', ingredientId: 'sardines_tomato', defaultUnit: 'g' },
];

export function createHouseholdMember(
  overrides: Partial<HouseholdMember> & { id: string; label: string; age: number }
): HouseholdMember {
  const isMinor = overrides.age < 18;
  return {
    id: overrides.id,
    label: overrides.label,
    age: overrides.age,
    sex: overrides.sex ?? 'female',
    heightCm: overrides.heightCm ?? (isMinor ? 130 : 162),
    weightKg: overrides.weightKg ?? (isMinor ? 30 : 58),
    activityLevel: overrides.activityLevel ?? 'moderate',
    goal: overrides.goal ?? 'maintain',
    goalAdjustmentKcal: overrides.goalAdjustmentKcal ?? 0,
    calorieMode: isMinor ? 'manual' : overrides.calorieMode ?? 'auto',
    manualTargetKcal:
      overrides.manualTargetKcal ?? (isMinor ? getMinorReferenceKcal(overrides.age) : 1900),
    portionPreference: overrides.portionPreference ?? 'regular',
    allergies: overrides.allergies ?? [],
    dietaryPrefs: overrides.dietaryPrefs ?? [],
    dislikes: overrides.dislikes ?? [],
  };
}

export function createDefaultProfile(): UserProfile {
  const household: HouseholdMember[] = [
    createHouseholdMember({
      id: 'm-1',
      label: 'Ana',
      age: 32,
      sex: 'female',
      heightCm: 158,
      weightKg: 56,
      activityLevel: 'moderate',
      goal: 'maintain',
      calorieMode: 'auto',
      manualTargetKcal: 1850,
    }),
    createHouseholdMember({
      id: 'm-2',
      label: 'Mark',
      age: 30,
      sex: 'male',
      heightCm: 170,
      weightKg: 68,
      activityLevel: 'moderate',
      goal: 'maintain',
      calorieMode: 'auto',
      manualTargetKcal: 2200,
    }),
    createHouseholdMember({
      id: 'm-3',
      label: 'Mika',
      age: 8,
      sex: 'female',
      heightCm: 128,
      weightKg: 26,
      activityLevel: 'light',
      goal: 'maintain',
      calorieMode: 'manual',
      manualTargetKcal: 1600,
      portionPreference: 'small',
    }),
  ];

  const weeklySchedule = createDefaultWeeklySchedule(household, {
    preset: 'everyday',
    includeMerienda: false,
  });

  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    onboardingCompleted: false,
    onboardingStep: 1,
    location: {
      regionCode: '130000000',
      regionName: 'National Capital Region',
      regionKey: 'ncr',
      provinceCode: '137400000',
      provinceName: 'Metro Manila — Second District (Eastern)',
      cityCode: '137404000',
      cityName: 'Quezon City',
    },
    language: 'en',
    household,
    weeklySchedule,
    weeklyBudgetPhp: 2500,
    budgetPreset: 'balanced',
    preferredStore: 'palengke',
    calories: {
      mode: 'auto',
      age: 32,
      sex: 'female',
      heightCm: 158,
      weightKg: 56,
      activityLevel: 'moderate',
      goal: 'maintain',
      goalAdjustmentKcal: 0,
      manualTargetKcal: 1850,
    },
    allergies: [],
    dietaryPrefs: [],
    dislikes: [],
    equipment: ['gas_stove', 'rice_cooker'],
    maxCookTime: {
      B: 30,
      L: 60,
      D: 60,
    },
    pantry: [
      { id: 'p-salt', ingredientId: 'salt', name: 'Asin', sufficient: true },
      { id: 'p-oil', ingredientId: 'cooking_oil', name: 'Mantika', sufficient: true },
      { id: 'p-soy', ingredientId: 'soy_sauce', name: 'Toyo', sufficient: true },
      { id: 'p-vinegar', ingredientId: 'vinegar', name: 'Suka', sufficient: true },
    ],
    mealMode: 'local_specialties',
    includeMerienda: false,
  };
}

export function createAutostartDemoProfile(): UserProfile {
  const base = createDefaultProfile();
  return {
    ...base,
    onboardingCompleted: true,
    onboardingStep: 9,
  };
}

/**
 * Backward-compatible migration from v1 profiles (simple {id,label,age} household + single calorie config)
 * to v2 household-aware profiles without losing any existing user settings, pantry items, allergies, or plans.
 */
export function migrateProfile(saved: Partial<UserProfile> | null | undefined): UserProfile {
  const base = createDefaultProfile();
  if (!saved) return base;

  const legacyCal: CalorieConfig = {
    ...base.calories,
    ...(saved.calories ?? {}),
  };

  const rawHousehold =
    Array.isArray(saved.household) && saved.household.length > 0
      ? saved.household
      : base.household;

  const migratedHousehold: HouseholdMember[] = rawHousehold.map((raw, idx) => {
    const partial = raw as Partial<HouseholdMember> & { id?: string; label?: string; age?: number };
    const age = Number.isFinite(partial.age) ? Number(partial.age) : idx === 0 ? legacyCal.age : 28;
    const isMinor = age < 18;
    const useLegacyCal = idx === 0 && !partial.calorieMode && !partial.heightCm && !partial.weightKg;

    return createHouseholdMember({
      id: partial.id || `m-${idx + 1}`,
      label: partial.label || `Member ${idx + 1}`,
      age,
      sex: partial.sex ?? (useLegacyCal ? legacyCal.sex : idx === 1 ? 'male' : 'female'),
      heightCm: partial.heightCm ?? (useLegacyCal ? legacyCal.heightCm : isMinor ? 130 : 165),
      weightKg: partial.weightKg ?? (useLegacyCal ? legacyCal.weightKg : isMinor ? 30 : 60),
      activityLevel: partial.activityLevel ?? (useLegacyCal ? legacyCal.activityLevel : 'moderate'),
      goal: partial.goal ?? (useLegacyCal ? legacyCal.goal : 'maintain'),
      goalAdjustmentKcal:
        partial.goalAdjustmentKcal ?? (useLegacyCal ? legacyCal.goalAdjustmentKcal : 0),
      calorieMode: isMinor
        ? 'manual'
        : partial.calorieMode ?? (useLegacyCal ? legacyCal.mode : 'auto'),
      manualTargetKcal:
        partial.manualTargetKcal ??
        (useLegacyCal ? legacyCal.manualTargetKcal : isMinor ? getMinorReferenceKcal(age) : 1950),
      portionPreference: partial.portionPreference ?? (isMinor && age <= 10 ? 'small' : 'regular'),
      allergies: Array.isArray(partial.allergies) ? partial.allergies : [],
      dietaryPrefs: Array.isArray(partial.dietaryPrefs) ? partial.dietaryPrefs : [],
      dislikes: Array.isArray(partial.dislikes) ? partial.dislikes : [],
    });
  });

  const includeMerienda = Boolean(saved.includeMerienda);
  const weeklySchedule = saved.weeklySchedule
    ? ensureMemberSchedules(saved.weeklySchedule, migratedHousehold, includeMerienda)
    : createDefaultWeeklySchedule(migratedHousehold, {
        preset: 'everyday',
        includeMerienda,
      });

  const primary = migratedHousehold[0];
  const syncedCalories: CalorieConfig = primary
    ? {
        mode: primary.calorieMode,
        age: primary.age,
        sex: primary.sex,
        heightCm: primary.heightCm,
        weightKg: primary.weightKg,
        activityLevel: primary.activityLevel,
        goal: primary.goal,
        goalAdjustmentKcal: primary.goalAdjustmentKcal,
        manualTargetKcal: primary.manualTargetKcal,
      }
    : legacyCal;

  return {
    ...base,
    ...saved,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    location: { ...base.location, ...(saved.location ?? {}) },
    calories: syncedCalories,
    maxCookTime: { ...base.maxCookTime, ...(saved.maxCookTime ?? {}) },
    household: migratedHousehold,
    weeklySchedule,
    allergies: Array.isArray(saved.allergies) ? saved.allergies : [],
    dietaryPrefs: Array.isArray(saved.dietaryPrefs) ? saved.dietaryPrefs : [],
    dislikes: Array.isArray(saved.dislikes) ? saved.dislikes : [],
    pantry: Array.isArray(saved.pantry) ? (saved.pantry as PantryItem[]) : base.pantry,
  };
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadProfile(): UserProfile {
  const saved = safeRead<Partial<UserProfile> | null>(STORAGE_KEYS.profile, null);
  return migrateProfile(saved);
}

export function saveProfile(profile: UserProfile): void {
  const normalized = migrateProfile(profile);
  safeWrite(STORAGE_KEYS.profile, normalized);
}

export function loadMealPlan(profile?: UserProfile): WeeklyMealPlan | null {
  const raw = safeRead<WeeklyMealPlan | null>(STORAGE_KEYS.mealPlan, null);
  if (!raw) return null;
  return profile ? hydrateLegacyMealPlan(raw, profile) : raw;
}

/**
 * Loads the cached weekly meal plan and validates it against every hard constraint.
 * If the cached plan is invalid (e.g. repeated dishes, 3-day protein violations, allergy conflicts,
 * or stale legacy violation warnings), ONLY the invalid meal-plan cache is cleared — preserving
 * household profile, location, allergies, pantry, favorites, saved plans, and settings.
 */
export function loadValidatedMealPlan(
  profile: UserProfile,
  dataset: UlamWiseDataset
): { plan: WeeklyMealPlan | null; invalidatedStaleCache: boolean } {
  const hydrated = loadMealPlan(profile);
  if (!hydrated) {
    return { plan: null, invalidatedStaleCache: false };
  }

  if (!isCachedMealPlanValid(hydrated, profile, dataset)) {
    clearMealPlanCache();
    return { plan: null, invalidatedStaleCache: true };
  }

  const plannedDaysCount = hydrated.days.filter((d) => d.isPlannedDay && d.meals.length > 0).length;
  const cleaned: WeeklyMealPlan = {
    ...hydrated,
    warnings: [],
    validationStatus: 'valid',
    statusMessage:
      hydrated.statusMessage ??
      (plannedDaysCount > 0
        ? `Valid ${plannedDaysCount}-day meal plan ready — all variety, allergy, and dietary rules passed.`
        : undefined),
  };

  return { plan: cleaned, invalidatedStaleCache: false };
}

export function clearMealPlanCache(): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEYS.mealPlan);
  } catch {
    // noop
  }
}

export function saveMealPlan(plan: WeeklyMealPlan | null): void {
  if (!plan || plan.validationStatus === 'insufficient_recipes') {
    clearMealPlanCache();
    return;
  }
  safeWrite(STORAGE_KEYS.mealPlan, plan);
}

export function loadWeeklyPlansByWeek(profile?: UserProfile): Record<string, WeeklyMealPlan> {
  const raw = safeRead<Record<string, WeeklyMealPlan>>(STORAGE_KEYS.weeklyPlansByWeek, {});
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, WeeklyMealPlan> = {};
  for (const [weekKey, plan] of Object.entries(raw)) {
    if (!plan || !Array.isArray(plan.days)) continue;
    const hydrated = profile ? hydrateLegacyMealPlan(plan, profile) : plan;
    if (hydrated) result[weekKey] = hydrated;
  }
  return result;
}

export function saveWeeklyPlansByWeek(plansByWeek: Record<string, WeeklyMealPlan>): void {
  const cleaned: Record<string, WeeklyMealPlan> = {};
  for (const [weekKey, plan] of Object.entries(plansByWeek)) {
    if (!plan || plan.validationStatus === 'insufficient_recipes') continue;
    cleaned[weekKey] = plan;
  }
  safeWrite(STORAGE_KEYS.weeklyPlansByWeek, cleaned);
}

export function loadCheckedGrocery(): Record<string, boolean> {
  return safeRead<Record<string, boolean>>(STORAGE_KEYS.checkedGrocery, {});
}

export function saveCheckedGrocery(checked: Record<string, boolean>): void {
  safeWrite(STORAGE_KEYS.checkedGrocery, checked);
}

export function loadAppliedSwaps(): Record<string, string> {
  return safeRead<Record<string, string>>(STORAGE_KEYS.appliedSwaps, {});
}

export function saveAppliedSwaps(swaps: Record<string, string>): void {
  safeWrite(STORAGE_KEYS.appliedSwaps, swaps);
}

export function loadSavedPlans(): SavedWeeklyPlan[] {
  return safeRead<SavedWeeklyPlan[]>(STORAGE_KEYS.savedPlans, []);
}

export function saveSavedPlans(plans: SavedWeeklyPlan[]): void {
  safeWrite(STORAGE_KEYS.savedPlans, plans);
}

export function loadFavorites(): string[] {
  return safeRead<string[]>(STORAGE_KEYS.favorites, []);
}

export function saveFavorites(dishIds: string[]): void {
  safeWrite(STORAGE_KEYS.favorites, dishIds);
}

export function loadCustomPsgc(): PsgcDataset | null {
  return safeRead<PsgcDataset | null>(STORAGE_KEYS.customPsgc, null);
}

export function saveCustomPsgc(psgc: PsgcDataset | null): void {
  safeWrite(STORAGE_KEYS.customPsgc, psgc);
}

export function loadTheme(): 'light' | 'dark' {
  try {
    if (typeof window === 'undefined') return 'light';
    const v = window.localStorage.getItem(STORAGE_KEYS.theme);
    if (v === 'dark' || v === 'light') return v;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.theme, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch {
    // noop
  }
}

export function resetAllLocalData(): void {
  try {
    if (typeof window === 'undefined') return;
    Object.values(STORAGE_KEYS).forEach((k) => {
      if (k !== STORAGE_KEYS.theme) {
        window.localStorage.removeItem(k);
      }
    });
  } catch {
    // noop
  }
}

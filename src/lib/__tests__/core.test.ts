import test from 'node:test';
import assert from 'node:assert/strict';
import { getNodeDataset } from '../datasetNode';
import {
  checkDishAllergens,
  checkDishDietaryEligibility,
  computeRecipeExclusionDiagnostics,
  getDishSlotSuitability,
} from '../allergens';
import { calculateDishCost, calculateIngredientCostPhp } from '../pricing';
import { generateGroceryList } from '../grocery';
import { resolveRetailPurchase } from '../packaging';
import {
  calculateCalorieTarget,
  calculateHouseholdServings,
  calculateMemberCalorieTarget,
} from '../nutrition';
import {
  generateDeterministicWeeklyPlan,
  regenerateSingleMeal,
  validateAndEnrichGeminiPlan,
} from '../planner';
import {
  applyWeeklyPreset,
  computeMemberDayNutrition,
  createDefaultWeeklySchedule,
  createMemberWeeklySchedule,
  getMemberDailySlotCalorieTargets,
} from '../schedule';
import {
  isCachedMealPlanValid,
  validateCompleteWeeklyPlan,
  validateWeeklyVariety,
} from '../variety';
import {
  getCitiesForProvince,
  getDefaultPsgcDataset,
  getProvincesForRegion,
  resolveRegionalContext,
} from '../psgc';
import {
  createDefaultProfile,
  createHouseholdMember,
  migrateProfile,
} from '../storage';

const dataset = getNodeDataset();
const psgc = getDefaultPsgcDataset();

test('Dataset validation verifies all 8 CSV files, 226 genuinely distinct dishes, fixed grocery categories, and zero broken references', () => {
  const r = dataset.validationReport;
  assert.ok(r.counts.dishes >= 200, `Expected >= 200 dishes, got ${r.counts.dishes}`);
  assert.equal(r.counts.dishes, 250);
  assert.equal(r.counts.ingredients, 123);
  assert.equal(r.counts.dishIngredients, 2060);
  assert.equal(r.counts.hiddenAllergens, 153);
  assert.equal(r.counts.ingredientSwaps, 32);
  assert.equal(r.counts.regions, 18);
  assert.equal(r.counts.provinceCuisineMap, 82);
  assert.equal(r.counts.cityOverrides, 31);
  assert.equal(r.brokenReferences.length, 0);
  assert.equal(r.invalidRowCount, 0);
  assert.equal(r.isValid, true);

  // Zero duplicate canonical IDs or duplicate local recipe names
  const ids = new Set(dataset.dishes.map((d) => d.dish_id));
  const names = new Set(dataset.dishes.map((d) => d.name_local.trim().toLowerCase()));
  assert.equal(ids.size, dataset.dishes.length);
  assert.equal(names.size, dataset.dishes.length);

  // Grocery category fixes verified
  assert.equal(dataset.ingredientsById.get('cornstarch')?.grocery_section, 'Sangkap at Pampalasa');
  assert.equal(dataset.ingredientsById.get('peanut_butter')?.grocery_section, 'Iba pa');
});

test('PSGC dataset provides dependent region -> province -> city/municipality hierarchy across all 1,634 LGUs', () => {
  assert.equal(psgc.regions.length, 17);
  assert.equal(psgc.cities.length, 1634);

  const bicolProvinces = getProvincesForRegion(psgc, '050000000');
  assert.ok(bicolProvinces.some((p) => p.name === 'Albay'));
  const albay = bicolProvinces.find((p) => p.name === 'Albay')!;
  const albayCities = getCitiesForProvince(psgc, albay.code);
  assert.ok(albayCities.some((c) => c.n.toLowerCase().includes('legazpi')));

  const ctx = resolveRegionalContext(
    {
      regionCode: '050000000',
      regionName: 'Bicol Region',
      regionKey: 'r5',
      provinceCode: albay.code,
      provinceName: albay.name,
      cityCode: albayCities[0].c,
      cityName: 'City of Legazpi',
    },
    dataset
  );
  assert.equal(ctx.primaryCuisineZone, 'bicolano');
  assert.ok(ctx.boostDishIds.includes('bicol_express'));
  assert.ok(ctx.boostDishIds.includes('laing'));
});

test('Deterministic allergy detection catches explicit and hidden Filipino allergens conservatively', () => {
  const sinigangHipon = dataset.dishesById.get('sinigang_hipon')!;
  assert.equal(checkDishAllergens(sinigangHipon, ['shellfish'], dataset).safe, false);
  assert.equal(checkDishAllergens(sinigangHipon, ['fish'], dataset).safe, false);

  const bicolExpress = dataset.dishesById.get('bicol_express')!;
  assert.equal(checkDishAllergens(bicolExpress, ['shellfish'], dataset).safe, false);

  const chickenAdobo = dataset.dishesById.get('chicken_adobo')!;
  assert.equal(checkDishAllergens(chickenAdobo, ['soy'], dataset).safe, false);
  assert.equal(checkDishAllergens(chickenAdobo, ['wheat'], dataset).safe, false);
  assert.equal(checkDishAllergens(chickenAdobo, ['shellfish'], dataset).safe, true);

  const kareKare = dataset.dishesById.get('kare_kare')!;
  assert.equal(checkDishAllergens(kareKare, ['peanut'], dataset).safe, false);
  assert.equal(checkDishAllergens(kareKare, ['shellfish'], dataset).safe, false);

  const pritongManok = dataset.dishesById.get('pritong_manok')!;
  assert.equal(
    checkDishAllergens(
      pritongManok,
      ['shellfish', 'fish', 'egg', 'milk', 'peanut', 'tree_nut', 'soy', 'wheat'],
      dataset
    ).safe,
    true
  );
});

test('Dietary restrictions apply independently of allergies', () => {
  const porkAdobo = dataset.dishesById.get('pork_adobo')!;
  const piaparan = dataset.dishesById.get('piaparan_manok')!;
  const ginisangMonggo = dataset.dishesById.get('ginisang_monggo')!;

  assert.equal(checkDishDietaryEligibility(porkAdobo, ['halal'], [], dataset).eligible, false);
  assert.equal(checkDishDietaryEligibility(piaparan, ['halal'], [], dataset).eligible, true);
  assert.equal(checkDishDietaryEligibility(ginisangMonggo, ['vegetarian'], [], dataset).eligible, true);
  assert.equal(checkDishDietaryEligibility(piaparan, [], ['chicken'], dataset).eligible, false);
});

test('Regional price multipliers and store multipliers accurately adjust ingredient and dish costs', () => {
  const ncr = dataset.regionsByKey.get('ncr')!;
  const car = dataset.regionsByKey.get('car')!;
  const kangkong = dataset.ingredientsById.get('kangkong')!;
  const bangus = dataset.ingredientsById.get('bangus')!;

  assert.equal(calculateIngredientCostPhp(kangkong, 1000, ncr, 'palengke'), 70);
  assert.equal(calculateIngredientCostPhp(kangkong, 1000, car, 'palengke'), 56);
  assert.equal(calculateIngredientCostPhp(kangkong, 1000, ncr, 'sm_hypermarket'), 78.4);

  assert.equal(calculateIngredientCostPhp(bangus, 1000, ncr, 'palengke'), 230);
  assert.equal(calculateIngredientCostPhp(bangus, 1000, car, 'palengke'), 310.5);

  const dish = dataset.dishesById.get('chicken_adobo')!;
  const cost2 = calculateDishCost(dish, 2, ncr, 'palengke', dataset);
  const cost4 = calculateDishCost(dish, 4, ncr, 'palengke', dataset);
  assert.ok(cost4.totalMealCostPhp > cost2.totalMealCostPhp);
  assert.ok(Math.abs(cost4.totalMealCostPhp - cost2.totalMealCostPhp * 2) < 0.05);
});

test('Scenario A: Weekday household generates zero weekend meals and scales Breakfast (1p) vs Lunch/Dinner (2p)', () => {
  const m1 = createHouseholdMember({ id: 'm1', label: 'Ana', age: 29, portionPreference: 'regular' });
  const m2 = createHouseholdMember({ id: 'm2', label: 'Mark', age: 31, portionPreference: 'regular' });
  const profile = createDefaultProfile();
  profile.household = [m1, m2];
  profile.pantry = [];
  profile.weeklySchedule = {
    weekStartDate: '2026-11-16',
    preset: 'weekdays',
    selectedDays: [0, 1, 2, 3, 4],
    memberSchedules: {
      m1: createMemberWeeklySchedule([0, 1, 2, 3, 4], { B: true, L: true, M: false, D: true }),
      m2: createMemberWeeklySchedule([0, 1, 2, 3, 4], { B: false, L: true, M: false, D: true }),
    },
  };

  const plan = generateDeterministicWeeklyPlan(profile, dataset, { seed: 42 });
  // No weekend meals
  assert.equal(plan.days[5].isPlannedDay, false);
  assert.equal(plan.days[5].meals.length, 0);
  assert.equal(plan.days[6].isPlannedDay, false);
  assert.equal(plan.days[6].meals.length, 0);

  // Monday–Friday: Breakfast has 1 participant (m1), Lunch & Dinner have 2 participants (m1, m2)
  for (let d = 0; d < 5; d++) {
    assert.equal(plan.days[d].isPlannedDay, true);
    const b = plan.days[d].meals.find((m) => m.slot === 'B')!;
    const l = plan.days[d].meals.find((m) => m.slot === 'L')!;
    const dn = plan.days[d].meals.find((m) => m.slot === 'D')!;
    assert.deepEqual(b.participatingMemberIds, ['m1']);
    assert.deepEqual(l.participatingMemberIds, ['m1', 'm2']);
    assert.deepEqual(dn.participatingMemberIds, ['m1', 'm2']);
    assert.ok(l.servings > b.servings);
  }

  // Grocery list for weekday schedule must be significantly lower than 7-day all-meals schedule
  const groceryWeekday = generateGroceryList(plan, profile, dataset);
  assert.equal(groceryWeekday.plannedDaysCount, 5);

  const profileAllWeek = {
    ...profile,
    weeklySchedule: applyWeeklyPreset(
      createDefaultWeeklySchedule([m1, m2]),
      [m1, m2],
      'everyday'
    ),
  };
  const planAllWeek = generateDeterministicWeeklyPlan(profileAllWeek, dataset, { seed: 42 });
  const groceryAllWeek = generateGroceryList(planAllWeek, profileAllWeek, dataset);
  assert.equal(groceryAllWeek.plannedDaysCount, 7);
  assert.ok(groceryWeekday.totalEstimatedPhp < groceryAllWeek.totalEstimatedPhp);
});

test('Scenario B: Independent automatic vs manual calorie targets, minor (<18) guard, and skipped-meal distribution', () => {
  const m1 = createHouseholdMember({
    id: 'm1',
    label: 'Lia',
    age: 21,
    sex: 'female',
    heightCm: 162,
    weightKg: 54,
    activityLevel: 'moderate',
    goal: 'maintain',
    calorieMode: 'auto',
    manualTargetKcal: 1800,
  });
  const m2 = createHouseholdMember({
    id: 'm2',
    label: 'Carlo',
    age: 28,
    sex: 'male',
    heightCm: 175,
    weightKg: 75,
    activityLevel: 'active',
    goal: 'gain',
    calorieMode: 'manual',
    manualTargetKcal: 2450,
  });
  const minor = createHouseholdMember({
    id: 'm3',
    label: 'Mika',
    age: 10,
    sex: 'female',
    calorieMode: 'auto', // Even if passed auto, <18 must NOT apply adult Mifflin-St Jeor
    manualTargetKcal: 1550,
  });

  const t1 = calculateMemberCalorieTarget(m1);
  const t2 = calculateMemberCalorieTarget(m2);
  const t3 = calculateMemberCalorieTarget(minor);

  assert.equal(t1.isMinor, false);
  assert.ok(t1.bmr !== null && t1.bmr > 1200);
  assert.equal(t2.dailyTargetKcal, 2450);
  assert.equal(t2.bmr, null);
  assert.equal(t3.isMinor, true);
  assert.equal(t3.bmr, null);
  assert.ok(t3.minorGuidanceMessage && t3.minorGuidanceMessage.includes('under 18'));

  // Updating m1's weight must NOT alter m2's manual target
  const m1Updated = { ...m1, weightKg: 64 };
  assert.notEqual(
    calculateMemberCalorieTarget(m1Updated).dailyTargetKcal,
    t1.dailyTargetKcal
  );
  assert.equal(calculateMemberCalorieTarget(m2).dailyTargetKcal, 2450);

  // Skipped-meal calorie distribution: m2 skips breakfast & merienda -> 0 kcal allocated to B & M, 100% split across L & D
  const profile = createDefaultProfile();
  profile.household = [m1, m2];
  profile.weeklySchedule = {
    weekStartDate: '2026-11-16',
    preset: 'weekdays',
    selectedDays: [0, 1, 2, 3, 4],
    memberSchedules: {
      m1: createMemberWeeklySchedule([0, 1, 2, 3, 4], { B: true, L: true, M: true, D: true }),
      m2: createMemberWeeklySchedule([0, 1, 2, 3, 4], { B: false, L: true, M: false, D: true }),
    },
  };
  const m2Slots = getMemberDailySlotCalorieTargets(m2, 0, profile);
  assert.equal(m2Slots.B, 0);
  assert.equal(m2Slots.M, 0);
  assert.ok(Math.abs(m2Slots.L + m2Slots.D - 2450) <= 2);

  // Per-member daily planned calories only count attended meals
  const plan = generateDeterministicWeeklyPlan(profile, dataset, { seed: 55 });
  const m1Day = computeMemberDayNutrition(plan.days[0], m1, profile);
  const m2Day = computeMemberDayNutrition(plan.days[0], m2, profile);
  assert.equal(m1Day.mealsAttended.length, 4);
  assert.deepEqual(m2Day.mealsAttended, ['L', 'D']);
  assert.ok(m1Day.plannedKcal > 0 && m2Day.plannedKcal > 0);
});

test('Scenario C: Different weekend schedules — Member 1 all week (4 slots), Member 2 weekdays L+D only', () => {
  const m1 = createHouseholdMember({ id: 'm1', label: 'Ana', age: 30 });
  const m2 = createHouseholdMember({ id: 'm2', label: 'Mark', age: 30 });
  const profile = createDefaultProfile();
  profile.household = [m1, m2];
  profile.weeklySchedule = {
    weekStartDate: '2026-11-16',
    preset: 'everyday',
    selectedDays: [0, 1, 2, 3, 4, 5, 6],
    memberSchedules: {
      m1: createMemberWeeklySchedule([0, 1, 2, 3, 4, 5, 6], { B: true, L: true, M: true, D: true }),
      m2: createMemberWeeklySchedule([0, 1, 2, 3, 4], { B: false, L: true, M: false, D: true }),
    },
  };

  const plan = generateDeterministicWeeklyPlan(profile, dataset, { seed: 77 });
  // Saturday (5) & Sunday (6): ONLY m1 eats all 4 slots, m2 NEVER appears
  for (const weekendIdx of [5, 6]) {
    assert.equal(plan.days[weekendIdx].isPlannedDay, true);
    assert.equal(plan.days[weekendIdx].meals.length, 4);
    for (const meal of plan.days[weekendIdx].meals) {
      assert.deepEqual(meal.participatingMemberIds, ['m1']);
    }
  }
  // Monday (0): Lunch includes both m1 and m2
  const monLunch = plan.days[0].meals.find((m) => m.slot === 'L')!;
  const satLunch = plan.days[5].meals.find((m) => m.slot === 'L')!;
  assert.deepEqual(monLunch.participatingMemberIds, ['m1', 'm2']);
  assert.ok(monLunch.servings > satLunch.servings);
});

test('Scenario D: Pantry subtraction, exact grocery sum, and over-budget top cost drivers', () => {
  const profile = createDefaultProfile();
  profile.weeklyBudgetPhp = 700; // Deliberately tight to verify over-budget diagnostics
  profile.pantry = [];
  const plan = generateDeterministicWeeklyPlan(profile, dataset, { seed: 101 });

  const list = generateGroceryList(plan, profile, dataset);
  const sumOfItems = Number(
    list.sections
      .flatMap((s) => s.items)
      .reduce((acc, i) => acc + i.estimatedCostPhp, 0)
      .toFixed(2)
  );
  assert.equal(list.totalEstimatedPhp, sumOfItems);
  assert.equal(list.status, 'over');
  assert.ok(list.overBudgetAmountPhp > 0);
  assert.ok(list.mostExpensiveItems.length > 0);

  // Pantry subtraction: mark bigas (rice_raw) as sufficient
  const withPantry = {
    ...profile,
    pantry: [{ id: 'p-rice', ingredientId: 'rice_raw', name: 'Bigas', sufficient: true }],
  };
  const listPantry = generateGroceryList(plan, withPantry, dataset);
  assert.ok(listPantry.pantryCoveredItems.some((i) => i.ingredientId === 'rice_raw'));
  assert.ok(
    !listPantry.sections.flatMap((s) => s.items).some((i) => i.ingredientId === 'rice_raw')
  );
  assert.ok(listPantry.totalEstimatedPhp < list.totalEstimatedPhp);
});

test('Scenario E: Per-member shellfish allergy protects shared meals, regeneration, and weekly variety', () => {
  const m1 = createHouseholdMember({ id: 'm1', label: 'Ana', age: 30, allergies: [] });
  const m2 = createHouseholdMember({ id: 'm2', label: 'Mark', age: 31, allergies: ['shellfish'] });
  const profile = createDefaultProfile();
  profile.allergies = []; // Household-level empty; allergy is ONLY on Member 2!
  profile.household = [m1, m2];
  profile.weeklySchedule = createDefaultWeeklySchedule([m1, m2], { preset: 'everyday' });

  const plan = generateDeterministicWeeklyPlan(profile, dataset, { seed: 42 });
  for (const day of plan.days) {
    for (const meal of day.meals) {
      const dish = dataset.dishesById.get(meal.dishId)!;
      assert.equal(
        checkDishAllergens(dish, ['shellfish'], dataset).safe,
        true,
        `Shared dish ${dish.dish_id} must NOT expose shellfish-allergic member`
      );
    }
  }

  const variety = validateWeeklyVariety(plan.days, dataset);
  assert.equal(variety.valid, true, `Variety violations: ${JSON.stringify(variety.violations)}`);

  // Single meal regeneration cannot introduce shellfish either
  const regen = regenerateSingleMeal(plan, 0, 'L', profile, dataset);
  assert.equal(regen.replaced, true);
  const newLunch = dataset.dishesById.get(
    regen.plan.days[0].meals.find((m) => m.slot === 'L')!.dishId
  )!;
  assert.equal(checkDishAllergens(newLunch, ['shellfish'], dataset).safe, true);

  // Explicit swap to a shellfish dish MUST be blocked
  const blockedSwap = regenerateSingleMeal(plan, 0, 'L', profile, dataset, 'sinigang_hipon');
  assert.equal(blockedSwap.replaced, false);
  assert.ok(blockedSwap.message?.includes('Blocked for allergen safety'));
});

test('Backward-compatible v1 -> v2 profile migration preserves existing users data without loss', () => {
  const legacyV1Profile = {
    onboardingCompleted: true,
    onboardingStep: 9,
    location: {
      regionCode: '050000000',
      regionName: 'Bicol Region',
      regionKey: 'r5',
      provinceCode: '050500000',
      provinceName: 'Albay',
      cityCode: '050506000',
      cityName: 'City of Legazpi',
    },
    language: 'taglish' as const,
    household: [
      { id: 'old-1', label: 'Nanay', age: 45 },
      { id: 'old-2', label: 'Bunso', age: 12 },
    ] as unknown as ReturnType<typeof createDefaultProfile>['household'],
    weeklyBudgetPhp: 3200,
    budgetPreset: 'tipid' as const,
    preferredStore: 'puregold' as const,
    calories: {
      mode: 'manual' as const,
      age: 45,
      sex: 'female' as const,
      heightCm: 155,
      weightKg: 60,
      activityLevel: 'light' as const,
      goal: 'maintain' as const,
      goalAdjustmentKcal: 0,
      manualTargetKcal: 1750,
    },
    allergies: ['peanut' as const],
    dietaryPrefs: ['halal' as const],
    dislikes: ['ampalaya'],
    pantry: [{ id: 'p-1', ingredientId: 'rice_raw', name: 'Bigas', sufficient: true }],
  };

  const migrated = migrateProfile(legacyV1Profile);
  assert.equal(migrated.onboardingCompleted, true);
  assert.equal(migrated.location.cityName, 'City of Legazpi');
  assert.equal(migrated.weeklyBudgetPhp, 3200);
  assert.deepEqual(migrated.allergies, ['peanut']);
  assert.deepEqual(migrated.dietaryPrefs, ['halal']);
  assert.equal(migrated.pantry.length, 1);
  assert.equal(migrated.household.length, 2);
  assert.equal(migrated.household[0].label, 'Nanay');
  assert.equal(migrated.household[0].calorieMode, 'manual');
  assert.equal(migrated.household[0].manualTargetKcal, 1750);
  assert.equal(migrated.household[1].label, 'Bunso');
  assert.equal(migrated.household[1].calorieMode, 'manual'); // minor <18 forced safe manual mode
  assert.equal(migrated.weeklySchedule.selectedDays.length, 7);
  assert.ok(migrated.weeklySchedule.memberSchedules['old-1']);
  assert.ok(migrated.weeklySchedule.memberSchedules['old-2']);
});

test('Mifflin-St Jeor BMR/TDEE and household serving calculations work accurately', () => {
  const maleRes = calculateCalorieTarget({
    mode: 'auto',
    age: 30,
    sex: 'male',
    heightCm: 170,
    weightKg: 70,
    activityLevel: 'sedentary',
    goal: 'maintain',
    goalAdjustmentKcal: 0,
    manualTargetKcal: 2000,
  });
  assert.equal(maleRes.bmr, 1618);
  assert.equal(maleRes.tdee, 1941);
  assert.equal(maleRes.isRestrictiveWarning, false);

  const femaleRes = calculateCalorieTarget({
    mode: 'auto',
    age: 28,
    sex: 'female',
    heightCm: 160,
    weightKg: 55,
    activityLevel: 'sedentary',
    goal: 'lose',
    goalAdjustmentKcal: -600,
    manualTargetKcal: 1500,
  });
  assert.equal(femaleRes.bmr, 1249);
  assert.equal(femaleRes.isRestrictiveWarning, true);

  const portions = calculateHouseholdServings([
    createHouseholdMember({ id: '1', label: 'Adult', age: 30 }),
    createHouseholdMember({ id: '2', label: 'Child', age: 7 }),
    createHouseholdMember({ id: '3', label: 'Senior', age: 70 }),
  ]);
  assert.equal(portions, 2.55); // 1.0 + 0.7 + 0.85
});

test('Regression 1: Previously-failing wheat + low-sodium + diabetic profile now passes cleanly, while genuinely infeasible profiles refuse invalid repeats', () => {
  // Formerly had only 2 dishes (sardinas only); expanded 226-dish dataset now produces a 100% valid 7-day plan
  const formerlyTight = createDefaultProfile();
  formerlyTight.allergies = ['wheat'];
  formerlyTight.dietaryPrefs = ['low_sodium', 'diabetic_friendly'];
  formerlyTight.budgetPreset = 'tipid';

  const validPlan = generateDeterministicWeeklyPlan(formerlyTight, dataset, { seed: 42 });
  assert.equal(validPlan.validationStatus, 'valid');
  assert.equal(validPlan.warnings.length, 0);
  const validCheck = validateCompleteWeeklyPlan(validPlan.days, formerlyTight, dataset);
  assert.equal(validCheck.valid, true, JSON.stringify(validCheck.issues));

  // Genuinely infeasible 8-allergen + vegetarian + low-sodium + diabetic profile MUST refuse to repeat dishes or relax hard rules
  const impossible = createDefaultProfile();
  impossible.allergies = ['egg', 'fish', 'shellfish', 'soy', 'wheat', 'milk', 'peanut', 'tree_nut'];
  impossible.dietaryPrefs = ['vegetarian', 'low_sodium', 'diabetic_friendly'];
  impossible.budgetPreset = 'tipid';

  const plan = generateDeterministicWeeklyPlan(impossible, dataset, { seed: 42 });
  assert.equal(plan.validationStatus, 'insufficient_recipes');
  assert.equal(plan.warnings.length, 0, 'Must never emit raw internal violation dumps');
  const totalMeals = plan.days.reduce((sum, d) => sum + d.meals.length, 0);
  assert.equal(totalMeals, 0, 'Must never generate invalid repeated meals just to fill slots');
  assert.ok(plan.insufficientRecipes);
  assert.ok(plan.insufficientRecipes!.exclusionBySlot);
  assert.ok(plan.statusMessage && plan.statusMessage.length > 15);
});

test('Regression 2: Bounded backtracking solves tough multi-constraint profiles with zero rule violations', () => {
  const toughCases: Array<{
    name: string;
    configure: (p: ReturnType<typeof createDefaultProfile>) => void;
  }> = [
    {
      name: 'Default balanced 7-day NCR household',
      configure: () => {},
    },
    {
      name: 'Pescatarian + tipid + one-burner stove + shellfish allergy',
      configure: (p) => {
        p.allergies = ['shellfish'];
        p.dietaryPrefs = ['pescatarian'];
        p.budgetPreset = 'tipid';
        p.equipment = ['one_burner_stove', 'rice_cooker'];
      },
    },
    {
      name: 'Shellfish + peanut + milk allergies + tipid',
      configure: (p) => {
        p.allergies = ['shellfish', 'peanut', 'milk'];
        p.budgetPreset = 'tipid';
      },
    },
    {
      name: 'Halal + shellfish allergy + tipid + Merienda enabled',
      configure: (p) => {
        p.allergies = ['shellfish'];
        p.dietaryPrefs = ['halal'];
        p.budgetPreset = 'tipid';
        p.includeMerienda = true;
        p.weeklySchedule = createDefaultWeeklySchedule(p.household, {
          preset: 'everyday',
          includeMerienda: true,
        });
      },
    },
    {
      name: 'Diabetic-friendly + milk + peanut allergies',
      configure: (p) => {
        p.allergies = ['milk', 'peanut'];
        p.dietaryPrefs = ['diabetic_friendly'];
      },
    },
  ];

  for (const tc of toughCases) {
    const profile = createDefaultProfile();
    tc.configure(profile);

    const plan = generateDeterministicWeeklyPlan(profile, dataset, { seed: 2026 });
    assert.equal(
      plan.validationStatus,
      'valid',
      `${tc.name} should generate a valid plan (got ${plan.validationStatus}: ${plan.statusMessage})`
    );
    assert.equal(plan.warnings.length, 0, `${tc.name} must have zero raw warnings`);

    const check = validateCompleteWeeklyPlan(plan.days, profile, dataset);
    assert.equal(
      check.valid,
      true,
      `${tc.name} failed complete validation: ${JSON.stringify(check.issues)}`
    );
    assert.equal(check.plannedDaysCount, 7, `${tc.name} should fill all 7 scheduled days`);
  }

  // 5-allergy profile now succeeds for a full 7-day valid plan thanks to expanded allergen-safe Filipino recipes
  const fiveAllergy = createDefaultProfile();
  fiveAllergy.allergies = ['soy', 'wheat', 'shellfish', 'peanut', 'milk'];
  const fullAttempt = generateDeterministicWeeklyPlan(fiveAllergy, dataset, { seed: 2026 });
  assert.equal(fullAttempt.validationStatus, 'valid');
  const fiveCheck = validateCompleteWeeklyPlan(fullAttempt.days, fiveAllergy, dataset);
  assert.equal(fiveCheck.valid, true, JSON.stringify(fiveCheck.issues));
  assert.equal(fiveCheck.plannedDaysCount, 7);
});

test('Regression 3: Cooking-time and shorter-plan relaxations require explicit user permission', () => {
  const profile = createDefaultProfile();
  profile.dietaryPrefs = ['vegetarian'];
  profile.cookTimeMode = 'strict';
  profile.maxCookTime = { B: 10, L: 15, D: 15 };

  // Without user permission, must NEVER silently violate maxCookTime or variety
  const strictAttempt = generateDeterministicWeeklyPlan(profile, dataset, { seed: 99 });
  assert.equal(strictAttempt.validationStatus, 'insufficient_recipes');
  assert.equal(
    strictAttempt.days.reduce((sum, d) => sum + d.meals.length, 0),
    0
  );
  assert.equal(strictAttempt.insufficientRecipes?.canRelaxCookTime, true);
  assert.equal(strictAttempt.insufficientRecipes?.canGenerateShorterPlan, true);

  // Explicit opt-in: allow longer cooking times -> valid 7-day plan still passing ALL hard rules
  const relaxedTimePlan = generateDeterministicWeeklyPlan(profile, dataset, {
    seed: 99,
    allowRelaxCookTime: true,
  });
  assert.equal(relaxedTimePlan.validationStatus, 'valid');
  assert.equal(relaxedTimePlan.relaxedByUser?.cookTime, true);
  const relaxedCheck = validateCompleteWeeklyPlan(relaxedTimePlan.days, profile, dataset, {
    allowRelaxCookTime: true,
  });
  assert.equal(relaxedCheck.valid, true, JSON.stringify(relaxedCheck.issues));
  assert.equal(relaxedCheck.plannedDaysCount, 7);

  // Explicit opt-in: shorter valid plan (keeping strict cook time) -> valid subset of days passing ALL hard rules
  const shorterPlan = generateDeterministicWeeklyPlan(profile, dataset, {
    seed: 99,
    allowShorterPlan: true,
  });
  assert.equal(shorterPlan.validationStatus, 'valid');
  assert.equal(shorterPlan.relaxedByUser?.shorterPlan, true);
  const shorterCheck = validateCompleteWeeklyPlan(shorterPlan.days, profile, dataset, {
    allowRelaxCookTime: false,
    allowShorterPlan: true,
  });
  assert.equal(shorterCheck.valid, true, JSON.stringify(shorterCheck.issues));
  assert.ok(shorterCheck.plannedDaysCount >= 1 && shorterCheck.plannedDaysCount < 7);
});

test('Regression 4: Gemini validation enforces identical hard rules (rejects duplicates, allergens, slow dishes, and protein floods)', () => {
  const profile = createDefaultProfile();
  profile.allergies = ['shellfish'];
  profile.cookTimeMode = 'strict';
  profile.maxCookTime = { B: 30, L: 45, D: 45 };

  // Inject intentionally invalid Gemini output: duplicates, shellfish allergen, 90m dish > 45m limit, and 4 fish dishes in Days 1-3
  const badGeminiSlots = [
    { dayIndex: 0, slot: 'B' as const, dishId: 'ginisang_sardinas' },
    { dayIndex: 0, slot: 'L' as const, dishId: 'sinigang_hipon' }, // Shellfish allergen!
    { dayIndex: 0, slot: 'D' as const, dishId: 'ginisang_sardinas' }, // Duplicate!
    { dayIndex: 1, slot: 'L' as const, dishId: 'kare_kare' }, // 90m > 45m + shellfish!
    { dayIndex: 1, slot: 'D' as const, dishId: 'ginisang_upo' }, // fish #2
    { dayIndex: 2, slot: 'L' as const, dishId: 'sinigang_bangus' }, // fish #3 in Days 1-3!
    { dayIndex: 2, slot: 'D' as const, dishId: 'paksiw_na_isda' }, // fish #4 in Days 1-3!
  ];

  const validated = validateAndEnrichGeminiPlan(badGeminiSlots, profile, dataset, null, {
    seed: 123,
  });

  assert.equal(validated.validationStatus, 'valid');
  assert.equal(validated.warnings.length, 0);
  const fullCheck = validateCompleteWeeklyPlan(validated.days, profile, dataset);
  assert.equal(fullCheck.valid, true, JSON.stringify(fullCheck.issues));

  // Parity on genuinely infeasible profile: Gemini validator also returns insufficient_recipes with 0 invalid meals
  const impossibleProfile = createDefaultProfile();
  impossibleProfile.allergies = ['egg', 'fish', 'shellfish', 'soy', 'wheat', 'milk', 'peanut', 'tree_nut'];
  impossibleProfile.dietaryPrefs = ['vegetarian', 'low_sodium', 'diabetic_friendly'];
  const geminiImpossible = validateAndEnrichGeminiPlan(
    [{ dayIndex: 0, slot: 'B', dishId: 'ginisang_sardinas' }],
    impossibleProfile,
    dataset
  );
  assert.equal(geminiImpossible.validationStatus, 'insufficient_recipes');
  assert.equal(
    geminiImpossible.days.reduce((sum, d) => sum + d.meals.length, 0),
    0
  );
});

test('Regression 5: Stale invalid cached meal plans are rejected while fresh valid plans pass cache validation', () => {
  const profile = createDefaultProfile();
  const validPlan = generateDeterministicWeeklyPlan(profile, dataset, { seed: 303 });
  assert.equal(isCachedMealPlanValid(validPlan, profile, dataset), true);

  // Build a corrupted cached plan replicating the exact reported screenshot failure
  const brokenPlan = {
    ...validPlan,
    warnings: [
      '"Ginisang upo at sardinas" appears 9 times in the week (max 1).',
      '"Ginisang sardinas with egg" appears 9 times in the week (max 1).',
      'Main protein "fish" appears 6 times across Days 1–3 (max 2 in 3 consecutive days).',
    ],
    days: validPlan.days.map((d) => ({
      ...d,
      meals: d.meals.map((m, idx) => ({
        ...m,
        dishId: idx % 2 === 0 ? 'ginisang_sardinas' : 'ginisang_upo',
      })),
    })),
  };

  assert.equal(isCachedMealPlanValid(brokenPlan, profile, dataset), false);
});

test('Regression 6: Candidate selection produces diverse menus across seeds rather than always picking the same cheapest dishes', () => {
  const profile = createDefaultProfile();
  profile.budgetPreset = 'tipid';

  const planA = generateDeterministicWeeklyPlan(profile, dataset, { seed: 1001 });
  const planB = generateDeterministicWeeklyPlan(profile, dataset, { seed: 9009 });

  assert.equal(planA.validationStatus, 'valid');
  assert.equal(planB.validationStatus, 'valid');

  const idsA = new Set(planA.days.flatMap((d) => d.meals.map((m) => m.dishId)));
  const idsB = new Set(planB.days.flatMap((d) => d.meals.map((m) => m.dishId)));

  let diffs = 0;
  for (const id of idsA) {
    if (!idsB.has(id)) diffs++;
  }
  assert.ok(diffs >= 5, `Expected diverse dish selection across seeds, found only ${diffs} differing dishes`);
});

test('Upgrade 1: Rosario, La Union flexible meal-slot suitability, exclusion diagnostics, and strict 7-day plan validity', () => {
  // Verify L <-> D flexibility for Filipino ulam/noodles/tokwa while keeping merienda sweets out of main ulam slots
  const chickenAdobo = dataset.dishesById.get('chicken_adobo')!;
  assert.notEqual(getDishSlotSuitability(chickenAdobo, 'L'), 'unsuitable');
  assert.notEqual(getDishSlotSuitability(chickenAdobo, 'D'), 'unsuitable');

  const profile = createDefaultProfile();
  profile.location = {
    regionCode: '010000000',
    regionName: 'Ilocos Region',
    regionKey: 'r1',
    provinceCode: '013300000',
    provinceName: 'La Union',
    cityCode: '013313000',
    cityName: 'Rosario',
  };
  profile.allergies = ['shellfish'];
  profile.dietaryPrefs = ['low_sodium'];
  profile.maxCookTime = { B: 20, L: 35, D: 35 };

  const diagB = computeRecipeExclusionDiagnostics(
    'B',
    { allergies: profile.allergies, dietaryPrefs: profile.dietaryPrefs, dislikes: [] },
    profile.equipment,
    profile.maxCookTime,
    dataset
  );
  const diagL = computeRecipeExclusionDiagnostics(
    'L',
    { allergies: profile.allergies, dietaryPrefs: profile.dietaryPrefs, dislikes: [] },
    profile.equipment,
    profile.maxCookTime,
    dataset
  );
  const diagD = computeRecipeExclusionDiagnostics(
    'D',
    { allergies: profile.allergies, dietaryPrefs: profile.dietaryPrefs, dislikes: [] },
    profile.equipment,
    profile.maxCookTime,
    dataset
  );

  // Dramatic expansion over BEFORE baseline (was B:3, L:2, D:2)
  assert.ok(diagB.eligibleCount >= 30, `Expected >=30 restricted breakfasts, got ${diagB.eligibleCount}`);
  assert.ok(diagL.eligibleCount >= 60, `Expected >=60 restricted lunches, got ${diagL.eligibleCount}`);
  assert.ok(diagD.eligibleCount >= 60, `Expected >=60 restricted dinners, got ${diagD.eligibleCount}`);
  assert.equal(diagL.excludedByMissingIngredients, 0);
  assert.ok(diagL.excludedByAllergy > 0);
  assert.ok(diagL.excludedByDietary > 0);

  const plan = generateDeterministicWeeklyPlan(profile, dataset, { seed: 2026 });
  assert.equal(plan.validationStatus, 'valid');
  assert.ok(
    plan.eligibilitySummary?.eligibleCountBySlot.B &&
      plan.eligibilitySummary?.eligibleCountBySlot.L &&
      plan.eligibilitySummary?.eligibleCountBySlot.D
  );
  const check = validateCompleteWeeklyPlan(plan.days, profile, dataset);
  assert.equal(check.valid, true, JSON.stringify(check.issues));
  assert.equal(check.plannedDaysCount, 7);
});

test('Upgrade 2: Realistic Philippine retail packaging prevents fractional grams/ml and reconciles item costs to the centavo', () => {
  const r1 = dataset.regionsByKey.get('r1')!;

  // 10 g cornstarch -> 1 pack (100 g), 90 g leftover, exact reconciliation
  const cornstarch = dataset.ingredientsById.get('cornstarch')!;
  assert.equal(cornstarch.grocery_section, 'Sangkap at Pampalasa');
  const csBuy = resolveRetailPurchase(cornstarch, 10, r1, 'palengke');
  assert.equal(csBuy.purchasedBaseQty, 100);
  assert.equal(csBuy.retailPackageLabel, '1 pack (100 g)');
  assert.equal(csBuy.leftoverBaseQty, 90);
  assert.equal(csBuy.isProvisionalPackagePrice, true);
  assert.equal(
    Number((csBuy.consumptionCostPhp + csBuy.leftoverValuePhp).toFixed(2)),
    csBuy.packageCostPhp
  );

  // 14 eggs at palengke OR 13 eggs at supermarket -> 1 half tray (15 pcs) with exact centavo reconciliation
  const egg = dataset.ingredientsById.get('egg')!;
  const eggBuyPalengke = resolveRetailPurchase(egg, 14, r1, 'palengke');
  assert.equal(eggBuyPalengke.purchasedBaseQty, 15);
  assert.equal(eggBuyPalengke.retailPackageLabel, '1 half tray (15 pcs)');
  assert.equal(eggBuyPalengke.leftoverBaseQty, 1);
  assert.equal(
    Number((eggBuyPalengke.consumptionCostPhp + eggBuyPalengke.leftoverValuePhp).toFixed(2)),
    eggBuyPalengke.packageCostPhp
  );
  const eggBuySupermarket = resolveRetailPurchase(egg, 13, r1, 'puregold');
  assert.equal(eggBuySupermarket.purchasedBaseQty, 15);
  assert.equal(eggBuySupermarket.retailPackageLabel, '1 half tray (15 pcs)');
  assert.equal(eggBuySupermarket.leftoverBaseQty, 2);

  // 200 g sardines -> 2 cans (155 g each = 310 g), integer cans
  const sardines = dataset.ingredientsById.get('sardines_tomato')!;
  const sardBuy = resolveRetailPurchase(sardines, 200, r1, 'palengke');
  assert.equal(sardBuy.packageCount, 2);
  assert.equal(sardBuy.purchasedBaseQty, 310);
  assert.equal(sardBuy.retailPackageLabel, '2 cans (155 g)');
});

test('Upgrade 3: Whole Chicken consolidation & 3-figure reconciled grocery totals across non-consecutive chicken dishes', () => {
  const m1 = createHouseholdMember({ id: 'm1', label: 'Ate', age: 30 });
  const m2 = createHouseholdMember({ id: 'm2', label: 'Kuya', age: 32 });
  const m3 = createHouseholdMember({ id: 'm3', label: 'Bunso', age: 10 });
  const profile = createDefaultProfile();
  profile.location = {
    regionCode: '010000000',
    regionName: 'Ilocos Region',
    regionKey: 'r1',
    provinceCode: '013300000',
    provinceName: 'La Union',
    cityCode: '013313000',
    cityName: 'Rosario',
  };
  profile.household = [m1, m2, m3];
  profile.pantry = [];
  profile.weeklySchedule = createDefaultWeeklySchedule([m1, m2, m3], { preset: 'everyday' });

  // Build a strictly valid plan with 3 chicken dishes spread across Mon, Thu, Sun (never exceeding 2 in 3 consecutive days)
  const basePlan = generateDeterministicWeeklyPlan(profile, dataset, { seed: 2026 });
  assert.equal(basePlan.validationStatus, 'valid');
  const chickenPlan = {
    ...basePlan,
    days: basePlan.days.map((d) => ({
      ...d,
      meals: d.meals.map((m) => {
        if (d.dayIndex === 0 && m.slot === 'L') return { ...m, dishId: 'chicken_adobo', servings: 3 };
        if (d.dayIndex === 3 && m.slot === 'L') return { ...m, dishId: 'chicken_tinola', servings: 3 };
        if (d.dayIndex === 6 && m.slot === 'D') return { ...m, dishId: 'chicken_afritada', servings: 3 };
        return m;
      }),
    })),
  };

  const grocery = generateGroceryList(chickenPlan, profile, dataset);

  // Whole Chicken bulk consolidation triggered
  const wholeChickenPlan = grocery.bulkPlans.find((bp) => bp.category === 'whole_chicken');
  assert.ok(wholeChickenPlan, 'Expected Whole Chicken bulk consolidation for 3 chicken dishes');
  assert.ok(wholeChickenPlan.edibleYieldLabel?.includes('72%'));
  assert.ok(wholeChickenPlan.bonesOrByproductNote?.toLowerCase().includes('broth'));
  assert.ok(wholeChickenPlan.allocations.length >= 3);
  const allocDishIds = new Set(wholeChickenPlan.allocations.map((a) => a.dishId));
  assert.ok(allocDishIds.has('chicken_adobo'));
  assert.ok(allocDishIds.has('chicken_tinola'));
  assert.ok(allocDishIds.has('chicken_afritada'));
  assert.ok(wholeChickenPlan.estimatedSavingsPhp > 0);
  assert.ok(wholeChickenPlan.storageNote.length > 15);

  // Strict 3-figure reconciliation across sections and totals
  const sumSectionCheckout = Number(
    grocery.sections.reduce((acc, s) => acc + s.subtotalPhp, 0).toFixed(2)
  );
  const sumSectionConsumption = Number(
    grocery.sections.reduce((acc, s) => acc + s.consumptionSubtotalPhp, 0).toFixed(2)
  );
  const sumSectionLeftover = Number(
    grocery.sections.reduce((acc, s) => acc + s.leftoverValueSubtotalPhp, 0).toFixed(2)
  );

  assert.equal(grocery.totalCheckoutCostPhp, sumSectionCheckout);
  assert.equal(grocery.totalEstimatedPhp, grocery.totalCheckoutCostPhp);
  assert.equal(grocery.totalConsumptionCostPhp, sumSectionConsumption);
  assert.equal(grocery.totalLeftoverInventoryValuePhp, sumSectionLeftover);
  assert.ok(
    Math.abs(
      grocery.totalConsumptionCostPhp +
        grocery.totalLeftoverInventoryValuePhp -
        grocery.totalCheckoutCostPhp
    ) <= 0.05,
    `Expected consumption (${grocery.totalConsumptionCostPhp}) + leftover (${grocery.totalLeftoverInventoryValuePhp}) === checkout (${grocery.totalCheckoutCostPhp})`
  );
  assert.ok(grocery.leftoverInventoryItems.length > 0);
});


import test from 'node:test';
import assert from 'node:assert/strict';
import { getNodeDataset } from '../datasetNode';
import {
  DIETARY_PREFS_LIST,
  checkDishDietaryEligibility,
  computeDishIngredientNutrition,
  computeRecipeExclusionDiagnostics,
  detectDietaryConflicts,
  isDishEligibleForProfile,
} from '../allergens';
import { generateDeterministicWeeklyPlan } from '../planner';
import { generateGroceryList } from '../grocery';
import { validateCompleteWeeklyPlan } from '../variety';
import { createDefaultProfile, createHouseholdMember } from '../storage';
import { createDefaultWeeklySchedule } from '../schedule';

const dataset = getNodeDataset();

test('Dataset expansion: 250 validated Filipino recipes with prep_min and Panlasang Pinoy reference attribution on added dishes', () => {
  assert.equal(dataset.dishes.length, 250);
  assert.equal(dataset.validationReport.isValid, true);
  assert.equal(dataset.validationReport.brokenReferences.length, 0);

  const ids = new Set(dataset.dishes.map((d) => d.dish_id));
  const names = new Set(dataset.dishes.map((d) => d.name_local.trim().toLowerCase()));
  assert.equal(ids.size, 250);
  assert.equal(names.size, 250);

  for (const d of dataset.dishes) {
    assert.ok(d.prep_min >= 5 && d.prep_min <= d.time_min, `${d.dish_id} invalid prep_min=${d.prep_min} vs time_min=${d.time_min}`);
  }

  const attributed = dataset.dishes.filter((d) => Boolean(d.source_url));
  assert.equal(attributed.length, 24);
  const monggoChicken = dataset.dishesById.get('ginisang_monggo_manok');
  assert.ok(monggoChicken);
  assert.ok(monggoChicken.source_url?.includes('panlasangpinoy.com'));
  assert.equal(monggoChicken.prep_min, 10);
  assert.equal(monggoChicken.time_min, 40);
});

test('Expanded dietary preferences: 21 preferences, conflict detection, configurable Keto vs Low-carb, and per-member independence', () => {
  assert.equal(DIETARY_PREFS_LIST.length, 21);

  // Conflict detection
  const hardConflicts = detectDietaryConflicts(['vegan', 'pescatarian']);
  assert.ok(hardConflicts.some((c) => c.severity === 'conflict'));
  const seafoodConflict = detectDietaryConflicts(['pescatarian', 'no_seafood']);
  assert.ok(seafoodConflict.some((c) => c.severity === 'conflict'));
  const ketoLowFat = detectDietaryConflicts(['keto', 'low_fat']);
  assert.ok(ketoLowFat.some((c) => c.severity === 'warning'));
  assert.equal(detectDietaryConflicts(['halal', 'high_protein', 'dairy_free']).length, 0);

  // Ingredient-quantity nutrition check & Keto strictly tighter than Low-carb
  const chickenSalpicao = dataset.dishesById.get('chicken_salpicao')!;
  const salpicaoNutr = computeDishIngredientNutrition(chickenSalpicao, dataset);
  assert.ok(
    salpicaoNutr.proteinPerServing >= 35,
    `Expected high protein on chicken_salpicao, got ${salpicaoNutr.proteinPerServing}`
  );
  assert.ok(
    salpicaoNutr.carbsPerServing < 7,
    `Expected very low carbs on chicken_salpicao, got ${salpicaoNutr.carbsPerServing}`
  );

  const pinakbetVegan = dataset.dishesById.get('pinakbet_vegan')!;
  const pinakbetNutr = computeDishIngredientNutrition(pinakbetVegan, dataset);
  assert.ok(pinakbetNutr.carbsPerServing > 9 && pinakbetNutr.carbsPerServing <= 25);
  // Pinakbet vegan passes low_carb (<=25g) and vegan/plant_based/high_fiber/low_fat/dairy_free/gluten_free,
  // but fails strict 20g/day Keto (per-meal cap ~7g)
  assert.equal(
    checkDishDietaryEligibility(pinakbetVegan, ['low_carb', 'vegan', 'plant_based', 'dairy_free', 'gluten_free', 'low_fat'], [], dataset).eligible,
    true
  );
  assert.equal(
    checkDishDietaryEligibility(pinakbetVegan, ['keto'], [], dataset, { ketoMaxCarbsPerDayG: 20 }).eligible,
    false
  );
  assert.equal(
    checkDishDietaryEligibility(chickenSalpicao, ['keto', 'high_protein', 'gluten_free', 'dairy_free', 'no_pork', 'no_beef', 'no_seafood', 'no_spicy', 'no_processed_meat'], [], dataset, { ketoMaxCarbsPerDayG: 20 }).eligible,
    true
  );

  // Food exclusions enforcement
  const bicolChicken = dataset.dishesById.get('bicol_express_manok')!;
  assert.equal(checkDishDietaryEligibility(bicolChicken, ['no_spicy'], [], dataset).eligible, false);
  const cornedBeefTorta = dataset.dishesById.get('tortang_corned_beef')!;
  assert.equal(checkDishDietaryEligibility(cornedBeefTorta, ['no_processed_meat'], [], dataset).eligible, false);
  assert.equal(checkDishDietaryEligibility(cornedBeefTorta, ['no_beef'], [], dataset).eligible, false);

  // Per-member independence in shared meals: Member 2 is no_pork + dairy_free
  const m1 = createHouseholdMember({ id: 'm1', label: 'Ana', age: 29, dietaryPrefs: [] });
  const m2 = createHouseholdMember({ id: 'm2', label: 'Ben', age: 31, dietaryPrefs: ['no_pork', 'dairy_free', 'no_spicy'] });
  const profile = createDefaultProfile();
  profile.household = [m1, m2];
  profile.weeklySchedule = createDefaultWeeklySchedule([m1, m2], { preset: 'weekdays' });

  const plan = generateDeterministicWeeklyPlan(profile, dataset, { seed: 777 });
  assert.equal(plan.validationStatus, 'valid');
  const fullCheck = validateCompleteWeeklyPlan(plan.days, profile, dataset);
  assert.equal(fullCheck.valid, true, JSON.stringify(fullCheck.issues));
});

test('Cooking time preference defaults to Flexible (no limit), supports Prefer Quick without excluding slow dishes, and enforces Strict mode', () => {
  const profile = createDefaultProfile();
  assert.equal(profile.cookTimeMode, 'flexible');

  const slowDish = dataset.dishesById.get('nilagang_baka')!; // 90 min
  assert.ok(slowDish.time_min > 45);
  profile.maxCookTime = { B: 20, L: 30, D: 30 };

  // Flexible: slow dish is NOT excluded
  profile.cookTimeMode = 'flexible';
  assert.equal(isDishEligibleForProfile(slowDish, 'L', profile, dataset).eligible, true);
  const diagFlex = computeRecipeExclusionDiagnostics(
    'L',
    { allergies: [], dietaryPrefs: [], dislikes: [] },
    profile.equipment,
    profile.maxCookTime,
    dataset,
    { cookTimeMode: 'flexible' }
  );
  assert.equal(diagFlex.excludedByCookTime, 0);

  // Prefer quick: slow dish is STILL eligible (soft ranking preference, never excluded)
  profile.cookTimeMode = 'prefer_quick';
  assert.equal(isDishEligibleForProfile(slowDish, 'L', profile, dataset).eligible, true);
  const diagPrefer = computeRecipeExclusionDiagnostics(
    'L',
    { allergies: [], dietaryPrefs: [], dislikes: [] },
    profile.equipment,
    profile.maxCookTime,
    dataset,
    { cookTimeMode: 'prefer_quick' }
  );
  assert.equal(diagPrefer.excludedByCookTime, 0);

  // Strict: slow dish IS excluded unless allowRelaxCookTime
  profile.cookTimeMode = 'strict';
  assert.equal(isDishEligibleForProfile(slowDish, 'L', profile, dataset).eligible, false);
  const diagStrict = computeRecipeExclusionDiagnostics(
    'L',
    { allergies: [], dietaryPrefs: [], dislikes: [] },
    profile.equipment,
    profile.maxCookTime,
    dataset,
    { cookTimeMode: 'strict' }
  );
  assert.ok(diagStrict.excludedByCookTime > 0);
});

test('Filipino batch buying: Whole Chicken consolidation across Adobo + Tinola + Ginisang Monggo with Chicken & Rosario, La Union end-to-end check', () => {
  const m1 = createHouseholdMember({ id: 'm1', label: 'Nanay', age: 34 });
  const m2 = createHouseholdMember({ id: 'm2', label: 'Tatay', age: 36 });
  const m3 = createHouseholdMember({ id: 'm3', label: 'Anak', age: 12 });

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
  profile.cookTimeMode = 'flexible';
  profile.weeklyBudgetPhp = 2600;
  profile.weeklySchedule = createDefaultWeeklySchedule([m1, m2, m3], { preset: 'everyday' });

  // 1. Targeted Rosario, La Union 7-day plan generation
  const plan = generateDeterministicWeeklyPlan(profile, dataset, { seed: 2026 });
  assert.equal(plan.validationStatus, 'valid');
  assert.equal(plan.warnings.length, 0);
  const check = validateCompleteWeeklyPlan(plan.days, profile, dataset);
  assert.equal(check.valid, true, JSON.stringify(check.issues));
  assert.equal(check.plannedDaysCount, 7);

  // 2. Whole Chicken consolidation across Adobo (Mon) + Tinola (Thu) + Ginisang Monggo with Chicken (Sun)
  const batchPlan = {
    ...plan,
    days: plan.days.map((d) => ({
      ...d,
      meals: d.meals.map((m) => {
        if (d.dayIndex === 0 && m.slot === 'L') return { ...m, dishId: 'chicken_adobo', servings: 3 };
        if (d.dayIndex === 3 && m.slot === 'L') return { ...m, dishId: 'chicken_tinola', servings: 3 };
        if (d.dayIndex === 6 && m.slot === 'D') return { ...m, dishId: 'ginisang_monggo_manok', servings: 3 };
        return m;
      }),
    })),
  };

  const grocery = generateGroceryList(batchPlan, profile, dataset);
  const wholeChicken = grocery.bulkPlans.find((b) => b.category === 'whole_chicken');
  assert.ok(wholeChicken, 'Expected Whole Chicken bulk plan across Adobo, Tinola & Ginisang Monggo with Chicken');
  const dishIds = new Set(wholeChicken.allocations.map((a) => a.dishId));
  assert.ok(dishIds.has('chicken_adobo'));
  assert.ok(dishIds.has('chicken_tinola'));
  assert.ok(dishIds.has('ginisang_monggo_manok'));
  assert.ok(wholeChicken.edibleYieldLabel?.includes('72%'));
  assert.ok(wholeChicken.bonesOrByproductNote?.includes('28%'));
  assert.ok(wholeChicken.storageNote.toLowerCase().includes('freeze'));

  // Exact 3-figure reconciliation
  assert.ok(
    Math.abs(
      grocery.totalConsumptionCostPhp +
        grocery.totalLeftoverInventoryValuePhp -
        grocery.totalCheckoutCostPhp
    ) <= 0.05
  );
  assert.equal(grocery.totalEstimatedPhp, grocery.totalCheckoutCostPhp);
});

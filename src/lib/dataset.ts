import {
  GROCERY_SECTIONS,
  type BudgetPreset,
  type CityOverride,
  type DatasetValidationIssue,
  type DatasetValidationReport,
  type Dish,
  type DishIngredient,
  type GrocerySection,
  type HiddenAllergen,
  type Ingredient,
  type IngredientSwap,
  type MealSlot,
  type PriceGroup,
  type ProvinceCuisine,
  type RegionRecord,
  type UlamWiseDataset,
} from '../types';
import { parseCsv, parseOptionalNumber, parseYesNo, splitSemicolon } from './csv';

export interface RawCsvBundle {
  dishes: string;
  ingredients: string;
  dishIngredients: string;
  hiddenAllergens: string;
  ingredientSwaps: string;
  regions: string;
  provinceCuisineMap: string;
  cityOverrides: string;
}

const VALID_SECTIONS = new Set<string>(GROCERY_SECTIONS);
const VALID_PRICE_GROUPS = new Set<string>(['staples', 'veg', 'fish', 'meat', 'packaged']);
const VALID_SLOTS = new Set<string>(['B', 'L', 'D', 'M']);

function asGrocerySection(val: string): GrocerySection {
  return VALID_SECTIONS.has(val) ? (val as GrocerySection) : 'Iba pa';
}

function asPriceGroup(val: string): PriceGroup {
  return VALID_PRICE_GROUPS.has(val) ? (val as PriceGroup) : 'packaged';
}

function asBudgetPreset(val: string): BudgetPreset {
  if (val === 'tipid' || val === 'balanced' || val === 'sagana') return val;
  return 'balanced';
}

/**
 * Parses and validates all 8 UlamWise CSV files into a normalized, indexed dataset
 * accompanied by a complete DatasetValidationReport. Never silently discards invalid rows.
 */
export function buildDatasetFromRawCsv(raw: RawCsvBundle): UlamWiseDataset {
  const brokenReferences: DatasetValidationIssue[] = [];
  const warnings: DatasetValidationIssue[] = [];
  let invalidRowCount = 0;

  // 1. Ingredients
  const parsedIng = parseCsv(raw.ingredients);
  for (const m of parsedIng.malformedRows) {
    invalidRowCount++;
    brokenReferences.push({
      file: 'ingredients.csv',
      row: m.lineNumber,
      severity: 'error',
      message: `Expected ${m.expectedCols} columns, found ${m.actualCols}`,
    });
  }
  const ingredients: Ingredient[] = [];
  const ingredientsById = new Map<string, Ingredient>();
  for (const row of parsedIng.rows) {
    const v = row.values;
    const id = v.ingredient_id?.trim();
    if (!id) {
      invalidRowCount++;
      brokenReferences.push({
        file: 'ingredients.csv',
        row: row.lineNumber,
        severity: 'error',
        message: 'Missing canonical ingredient_id',
      });
      continue;
    }
    const price = parseOptionalNumber(v.price_php_ncr_palengke);
    if (price === null || price < 0) {
      warnings.push({
        file: 'ingredients.csv',
        row: row.lineNumber,
        severity: 'warning',
        message: `Ingredient "${id}" missing valid NCR palengke price`,
      });
    }
    const ing: Ingredient = {
      ingredient_id: id,
      name_en: v.name_en || id,
      name_fil: v.name_fil || v.name_en || id,
      grocery_section: asGrocerySection(v.grocery_section),
      price_group: asPriceGroup(v.price_group),
      base_unit: v.base_unit === 'ml' || v.base_unit === 'pc' ? v.base_unit : 'g',
      nutrition_basis:
        v.nutrition_basis === 'per_100ml' || v.nutrition_basis === 'per_piece'
          ? v.nutrition_basis
          : 'per_100g',
      kcal: parseOptionalNumber(v.kcal) ?? 0,
      protein_g: parseOptionalNumber(v.protein_g) ?? 0,
      carbs_g: parseOptionalNumber(v.carbs_g) ?? 0,
      fat_g: parseOptionalNumber(v.fat_g) ?? 0,
      price_php_ncr_palengke: price ?? 0,
      price_basis:
        v.price_basis === 'per_liter' || v.price_basis === 'per_piece' ? v.price_basis : 'per_kg',
      pantry_staple: parseYesNo(v.pantry_staple),
      allergens: splitSemicolon(v.allergens),
      may_contain: splitSemicolon(v.may_contain),
      diet_flags: splitSemicolon(v.diet_flags),
      notes: v.notes || '',
    };
    if (ingredientsById.has(id)) {
      warnings.push({
        file: 'ingredients.csv',
        row: row.lineNumber,
        severity: 'warning',
        message: `Duplicate ingredient_id "${id}"`,
      });
    }
    ingredients.push(ing);
    ingredientsById.set(id, ing);
  }

  // 2. Dishes
  const parsedDishes = parseCsv(raw.dishes);
  for (const m of parsedDishes.malformedRows) {
    invalidRowCount++;
    brokenReferences.push({
      file: 'dishes.csv',
      row: m.lineNumber,
      severity: 'error',
      message: `Expected ${m.expectedCols} columns, found ${m.actualCols}`,
    });
  }
  const dishes: Dish[] = [];
  const dishesById = new Map<string, Dish>();
  for (const row of parsedDishes.rows) {
    const v = row.values;
    const id = v.dish_id?.trim();
    if (!id) {
      invalidRowCount++;
      brokenReferences.push({
        file: 'dishes.csv',
        row: row.lineNumber,
        severity: 'error',
        message: 'Missing canonical dish_id',
      });
      continue;
    }
    const slots = splitSemicolon(v.meal_types).filter((s): s is MealSlot => VALID_SLOTS.has(s));
    const ricePairing =
      v.rice_pairing === 'no' || v.rice_pairing === 'optional' ? v.rice_pairing : 'yes';

    const dish: Dish = {
      dish_id: id,
      name_en: v.name_en || id,
      name_local: v.name_local || v.name_en || id,
      cuisine_zones: splitSemicolon(v.cuisine_zones),
      meal_types: slots.length > 0 ? slots : ['L', 'D'],
      main_protein: (v.main_protein || 'mixed').toLowerCase(),
      method: v.method || 'stew',
      time_min: parseOptionalNumber(v.time_min) ?? 30,
      difficulty_1_3: parseOptionalNumber(v.difficulty_1_3) ?? 1,
      equipment: splitSemicolon(v.equipment),
      rice_pairing: ricePairing,
      tags: splitSemicolon(v.tags),
      base_servings: parseOptionalNumber(v.base_servings) ?? 4,
      kcal_per_serving: parseOptionalNumber(v.kcal_per_serving),
      protein_g: parseOptionalNumber(v.protein_g),
      carbs_g: parseOptionalNumber(v.carbs_g),
      fat_g: parseOptionalNumber(v.fat_g),
      cost_php_per_serving_ncr: parseOptionalNumber(v.cost_php_per_serving_ncr),
      cost_tier: asBudgetPreset(v.cost_tier),
      allergens_strict: splitSemicolon(v.allergens_strict),
      may_contain_strict: splitSemicolon(v.may_contain_strict),
      allergens_core: splitSemicolon(v.allergens_core),
      may_contain_core: splitSemicolon(v.may_contain_core),
      optional_ingredient_ids: splitSemicolon(v.optional_ingredient_ids),
      halal_friendly: parseYesNo(v.halal_friendly),
      pescatarian_ok: parseYesNo(v.pescatarian_ok),
      vegetarian_ok: parseYesNo(v.vegetarian_ok),
      vegan_ok: parseYesNo(v.vegan_ok),
      contains_coconut: parseYesNo(v.contains_coconut),
      high_sodium: parseYesNo(v.high_sodium),
      high_sugar: parseYesNo(v.high_sugar),
      diet_flags: splitSemicolon(v.diet_flags),
      method_hint: v.method_hint || '',
    };
    dishes.push(dish);
    dishesById.set(id, dish);
  }

  // 3. Dish Ingredients (validate FK references to both dishes.csv and ingredients.csv)
  const parsedDI = parseCsv(raw.dishIngredients);
  for (const m of parsedDI.malformedRows) {
    invalidRowCount++;
    brokenReferences.push({
      file: 'dish_ingredients.csv',
      row: m.lineNumber,
      severity: 'error',
      message: `Expected ${m.expectedCols} columns, found ${m.actualCols}`,
    });
  }
  const dishIngredients: DishIngredient[] = [];
  const dishIngredientsByDishId = new Map<string, DishIngredient[]>();
  for (const row of parsedDI.rows) {
    const v = row.values;
    const dishId = v.dish_id?.trim();
    const ingId = v.ingredient_id?.trim();
    const qty = parseOptionalNumber(v.qty_for_base_servings);
    if (!dishId || !dishesById.has(dishId)) {
      invalidRowCount++;
      brokenReferences.push({
        file: 'dish_ingredients.csv',
        row: row.lineNumber,
        severity: 'error',
        message: `Unknown dish_id "${dishId}"`,
      });
    }
    if (!ingId || !ingredientsById.has(ingId)) {
      invalidRowCount++;
      brokenReferences.push({
        file: 'dish_ingredients.csv',
        row: row.lineNumber,
        severity: 'error',
        message: `Unknown ingredient_id "${ingId}" for dish "${dishId}"`,
      });
    }
    if (qty === null || qty <= 0) {
      warnings.push({
        file: 'dish_ingredients.csv',
        row: row.lineNumber,
        severity: 'warning',
        message: `Non-positive quantity for "${dishId}" -> "${ingId}"`,
      });
    }
    const item: DishIngredient = {
      dish_id: dishId,
      ingredient_id: ingId,
      ingredient_name: v.ingredient_name || ingId,
      qty_for_base_servings: qty ?? 0,
      unit: v.unit === 'ml' || v.unit === 'pc' ? v.unit : 'g',
      role:
        v.role === 'pantry_staple' || v.role === 'optional'
          ? v.role
          : 'main',
    };
    dishIngredients.push(item);
    const list = dishIngredientsByDishId.get(dishId) ?? [];
    list.push(item);
    dishIngredientsByDishId.set(dishId, list);
  }

  // Ensure every dish has at least one ingredient
  for (const dish of dishes) {
    if (!dishIngredientsByDishId.has(dish.dish_id)) {
      warnings.push({
        file: 'dishes.csv',
        row: 0,
        severity: 'warning',
        message: `Dish "${dish.dish_id}" has zero rows in dish_ingredients.csv`,
      });
    }
  }

  // 4. Hidden Allergens
  const parsedAllergens = parseCsv(raw.hiddenAllergens);
  const hiddenAllergens: HiddenAllergen[] = parsedAllergens.rows.map((r) => ({
    keyword: (r.values.keyword || '').toLowerCase(),
    allergen: (r.values.allergen || '').toLowerCase(),
    confidence: r.values.confidence === 'possible' ? 'possible' : 'definite',
    note: r.values.note || '',
  }));

  // 5. Ingredient Swaps
  const parsedSwaps = parseCsv(raw.ingredientSwaps);
  const ingredientSwaps: IngredientSwap[] = [];
  for (const r of parsedSwaps.rows) {
    const fromId = r.values.from_ingredient_id?.trim();
    const toId = r.values.to_ingredient_id?.trim();
    if (!ingredientsById.has(fromId) || !ingredientsById.has(toId)) {
      invalidRowCount++;
      brokenReferences.push({
        file: 'ingredient_swaps.csv',
        row: r.lineNumber,
        severity: 'error',
        message: `Swap references unknown ingredient: "${fromId}" -> "${toId}"`,
      });
    }
    ingredientSwaps.push({
      from_ingredient_id: fromId,
      to_ingredient_id: toId,
      applies_when: r.values.applies_when || 'budget',
      quantity_ratio: parseOptionalNumber(r.values.quantity_ratio) ?? 1,
      note: r.values.note || '',
    });
  }

  // 6. Regions
  const parsedRegions = parseCsv(raw.regions);
  const regions: RegionRecord[] = [];
  const regionsByKey = new Map<string, RegionRecord>();
  for (const r of parsedRegions.rows) {
    const v = r.values;
    const sigIds = splitSemicolon(v.signature_dish_ids);
    for (const dId of sigIds) {
      if (!dishesById.has(dId)) {
        brokenReferences.push({
          file: 'regions.csv',
          row: r.lineNumber,
          severity: 'error',
          message: `Region "${v.region_key}" references unknown signature dish "${dId}"`,
        });
      }
    }
    const rec: RegionRecord = {
      region_key: v.region_key,
      region_name: v.region_name,
      name_aliases: splitSemicolon(v.name_aliases),
      island_group: v.island_group,
      default_cuisine_zone: v.default_cuisine_zone,
      secondary_zones: splitSemicolon(v.secondary_zones),
      coastal_profile: v.coastal_profile,
      food_notes: v.food_notes,
      signature_dish_ids: sigIds,
      price_mult_staples: parseOptionalNumber(v.price_mult_staples) ?? 1,
      price_mult_veg: parseOptionalNumber(v.price_mult_veg) ?? 1,
      price_mult_fish: parseOptionalNumber(v.price_mult_fish) ?? 1,
      price_mult_meat: parseOptionalNumber(v.price_mult_meat) ?? 1,
      price_mult_packaged: parseOptionalNumber(v.price_mult_packaged) ?? 1,
      price_notes: v.price_notes || '',
    };
    regions.push(rec);
    regionsByKey.set(rec.region_key, rec);
  }

  // 7. Province Cuisine Map
  const parsedProv = parseCsv(raw.provinceCuisineMap);
  const provinceCuisineMap: ProvinceCuisine[] = parsedProv.rows.map((r) => {
    if (!regionsByKey.has(r.values.region_key)) {
      brokenReferences.push({
        file: 'province_cuisine_map.csv',
        row: r.lineNumber,
        severity: 'error',
        message: `Province "${r.values.province}" references unknown region_key "${r.values.region_key}"`,
      });
    }
    return {
      province: r.values.province,
      region_key: r.values.region_key,
      cuisine_zone: r.values.cuisine_zone,
      coastal_profile: r.values.coastal_profile === 'inland' ? 'inland' : 'coastal',
    };
  });

  // 8. City Overrides
  const parsedCity = parseCsv(raw.cityOverrides);
  const cityOverrides: CityOverride[] = parsedCity.rows.map((r) => {
    const boostIds = splitSemicolon(r.values.boost_dish_ids);
    for (const dId of boostIds) {
      if (!dishesById.has(dId)) {
        brokenReferences.push({
          file: 'city_overrides.csv',
          row: r.lineNumber,
          severity: 'error',
          message: `City "${r.values.city}" references unknown boost dish "${dId}"`,
        });
      }
    }
    return {
      city: r.values.city,
      province: r.values.province,
      region_key: r.values.region_key,
      cuisine_zone: r.values.cuisine_zone,
      coastal_profile: r.values.coastal_profile === 'inland' ? 'inland' : 'coastal',
      local_food_notes: r.values.local_food_notes || '',
      boost_dish_ids: boostIds,
      price_notes: r.values.price_notes || '',
    };
  });

  const validationReport: DatasetValidationReport = {
    generatedAt: new Date().toISOString(),
    counts: {
      dishes: dishes.length,
      ingredients: ingredients.length,
      dishIngredients: dishIngredients.length,
      hiddenAllergens: hiddenAllergens.length,
      ingredientSwaps: ingredientSwaps.length,
      regions: regions.length,
      provinceCuisineMap: provinceCuisineMap.length,
      cityOverrides: cityOverrides.length,
    },
    invalidRowCount,
    brokenReferences,
    warnings,
    isValid: brokenReferences.length === 0 && invalidRowCount === 0,
  };

  return {
    dishes,
    dishesById,
    ingredients,
    ingredientsById,
    dishIngredients,
    dishIngredientsByDishId,
    hiddenAllergens,
    ingredientSwaps,
    regions,
    regionsByKey,
    provinceCuisineMap,
    cityOverrides,
    validationReport,
  };
}

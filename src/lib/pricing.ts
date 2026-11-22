import type {
  Dish,
  Ingredient,
  PriceGroup,
  RegionRecord,
  StoreId,
  UlamWiseDataset,
} from '../types';
import { STORE_MULTIPLIERS } from './storeConfig';

export function getRegionalPriceMultiplier(
  region: RegionRecord,
  priceGroup: PriceGroup
): number {
  switch (priceGroup) {
    case 'staples':
      return region.price_mult_staples;
    case 'veg':
      return region.price_mult_veg;
    case 'fish':
      return region.price_mult_fish;
    case 'meat':
      return region.price_mult_meat;
    case 'packaged':
    default:
      return region.price_mult_packaged;
  }
}

export function getStoreMultiplier(storeId: StoreId): number {
  return STORE_MULTIPLIERS[storeId]?.multiplier ?? 1.0;
}

/**
 * Returns the adjusted price per pricing basis (per kg, per liter, or per piece)
 * using the trusted NCR palengke baseline * regional price_group multiplier * store multiplier.
 */
export function getAdjustedIngredientBasisPrice(
  ingredient: Ingredient,
  region: RegionRecord,
  storeId: StoreId
): number {
  const regMult = getRegionalPriceMultiplier(region, ingredient.price_group);
  const storeMult = getStoreMultiplier(storeId);
  return Number((ingredient.price_php_ncr_palengke * regMult * storeMult).toFixed(2));
}

/**
 * Calculates exact PHP cost for a quantity in the ingredient's base unit (g, ml, or pc).
 */
export function calculateIngredientCostPhp(
  ingredient: Ingredient,
  qtyInBaseUnit: number,
  region: RegionRecord,
  storeId: StoreId
): number {
  if (qtyInBaseUnit <= 0) return 0;
  const basisPrice = getAdjustedIngredientBasisPrice(ingredient, region, storeId);
  const units =
    ingredient.price_basis === 'per_piece' ? qtyInBaseUnit : qtyInBaseUnit / 1000;
  return Number((units * basisPrice).toFixed(2));
}

/**
 * Computes trusted per-serving and household meal cost from dish_ingredients.csv + ingredients.csv
 * with regional & store multipliers. Falls back to dishes.csv NCR cost only if ingredient rows are absent.
 */
export function calculateDishCost(
  dish: Dish,
  householdServings: number,
  region: RegionRecord,
  storeId: StoreId,
  dataset: UlamWiseDataset
): { costPerServingPhp: number; totalMealCostPhp: number } {
  const rows = dataset.dishIngredientsByDishId.get(dish.dish_id) ?? [];
  const baseServings = Math.max(1, dish.base_servings);

  if (rows.length > 0) {
    let baseBatchCost = 0;
    for (const row of rows) {
      const ing = dataset.ingredientsById.get(row.ingredient_id);
      if (!ing) continue;
      baseBatchCost += calculateIngredientCostPhp(
        ing,
        row.qty_for_base_servings,
        region,
        storeId
      );
    }
    const costPerServingPhp = Number((baseBatchCost / baseServings).toFixed(2));
    const totalMealCostPhp = Number((costPerServingPhp * householdServings).toFixed(2));
    return { costPerServingPhp, totalMealCostPhp };
  }

  // Fallback to NCR per-serving cost if no ingredient rows exist
  const fallbackNcr = dish.cost_php_per_serving_ncr ?? 0;
  const storeMult = getStoreMultiplier(storeId);
  const costPerServingPhp = Number((fallbackNcr * region.price_mult_meat * storeMult).toFixed(2));
  return {
    costPerServingPhp,
    totalMealCostPhp: Number((costPerServingPhp * householdServings).toFixed(2)),
  };
}

export function formatPhp(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₱${safe.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPhpCompact(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₱${Math.round(safe).toLocaleString('en-PH')}`;
}

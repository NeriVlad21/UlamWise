import dishesRaw from '../../data/csv/dishes.csv?raw';
import ingredientsRaw from '../../data/csv/ingredients.csv?raw';
import dishIngredientsRaw from '../../data/csv/dish_ingredients.csv?raw';
import hiddenAllergensRaw from '../../data/csv/hidden_allergens.csv?raw';
import ingredientSwapsRaw from '../../data/csv/ingredient_swaps.csv?raw';
import regionsRaw from '../../data/csv/regions.csv?raw';
import provinceCuisineMapRaw from '../../data/csv/province_cuisine_map.csv?raw';
import cityOverridesRaw from '../../data/csv/city_overrides.csv?raw';
import { buildDatasetFromRawCsv } from './dataset';
import type { UlamWiseDataset } from '../types';

let cachedDataset: UlamWiseDataset | null = null;

export function getBrowserDataset(): UlamWiseDataset {
  if (!cachedDataset) {
    cachedDataset = buildDatasetFromRawCsv({
      dishes: dishesRaw,
      ingredients: ingredientsRaw,
      dishIngredients: dishIngredientsRaw,
      hiddenAllergens: hiddenAllergensRaw,
      ingredientSwaps: ingredientSwapsRaw,
      regions: regionsRaw,
      provinceCuisineMap: provinceCuisineMapRaw,
      cityOverrides: cityOverridesRaw,
    });
  }
  return cachedDataset;
}

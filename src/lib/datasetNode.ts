import fs from 'node:fs';
import path from 'node:path';
import { buildDatasetFromRawCsv } from './dataset';
import type { UlamWiseDataset } from '../types';

let cachedNodeDataset: UlamWiseDataset | null = null;

export function getNodeDataset(csvDir = path.resolve(process.cwd(), 'data/csv')): UlamWiseDataset {
  if (!cachedNodeDataset) {
    cachedNodeDataset = buildDatasetFromRawCsv({
      dishes: fs.readFileSync(path.join(csvDir, 'dishes.csv'), 'utf8'),
      ingredients: fs.readFileSync(path.join(csvDir, 'ingredients.csv'), 'utf8'),
      dishIngredients: fs.readFileSync(path.join(csvDir, 'dish_ingredients.csv'), 'utf8'),
      hiddenAllergens: fs.readFileSync(path.join(csvDir, 'hidden_allergens.csv'), 'utf8'),
      ingredientSwaps: fs.readFileSync(path.join(csvDir, 'ingredient_swaps.csv'), 'utf8'),
      regions: fs.readFileSync(path.join(csvDir, 'regions.csv'), 'utf8'),
      provinceCuisineMap: fs.readFileSync(path.join(csvDir, 'province_cuisine_map.csv'), 'utf8'),
      cityOverrides: fs.readFileSync(path.join(csvDir, 'city_overrides.csv'), 'utf8'),
    });
  }
  return cachedNodeDataset;
}

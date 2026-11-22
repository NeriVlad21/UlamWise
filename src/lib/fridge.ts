import type {
  DetectedIngredient,
  FridgeDishSuggestion,
  Ingredient,
  UlamWiseDataset,
  UserProfile,
} from '../types';
import { checkDishAllergens, checkDishDietaryEligibility } from './allergens';
import { calculateHouseholdServings } from './nutrition';
import { calculateIngredientCostPhp } from './pricing';
import { resolveRegionalContext } from './psgc';

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Matches a free-text ingredient name (from Vision detection or manual typing)
 * to a canonical ingredient_id in ingredients.csv when possible.
 */
export function matchIngredientByName(
  rawName: string,
  dataset: UlamWiseDataset
): Ingredient | undefined {
  const q = normalize(rawName);
  if (!q) return undefined;

  // Exact match on id, name_en, or name_fil
  for (const ing of dataset.ingredients) {
    const idNorm = normalize(ing.ingredient_id.replace(/_/g, ' '));
    const enNorm = normalize(ing.name_en);
    const filNorm = normalize(ing.name_fil);
    if (q === idNorm || q === enNorm || q === filNorm) return ing;
  }

  // Partial word match
  for (const ing of dataset.ingredients) {
    const enNorm = normalize(ing.name_en);
    const filNorm = normalize(ing.name_fil);
    if (enNorm.includes(q) || filNorm.includes(q) || q.includes(filNorm) || q.includes(enNorm)) {
      return ing;
    }
  }

  return undefined;
}

/**
 * Recommends allergen-safe and diet-eligible Filipino dishes based on confirmed fridge/pantry items,
 * showing available ingredients, missing ingredients, and estimated extra PHP cost.
 */
export function recommendDishesFromIngredients(
  confirmedItems: DetectedIngredient[],
  profile: UserProfile,
  dataset: UlamWiseDataset
): FridgeDishSuggestion[] {
  const availableIds = new Set<string>();
  const availableTerms = new Set<string>();

  for (const item of confirmedItems) {
    if (!item.confirmed) continue;
    const matched =
      (item.matchedIngredientId && dataset.ingredientsById.get(item.matchedIngredientId)) ||
      matchIngredientByName(item.name, dataset);
    if (matched) availableIds.add(matched.ingredient_id);
    const n = normalize(item.name);
    if (n) availableTerms.add(n);
  }

  // Also include user's sufficient pantry items
  for (const p of profile.pantry) {
    if (p.ingredientId) availableIds.add(p.ingredientId);
    const n = normalize(p.name);
    if (n) availableTerms.add(n);
  }

  if (availableIds.size === 0 && availableTerms.size === 0) return [];

  const regional = resolveRegionalContext(profile.location, dataset);
  const servings = calculateHouseholdServings(profile.household);
  const suggestions: FridgeDishSuggestion[] = [];

  for (const dish of dataset.dishes) {
    // Strictly enforce allergies & dietary restrictions
    if (!checkDishAllergens(dish, profile.allergies, dataset).safe) continue;
    if (!checkDishDietaryEligibility(dish, profile.dietaryPrefs, profile.dislikes, dataset).eligible) {
      continue;
    }

    const rows = dataset.dishIngredientsByDishId.get(dish.dish_id) ?? [];
    if (rows.length === 0) continue;

    const matchedIngredientNames: string[] = [];
    const missingIngredientNames: string[] = [];
    let additionalCost = 0;
    let mainMatchedCount = 0;
    let mainTotalCount = 0;

    const scale = servings / Math.max(1, dish.base_servings);

    for (const row of rows) {
      const ing = dataset.ingredientsById.get(row.ingredient_id);
      if (row.role === 'main') mainTotalCount++;

      const hasIt =
        availableIds.has(row.ingredient_id) ||
        (ing &&
          (availableTerms.has(normalize(ing.name_en)) ||
            availableTerms.has(normalize(ing.name_fil))));

      if (hasIt) {
        matchedIngredientNames.push(ing ? ing.name_fil : row.ingredient_name);
        if (row.role === 'main') mainMatchedCount++;
      } else if (row.role !== 'optional') {
        missingIngredientNames.push(ing ? ing.name_fil : row.ingredient_name);
        if (ing) {
          additionalCost += calculateIngredientCostPhp(
            ing,
            row.qty_for_base_servings * scale,
            regional.region,
            profile.preferredStore
          );
        }
      }
    }

    if (mainMatchedCount === 0) continue;

    const matchRatio = mainTotalCount > 0 ? mainMatchedCount / mainTotalCount : 0;
    suggestions.push({
      dish,
      matchedIngredientNames,
      missingIngredientNames,
      additionalEstimatedCostPhp: Number(additionalCost.toFixed(2)),
      matchRatio,
    });
  }

  return suggestions
    .sort((a, b) => {
      if (Math.abs(b.matchRatio - a.matchRatio) > 0.05) {
        return b.matchRatio - a.matchRatio;
      }
      return a.additionalEstimatedCostPhp - b.additionalEstimatedCostPhp;
    })
    .slice(0, 12);
}

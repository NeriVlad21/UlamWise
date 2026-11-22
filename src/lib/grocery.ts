import {
  GROCERY_SECTIONS,
  type BudgetSwapRecommendation,
  type GroceryItem,
  type GroceryListSummary,
  type GrocerySectionSummary,
  type Ingredient,
  type LeftoverInventoryItem,
  type PantryItem,
  type UlamWiseDataset,
  type UserProfile,
  type WeeklyMealPlan,
} from '../types';
import { inspectIngredientAllergens } from './allergens';
import { calculateHouseholdServings } from './nutrition';
import {
  optimizeWeeklyBulkPurchases,
  resolveRetailPurchase,
  type DishIngredientUsage,
} from './packaging';
import {
  formatPhp,
  getAdjustedIngredientBasisPrice,
} from './pricing';
import { resolveRegionalContext } from './psgc';
import { getEffectiveConstraintsForParticipants } from './schedule';
import { STORE_MULTIPLIERS } from './storeConfig';

/**
 * Converts a pantry item quantity to the ingredient's base unit (g, ml, or pc).
 */
export function convertPantryQtyToBase(
  item: PantryItem,
  targetBaseUnit: 'g' | 'ml' | 'pc'
): number {
  if (item.sufficient) return Number.POSITIVE_INFINITY;
  const qty = item.quantity ?? 0;
  if (qty <= 0) return 0;

  const u = item.unit ?? targetBaseUnit;
  if (targetBaseUnit === 'g') {
    if (u === 'kg') return qty * 1000;
    if (u === 'g') return qty;
    return qty;
  }
  if (targetBaseUnit === 'ml') {
    if (u === 'L') return qty * 1000;
    if (u === 'ml') return qty;
    return qty;
  }
  return qty;
}

/**
 * Formats base quantities (g, ml, pc) into practical Philippine palengke shopping units.
 */
export function formatShoppingQuantity(
  qtyBase: number,
  baseUnit: 'g' | 'ml' | 'pc'
): { displayQty: number; displayUnit: string } {
  if (baseUnit === 'pc') {
    const rounded = Math.max(1, Math.ceil(qtyBase));
    return { displayQty: rounded, displayUnit: rounded === 1 ? 'pc' : 'pcs' };
  }
  if (baseUnit === 'g') {
    if (qtyBase >= 1000) {
      return { displayQty: Number((qtyBase / 1000).toFixed(2)), displayUnit: 'kg' };
    }
    return { displayQty: Math.max(5, Math.ceil(qtyBase / 5) * 5), displayUnit: 'g' };
  }
  if (qtyBase >= 1000) {
    return { displayQty: Number((qtyBase / 1000).toFixed(2)), displayUnit: 'L' };
  }
  return { displayQty: Math.max(10, Math.ceil(qtyBase / 10) * 10), displayUnit: 'ml' };
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findMatchingPantryItem(
  ingredient: Ingredient,
  pantry: PantryItem[]
): PantryItem | undefined {
  const exact = pantry.find((p) => p.ingredientId === ingredient.ingredient_id);
  if (exact) return exact;

  const targetNames = new Set([
    normalizeName(ingredient.name_en),
    normalizeName(ingredient.name_fil),
    normalizeName(ingredient.ingredient_id.replace(/_/g, ' ')),
  ]);

  return pantry.find((p) => {
    const n = normalizeName(p.name);
    if (!n) return false;
    if (targetNames.has(n)) return true;
    if (n === 'bigas' && ingredient.ingredient_id === 'rice_raw') return true;
    if (n === 'itlog' && ingredient.ingredient_id === 'egg') return true;
    if (n === 'toyo' && ingredient.ingredient_id === 'soy_sauce') return true;
    if (n === 'suka' && ingredient.ingredient_id === 'vinegar') return true;
    if (n === 'asin' && ingredient.ingredient_id === 'salt') return true;
    if (n === 'mantika' && ingredient.ingredient_id === 'cooking_oil') return true;
    if (n === 'bawang' && ingredient.ingredient_id === 'garlic') return true;
    if (n === 'sibuyas' && ingredient.ingredient_id === 'onion') return true;
    return false;
  });
}

function isIngredientSafeForHousehold(
  ingredient: Ingredient,
  profile: UserProfile,
  dataset: UlamWiseDataset
): boolean {
  const constraints = getEffectiveConstraintsForParticipants(profile.household, profile);
  const allergyInfo = inspectIngredientAllergens(ingredient, dataset);

  for (const a of constraints.allergies) {
    if (allergyInfo.definite.has(a) || allergyInfo.possible.has(a)) {
      return false;
    }
  }

  for (const pref of constraints.dietaryPrefs) {
    if (pref === 'halal' && ingredient.diet_flags.includes('pork')) return false;
    if (
      pref === 'vegetarian' &&
      (ingredient.diet_flags.includes('meat') || ingredient.diet_flags.includes('seafood'))
    ) {
      return false;
    }
    if (pref === 'pescatarian' && ingredient.diet_flags.includes('meat')) return false;
  }

  if (constraints.dislikes.length > 0) {
    const searchable = normalizeName(`${ingredient.name_en} ${ingredient.name_fil}`);
    for (const d of constraints.dislikes) {
      const term = normalizeName(d);
      if (term.length >= 2 && searchable.includes(term)) return false;
    }
  }

  return true;
}

/**
 * Generates an itemized, grouped grocery list scaled strictly by actual household meal participation:
 * - Uses only selected planning days and meals with participating members.
 * - Uses each meal's actual `meal.servings` (calculated from actual participating members & portion prefs).
 * - Scales raw rice (`rice_raw`) by exact servings of rice-paired meals.
 * - Deducts pantry quantities, applies regional & store multipliers, and sums exact item costs.
 * - Identifies top cost drivers and allergy/diet-validated budget swaps when over budget.
 */
export function generateGroceryList(
  plan: WeeklyMealPlan | null,
  profile: UserProfile,
  dataset: UlamWiseDataset,
  appliedSwaps: Record<string, string> = {}
): GroceryListSummary {
  const regional = resolveRegionalContext(profile.location, dataset);
  const storeCfg = STORE_MULTIPLIERS[profile.preferredStore] ?? STORE_MULTIPLIERS.palengke;
  const weeklyBudgetPhp = Math.max(100, profile.weeklyBudgetPhp || 2000);
  const scheduledDaysCount = Math.max(
    1,
    profile.weeklySchedule?.selectedDays?.length || 7
  );
  const memberCount = Math.max(1, profile.household.length);

  if (!plan || plan.days.length === 0) {
    return {
      sections: [],
      pantryCoveredItems: [],
      totalEstimatedPhp: 0,
      totalConsumptionCostPhp: 0,
      totalCheckoutCostPhp: 0,
      totalLeftoverInventoryValuePhp: 0,
      bulkSavingsPhp: 0,
      bulkPlans: [],
      leftoverInventoryItems: [],
      weeklyBudgetPhp,
      remainingBudgetPhp: weeklyBudgetPhp,
      overBudgetAmountPhp: 0,
      percentConsumed: 0,
      plannedDaysCount: scheduledDaysCount,
      dailyEquivalentBudgetPhp: Number((weeklyBudgetPhp / scheduledDaysCount).toFixed(2)),
      averageSpendPerPlannedDayPhp: 0,
      estimatedCostPerMemberPhp: 0,
      mostExpensiveItems: [],
      status: 'under',
      recommendedSwaps: [],
      storeIsProvisional: storeCfg.isProvisional,
      storeMultiplier: storeCfg.multiplier,
    };
  }

  const fallbackHouseholdServings = calculateHouseholdServings(profile.household);
  const aggregated = new Map<
    string,
    {
      qtyBase: number;
      usedInDishIds: Set<string>;
      swappedFromId?: string;
      swappedFromName?: string;
    }
  >();
  const usageByIngredient = new Map<string, DishIngredientUsage[]>();

  let totalRicePairedServings = 0;
  const ricePairedDishIds = new Set<string>();
  let plannedDaysCount = 0;
  const activeParticipantIds = new Set<string>();

  for (const day of plan.days) {
    const dayHasMeals = day.meals.length > 0 && day.isPlannedDay !== false;
    if (!dayHasMeals) continue;
    plannedDaysCount++;

    for (const meal of day.meals) {
      const dish = dataset.dishesById.get(meal.dishId);
      if (!dish) continue;

      const mealServings =
        typeof meal.servings === 'number' && meal.servings > 0
          ? meal.servings
          : fallbackHouseholdServings;

      if (mealServings <= 0) continue;

      for (const pid of meal.participatingMemberIds ?? []) {
        activeParticipantIds.add(pid);
      }

      if (dish.rice_pairing === 'yes') {
        totalRicePairedServings += mealServings;
        ricePairedDishIds.add(dish.dish_id);
      }

      const scaleFactor = mealServings / Math.max(1, dish.base_servings);
      const rows = dataset.dishIngredientsByDishId.get(dish.dish_id) ?? [];

      for (const row of rows) {
        let targetIngId = row.ingredient_id;
        let ratio = 1;
        let swappedFromId: string | undefined;
        let swappedFromName: string | undefined;

        const appliedToId = appliedSwaps[row.ingredient_id];
        if (appliedToId && dataset.ingredientsById.has(appliedToId)) {
          const swapMeta = dataset.ingredientSwaps.find(
            (s) => s.from_ingredient_id === row.ingredient_id && s.to_ingredient_id === appliedToId
          );
          const fromIng = dataset.ingredientsById.get(row.ingredient_id);
          targetIngId = appliedToId;
          ratio = swapMeta?.quantity_ratio ?? 1;
          swappedFromId = row.ingredient_id;
          swappedFromName = fromIng?.name_fil || fromIng?.name_en;
        }

        const neededQty = row.qty_for_base_servings * scaleFactor * ratio;
        const entry = aggregated.get(targetIngId) ?? {
          qtyBase: 0,
          usedInDishIds: new Set<string>(),
        };
        entry.qtyBase += neededQty;
        entry.usedInDishIds.add(dish.dish_id);
        if (swappedFromId) {
          entry.swappedFromId = swappedFromId;
          entry.swappedFromName = swappedFromName;
        }
        aggregated.set(targetIngId, entry);

        const usageList = usageByIngredient.get(targetIngId) ?? [];
        const existingUsage = usageList.find((u) => u.dishId === dish.dish_id);
        if (existingUsage) {
          existingUsage.requiredBaseQty += neededQty;
        } else {
          usageList.push({
            dishId: dish.dish_id,
            dishName: dish.name_local || dish.name_en,
            requiredBaseQty: neededQty,
          });
        }
        usageByIngredient.set(targetIngId, usageList);
      }
    }
  }

  // Raw rice estimate scaled strictly by actual servings of rice-paired meals (~75g raw bigas/serving)
  if (totalRicePairedServings > 0 && dataset.ingredientsById.has('rice_raw')) {
    const riceRawQty = totalRicePairedServings * 75;
    const entry = aggregated.get('rice_raw') ?? {
      qtyBase: 0,
      usedInDishIds: new Set<string>(),
    };
    entry.qtyBase += riceRawQty;
    ricePairedDishIds.forEach((id) => entry.usedInDishIds.add(id));
    aggregated.set('rice_raw', entry);
  }

  const rawBuyItems: GroceryItem[] = [];
  const pantryCoveredItems: GroceryItem[] = [];

  for (const [ingredientId, agg] of aggregated.entries()) {
    const ing = dataset.ingredientsById.get(ingredientId);
    if (!ing) continue;

    const pantryMatch = findMatchingPantryItem(ing, profile.pantry);
    const availableBase = pantryMatch ? convertPantryQtyToBase(pantryMatch, ing.base_unit) : 0;
    const deductedBase = Math.min(agg.qtyBase, availableBase);
    const netBase = Math.max(0, agg.qtyBase - deductedBase);
    const coveredByPantry = netBase <= 0.001;

    const basisPrice = getAdjustedIngredientBasisPrice(
      ing,
      regional.region,
      profile.preferredStore
    );
    const priceBasisLabel =
      ing.price_basis === 'per_piece'
        ? '/pc'
        : ing.price_basis === 'per_liter'
        ? '/L'
        : '/kg';

    const formatted = formatShoppingQuantity(coveredByPantry ? agg.qtyBase : netBase, ing.base_unit);
    const retail = resolveRetailPurchase(
      ing,
      coveredByPantry ? 0 : netBase,
      regional.region,
      profile.preferredStore
    );

    const item: GroceryItem = {
      ingredientId,
      nameEn: ing.name_en,
      nameFil: ing.name_fil,
      section: ing.grocery_section,
      priceGroup: ing.price_group,
      requiredBaseQty: Number(agg.qtyBase.toFixed(1)),
      pantryDeductedBaseQty: Number(deductedBase.toFixed(1)),
      netBaseQty: Number(netBase.toFixed(1)),
      baseUnit: ing.base_unit,
      displayQty: formatted.displayQty,
      displayUnit: formatted.displayUnit,
      unitPricePhp: basisPrice,
      priceBasisLabel,
      estimatedCostPhp: retail.packageCostPhp,
      consumptionCostPhp: retail.consumptionCostPhp,
      retailPackageCount: retail.packageCount,
      retailPackageSizeBase: retail.packageSizeBase,
      retailPackageLabel: retail.retailPackageLabel,
      purchasedBaseQty: retail.purchasedBaseQty,
      packageCostPhp: retail.packageCostPhp,
      leftoverBaseQty: retail.leftoverBaseQty,
      leftoverDisplayLabel: retail.leftoverDisplayLabel,
      leftoverValuePhp: retail.leftoverValuePhp,
      isProvisionalPackagePrice: retail.isProvisionalPackagePrice,
      coveredByPantry,
      swappedFromId: agg.swappedFromId,
      swappedFromName: agg.swappedFromName,
      usedInDishIds: Array.from(agg.usedInDishIds),
    };

    if (coveredByPantry) {
      pantryCoveredItems.push(item);
    } else {
      rawBuyItems.push(item);
    }
  }

  // Apply weekly bulk-buying & reuse consolidation (whole chicken, bulk pork, eggs, rice, tokwa, shared veg)
  const { items: buyItems, bulkPlans, bulkSavingsPhp } = optimizeWeeklyBulkPurchases(
    rawBuyItems,
    usageByIngredient,
    regional.region,
    profile.preferredStore,
    dataset
  );

  // Group into the 9 required market sections in canonical order
  const sections: GrocerySectionSummary[] = [];
  for (const section of GROCERY_SECTIONS) {
    const items = buyItems
      .filter((i) => i.section === section)
      .sort((a, b) => b.packageCostPhp - a.packageCostPhp);
    if (items.length === 0) continue;
    const subtotalPhp = Number(
      items.reduce((sum, i) => sum + i.packageCostPhp, 0).toFixed(2)
    );
    const consumptionSubtotalPhp = Number(
      items.reduce((sum, i) => sum + i.consumptionCostPhp, 0).toFixed(2)
    );
    const leftoverValueSubtotalPhp = Number(
      items.reduce((sum, i) => sum + i.leftoverValuePhp, 0).toFixed(2)
    );
    sections.push({
      section,
      items,
      subtotalPhp,
      consumptionSubtotalPhp,
      leftoverValueSubtotalPhp,
    });
  }

  // Three distinct, strictly reconciled figures:
  // 1. Estimated ingredient consumption cost (exact recipe quantities consumed after pantry deduction)
  const totalConsumptionCostPhp = Number(
    sections.reduce((sum, s) => sum + s.consumptionSubtotalPhp, 0).toFixed(2)
  );
  // 2. Estimated actual grocery checkout cost (exact sum of retail packages & bulk buys)
  const totalCheckoutCostPhp = Number(
    sections.reduce((sum, s) => sum + s.subtotalPhp, 0).toFixed(2)
  );
  // 3. Expected remaining inventory value (exact sum of expected retail leftovers carried into pantry)
  const totalLeftoverInventoryValuePhp = Number(
    sections.reduce((sum, s) => sum + s.leftoverValueSubtotalPhp, 0).toFixed(2)
  );

  const leftoverInventoryItems: LeftoverInventoryItem[] = buyItems
    .filter((it) => it.leftoverBaseQty > 0.01 && it.leftoverValuePhp > 0)
    .map((it) => ({
      ingredientId: it.ingredientId,
      nameEn: it.nameEn,
      nameFil: it.nameFil,
      leftoverBaseQty: it.leftoverBaseQty,
      baseUnit: it.baseUnit,
      leftoverDisplayLabel: it.leftoverDisplayLabel,
      leftoverValuePhp: it.leftoverValuePhp,
    }))
    .sort((a, b) => b.leftoverValuePhp - a.leftoverValuePhp);

  const totalEstimatedPhp = totalCheckoutCostPhp;
  const remainingBudgetPhp = Number((weeklyBudgetPhp - totalCheckoutCostPhp).toFixed(2));
  const overBudgetAmountPhp =
    totalCheckoutCostPhp > weeklyBudgetPhp
      ? Number((totalCheckoutCostPhp - weeklyBudgetPhp).toFixed(2))
      : 0;
  const percentConsumed = Number(((totalCheckoutCostPhp / weeklyBudgetPhp) * 100).toFixed(1));
  const effectivePlannedDays = Math.max(1, plannedDaysCount || scheduledDaysCount);
  const dailyEquivalentBudgetPhp = Number((weeklyBudgetPhp / effectivePlannedDays).toFixed(2));
  const averageSpendPerPlannedDayPhp = Number(
    (totalCheckoutCostPhp / effectivePlannedDays).toFixed(2)
  );
  const participatingPeople = Math.max(1, activeParticipantIds.size || memberCount);
  const estimatedCostPerMemberPhp = Number(
    (totalCheckoutCostPhp / participatingPeople).toFixed(2)
  );

  const mostExpensiveItems = [...buyItems]
    .sort((a, b) => b.packageCostPhp - a.packageCostPhp)
    .slice(0, 5);

  const status: 'under' | 'approaching' | 'over' =
    totalCheckoutCostPhp > weeklyBudgetPhp
      ? 'over'
      : percentConsumed >= 85
      ? 'approaching'
      : 'under';

  // Budget optimization recommendations from ingredient_swaps.csv (validated for ALL household allergies & diet)
  const recommendedSwaps: BudgetSwapRecommendation[] = [];
  for (const item of buyItems) {
    const budgetSwaps = dataset.ingredientSwaps.filter(
      (s) => s.from_ingredient_id === item.ingredientId && s.applies_when === 'budget'
    );
    let bestRec: BudgetSwapRecommendation | null = null;
    for (const swap of budgetSwaps) {
      const targetIng = dataset.ingredientsById.get(swap.to_ingredient_id);
      if (!targetIng) continue;
      if (!isIngredientSafeForHousehold(targetIng, profile, dataset)) continue;

      const projectedQty = item.netBaseQty * swap.quantity_ratio;
      const projectedRetail = resolveRetailPurchase(
        targetIng,
        projectedQty,
        regional.region,
        profile.preferredStore
      );
      const projectedCost = projectedRetail.packageCostPhp;
      const savings = Number((item.packageCostPhp - projectedCost).toFixed(2));
      if (savings >= 5 && (!bestRec || savings > bestRec.savingsPhp)) {
        bestRec = {
          id: `${item.ingredientId}->${targetIng.ingredient_id}`,
          fromIngredientId: item.ingredientId,
          fromName:
            item.nameFil.toLowerCase() !== item.nameEn.toLowerCase()
              ? `${item.nameFil} · ${item.nameEn}`
              : item.nameEn,
          toIngredientId: targetIng.ingredient_id,
          toName:
            targetIng.name_fil.toLowerCase() !== targetIng.name_en.toLowerCase()
              ? `${targetIng.name_fil} · ${targetIng.name_en}`
              : targetIng.name_en,
          quantityRatio: swap.quantity_ratio,
          currentCostPhp: item.packageCostPhp,
          projectedCostPhp: projectedCost,
          savingsPhp: savings,
          note: swap.note,
        };
      }
    }
    if (bestRec) recommendedSwaps.push(bestRec);
  }
  recommendedSwaps.sort((a, b) => b.savingsPhp - a.savingsPhp);

  return {
    sections,
    pantryCoveredItems,
    totalEstimatedPhp,
    totalConsumptionCostPhp,
    totalCheckoutCostPhp,
    totalLeftoverInventoryValuePhp,
    bulkSavingsPhp,
    bulkPlans,
    leftoverInventoryItems,
    weeklyBudgetPhp,
    remainingBudgetPhp,
    overBudgetAmountPhp,
    percentConsumed,
    plannedDaysCount,
    dailyEquivalentBudgetPhp,
    averageSpendPerPlannedDayPhp,
    estimatedCostPerMemberPhp,
    mostExpensiveItems,
    status,
    recommendedSwaps,
    storeIsProvisional: storeCfg.isProvisional,
    storeMultiplier: storeCfg.multiplier,
  };
}

/**
 * Formats the grocery list as plain text (or compact Messenger/Viber checklist)
 * including actual retail packages, bulk tips, and all three reconciled cost figures.
 */
export function formatGroceryListText(
  summary: GroceryListSummary,
  profile: UserProfile,
  checkedIds: Record<string, boolean>,
  mode: 'plain' | 'messenger'
): string {
  const storeName = STORE_MULTIPLIERS[profile.preferredStore]?.name ?? 'Palengke';
  const lines: string[] = [];

  if (mode === 'messenger') {
    lines.push(`ULAMWISE PALENGKE LIST — ${profile.location.cityName}, ${profile.location.provinceName}`);
    lines.push(
      `Store: ${storeName} | Planned Days: ${summary.plannedDaysCount} | Budget: ${formatPhp(summary.weeklyBudgetPhp)}`
    );
    lines.push(
      `Checkout Est.: ${formatPhp(summary.totalCheckoutCostPhp)} | Recipe Consumption: ${formatPhp(summary.totalConsumptionCostPhp)} | Leftover Inventory: ${formatPhp(summary.totalLeftoverInventoryValuePhp)}`
    );
    lines.push('');
  } else {
    lines.push(`UlamWise Weekly Grocery List`);
    lines.push(`Location: ${profile.location.cityName}, ${profile.location.provinceName}`);
    lines.push(`Preferred Store: ${storeName} | Planned Days: ${summary.plannedDaysCount}`);
    lines.push(`Weekly Budget: ${formatPhp(summary.weeklyBudgetPhp)}`);
    lines.push(`1. Est. Actual Grocery Checkout: ${formatPhp(summary.totalCheckoutCostPhp)} (provisional retail pack prices)`);
    lines.push(`2. Est. Recipe Consumption Cost: ${formatPhp(summary.totalConsumptionCostPhp)}`);
    lines.push(`3. Expected Remaining Inventory Value: ${formatPhp(summary.totalLeftoverInventoryValuePhp)}`);
    lines.push('----------------------------------------');
  }

  for (const sec of summary.sections) {
    lines.push(`${sec.section.toUpperCase()} (${formatPhp(sec.subtotalPhp)})`);
    for (const item of sec.items) {
      const done = checkedIds[item.ingredientId] ? '[x]' : '[ ]';
      const label =
        item.nameFil.toLowerCase() !== item.nameEn.toLowerCase()
          ? `${item.nameFil} / ${item.nameEn}`
          : item.nameEn;
      const leftoverPart =
        item.leftoverBaseQty > 0.01 ? ` · leftover ~${item.leftoverDisplayLabel}` : '';
      lines.push(
        `${done} ${label} — Buy ${item.retailPackageLabel} (${formatPhp(item.packageCostPhp)}) [needs ${item.displayQty} ${item.displayUnit}${leftoverPart}]`
      );
    }
    lines.push('');
  }

  if (summary.bulkPlans.length > 0) {
    lines.push('SMART BULK BUYS:');
    for (const bp of summary.bulkPlans) {
      lines.push(
        `- ${bp.title}: ${bp.retailPackageLabel} (${formatPhp(bp.estimatedBulkCostPhp)}, saves ~${formatPhp(bp.estimatedSavingsPhp)})`
      );
    }
    lines.push('');
  }

  if (summary.pantryCoveredItems.length > 0) {
    lines.push(
      `Already in Pantry (${summary.pantryCoveredItems.length}): ${summary.pantryCoveredItems
        .map((i) => i.nameFil)
        .join(', ')}`
    );
    lines.push('');
  }

  lines.push('Note: Retail package prices are provisional planning estimates only and vary by market and season.');
  return lines.join('\n');
}

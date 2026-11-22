import React, { useMemo, useState } from 'react';
import { AlertTriangle, Heart, Minus, Plus, X } from 'lucide-react';
import type { Dish, PlannedMeal, UlamWiseDataset, UserProfile } from '../types';
import { checkDishAllergens } from '../lib/allergens';
import type { Translations } from '../lib/i18n';
import { calculateHouseholdServings, getDishNutritionPerServing } from '../lib/nutrition';
import { buildDefaultInstructions } from '../lib/planner';
import { calculateDishCost, formatPhp } from '../lib/pricing';
import { resolveRegionalContext } from '../lib/psgc';
import { getEffectiveConstraintsForParticipants } from '../lib/schedule';
import { DishIllustration } from './DishIllustration';

interface RecipeDetailModalProps {
  dish: Dish;
  meal?: PlannedMeal;
  profile: UserProfile;
  dataset: UlamWiseDataset;
  t: Translations;
  isFavorite: boolean;
  onToggleFavorite: (dishId: string) => void;
  onClose: () => void;
}

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  dish,
  meal,
  profile,
  dataset,
  t,
  isFavorite,
  onToggleFavorite,
  onClose,
}) => {
  const defaultServings = meal?.servings
    ? Math.max(0.5, Math.round(meal.servings * 2) / 2)
    : Math.max(1, Math.round(calculateHouseholdServings(profile.household)));
  const [servings, setServings] = useState<number>(defaultServings);

  const participatingMembers = useMemo(() => {
    if (!meal?.participatingMemberIds?.length) return profile.household;
    const set = new Set(meal.participatingMemberIds);
    const matched = profile.household.filter((m) => set.has(m.id));
    return matched.length > 0 ? matched : profile.household;
  }, [meal, profile.household]);

  const effectiveConstraints = useMemo(
    () => getEffectiveConstraintsForParticipants(participatingMembers, profile),
    [participatingMembers, profile]
  );

  const regional = useMemo(
    () => resolveRegionalContext(profile.location, dataset),
    [profile.location, dataset]
  );

  const nutrition = useMemo(
    () => getDishNutritionPerServing(dish, dataset),
    [dish, dataset]
  );

  const cost = useMemo(
    () => calculateDishCost(dish, servings, regional.region, profile.preferredStore, dataset),
    [dish, servings, regional.region, profile.preferredStore, dataset]
  );

  const allergyInfo = useMemo(
    () => checkDishAllergens(dish, effectiveConstraints.allergies, dataset),
    [dish, effectiveConstraints.allergies, dataset]
  );

  const scaledIngredients = useMemo(() => {
    const rows = dataset.dishIngredientsByDishId.get(dish.dish_id) ?? [];
    const scale = servings / Math.max(1, dish.base_servings);
    return rows.map((row) => {
      const ing = dataset.ingredientsById.get(row.ingredient_id);
      const qty =
        row.unit === 'pc'
          ? Math.max(1, Math.round(row.qty_for_base_servings * scale * 2) / 2)
          : Math.round(row.qty_for_base_servings * scale);
      return {
        ...row,
        scaledQty: qty,
        nameFil: ing?.name_fil ?? row.ingredient_name,
        nameEn: ing?.name_en ?? row.ingredient_name,
      };
    });
  }, [dish, servings, dataset]);

  const instructions =
    meal && meal.instructions.length > 0
      ? meal.instructions
      : buildDefaultInstructions(dish, dataset);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#18221E] shadow-2xl">
        {/* Sticky Sheet Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4]/95 dark:bg-[#18221E]/95 backdrop-blur-md p-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <DishIllustration dish={dish} size="sm" />
            <div className="min-w-0">
              <h2
                id="recipe-modal-title"
                className="text-xl font-semibold text-[#1E2421] dark:text-[#F2EFE9] leading-snug"
              >
                {dish.name_local}
              </h2>
              <p className="text-sm text-[#535E58] dark:text-[#A6B5AE]">{dish.name_en}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onToggleFavorite(dish.dish_id)}
              aria-label={isFavorite ? `Remove ${dish.name_local} from favorites` : `Add ${dish.name_local} to favorites`}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]"
            >
              <Heart
                className={`w-5 h-5 ${
                  isFavorite
                    ? 'fill-[#C9972B] text-[#C9972B]'
                    : 'text-[#535E58] dark:text-[#A6B5AE]'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close recipe details"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#535E58] hover:bg-[#F3EFE6] dark:text-[#A6B5AE] dark:hover:bg-[#1F2C27]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Metadata & Adjustable Servings */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white dark:bg-[#111815] border border-[#E4DDD0] dark:border-[#2A3B34] p-4">
            <div className="text-xs text-[#535E58] dark:text-[#A6B5AE] space-y-1">
              <p>
                Main protein:{' '}
                <strong className="text-[#1E2421] dark:text-[#F2EFE9] capitalize">
                  {dish.main_protein}
                </strong>{' '}
                · Prep {dish.prep_min}m · Total {dish.time_min} {t.common.minutes} · {dish.method}
              </p>
              {meal && meal.participatingMemberNames.length > 0 && (
                <p>
                  Eating ({meal.participatingMemberNames.length}):{' '}
                  <strong className="text-[#1E2421] dark:text-[#F2EFE9]">
                    {meal.participatingMemberNames.join(', ')}
                  </strong>
                </p>
              )}
              <p className="font-mono-tabular">
                {formatPhp(cost.costPerServingPhp)} / serving · Total ({servings}{' '}
                {t.common.servings}):{' '}
                <strong className="text-[#1B4D3E] dark:text-[#86B8A3]">
                  {formatPhp(cost.totalMealCostPhp)}
                </strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#535E58] dark:text-[#A6B5AE]">
                {t.common.servings}
              </span>
              <button
                type="button"
                onClick={() => setServings((s) => Math.max(0.5, Math.round((s - 0.5) * 2) / 2))}
                aria-label="Decrease servings"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#D8CFC0] dark:border-[#2A3B34] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-mono-tabular font-semibold">{servings}</span>
              <button
                type="button"
                onClick={() => setServings((s) => Math.min(16, Math.round((s + 0.5) * 2) / 2))}
                aria-label="Increase servings"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#D8CFC0] dark:border-[#2A3B34] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Nutrition Grid (labeled Estimate) */}
          <div>
            <p className="text-xs font-semibold text-[#535E58] dark:text-[#A6B5AE] mb-2">
              Nutrition per serving ({t.common.estimate})
            </p>
            <div className="grid grid-cols-4 gap-2.5 text-center">
              {[
                { label: 'Calories', val: `${nutrition.kcal} kcal` },
                { label: 'Protein', val: `${nutrition.protein_g} g` },
                { label: 'Carbs', val: `${nutrition.carbs_g} g` },
                { label: 'Fat', val: `${nutrition.fat_g} g` },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#111815] p-3"
                >
                  <p className="text-[11px] text-[#535E58] dark:text-[#A6B5AE]">{m.label}</p>
                  <p className="mt-0.5 text-sm font-semibold font-mono-tabular">{m.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Allergen Safety Notice (Mandatory on every recipe) */}
          <div className="rounded-xl border border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/25 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t.mealPlan.allergenWarningTitle}</span>
            </div>
            <p className="text-xs text-amber-950 dark:text-amber-100">
              <strong>Contains:</strong>{' '}
              {allergyInfo.definiteAllergens.length > 0
                ? allergyInfo.definiteAllergens.join(', ')
                : 'No major listed allergens detected'}
              {allergyInfo.possibleAllergens.length > 0 && (
                <>
                  {' '}· <strong>May contain:</strong> {allergyInfo.possibleAllergens.join(', ')}
                </>
              )}
            </p>
            <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
              {t.disclaimers.allergen}
            </p>
          </div>

          {/* Ingredients */}
          <div>
            <h3 className="text-base font-semibold mb-2.5">{t.mealPlan.ingredientsHeading}</h3>
            <ul className="divide-y divide-[#E4DDD0] dark:divide-[#2A3B34] rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#111815]">
              {scaledIngredients.map((ing) => (
                <li
                  key={`${ing.ingredient_id}-${ing.role}`}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <span className="font-medium">{ing.nameFil}</span>
                    {ing.nameEn.toLowerCase() !== ing.nameFil.toLowerCase() && (
                      <span className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                        {' '}({ing.nameEn})
                      </span>
                    )}
                    {ing.role === 'optional' && (
                      <span className="text-xs text-[#535E58] dark:text-[#A6B5AE]"> · {t.common.optional}</span>
                    )}
                  </div>
                  <span className="font-mono-tabular text-xs font-medium shrink-0">
                    {ing.scaledQty} {ing.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Cooking Steps */}
          <div>
            <h3 className="text-base font-semibold mb-2.5">{t.mealPlan.instructionsHeading}</h3>
            <ol className="space-y-2.5 text-sm leading-relaxed">
              {instructions.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#1B4D3E]/12 dark:bg-[#2B7A5C]/30 text-[#1B4D3E] dark:text-[#86B8A3] text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {meal?.leftoverNote && (
              <p className="mt-4 text-xs text-[#4E7A68] dark:text-[#86B8A3] bg-[#EDF3EF] dark:bg-[#1B2B24] rounded-xl p-3">
                <strong>{t.mealPlan.leftoverLabel}:</strong> {meal.leftoverNote}
              </p>
            )}
            {dish.source_url && (
              <p className="mt-3 text-[11px] text-[#535E58] dark:text-[#A6B5AE]">
                Recipe discovery reference:{' '}
                <a
                  href={dish.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[#1B4D3E] dark:text-[#86B8A3] hover:opacity-80"
                >
                  {dish.source_name || dish.source_url}
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Heart,
  Info,
  Lock,
  RefreshCw,
  Repeat,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import type {
  Dish,
  MealSelectionMode,
  MealSlot,
  PlannedMeal,
  SavedWeeklyPlan,
  UlamWiseDataset,
  UserProfile,
  WeeklyMealPlan,
} from '../types';
import { checkDishAllergens } from '../lib/allergens';
import type { Translations } from '../lib/i18n';
import { DAY_NAMES_EN, DAY_NAMES_TL, getSwapOptionsForSlot } from '../lib/planner';
import { formatPhp } from '../lib/pricing';
import {
  computeMemberDayNutrition,
  ensureMemberSchedules,
  getEffectiveConstraintsForParticipants,
} from '../lib/schedule';
import { DishIllustration } from './DishIllustration';

interface MealPlanViewProps {
  profile: UserProfile;
  plan: WeeklyMealPlan | null;
  dataset: UlamWiseDataset;
  t: Translations;
  isGenerating: boolean;
  favorites: string[];
  savedPlans: SavedWeeklyPlan[];
  actionFeedback?: string | null;
  onDismissActionFeedback?: () => void;
  onGenerateWeek: () => void;
  onRetryRelaxCookTime: () => void;
  onAcceptShorterPlan: () => void;
  onOpenSettings: () => void;
  onChangeMode: (mode: MealSelectionMode) => void;
  onEditSchedule: () => void;
  onToggleLock: (dayIndex: number, slot: MealSlot) => void;
  onRegenerateMeal: (dayIndex: number, slot: MealSlot) => void;
  onSwapMeal: (dayIndex: number, slot: MealSlot, newDishId: string) => void;
  onSelectDish: (dish: Dish, meal?: PlannedMeal) => void;
  onToggleFavorite: (dishId: string) => void;
  onSaveCurrentPlan: () => void;
  onLoadSavedPlan: (saved: SavedWeeklyPlan) => void;
  onDeleteSavedPlan: (id: string) => void;
}

export const MealPlanView: React.FC<MealPlanViewProps> = ({
  profile,
  plan,
  dataset,
  t,
  isGenerating,
  favorites,
  savedPlans,
  actionFeedback,
  onDismissActionFeedback,
  onGenerateWeek,
  onRetryRelaxCookTime,
  onAcceptShorterPlan,
  onOpenSettings,
  onChangeMode,
  onEditSchedule,
  onToggleLock,
  onRegenerateMeal,
  onSwapMeal,
  onSelectDish,
  onToggleFavorite,
  onSaveCurrentPlan,
  onLoadSavedPlan,
  onDeleteSavedPlan,
}) => {
  const [subTab, setSubTab] = useState<'week' | 'saved' | 'favorites'>('week');
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [swapTarget, setSwapTarget] = useState<{ dayIndex: number; slot: MealSlot } | null>(null);
  const [planSavedToast, setPlanSavedToast] = useState(false);

  const dayNames = profile.language === 'tl' ? DAY_NAMES_TL : DAY_NAMES_EN;

  const schedule = useMemo(
    () => ensureMemberSchedules(profile.weeklySchedule, profile.household, profile.includeMerienda),
    [profile.weeklySchedule, profile.household, profile.includeMerienda]
  );

  // Only show planned days that actually have meals in the day selector
  const plannedDays = useMemo(() => {
    if (!plan) return [];
    return plan.days.filter((d) => d.isPlannedDay && d.meals.length > 0);
  }, [plan]);

  useEffect(() => {
    if (plannedDays.length === 0) return;
    if (!plannedDays.some((d) => d.dayIndex === selectedDay)) {
      setSelectedDay(plannedDays[0].dayIndex);
    }
  }, [plannedDays, selectedDay]);

  const activeDay = useMemo(
    () => plannedDays.find((d) => d.dayIndex === selectedDay) ?? plannedDays[0] ?? null,
    [plannedDays, selectedDay]
  );

  const dailySummary = useMemo(() => {
    if (!activeDay) {
      return {
        totalCostPhp: 0,
        mealCount: 0,
        memberStats: [] as Array<{
          id: string;
          label: string;
          plannedKcal: number;
          targetKcal: number;
          diffKcal: number;
          protein: number;
          carbs: number;
          fat: number;
          mealsCount: number;
        }>,
      };
    }

    const totalCostPhp = Number(
      activeDay.meals.reduce((sum, m) => sum + m.totalMealCostPhp, 0).toFixed(2)
    );

    const memberStats = profile.household
      .map((member) => {
        const res = computeMemberDayNutrition(activeDay, member, profile);
        return {
          id: member.id,
          label: member.label,
          plannedKcal: res.plannedKcal,
          targetKcal: res.targetKcal,
          diffKcal: res.differenceKcal,
          protein: res.proteinG,
          carbs: res.carbsG,
          fat: res.fatG,
          mealsCount: res.mealsAttended.length,
        };
      })
      .filter((m) => m.mealsCount > 0);

    return { totalCostPhp, mealCount: activeDay.meals.length, memberStats };
  }, [activeDay, profile]);

  const swapOptions = useMemo(() => {
    if (!swapTarget || !plan) return [];
    return getSwapOptionsForSlot(plan, swapTarget.dayIndex, swapTarget.slot, profile, dataset);
  }, [swapTarget, plan, profile, dataset]);

  const favoriteDishes = useMemo(
    () =>
      favorites
        .map((id) => dataset.dishesById.get(id))
        .filter((d): d is Dish => Boolean(d)),
    [favorites, dataset]
  );

  // Combined household + member allergies for subtitle
  const allActiveAllergies = useMemo(() => {
    const set = new Set(profile.allergies);
    for (const m of profile.household) {
      for (const a of m.allergies ?? []) set.add(a);
    }
    return Array.from(set);
  }, [profile]);

  const handleSavePlan = () => {
    onSaveCurrentPlan();
    setPlanSavedToast(true);
    setTimeout(() => setPlanSavedToast(false), 2500);
  };

  const skippedDaysCount = 7 - plannedDays.length;

  return (
    <div className="space-y-6">
      {/* Page Title & Sub-view Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">
            {plannedDays.length > 0 && plannedDays.length < 7
              ? `${plannedDays.length}-Day Meal Plan`
              : t.mealPlan.title}
          </h1>
          <p className="mt-1 text-sm text-[#535E58] dark:text-[#A6B5AE]">
            {profile.location.cityName}, {profile.location.provinceName} ·{' '}
            {schedule.selectedDays.length}{' '}
            {schedule.selectedDays.length === 1 ? 'planned day' : 'planned days'} ·{' '}
            {allActiveAllergies.length > 0
              ? `Allergy shield: ${allActiveAllergies.join(', ')}`
              : 'Allergen labels shown'}
          </p>
        </div>

        <div className="inline-flex max-w-full overflow-x-auto rounded-xl bg-[#EFE9DD] dark:bg-[#18221E] p-1 border border-[#E4DDD0] dark:border-[#2A3B34] self-start">
          {(
            [
              { id: 'week', label: 'Weekly Plan' },
              { id: 'saved', label: `${t.mealPlan.savedPlans} (${savedPlans.length})` },
              { id: 'favorites', label: `${t.mealPlan.favorites} (${favoriteDishes.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-2.5 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium min-h-[40px] whitespace-nowrap transition-colors ${
                subTab === tab.id
                  ? 'bg-white dark:bg-[#24332C] text-[#1E2421] dark:text-[#F2EFE9] shadow-xs'
                  : 'text-[#535E58] dark:text-[#A6B5AE]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode & Action Toolbar (Week View) */}
      {subTab === 'week' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Regional vs Everyday mode */}
              <div className="inline-flex rounded-xl bg-[#F3EFE6] dark:bg-[#111815] p-1">
                <button
                  type="button"
                  onClick={() => onChangeMode('local_specialties')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium min-h-[38px] whitespace-nowrap transition-colors ${
                    profile.mealMode === 'local_specialties'
                      ? 'bg-[#1B4D3E] text-[#FAF8F4] dark:bg-[#2B7A5C]'
                      : 'text-[#535E58] dark:text-[#A6B5AE]'
                  }`}
                >
                  {t.mealPlan.modeLocal}
                </button>
                <button
                  type="button"
                  onClick={() => onChangeMode('everyday_pinoy')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium min-h-[38px] whitespace-nowrap transition-colors ${
                    profile.mealMode === 'everyday_pinoy'
                      ? 'bg-[#1B4D3E] text-[#FAF8F4] dark:bg-[#2B7A5C]'
                      : 'text-[#535E58] dark:text-[#A6B5AE]'
                  }`}
                >
                  {t.mealPlan.modeEveryday}
                </button>
              </div>

              <button
                type="button"
                onClick={onEditSchedule}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] text-xs font-medium hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27] transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#1B4D3E] dark:text-[#86B8A3]" aria-hidden="true" />
                <span>Edit Schedule</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {plan && plan.validationStatus !== 'insufficient_recipes' && plannedDays.length > 0 ? (
                <button
                  type="button"
                  onClick={handleSavePlan}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] text-xs sm:text-sm font-medium hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]"
                >
                  {planSavedToast ? (
                    <BookmarkCheck className="w-4 h-4 text-[#1B4D3E] dark:text-[#86B8A3]" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                  <span>{planSavedToast ? 'Saved' : t.mealPlan.savePlan}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onGenerateWeek}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] dark:bg-[#2B7A5C] text-[#FAF8F4] text-xs sm:text-sm font-medium disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>{t.common.generatePlan}</span>
                </button>
              )}
            </div>
          </div>

          {/* Concise Action Feedback (e.g. single-meal regenerate notice or stale-cache refresh) */}
          {actionFeedback && (
            <div
              role="status"
              className="flex items-start justify-between gap-2.5 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#F3EFE6]/80 dark:bg-[#18221E] p-3.5 text-xs text-[#1E2421] dark:text-[#F2EFE9]"
            >
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#1B4D3E] dark:text-[#86B8A3]" aria-hidden="true" />
                <span>{actionFeedback}</span>
              </div>
              {onDismissActionFeedback && (
                <button
                  type="button"
                  onClick={onDismissActionFeedback}
                  aria-label="Dismiss notice"
                  className="p-1 rounded-lg hover:bg-[#E4DDD0]/60 dark:hover:bg-[#24332C]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Concise Valid Plan Banner (shown ONLY when a valid plan passes all hard rules) */}
          {!isGenerating &&
            plan &&
            plan.validationStatus !== 'insufficient_recipes' &&
            plannedDays.length > 0 && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-[#1B4D3E]/25 dark:border-[#34926F]/40 bg-[#1B4D3E]/6 dark:bg-[#1B4D3E]/20 p-3.5 text-xs text-[#1E2421] dark:text-[#E6F1EC]"
              >
                <CheckCircle2
                  className="w-4 h-4 shrink-0 mt-0.5 text-[#1B4D3E] dark:text-[#86B8A3]"
                  aria-hidden="true"
                />
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {plan.statusMessage ??
                      `Valid ${plannedDays.length}-day meal plan ready — all variety, protein rotation, allergy, and dietary checks passed.`}
                  </p>
                  {plan.fallbackReason && (
                    <p className="text-[#535E58] dark:text-[#A6B5AE]">{plan.fallbackReason}</p>
                  )}
                </div>
              </div>
            )}

          {/* Loading Skeleton */}
          {isGenerating ? (
            <div className="space-y-4" aria-busy="true" aria-label="Generating meal plan">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#EFE9DD]/60 dark:bg-[#18221E] animate-pulse"
                />
              ))}
            </div>
          ) : !plan ? (
            <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-10 text-center space-y-4">
              <h2 className="text-xl font-semibold">{t.home.noPlanTitle}</h2>
              <p className="text-sm text-[#535E58] dark:text-[#A6B5AE] max-w-md mx-auto">
                {t.home.noPlanDesc}
              </p>
              <button
                type="button"
                onClick={onGenerateWeek}
                className="min-h-[48px] px-6 rounded-xl bg-[#1B4D3E] text-[#FAF8F4] text-sm font-semibold"
              >
                {t.common.generatePlan}
              </button>
            </div>
          ) : plan.validationStatus === 'insufficient_recipes' ? (
            <section
              role="alert"
              aria-label="Insufficient matching recipes"
              className="rounded-2xl border border-amber-600/35 dark:border-amber-500/35 bg-white dark:bg-[#18221E] p-6 sm:p-8 space-y-5"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className="w-6 h-6 shrink-0 mt-0.5 text-[#A06D08] dark:text-[#F0CB73]"
                  aria-hidden="true"
                />
                <div className="space-y-1.5">
                  <h2 className="text-xl font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
                    Not enough matching recipes for a valid full schedule
                  </h2>
                  <p className="text-sm text-[#535E58] dark:text-[#A6B5AE] leading-relaxed">
                    {plan.statusMessage ??
                      'Your current allergy, dietary, cooking-time, and schedule settings do not have enough unique recipes to fill every scheduled meal without repeating dishes or exceeding protein limits.'}
                  </p>
                </div>
              </div>

              {plan.insufficientRecipes && (
                <div className="rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] p-4 space-y-2.5 text-xs">
                  <p className="font-mono-tabular font-medium text-[#1E2421] dark:text-[#F2EFE9]">
                    Matching recipes found: {plan.insufficientRecipes.uniqueEligibleCount} unique ·
                    Breakfast {plan.insufficientRecipes.eligibleCountBySlot.B} · Lunch{' '}
                    {plan.insufficientRecipes.eligibleCountBySlot.L} · Dinner{' '}
                    {plan.insufficientRecipes.eligibleCountBySlot.D}
                    {plan.insufficientRecipes.eligibleCountBySlot.M > 0
                      ? ` · Merienda ${plan.insufficientRecipes.eligibleCountBySlot.M}`
                      : ''}
                  </p>
                  <ul className="space-y-1 text-[#535E58] dark:text-[#A6B5AE] list-disc pl-4">
                    {plan.insufficientRecipes.reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                  {plan.insufficientRecipes.exclusionBySlot && (() => {
                    const lunchDiag = plan.insufficientRecipes.exclusionBySlot.L;
                    const parts: string[] = [];
                    if (lunchDiag.excludedByAllergy > 0) parts.push(`allergies (${lunchDiag.excludedByAllergy})`);
                    if (lunchDiag.excludedByDietary > 0) parts.push(`dietary prefs (${lunchDiag.excludedByDietary})`);
                    if (lunchDiag.excludedByDislike > 0) parts.push(`dislikes (${lunchDiag.excludedByDislike})`);
                    if (lunchDiag.excludedByCookTime > 0) parts.push(`cooking time (${lunchDiag.excludedByCookTime})`);
                    if (lunchDiag.excludedByEquipment > 0) parts.push(`equipment (${lunchDiag.excludedByEquipment})`);
                    if (lunchDiag.excludedByMissingIngredients > 0) {
                      parts.push(`incomplete data (${lunchDiag.excludedByMissingIngredients})`);
                    }
                    if (parts.length === 0) return null;
                    return (
                      <p className="pt-2 border-t border-[#E4DDD0] dark:border-[#2A3B34] text-[#535E58] dark:text-[#A6B5AE]">
                        Filtered out of {lunchDiag.totalRecipes} recipes by: {parts.join(' · ')}.
                      </p>
                    );
                  })()}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] dark:bg-[#2B7A5C] text-[#FAF8F4] text-sm font-medium transition-colors"
                >
                  <Settings2 className="w-4 h-4" aria-hidden="true" />
                  <span>Adjust Preferences</span>
                </button>

                {plan.insufficientRecipes?.canRelaxCookTime && (
                  <button
                    type="button"
                    onClick={onRetryRelaxCookTime}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-[#1B4D3E] dark:border-[#34926F] text-[#1B4D3E] dark:text-[#86B8A3] text-sm font-medium hover:bg-[#1B4D3E]/5 transition-colors disabled:opacity-60"
                  >
                    <Clock className="w-4 h-4" aria-hidden="true" />
                    <span>Allow Longer Cooking Times</span>
                  </button>
                )}

                {plan.insufficientRecipes?.canGenerateShorterPlan && (
                  <button
                    type="button"
                    onClick={onAcceptShorterPlan}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] text-sm font-medium hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27] transition-colors disabled:opacity-60"
                  >
                    <CalendarDays className="w-4 h-4 text-[#1B4D3E] dark:text-[#86B8A3]" aria-hidden="true" />
                    <span>
                      Generate Shorter Valid Plan ({plan.insufficientRecipes.suggestedMaxDays}{' '}
                      {plan.insufficientRecipes.suggestedMaxDays === 1 ? 'day' : 'days'})
                    </span>
                  </button>
                )}
              </div>
            </section>
          ) : plannedDays.length === 0 ? (
            <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-10 text-center space-y-4">
              <CalendarDays className="w-8 h-8 mx-auto text-[#4E7A68]" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-semibold">No active meal days scheduled</h2>
                <p className="mt-1 text-sm text-[#535E58] dark:text-[#A6B5AE] max-w-md mx-auto">
                  Select at least one day and one household member meal in your Weekly Eating Schedule to generate meals.
                </p>
              </div>
              <button
                type="button"
                onClick={onEditSchedule}
                className="min-h-[48px] px-6 rounded-xl bg-[#1B4D3E] text-[#FAF8F4] text-sm font-semibold"
              >
                Configure Weekly Schedule
              </button>
            </div>
          ) : (
            <>
              {/* Planned-Days-Only Horizontal Selector */}
              <div className="space-y-2">
                <div
                  role="tablist"
                  aria-label="Planned days of the week"
                  className="flex gap-2 overflow-x-auto pb-1"
                >
                  {plannedDays.map((day) => {
                    const active = activeDay?.dayIndex === day.dayIndex;
                    const lockedCount = day.meals.filter((m) => m.locked).length;
                    return (
                      <button
                        key={day.dayIndex}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        onClick={() => setSelectedDay(day.dayIndex)}
                        className={`min-h-[48px] px-4 py-2 rounded-xl border text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                          active
                            ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                            : 'border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] text-[#1E2421] dark:text-[#F2EFE9] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]'
                        }`}
                      >
                        <span>
                          {dayNames[day.dayIndex].slice(0, 3)} · {day.meals.length}{' '}
                          {day.meals.length === 1 ? 'meal' : 'meals'}
                        </span>
                        {lockedCount > 0 && (
                          <span className="ml-1.5 text-[11px] opacity-80">({lockedCount} locked)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {skippedDaysCount > 0 && (
                  <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                    Showing {plannedDays.length} planned {plannedDays.length === 1 ? 'day' : 'days'} ({skippedDaysCount}{' '}
                    unselected {skippedDaysCount === 1 ? 'day' : 'days'} skipped from planning and grocery quantities).
                  </p>
                )}
              </div>

              {/* Daily Summary + Individual Member Nutrition Breakdown */}
              {activeDay && (
                <section className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#F3EFE6]/70 dark:bg-[#18221E] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
                        {dayNames[activeDay.dayIndex]} Summary
                      </h2>
                      <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                        {dailySummary.mealCount} scheduled {dailySummary.mealCount === 1 ? 'meal' : 'meals'} ·{' '}
                        {dailySummary.memberStats.length}{' '}
                        {dailySummary.memberStats.length === 1 ? 'member' : 'members'} eating at home
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-[#535E58] dark:text-[#A6B5AE] block">
                        Est. Day Meals Cost
                      </span>
                      <span className="text-base font-semibold font-mono-tabular text-[#1B4D3E] dark:text-[#86B8A3]">
                        {formatPhp(dailySummary.totalCostPhp)}
                      </span>
                    </div>
                  </div>

                  {/* Per-Member Nutrition Table/Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {dailySummary.memberStats.map((ms) => (
                      <div
                        key={ms.id}
                        className="rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#111815] p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#1E2421] dark:text-[#F2EFE9] truncate">
                            {ms.label}{' '}
                            <span className="font-normal text-[#535E58] dark:text-[#A6B5AE]">
                              ({ms.mealsCount} {ms.mealsCount === 1 ? 'meal' : 'meals'})
                            </span>
                          </span>
                          <span className="font-mono-tabular font-semibold text-[#1B4D3E] dark:text-[#86B8A3] shrink-0">
                            {ms.plannedKcal} / {ms.targetKcal} kcal
                          </span>
                        </div>
                        <p className="text-[11px] font-mono-tabular text-[#535E58] dark:text-[#A6B5AE]">
                          Est. · Diff {ms.diffKcal >= 0 ? `+${ms.diffKcal}` : ms.diffKcal} kcal · P {ms.protein}g · C {ms.carbs}g · F {ms.fat}g
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Meal Cards for Selected Day */}
              {activeDay && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeDay.meals.map((meal) => {
                    const dish = dataset.dishesById.get(meal.dishId);
                    if (!dish) return null;

                    const participantSet = new Set(meal.participatingMemberIds);
                    const participants = profile.household.filter((m) => participantSet.has(m.id));
                    const effectiveConstraints = getEffectiveConstraintsForParticipants(
                      participants.length > 0 ? participants : profile.household,
                      profile
                    );
                    const allergyInfo = checkDishAllergens(
                      dish,
                      effectiveConstraints.allergies,
                      dataset
                    );
                    const isFav = favorites.includes(dish.dish_id);
                    const eatingCount = meal.participatingMemberNames.length || participants.length;
                    const eatingLabel =
                      eatingCount === 1 ? '1 person eating' : `${eatingCount} people eating`;

                    return (
                      <article
                        key={`${activeDay.dayIndex}-${meal.slot}`}
                        className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3.5 min-w-0">
                              <DishIllustration dish={dish} />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-[#4E7A68] dark:text-[#86B8A3]">
                                  {t.slots[meal.slot]} · {eatingLabel}
                                </p>
                                <h3 className="mt-0.5 text-lg font-semibold leading-snug text-[#1E2421] dark:text-[#F2EFE9]">
                                  {dish.name_local}
                                </h3>
                                <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                                  {dish.name_en} · {dish.main_protein} · {dish.time_min} {t.common.minutes}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => onToggleFavorite(dish.dish_id)}
                              aria-label={
                                isFav
                                  ? `Remove ${dish.name_local} from favorites`
                                  : `Save ${dish.name_local} as favorite`
                              }
                              className="min-h-[44px] min-w-[44px] -mt-1 -mr-1 flex items-center justify-center rounded-xl hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]"
                            >
                              <Heart
                                className={`w-4 h-4 ${
                                  isFav
                                    ? 'fill-[#C9972B] text-[#C9972B]'
                                    : 'text-[#535E58] dark:text-[#A6B5AE]'
                                }`}
                              />
                            </button>
                          </div>

                          {/* Participating Members Line */}
                          <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-[#4E7A68] shrink-0" aria-hidden="true" />
                            <span>
                              {meal.participatingMemberNames.length > 0
                                ? meal.participatingMemberNames.join(', ')
                                : 'Household'}
                              {' · '}
                              <strong className="font-mono-tabular text-[#1E2421] dark:text-[#F2EFE9]">
                                {meal.servings} {t.common.servings}
                              </strong>
                            </span>
                          </p>

                          {/* Unboxed Metadata Line (Zero-Pill Discipline) */}
                          <p className="text-xs font-mono-tabular text-[#1E2421] dark:text-[#F2EFE9] border-t border-[#EFE9DD] dark:border-[#2A3B34] pt-2.5">
                            {formatPhp(meal.totalMealCostPhp)} total ({formatPhp(meal.costPerServingPhp)}/srv) · {meal.kcalPerServing} kcal/srv ({t.common.estimate}) · {meal.proteinPerServing}g P
                          </p>

                          {/* Allergen Line */}
                          <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                            <span className="font-medium text-[#1E2421] dark:text-[#F2EFE9]">
                              Allergens:
                            </span>{' '}
                            {allergyInfo.definiteAllergens.length > 0
                              ? allergyInfo.definiteAllergens.join(', ')
                              : 'None of the 8 major listed allergens'}
                            {allergyInfo.possibleAllergens.length > 0
                              ? ` (may contain: ${allergyInfo.possibleAllergens.join(', ')})`
                              : ''}
                          </p>
                        </div>

                        {/* Meal Controls */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EFE9DD] dark:border-[#2A3B34]">
                          <button
                            type="button"
                            onClick={() => onSelectDish(dish, meal)}
                            className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#F3EFE6] hover:bg-[#E8E0D1] dark:bg-[#24332C] dark:hover:bg-[#2E4138] text-xs font-semibold text-[#1B4D3E] dark:text-[#F2EFE9] transition-colors"
                          >
                            {t.mealPlan.viewRecipe}
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleLock(activeDay.dayIndex, meal.slot)}
                            aria-pressed={meal.locked}
                            aria-label={`${meal.locked ? 'Unlock' : 'Lock'} ${dish.name_local}`}
                            className={`min-h-[44px] px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                              meal.locked
                                ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                                : 'border-[#D8CFC0] dark:border-[#2A3B34] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]'
                            }`}
                          >
                            {meal.locked ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                            <span>{meal.locked ? 'Locked' : 'Lock'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSwapTarget({ dayIndex: activeDay.dayIndex, slot: meal.slot })
                            }
                            aria-label={`Swap ${dish.name_local}`}
                            className="min-h-[44px] px-3 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]"
                          >
                            <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{t.mealPlan.swapMeal}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRegenerateMeal(activeDay.dayIndex, meal.slot)}
                            aria-label={`Regenerate ${t.slots[meal.slot]} on ${dayNames[activeDay.dayIndex]}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Saved Weekly Plans Sub-Tab */}
      {subTab === 'saved' && (
        <section className="space-y-3">
          {savedPlans.length === 0 ? (
            <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-8 text-center text-sm text-[#535E58] dark:text-[#A6B5AE]">
              No saved weekly plans yet. Use &ldquo;{t.mealPlan.savePlan}&rdquo; on your schedule to keep a favorite week.
            </div>
          ) : (
            savedPlans.map((sp) => (
              <div
                key={sp.id}
                className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <h3 className="font-semibold text-base">{sp.title}</h3>
                  <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] font-mono-tabular mt-0.5">
                    {sp.locationLabel} · Est. {formatPhp(sp.estimatedTotalPhp)} / {formatPhp(sp.weeklyBudgetPhp)} · Saved {new Date(sp.savedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onLoadSavedPlan(sp);
                      setSubTab('week');
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] text-[#FAF8F4] text-xs font-medium"
                  >
                    Load Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSavedPlan(sp.id)}
                    aria-label={`Delete saved plan ${sp.title}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] text-[#535E58] hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* Favorites Sub-Tab */}
      {subTab === 'favorites' && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {favoriteDishes.length === 0 ? (
            <div className="sm:col-span-2 rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-8 text-center text-sm text-[#535E58] dark:text-[#A6B5AE]">
              No favorite dishes yet. Tap the heart icon on any meal card or recipe to bookmark it.
            </div>
          ) : (
            favoriteDishes.map((dish) => (
              <div
                key={dish.dish_id}
                className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-4 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => onSelectDish(dish)}
                  className="flex items-center gap-3 text-left min-w-0 flex-1"
                >
                  <DishIllustration dish={dish} size="sm" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{dish.name_local}</h3>
                    <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] truncate">{dish.name_en}</p>
                    <p className="text-xs text-[#4E7A68] dark:text-[#86B8A3] mt-0.5">
                      {dish.main_protein} · {dish.time_min} min
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(dish.dish_id)}
                  aria-label={`Remove ${dish.name_local} from favorites`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl"
                >
                  <Heart className="w-4 h-4 fill-[#C9972B] text-[#C9972B]" />
                </button>
              </div>
            ))
          )}
        </section>
      )}

      {/* Swap Dish Modal */}
      {swapTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Swap dish"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-lg max-h-[80vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#18221E] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Swap {t.slots[swapTarget.slot]} — {dayNames[swapTarget.dayIndex]}
              </h2>
              <button
                type="button"
                onClick={() => setSwapTarget(null)}
                aria-label="Close swap dish dialog"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {swapOptions.slice(0, 16).map((opt) => (
                <button
                  key={opt.dish.dish_id}
                  type="button"
                  onClick={() => {
                    onSwapMeal(swapTarget.dayIndex, swapTarget.slot, opt.dish.dish_id);
                    setSwapTarget(null);
                  }}
                  className="w-full text-left rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#111815] hover:border-[#1B4D3E] p-3.5 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{opt.dish.name_local}</p>
                    <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] truncate">
                      {opt.dish.name_en} · {opt.dish.main_protein} · {opt.dish.time_min} min
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono-tabular font-semibold text-[#1B4D3E] dark:text-[#86B8A3]">
                      {formatPhp(opt.costPerServingPhp)}/srv
                    </p>
                    <p className="text-[11px] text-[#535E58] dark:text-[#A6B5AE]">
                      {opt.satisfiesVariety ? 'Variety OK' : 'Repeats protein'}
                    </p>
                  </div>
                </button>
              ))}
              {swapOptions.length === 0 && (
                <p className="text-sm text-[#535E58] dark:text-[#A6B5AE] py-6 text-center">
                  No other safe dataset dishes match participating members&apos; allergy and dietary filters for this slot.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

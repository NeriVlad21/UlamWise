import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronUp,
  MapPin,
  ShoppingBasket,
  Users,
  Utensils,
} from 'lucide-react';
import type {
  Dish,
  GroceryListSummary,
  PlannedMeal,
  UlamWiseDataset,
  UserProfile,
  WeeklyMealPlan,
} from '../types';
import type { Translations } from '../lib/i18n';
import { DAY_NAMES_EN, DAY_NAMES_TL } from '../lib/planner';
import { formatPhp, formatPhpCompact } from '../lib/pricing';
import { resolveRegionalContext } from '../lib/psgc';
import {
  ALL_DAYS,
  computeMemberWeeklyNutrition,
  ensureMemberSchedules,
} from '../lib/schedule';
import {
  formatLongDate,
  formatWeekRangeLabel,
  getDayOfWeekIndex,
  getTodayIsoInTimezone,
  getWeekDates,
  getWeekStartIso,
} from '../lib/calendar';
import { STORE_MULTIPLIERS } from '../lib/storeConfig';
import { DishIllustration } from './DishIllustration';

interface HomeViewProps {
  profile: UserProfile;
  plan: WeeklyMealPlan | null;
  activeWeekStart: string;
  grocery: GroceryListSummary;
  dataset: UlamWiseDataset;
  t: Translations;
  onGeneratePlan: () => void;
  onOpenMealPlan: () => void;
  onOpenGrocery: () => void;
  onOpenFridgeScan: () => void;
  onEditSchedule: () => void;
  onSelectDish: (dish: Dish, meal?: PlannedMeal) => void;
  isGenerating: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  profile,
  plan,
  activeWeekStart,
  grocery,
  dataset,
  t,
  onGeneratePlan,
  onOpenMealPlan,
  onOpenGrocery,
  onOpenFridgeScan,
  onEditSchedule,
  onSelectDish,
  isGenerating,
}) => {
  const [nutritionExpanded, setNutritionExpanded] = useState(true);

  const regional = resolveRegionalContext(profile.location, dataset);
  const storeCfg = STORE_MULTIPLIERS[profile.preferredStore] ?? STORE_MULTIPLIERS.palengke;
  const dayNames = profile.language === 'tl' ? DAY_NAMES_TL : DAY_NAMES_EN;

  const schedule = useMemo(
    () => ensureMemberSchedules(profile.weeklySchedule, profile.household, profile.includeMerienda),
    [profile.weeklySchedule, profile.household, profile.includeMerienda]
  );

  const todayIso = getTodayIsoInTimezone();
  const todayIdx = getDayOfWeekIndex(todayIso); // Mon=0..Sun=6 in Asia/Manila
  const todayLongLabel = formatLongDate(todayIso);
  const currentWeekStart = getWeekStartIso(todayIso);
  const displayWeekStart = activeWeekStart || currentWeekStart;
  const weekDays = useMemo(() => getWeekDates(displayWeekStart, todayIso), [displayWeekStart, todayIso]);
  const weekRangeLabel = formatWeekRangeLabel(displayWeekStart);
  const todayWeekDay = weekDays.find((d) => d.isToday) ?? weekDays[todayIdx];

  const todayDayPlan = plan?.days[todayIdx] ?? null;
  const isTodayPlanned = Boolean(todayDayPlan && todayDayPlan.isPlannedDay && todayDayPlan.meals.length > 0);

  const memberNutritionRows = useMemo(
    () =>
      profile.household.map((member) => ({
        member,
        stats: computeMemberWeeklyNutrition(plan, member, profile),
      })),
    [plan, profile]
  );

  const statusText =
    grocery.status === 'over'
      ? t.grocery.overBudget
      : grocery.status === 'approaching'
      ? t.grocery.approachingBudget
      : t.grocery.underBudget;

  const barColor =
    grocery.status === 'over'
      ? 'bg-red-600 dark:bg-red-500'
      : grocery.status === 'approaching'
      ? 'bg-[#C9972B]'
      : 'bg-[#1B4D3E] dark:bg-[#34926F]';

  const plannedDaysCount =
    grocery.plannedDaysCount > 0 ? grocery.plannedDaysCount : schedule.selectedDays.length;

  return (
    <div className="space-y-7">
      {/* Greeting & Quick Actions */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#4E7A68] dark:text-[#86B8A3]">
            {profile.location.cityName}, {profile.location.provinceName} · {storeCfg.shortName} ·{' '}
            {profile.household.length} {profile.household.length === 1 ? 'member' : 'members'}
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight text-[#1E2421] dark:text-[#F2EFE9]">
            {t.home.greeting}
          </h1>
          <p className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-[#535E58] dark:text-[#A6B5AE]">
            <CalendarDays className="w-3.5 h-3.5 text-[#1B4D3E] dark:text-[#86B8A3] shrink-0" aria-hidden="true" />
            <span className="font-medium text-[#1E2421] dark:text-[#F2EFE9]">{todayLongLabel}</span>
            <span className="text-[11px] font-mono-tabular">· PHT</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onOpenGrocery}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] text-sm font-medium hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27] transition-colors"
          >
            <ShoppingBasket className="w-4 h-4 text-[#1B4D3E] dark:text-[#86B8A3]" aria-hidden="true" />
            <span>{t.home.openGroceryList}</span>
          </button>
          <button
            type="button"
            onClick={onOpenMealPlan}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] dark:bg-[#2B7A5C] dark:hover:bg-[#23654B] text-[#FAF8F4] text-sm font-medium transition-colors"
          >
            <span>
              {plannedDaysCount > 0 && plannedDaysCount < 7
                ? `View ${plannedDaysCount}-Day Plan`
                : t.home.viewFullPlan}
            </span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 4-Column Budget & Schedule KPI Strip */}
      <section aria-label="Weekly budget and schedule summary" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-4 sm:p-5">
          <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">{t.home.weeklyBudget}</p>
          <p className="mt-2 text-xl sm:text-2xl font-semibold font-mono-tabular">
            {formatPhpCompact(grocery.weeklyBudgetPhp)}
          </p>
          <p className="mt-1 text-xs text-[#535E58] dark:text-[#A6B5AE] capitalize">
            {profile.budgetPreset} mode
          </p>
        </div>

        <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-4 sm:p-5">
          <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">{t.home.estimatedSpend}</p>
          <p className="mt-2 text-xl sm:text-2xl font-semibold font-mono-tabular text-[#1B4D3E] dark:text-[#86B8A3]">
            {formatPhp(grocery.totalEstimatedPhp)}
          </p>
          <p className="mt-1 text-xs text-[#535E58] dark:text-[#A6B5AE]">
            {grocery.percentConsumed}% · {statusText}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-4 sm:p-5">
          <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">{t.home.remainingBudget}</p>
          <p
            className={`mt-2 text-xl sm:text-2xl font-semibold font-mono-tabular ${
              grocery.remainingBudgetPhp < 0
                ? 'text-red-700 dark:text-red-400'
                : 'text-[#1E2421] dark:text-[#F2EFE9]'
            }`}
          >
            {formatPhp(grocery.remainingBudgetPhp)}
          </p>
          <p className="mt-1 text-xs text-[#535E58] dark:text-[#A6B5AE]">
            {grocery.pantryCoveredItems.length} pantry items deducted
          </p>
        </div>

        <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-4 sm:p-5">
          <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">Planned Days</p>
          <p className="mt-2 text-xl sm:text-2xl font-semibold font-mono-tabular">
            {plannedDaysCount} / 7 days
          </p>
          <p className="mt-1 text-xs text-[#535E58] dark:text-[#A6B5AE] font-mono-tabular">
            {plannedDaysCount > 0
              ? `~${formatPhp(grocery.averageSpendPerPlannedDayPhp)} / planned day`
              : 'No days active'}
          </p>
        </div>
      </section>

      {/* Budget Progress Bar */}
      <section className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">{t.grocery.budgetProgress}</span>
          <span className="font-mono-tabular text-xs font-semibold">
            {formatPhp(grocery.totalEstimatedPhp)} / {formatPhp(grocery.weeklyBudgetPhp)} ({statusText})
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.min(100, Math.round(grocery.percentConsumed))}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Weekly budget progress"
          className="h-2.5 w-full rounded-full bg-[#EFE9DD] dark:bg-[#24332C] overflow-hidden"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${Math.min(100, Math.max(0, grocery.percentConsumed))}%` }}
          />
        </div>
        {grocery.overBudgetAmountPhp > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-red-700 dark:text-red-300">
            <span>
              Over weekly budget by <strong className="font-mono-tabular">{formatPhp(grocery.overBudgetAmountPhp)}</strong>.
            </span>
            <button
              type="button"
              onClick={onOpenGrocery}
              className="font-semibold underline hover:no-underline min-h-[36px] inline-flex items-center"
            >
              Review swaps & optimize
            </button>
          </div>
        )}
      </section>

      {/* Weekly Eating Schedule Overview Strip */}
      <section className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold flex flex-wrap items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#1B4D3E] dark:text-[#86B8A3] shrink-0" aria-hidden="true" />
              <span>This Week&apos;s Eating Schedule</span>
              <span className="text-xs font-mono-tabular font-normal text-[#535E58] dark:text-[#A6B5AE]">
                ({weekRangeLabel})
              </span>
            </h2>
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] mt-0.5">
              Planning meals for {schedule.selectedDays.length}{' '}
              {schedule.selectedDays.length === 1 ? 'day' : 'days'} · Off-days are excluded from your meal plan and grocery list.
            </p>
          </div>
          <button
            type="button"
            onClick={onEditSchedule}
            className="min-h-[44px] px-3.5 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] text-xs font-medium hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27] transition-colors"
          >
            Edit Weekly Schedule
          </button>
        </div>

        <div className="flex sm:grid sm:grid-cols-7 gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
          {ALL_DAYS.map((dayIdx) => {
            const wd = weekDays[dayIdx];
            const isSelected = schedule.selectedDays.includes(dayIdx);
            const plannedDay = plan?.days[dayIdx];
            const mealCount = plannedDay?.meals.length ?? 0;
            const isToday = wd?.isToday ?? false;
            return (
              <div
                key={dayIdx}
                className={`min-w-[62px] sm:min-w-0 shrink-0 sm:shrink rounded-xl border p-2 sm:p-2.5 text-center transition-colors ${
                  isSelected
                    ? isToday
                      ? 'border-[#C9972B] bg-[#C9972B]/10 dark:border-[#E5BC5E] dark:bg-[#C9972B]/15'
                      : 'border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815]'
                    : 'border-dashed border-[#E4DDD0] dark:border-[#2A3B34] opacity-55'
                }`}
              >
                <p className="text-[11px] sm:text-xs font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
                  {dayNames[dayIdx].slice(0, 3)}
                </p>
                <p
                  className={`text-xs sm:text-sm font-mono-tabular font-semibold leading-tight mt-0.5 ${
                    isToday
                      ? 'text-[#8C6514] dark:text-[#F0CB73]'
                      : 'text-[#1E2421] dark:text-[#F2EFE9]'
                  }`}
                >
                  {wd?.day}
                </p>
                <p className="text-[10px] sm:text-[11px] font-mono-tabular text-[#535E58] dark:text-[#A6B5AE] mt-0.5">
                  {isToday ? 'Today' : isSelected ? (plan ? `${mealCount}m` : 'On') : 'Off'}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Individual Household Nutrition Overview */}
      <section className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 space-y-4">
        <button
          type="button"
          onClick={() => setNutritionExpanded((v) => !v)}
          aria-expanded={nutritionExpanded}
          className="w-full flex items-center justify-between gap-2 text-left min-h-[44px]"
        >
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1B4D3E] dark:text-[#86B8A3]" aria-hidden="true" />
              <span>Household Nutrition Targets (Estimate)</span>
            </h2>
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] mt-0.5">
              Individual daily targets adjusted for scheduled meals and portion size. Dish totals reflect ulam estimates (extra steamed rice adds ~200–270 kcal/cup).
            </p>
          </div>
          {nutritionExpanded ? (
            <ChevronUp className="w-4 h-4 text-[#535E58] shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#535E58] shrink-0" aria-hidden="true" />
          )}
        </button>

        {nutritionExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {memberNutritionRows.map(({ member, stats }) => {
              const diffLabel =
                stats.activeDaysCount === 0
                  ? 'Not scheduled'
                  : `${stats.differenceKcal >= 0 ? '+' : ''}${stats.differenceKcal} kcal`;
              return (
                <div
                  key={member.id}
                  className="rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-[#1E2421] dark:text-[#F2EFE9]">
                        {member.label}{' '}
                        <span className="text-xs font-normal text-[#535E58] dark:text-[#A6B5AE]">
                          · {member.age} yrs · {member.portionPreference}
                        </span>
                      </p>
                      <p className="text-[11px] text-[#535E58] dark:text-[#A6B5AE]">
                        Eating {stats.activeDaysCount} {stats.activeDaysCount === 1 ? 'day' : 'days'} · {stats.totalMealsAttended} meals/wk
                      </p>
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold text-[#1B4D3E] dark:text-[#86B8A3] shrink-0">
                      {stats.dailyTargetKcal} kcal/day
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#EFE9DD] dark:border-[#2A3B34] text-xs font-mono-tabular">
                    <div>
                      <span className="block text-[10px] text-[#535E58] dark:text-[#A6B5AE]">Target (Est.)</span>
                      <span className="font-semibold">{stats.dailyTargetKcal} kcal</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[#535E58] dark:text-[#A6B5AE]">Avg Planned</span>
                      <span className="font-semibold">
                        {stats.activeDaysCount > 0 ? `${stats.avgPlannedKcalPerActiveDay} kcal` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[#535E58] dark:text-[#A6B5AE]">Difference</span>
                      <span
                        className={`font-semibold ${
                          Math.abs(stats.differenceKcal) > 450 && stats.activeDaysCount > 0
                            ? 'text-[#A06D08] dark:text-[#F0CB73]'
                            : ''
                        }`}
                      >
                        {diffLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Main 2-Column Content: Today's Meals + Regional Kitchen & Fridge Scan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Meals (2 cols) */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">
              {t.home.todaysMeals} · {dayNames[todayIdx]}
              {todayWeekDay ? `, ${todayWeekDay.shortDateLabel}` : ''}
            </h2>
            {plan && (
              <button
                type="button"
                onClick={onOpenMealPlan}
                className="text-sm font-medium text-[#1B4D3E] dark:text-[#86B8A3] hover:underline min-h-[44px] inline-flex items-center"
              >
                {t.home.viewFullPlan}
              </button>
            )}
          </div>

          {!plan ? (
            <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-8 text-center space-y-4">
              <Utensils className="w-8 h-8 mx-auto text-[#4E7A68]" aria-hidden="true" />
              <div>
                <h3 className="text-lg font-semibold">{t.home.noPlanTitle}</h3>
                <p className="mt-1 text-sm text-[#535E58] dark:text-[#A6B5AE] max-w-md mx-auto">
                  {t.home.noPlanDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={onGeneratePlan}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 min-h-[48px] px-6 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] text-[#FAF8F4] text-sm font-semibold"
              >
                {isGenerating ? t.common.loading : t.common.generatePlan}
              </button>
            </div>
          ) : plan.validationStatus === 'insufficient_recipes' ? (
            <div className="rounded-2xl border border-amber-600/35 dark:border-amber-500/35 bg-white dark:bg-[#18221E] p-7 text-center space-y-3.5">
              <div>
                <h3 className="text-base font-semibold">
                  Not enough matching recipes for your current schedule
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#535E58] dark:text-[#A6B5AE] max-w-md mx-auto">
                  {plan.statusMessage ??
                    'Open Meal Plan to adjust your preferences or generate a shorter valid schedule.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onOpenMealPlan}
                  className="min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] dark:bg-[#2B7A5C] text-[#FAF8F4] text-xs sm:text-sm font-medium"
                >
                  Review Options in Meal Plan
                </button>
              </div>
            </div>
          ) : !isTodayPlanned ? (
            <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-7 text-center space-y-3.5">
              <CalendarDays className="w-7 h-7 mx-auto text-[#4E7A68]" aria-hidden="true" />
              <div>
                <h3 className="text-base font-semibold">
                  No meals scheduled for {dayNames[todayIdx]}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#535E58] dark:text-[#A6B5AE] max-w-md mx-auto">
                  {dayNames[todayIdx]} is marked as an off-day in your weekly eating schedule, so no ingredients were added for today.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onOpenMealPlan}
                  className="min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] dark:bg-[#2B7A5C] text-[#FAF8F4] text-xs sm:text-sm font-medium"
                >
                  View Planned Days
                </button>
                <button
                  type="button"
                  onClick={onEditSchedule}
                  className="min-h-[44px] px-4 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] text-xs sm:text-sm font-medium hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]"
                >
                  Edit Weekly Schedule
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {todayDayPlan!.meals.map((meal) => {
                const dish = dataset.dishesById.get(meal.dishId);
                if (!dish) return null;
                const count = meal.participatingMemberNames.length || profile.household.length;
                const personLabel = count === 1 ? '1 person eating' : `${count} people eating`;
                return (
                  <button
                    key={`${todayDayPlan!.dayIndex}-${meal.slot}`}
                    type="button"
                    onClick={() => onSelectDish(dish, meal)}
                    className="w-full text-left rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] hover:border-[#1B4D3E]/50 dark:hover:border-[#34926F] p-4 flex items-center gap-4 transition-colors"
                  >
                    <DishIllustration dish={dish} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#4E7A68] dark:text-[#86B8A3]">
                        {t.slots[meal.slot]} · {personLabel}
                        {meal.participatingMemberNames.length > 0
                          ? ` (${meal.participatingMemberNames.join(', ')})`
                          : ''}
                      </p>
                      <h3 className="text-base font-semibold truncate text-[#1E2421] dark:text-[#F2EFE9]">
                        {dish.name_local}
                      </h3>
                      <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] truncate">
                        {dish.name_en} · {dish.time_min} {t.common.minutes}
                      </p>
                      <p className="mt-1 text-xs font-mono-tabular text-[#535E58] dark:text-[#A6B5AE]">
                        {formatPhp(meal.totalMealCostPhp)} ({meal.servings} srv) · {meal.kcalPerServing} kcal/srv ({t.common.estimate})
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0 text-[#535E58] dark:text-[#A6B5AE]" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Side Column: Regional Note & Fridge Scan */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#F3EFE6]/70 dark:bg-[#18221E] p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1B4D3E] dark:text-[#86B8A3]">
              <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t.home.regionalNoteTitle}</span>
            </div>
            <p className="text-sm font-medium">
              {regional.region.region_name} · {regional.primaryCuisineZone}
            </p>
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] leading-relaxed">
              {regional.localFoodNotes}
            </p>
            {regional.priceNotes && (
              <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] border-t border-[#E4DDD0] dark:border-[#2A3B34] pt-2.5">
                {regional.priceNotes}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 space-y-3">
            <h3 className="text-base font-semibold">{t.fridge.title}</h3>
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] leading-relaxed">
              {t.fridge.subtitle}
            </p>
            <button
              type="button"
              onClick={onOpenFridgeScan}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#1B4D3E] dark:border-[#34926F] text-[#1B4D3E] dark:text-[#86B8A3] text-sm font-medium hover:bg-[#1B4D3E]/5 transition-colors"
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
              <span>{t.home.fridgeScanCta}</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

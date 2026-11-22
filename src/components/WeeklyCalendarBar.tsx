import React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import type { WeeklyMealPlan } from '../types';
import {
  formatWeekRangeLabel,
  getWeekDates,
  getWeekStartIso,
  shiftWeekIso,
} from '../lib/calendar';

interface WeeklyCalendarBarProps {
  weekStartIso: string;
  todayIso: string;
  selectedDayIndex: number;
  dayNames: readonly string[];
  scheduledDayIndices: number[];
  plan: WeeklyMealPlan | null;
  hasPlanForWeek: boolean;
  onSelectDay: (dayIndex: number) => void;
  onChangeWeek: (nextWeekStartIso: string, focusDayIndex?: number) => void;
}

export const WeeklyCalendarBar: React.FC<WeeklyCalendarBarProps> = ({
  weekStartIso,
  todayIso,
  selectedDayIndex,
  dayNames,
  scheduledDayIndices,
  plan,
  hasPlanForWeek,
  onSelectDay,
  onChangeWeek,
}) => {
  const currentWeekStartIso = getWeekStartIso(todayIso);
  const isCurrentWeek = weekStartIso === currentWeekStartIso;
  const weekDays = getWeekDates(weekStartIso, todayIso);
  const weekRangeLabel = formatWeekRangeLabel(weekStartIso);
  const scheduledSet = new Set(scheduledDayIndices);

  const selectedDayMeta = weekDays[selectedDayIndex] ?? weekDays[0];

  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.value;
    if (!picked) return;
    const nextMonday = getWeekStartIso(picked);
    const nextWeekDays = getWeekDates(nextMonday, todayIso);
    const matched = nextWeekDays.find((d) => d.isoDate === picked);
    onChangeWeek(nextMonday, matched?.dayIndex);
  };

  const handleJumpToday = () => {
    const todayWeekDays = getWeekDates(currentWeekStartIso, todayIso);
    const todayDay = todayWeekDays.find((d) => d.isToday);
    onChangeWeek(currentWeekStartIso, todayDay?.dayIndex ?? 0);
  };

  return (
    <section
      aria-label="Weekly meal calendar"
      className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-3.5 sm:p-4 space-y-3"
    >
      {/* Top Row: Prev / Week Range / Next + Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onChangeWeek(shiftWeekIso(weekStartIso, -1))}
            aria-label="Previous week"
            className="min-h-[44px] min-w-[44px] shrink-0 inline-flex items-center justify-center rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27] text-[#1E2421] dark:text-[#F2EFE9] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          <div className="min-w-0 text-center sm:text-left px-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-0.5">
              <span className="text-sm sm:text-base font-semibold text-[#1E2421] dark:text-[#F2EFE9] font-mono-tabular">
                {weekRangeLabel}
              </span>
              {isCurrentWeek && (
                <span className="text-[11px] font-semibold text-[#1B4D3E] dark:text-[#86B8A3]">
                  · This Week
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#535E58] dark:text-[#A6B5AE] truncate">
              {hasPlanForWeek ? 'Saved plan active for this week' : 'No meal plan generated for this week yet'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onChangeWeek(shiftWeekIso(weekStartIso, 1))}
            aria-label="Next week"
            className="min-h-[44px] min-w-[44px] shrink-0 inline-flex items-center justify-center rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27] text-[#1E2421] dark:text-[#F2EFE9] transition-colors"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={handleJumpToday}
              className="min-h-[44px] px-3 rounded-xl border border-[#1B4D3E]/40 dark:border-[#34926F]/50 bg-[#1B4D3E]/8 dark:bg-[#2B7A5C]/20 text-xs font-semibold text-[#1B4D3E] dark:text-[#86B8A3] hover:bg-[#1B4D3E]/15 transition-colors whitespace-nowrap"
            >
              This Week
            </button>
          )}

          <label className="relative inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27] text-xs font-medium text-[#1E2421] dark:text-[#F2EFE9] cursor-pointer">
            <CalendarDays
              className="w-3.5 h-3.5 text-[#1B4D3E] dark:text-[#86B8A3] shrink-0"
              aria-hidden="true"
            />
            <span className="sr-only">Pick planning week date</span>
            <input
              type="date"
              value={selectedDayMeta?.isoDate ?? weekStartIso}
              onChange={handleDatePick}
              aria-label="Pick a date to select planning week"
              className="bg-transparent text-xs font-mono-tabular text-[#1E2421] dark:text-[#F2EFE9] focus:outline-none cursor-pointer max-w-[126px]"
            />
          </label>
        </div>
      </div>

      {/* Responsive Monday–Sunday Strip: horizontal compact cards on mobile, 7-column grid on tablet/desktop */}
      <div
        role="tablist"
        aria-label="Days of the selected week"
        className="flex md:grid md:grid-cols-7 gap-2 overflow-x-auto pb-1 md:pb-0 -mx-0.5 px-0.5 snap-x"
      >
        {weekDays.map((wd) => {
          const planDay = plan?.days[wd.dayIndex];
          const mealCount =
            plan && plan.validationStatus !== 'insufficient_recipes' && planDay?.isPlannedDay
              ? planDay.meals.length
              : 0;
          const lockedCount =
            plan && plan.validationStatus !== 'insufficient_recipes' && planDay?.isPlannedDay
              ? planDay.meals.filter((m) => m.locked).length
              : 0;
          const isScheduledDay = scheduledSet.has(wd.dayIndex);
          const isSelected = selectedDayIndex === wd.dayIndex;
          const showMonthPrefix =
            wd.dayIndex === 0 || wd.day === 1 || wd.month !== weekDays[0].month;

          return (
            <button
              key={wd.isoDate}
              role="tab"
              type="button"
              aria-selected={isSelected}
              aria-label={`${wd.fullDateLabel}${wd.isToday ? ' (Today)' : ''}${
                mealCount > 0 ? `, ${mealCount} meals` : isScheduledDay ? '' : ', off day'
              }`}
              onClick={() => onSelectDay(wd.dayIndex)}
              className={`snap-start min-w-[74px] md:min-w-0 min-h-[72px] shrink-0 md:shrink rounded-xl border px-2 py-2 flex flex-col items-center justify-between text-center transition-colors ${
                isSelected
                  ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                  : wd.isToday
                  ? 'border-[#C9972B] bg-[#C9972B]/10 dark:border-[#E5BC5E] dark:bg-[#C9972B]/15 text-[#1E2421] dark:text-[#F2EFE9]'
                  : isScheduledDay
                  ? 'border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] text-[#1E2421] dark:text-[#F2EFE9] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]'
                  : 'border-dashed border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] text-[#535E58] dark:text-[#A6B5AE] opacity-75 hover:opacity-100'
              }`}
            >
              <span
                className={`text-[11px] font-semibold tracking-wide ${
                  isSelected
                    ? 'text-[#FAF8F4]/90'
                    : wd.isToday
                    ? 'text-[#8C6514] dark:text-[#F0CB73]'
                    : 'text-[#535E58] dark:text-[#A6B5AE]'
                }`}
              >
                {dayNames[wd.dayIndex].slice(0, 3)}
              </span>

              <span className="text-sm sm:text-base font-semibold font-mono-tabular leading-tight">
                {showMonthPrefix ? wd.shortDateLabel : wd.day}
              </span>

              <span
                className={`text-[10px] font-mono-tabular inline-flex items-center gap-0.5 leading-none ${
                  isSelected
                    ? 'text-[#FAF8F4]/85'
                    : wd.isToday
                    ? 'font-semibold text-[#8C6514] dark:text-[#F0CB73]'
                    : 'text-[#535E58] dark:text-[#A6B5AE]'
                }`}
              >
                {wd.isToday ? (
                  <span>Today{mealCount > 0 ? ` · ${mealCount}m` : ''}</span>
                ) : hasPlanForWeek ? (
                  mealCount > 0 ? (
                    <>
                      <span>{mealCount}m</span>
                      {lockedCount > 0 && <Lock className="w-2.5 h-2.5" aria-hidden="true" />}
                    </>
                  ) : (
                    <span>Off</span>
                  )
                ) : (
                  <span>{isScheduledDay ? 'On' : 'Off'}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

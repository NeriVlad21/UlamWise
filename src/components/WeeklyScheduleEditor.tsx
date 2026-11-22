import React, { useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eraser,
  Users,
} from 'lucide-react';
import type {
  HouseholdMember,
  LanguageCode,
  MealSlot,
  WeeklySchedule,
  WeeklySchedulePreset,
} from '../types';
import { DAY_NAMES_EN, DAY_NAMES_TL } from '../lib/planner';
import {
  ALL_DAYS,
  applyMemberPatternToDays,
  applyWeeklyPreset,
  clearMemberMealSlot,
  copyMemberSchedule,
  copyMondayToWeekdays,
  ensureMemberSchedules,
  setMemberDaySlot,
  togglePlanningDay,
} from '../lib/schedule';

interface WeeklyScheduleEditorProps {
  household: HouseholdMember[];
  schedule: WeeklySchedule;
  language?: LanguageCode;
  includeMeriendaDefault?: boolean;
  onChange: (next: WeeklySchedule) => void;
  compact?: boolean;
}

const SLOT_META: Array<{ id: MealSlot; short: string; label: string; fil: string }> = [
  { id: 'B', short: 'B', label: 'Breakfast', fil: 'Almusal' },
  { id: 'L', short: 'L', label: 'Lunch', fil: 'Tanghalian' },
  { id: 'M', short: 'M', label: 'Merienda', fil: 'Merienda' },
  { id: 'D', short: 'D', label: 'Dinner', fil: 'Hapunan' },
];

export const WeeklyScheduleEditor: React.FC<WeeklyScheduleEditorProps> = ({
  household,
  schedule,
  language = 'en',
  includeMeriendaDefault = false,
  onChange,
  compact = false,
}) => {
  const ensured = ensureMemberSchedules(schedule, household, includeMeriendaDefault);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(household[0]?.id ?? '');
  const [expandedMobileDay, setExpandedMobileDay] = useState<number>(
    ensured.selectedDays[0] ?? 0
  );
  const [copySourceId, setCopySourceId] = useState<string>('');

  const activeMember =
    household.find((m) => m.id === selectedMemberId) ?? household[0] ?? null;
  const dayNames = language === 'tl' ? DAY_NAMES_TL : DAY_NAMES_EN;

  const selectedCount = ensured.selectedDays.length;
  const memberSched = activeMember ? ensured.memberSchedules[activeMember.id] : null;

  const handlePreset = (preset: WeeklySchedulePreset) => {
    onChange(applyWeeklyPreset(ensured, household, preset, includeMeriendaDefault));
  };

  const handleToggleDay = (dayIdx: number) => {
    onChange(togglePlanningDay(ensured, household, dayIdx, includeMeriendaDefault));
  };

  const handleToggleSlot = (memberId: string, dayIdx: number, slot: MealSlot) => {
    const current = Boolean(ensured.memberSchedules[memberId]?.[dayIdx]?.[slot]);
    onChange(setMemberDaySlot(ensured, memberId, dayIdx, slot, !current));
  };

  const getParticipantCountForSlot = (dayIdx: number, slot: MealSlot): number => {
    if (!ensured.selectedDays.includes(dayIdx)) return 0;
    return household.filter((m) => Boolean(ensured.memberSchedules[m.id]?.[dayIdx]?.[slot])).length;
  };

  const getMemberActiveMealCount = (memberId: string): number => {
    let count = 0;
    for (const d of ensured.selectedDays) {
      const s = ensured.memberSchedules[memberId]?.[d];
      if (!s) continue;
      if (s.B) count++;
      if (s.L) count++;
      if (s.M) count++;
      if (s.D) count++;
    }
    return count;
  };

  return (
    <div className={compact ? 'space-y-5' : 'space-y-6'}>
      {/* PART A: Weekly Planning Days */}
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2 text-[#1E2421] dark:text-[#F2EFE9]">
              <CalendarDays className="w-4 h-4 text-[#1B4D3E] dark:text-[#86B8A3]" aria-hidden="true" />
              <span>When do you usually eat at home?</span>
            </h3>
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] mt-0.5">
              Unselected days will not generate meals or grocery quantities.
            </p>
          </div>
          <p className="text-xs font-semibold text-[#1B4D3E] dark:text-[#86B8A3] tabular-nums">
            You&apos;re planning meals for {selectedCount} {selectedCount === 1 ? 'day' : 'days'} this week.
          </p>
        </div>

        {/* Quick Preset Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              { id: 'everyday', title: 'Every day', sub: 'Mon–Sun' },
              { id: 'weekdays', title: 'Weekdays only', sub: 'Mon–Fri' },
              { id: 'weekends', title: 'Weekends only', sub: 'Sat–Sun' },
              { id: 'custom', title: 'Custom schedule', sub: 'Pick days' },
            ] as Array<{ id: WeeklySchedulePreset; title: string; sub: string }>
          ).map((p) => {
            const active = ensured.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePreset(p.id)}
                aria-pressed={active}
                className={`min-h-[54px] rounded-xl border px-3 py-2 text-left transition-colors ${
                  active
                    ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                    : 'border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]'
                }`}
              >
                <span className="block text-xs sm:text-sm font-semibold leading-tight">{p.title}</span>
                <span
                  className={`block text-[11px] mt-0.5 ${
                    active ? 'text-[#FAF8F4]/85' : 'text-[#535E58] dark:text-[#A6B5AE]'
                  }`}
                >
                  {p.sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* Individual Day Selector Chips (Mon–Sun) */}
        <div
          role="group"
          aria-label="Select days of the week to plan"
          className="grid grid-cols-7 gap-1.5 sm:gap-2"
        >
          {ALL_DAYS.map((dayIdx) => {
            const active = ensured.selectedDays.includes(dayIdx);
            const labelFull = dayNames[dayIdx];
            const labelShort = labelFull.slice(0, 3);
            return (
              <button
                key={dayIdx}
                type="button"
                onClick={() => handleToggleDay(dayIdx)}
                aria-pressed={active}
                aria-label={`${labelFull} ${active ? 'selected' : 'not selected'}`}
                className={`min-h-[48px] rounded-xl border flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                  active
                    ? 'border-[#1B4D3E] bg-[#1B4D3E]/12 text-[#1B4D3E] dark:border-[#34926F] dark:bg-[#2B7A5C]/30 dark:text-[#F2EFE9] font-semibold'
                    : 'border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] text-[#535E58] dark:text-[#A6B5AE] opacity-70 hover:opacity-100'
                }`}
              >
                <span className="text-xs sm:text-sm leading-none">{labelShort}</span>
                {active ? (
                  <Check className="w-3.5 h-3.5 text-[#1B4D3E] dark:text-[#86B8A3]" aria-hidden="true" />
                ) : (
                  <span className="text-[10px] leading-none">Off</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* PART B: Individual Household Availability */}
      <div className="space-y-4 pt-4 border-t border-[#E4DDD0] dark:border-[#2A3B34]">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2 text-[#1E2421] dark:text-[#F2EFE9]">
            <Users className="w-4 h-4 text-[#1B4D3E] dark:text-[#86B8A3]" aria-hidden="true" />
            <span>Who will be eating at home, and when?</span>
          </h3>
          <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] mt-0.5">
            Set each member&apos;s meals per day. Servings and grocery quantities adjust automatically.
          </p>
        </div>

        {/* Member Selector Tabs */}
        <div
          role="tablist"
          aria-label="Household members schedule selector"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {household.map((m) => {
            const active = activeMember?.id === m.id;
            const mealCount = getMemberActiveMealCount(m.id);
            return (
              <button
                key={m.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setSelectedMemberId(m.id)}
                className={`min-h-[46px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                    : 'border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] text-[#1E2421] dark:text-[#F2EFE9]'
                }`}
              >
                <span>{m.label}</span>
                <span
                  className={`ml-1.5 text-[11px] font-mono-tabular ${
                    active ? 'text-[#FAF8F4]/85' : 'text-[#535E58] dark:text-[#A6B5AE]'
                  }`}
                >
                  ({mealCount} meals)
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Schedule Controls for Active Member */}
        {activeMember && memberSched && (
          <div className="rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#F3EFE6]/60 dark:bg-[#151E1A] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onChange(copyMondayToWeekdays(ensured, activeMember.id))}
                className="min-h-[40px] px-3 rounded-lg border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#FAF8F4] dark:hover:bg-[#1F2C27]"
              >
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copy Mon → Weekdays</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const template = memberSched[ensured.selectedDays[0] ?? 0] ?? {
                    B: true,
                    L: true,
                    M: false,
                    D: true,
                  };
                  onChange(applyMemberPatternToDays(ensured, activeMember.id, template, 'all'));
                }}
                className="min-h-[40px] px-3 rounded-lg border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] text-xs font-medium hover:bg-[#FAF8F4] dark:hover:bg-[#1F2C27]"
              >
                Apply to All Planned Days
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange(
                    applyMemberPatternToDays(
                      ensured,
                      activeMember.id,
                      { B: false, L: true, M: false, D: true },
                      'weekdays'
                    )
                  )
                }
                className="min-h-[40px] px-3 rounded-lg border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] text-xs font-medium hover:bg-[#FAF8F4] dark:hover:bg-[#1F2C27]"
              >
                Weekdays L + D Only
              </button>
              <button
                type="button"
                onClick={() => onChange(clearMemberMealSlot(ensured, activeMember.id, 'B'))}
                className="min-h-[40px] px-3 rounded-lg border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] text-xs font-medium inline-flex items-center gap-1 text-[#535E58] dark:text-[#A6B5AE] hover:text-[#1E2421]"
              >
                <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
                <span>No Breakfast</span>
              </button>
            </div>

            {household.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E4DDD0] dark:border-[#2A3B34]">
                <label
                  htmlFor={`copy-from-${activeMember.id}`}
                  className="text-xs text-[#535E58] dark:text-[#A6B5AE]"
                >
                  Copy schedule from:
                </label>
                <select
                  id={`copy-from-${activeMember.id}`}
                  value={copySourceId}
                  onChange={(e) => {
                    const fromId = e.target.value;
                    setCopySourceId(fromId);
                    if (fromId) {
                      onChange(copyMemberSchedule(ensured, fromId, activeMember.id));
                      setCopySourceId('');
                    }
                  }}
                  className="min-h-[40px] rounded-lg border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] px-2.5 text-xs"
                >
                  <option value="">Choose member...</option>
                  {household
                    .filter((m) => m.id !== activeMember.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* DESKTOP (md+): Clean Interactive Weekly Schedule Grid for Active Member */}
        {activeMember && memberSched && (
          <div className="hidden md:block rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden">
            <div className="grid grid-cols-5 bg-[#F3EFE6]/70 dark:bg-[#1F2C27] border-b border-[#E4DDD0] dark:border-[#2A3B34] px-4 py-2.5 text-xs font-semibold text-[#535E58] dark:text-[#A6B5AE]">
              <span>Day</span>
              {SLOT_META.map((s) => (
                <span key={s.id} className="text-center">
                  {s.label} · {s.fil}
                </span>
              ))}
            </div>
            <div className="divide-y divide-[#EFE9DD] dark:divide-[#2A3B34]">
              {ALL_DAYS.map((dayIdx) => {
                const isSelected = ensured.selectedDays.includes(dayIdx);
                const daySched = memberSched[dayIdx] ?? { B: false, L: false, M: false, D: false };
                return (
                  <div
                    key={dayIdx}
                    className={`grid grid-cols-5 items-center px-4 py-2.5 gap-2 ${
                      !isSelected ? 'opacity-45 bg-[#FAF8F4] dark:bg-[#111815]' : ''
                    }`}
                  >
                    <div>
                      <span className="text-sm font-medium">{dayNames[dayIdx]}</span>
                      {!isSelected && (
                        <span className="block text-[11px] text-[#535E58] dark:text-[#A6B5AE]">
                          Day off
                        </span>
                      )}
                    </div>
                    {SLOT_META.map((s) => {
                      const checked = isSelected && Boolean(daySched[s.id]);
                      const totalEating = getParticipantCountForSlot(dayIdx, s.id);
                      return (
                        <div key={s.id} className="flex justify-center">
                          <button
                            type="button"
                            disabled={!isSelected}
                            onClick={() => handleToggleSlot(activeMember.id, dayIdx, s.id)}
                            aria-pressed={checked}
                            aria-label={`${activeMember.label} ${dayNames[dayIdx]} ${s.label}`}
                            className={`min-h-[40px] min-w-[92px] px-2.5 rounded-lg border text-xs font-medium transition-colors ${
                              checked
                                ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                                : 'border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] text-[#535E58] dark:text-[#A6B5AE] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]'
                            } disabled:cursor-not-allowed`}
                          >
                            {checked ? `Eating (${totalEating}p)` : 'Skip'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MOBILE (<md): Expandable Day Cards — Zero Horizontal Spreadsheet Squeezing */}
        <div className="md:hidden space-y-2.5">
          {ensured.selectedDays.map((dayIdx) => {
            const expanded = expandedMobileDay === dayIdx;
            const totalSlotsActive = SLOT_META.filter(
              (s) => getParticipantCountForSlot(dayIdx, s.id) > 0
            ).length;
            return (
              <div
                key={dayIdx}
                className="rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedMobileDay(expanded ? -1 : dayIdx)}
                  aria-expanded={expanded}
                  className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between gap-2 text-left"
                >
                  <div>
                    <span className="text-sm font-semibold">{dayNames[dayIdx]}</span>
                    <span className="block text-xs text-[#535E58] dark:text-[#A6B5AE]">
                      {totalSlotsActive} active meal {totalSlotsActive === 1 ? 'slot' : 'slots'}
                    </span>
                  </div>
                  {expanded ? (
                    <ChevronUp className="w-4 h-4 text-[#535E58]" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#535E58]" aria-hidden="true" />
                  )}
                </button>

                {expanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-[#EFE9DD] dark:border-[#2A3B34] space-y-3">
                    {household.map((member) => {
                      const dSched = ensured.memberSchedules[member.id]?.[dayIdx] ?? {
                        B: false,
                        L: false,
                        M: false,
                        D: false,
                      };
                      return (
                        <div key={member.id} className="space-y-1.5">
                          <p className="text-xs font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
                            {member.label}
                          </p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {SLOT_META.map((s) => {
                              const checked = Boolean(dSched[s.id]);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => handleToggleSlot(member.id, dayIdx, s.id)}
                                  aria-pressed={checked}
                                  aria-label={`${member.label} ${dayNames[dayIdx]} ${s.label}`}
                                  className={`min-h-[44px] rounded-lg border text-xs font-medium px-1 transition-colors ${
                                    checked
                                      ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                                      : 'border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] text-[#535E58] dark:text-[#A6B5AE]'
                                  }`}
                                >
                                  {s.label.slice(0, 5)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

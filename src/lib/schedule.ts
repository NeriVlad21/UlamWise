import type {
  AllergenId,
  DayPlan,
  DietaryPrefId,
  HouseholdMember,
  MealSlot,
  MemberDaySchedule,
  MemberWeeklySchedule,
  PlannedMeal,
  UserProfile,
  WeeklyMealPlan,
  WeeklySchedule,
  WeeklySchedulePreset,
} from '../types';
import { calculateMemberCalorieTarget, getMemberPortionFactor } from './nutrition';

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export const WEEKDAYS = [0, 1, 2, 3, 4] as const;
export const WEEKENDS = [5, 6] as const;
export const ALL_SLOTS: MealSlot[] = ['B', 'L', 'M', 'D'];

export const DEFAULT_SLOT_CALORIE_WEIGHTS: Record<MealSlot, number> = {
  B: 0.25,
  L: 0.35,
  M: 0.1,
  D: 0.3,
};

export function getMondayIsoDate(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function createDaySchedule(
  slots: Partial<MemberDaySchedule> = {}
): MemberDaySchedule {
  return {
    B: slots.B ?? true,
    L: slots.L ?? true,
    M: slots.M ?? false,
    D: slots.D ?? true,
  };
}

export function createMemberWeeklySchedule(
  activeDays: readonly number[] = ALL_DAYS,
  dayTemplate: Partial<MemberDaySchedule> = { B: true, L: true, M: false, D: true }
): MemberWeeklySchedule {
  const activeSet = new Set(activeDays);
  const sched: MemberWeeklySchedule = {};
  for (const d of ALL_DAYS) {
    sched[d] = activeSet.has(d)
      ? createDaySchedule(dayTemplate)
      : { B: false, L: false, M: false, D: false };
  }
  return sched;
}

export function createDefaultWeeklySchedule(
  members: HouseholdMember[],
  options?: {
    preset?: WeeklySchedulePreset;
    includeMerienda?: boolean;
  }
): WeeklySchedule {
  const preset = options?.preset ?? 'everyday';
  const selectedDays =
    preset === 'weekdays'
      ? [...WEEKDAYS]
      : preset === 'weekends'
      ? [...WEEKENDS]
      : [...ALL_DAYS];
  const includeMerienda = Boolean(options?.includeMerienda);

  const memberSchedules: Record<string, MemberWeeklySchedule> = {};
  for (const m of members) {
    memberSchedules[m.id] = createMemberWeeklySchedule(selectedDays, {
      B: true,
      L: true,
      M: includeMerienda,
      D: true,
    });
  }

  return {
    weekStartDate: getMondayIsoDate(),
    preset,
    selectedDays,
    memberSchedules,
  };
}

/**
 * Ensures every current household member has a complete 0..6 schedule entry.
 */
export function ensureMemberSchedules(
  schedule: WeeklySchedule,
  members: HouseholdMember[],
  defaultIncludeMerienda = false
): WeeklySchedule {
  const selectedDays =
    Array.isArray(schedule.selectedDays) && schedule.selectedDays.length > 0
      ? Array.from(new Set(schedule.selectedDays.filter((d) => d >= 0 && d <= 6))).sort(
          (a, b) => a - b
        )
      : [...ALL_DAYS];

  const nextMemberSchedules: Record<string, MemberWeeklySchedule> = {};
  for (const member of members) {
    const existing = schedule.memberSchedules?.[member.id];
    if (existing) {
      const normalized: MemberWeeklySchedule = {};
      for (const d of ALL_DAYS) {
        const daySched = existing[d];
        normalized[d] = daySched
          ? {
              B: Boolean(daySched.B),
              L: Boolean(daySched.L),
              M: Boolean(daySched.M),
              D: Boolean(daySched.D),
            }
          : selectedDays.includes(d)
          ? createDaySchedule({ B: true, L: true, M: defaultIncludeMerienda, D: true })
          : { B: false, L: false, M: false, D: false };
      }
      nextMemberSchedules[member.id] = normalized;
    } else {
      nextMemberSchedules[member.id] = createMemberWeeklySchedule(selectedDays, {
        B: true,
        L: true,
        M: defaultIncludeMerienda,
        D: true,
      });
    }
  }

  return {
    weekStartDate: schedule.weekStartDate || getMondayIsoDate(),
    preset: schedule.preset || inferPresetFromDays(selectedDays),
    selectedDays,
    memberSchedules: nextMemberSchedules,
  };
}

export function inferPresetFromDays(days: number[]): WeeklySchedulePreset {
  const sorted = Array.from(new Set(days)).sort((a, b) => a - b);
  if (sorted.length === 7) return 'everyday';
  if (sorted.length === 5 && sorted.every((d, i) => d === i)) return 'weekdays';
  if (sorted.length === 2 && sorted[0] === 5 && sorted[1] === 6) return 'weekends';
  return 'custom';
}

/**
 * Applies a quick weekly preset (Every day, Weekdays only, Weekends only, or Custom).
 * Automatically turns off unselected days and enables newly selected days using Monday's pattern (or default B/L/D).
 */
export function applyWeeklyPreset(
  schedule: WeeklySchedule,
  members: HouseholdMember[],
  preset: WeeklySchedulePreset,
  includeMerienda = false
): WeeklySchedule {
  const ensured = ensureMemberSchedules(schedule, members, includeMerienda);
  if (preset === 'custom') {
    return { ...ensured, preset: 'custom' };
  }

  const nextDays =
    preset === 'weekdays'
      ? [...WEEKDAYS]
      : preset === 'weekends'
      ? [...WEEKENDS]
      : [...ALL_DAYS];
  const nextSet = new Set(nextDays);

  const nextMemberSchedules: Record<string, MemberWeeklySchedule> = {};
  for (const m of members) {
    const prev = ensured.memberSchedules[m.id];
    // Find first active day pattern as template, or fallback to B/L/D
    const firstActive = ALL_DAYS.map((d) => prev[d]).find((s) => s.B || s.L || s.M || s.D) ?? {
      B: true,
      L: true,
      M: includeMerienda,
      D: true,
    };

    const nextSched: MemberWeeklySchedule = {};
    for (const d of ALL_DAYS) {
      if (!nextSet.has(d)) {
        nextSched[d] = { B: false, L: false, M: false, D: false };
      } else {
        const wasActive = prev[d] && (prev[d].B || prev[d].L || prev[d].M || prev[d].D);
        nextSched[d] = wasActive ? { ...prev[d] } : { ...firstActive };
      }
    }
    nextMemberSchedules[m.id] = nextSched;
  }

  return {
    ...ensured,
    preset,
    selectedDays: nextDays,
    memberSchedules: nextMemberSchedules,
  };
}

/**
 * Toggles an individual day of the week on or off in the household schedule.
 */
export function togglePlanningDay(
  schedule: WeeklySchedule,
  members: HouseholdMember[],
  dayIndex: number,
  includeMerienda = false
): WeeklySchedule {
  const ensured = ensureMemberSchedules(schedule, members, includeMerienda);
  const exists = ensured.selectedDays.includes(dayIndex);
  // Keep at least 1 day selected so the household always has a valid planning window
  if (exists && ensured.selectedDays.length <= 1) {
    return ensured;
  }

  const nextDays = exists
    ? ensured.selectedDays.filter((d) => d !== dayIndex)
    : [...ensured.selectedDays, dayIndex].sort((a, b) => a - b);

  const nextMemberSchedules: Record<string, MemberWeeklySchedule> = {};
  for (const m of members) {
    const prev = ensured.memberSchedules[m.id];
    const template = ALL_DAYS.map((d) => prev[d]).find((s) => s.B || s.L || s.M || s.D) ?? {
      B: true,
      L: true,
      M: includeMerienda,
      D: true,
    };
    nextMemberSchedules[m.id] = {
      ...prev,
      [dayIndex]: exists ? { B: false, L: false, M: false, D: false } : { ...template },
    };
  }

  return {
    ...ensured,
    preset: inferPresetFromDays(nextDays),
    selectedDays: nextDays,
    memberSchedules: nextMemberSchedules,
  };
}

export function setMemberDaySlot(
  schedule: WeeklySchedule,
  memberId: string,
  dayIndex: number,
  slot: MealSlot,
  enabled: boolean
): WeeklySchedule {
  const memberSched = schedule.memberSchedules[memberId] ?? createMemberWeeklySchedule(schedule.selectedDays);
  const daySched = memberSched[dayIndex] ?? { B: false, L: false, M: false, D: false };
  return {
    ...schedule,
    memberSchedules: {
      ...schedule.memberSchedules,
      [memberId]: {
        ...memberSched,
        [dayIndex]: {
          ...daySched,
          [slot]: enabled,
        },
      },
    },
  };
}

/**
 * Copies Monday's meal participation pattern to Monday–Friday for a given member.
 */
export function copyMondayToWeekdays(
  schedule: WeeklySchedule,
  memberId: string
): WeeklySchedule {
  const memberSched = schedule.memberSchedules[memberId];
  if (!memberSched) return schedule;
  const mon = memberSched[0] ?? createDaySchedule();
  const next = { ...memberSched };
  const selectedSet = new Set(schedule.selectedDays);
  for (const d of WEEKDAYS) {
    if (selectedSet.has(d)) {
      next[d] = { ...mon };
    }
  }
  return {
    ...schedule,
    memberSchedules: {
      ...schedule.memberSchedules,
      [memberId]: next,
    },
  };
}

/**
 * Applies a template meal pattern to all selected weekdays or all 7 selected days for a member.
 */
export function applyMemberPatternToDays(
  schedule: WeeklySchedule,
  memberId: string,
  template: MemberDaySchedule,
  target: 'weekdays' | 'all' | 'weekends'
): WeeklySchedule {
  const memberSched = schedule.memberSchedules[memberId] ?? createMemberWeeklySchedule(schedule.selectedDays);
  const next = { ...memberSched };
  const selectedSet = new Set(schedule.selectedDays);
  const targetDays =
    target === 'weekdays' ? WEEKDAYS : target === 'weekends' ? WEEKENDS : ALL_DAYS;

  for (const d of ALL_DAYS) {
    if (target === 'weekdays' && !WEEKDAYS.includes(d as 0 | 1 | 2 | 3 | 4)) {
      // When explicitly applying weekdays-only pattern, keep weekend days untouched unless user clears them
      continue;
    }
    if ((targetDays as readonly number[]).includes(d) && selectedSet.has(d)) {
      next[d] = { ...template };
    }
  }
  return {
    ...schedule,
    memberSchedules: {
      ...schedule.memberSchedules,
      [memberId]: next,
    },
  };
}

/**
 * Copies one household member's complete weekly schedule to another member.
 */
export function copyMemberSchedule(
  schedule: WeeklySchedule,
  fromMemberId: string,
  toMemberId: string
): WeeklySchedule {
  const source = schedule.memberSchedules[fromMemberId];
  if (!source) return schedule;
  const cloned: MemberWeeklySchedule = {};
  for (const d of ALL_DAYS) {
    cloned[d] = { ...source[d] };
  }
  return {
    ...schedule,
    memberSchedules: {
      ...schedule.memberSchedules,
      [toMemberId]: cloned,
    },
  };
}

/**
 * Clears a specific meal slot across all days for a member (e.g., "No breakfast").
 */
export function clearMemberMealSlot(
  schedule: WeeklySchedule,
  memberId: string,
  slot: MealSlot
): WeeklySchedule {
  const source = schedule.memberSchedules[memberId];
  if (!source) return schedule;
  const next: MemberWeeklySchedule = {};
  for (const d of ALL_DAYS) {
    next[d] = { ...source[d], [slot]: false };
  }
  return {
    ...schedule,
    memberSchedules: {
      ...schedule.memberSchedules,
      [memberId]: next,
    },
  };
}

/**
 * Returns the exact household members eating a specific (dayIndex, slot).
 * Always returns [] if dayIndex is not in weeklySchedule.selectedDays!
 */
export function getParticipatingMembers(
  profile: UserProfile,
  dayIndex: number,
  slot: MealSlot
): HouseholdMember[] {
  const schedule = profile.weeklySchedule;
  if (!schedule || !schedule.selectedDays.includes(dayIndex)) {
    return [];
  }
  return profile.household.filter((m) => {
    const daySched = schedule.memberSchedules?.[m.id]?.[dayIndex];
    return Boolean(daySched?.[slot]);
  });
}

/**
 * Returns true if ANY member is eating at least one meal on dayIndex and dayIndex is selected.
 */
export function isDayActiveInSchedule(profile: UserProfile, dayIndex: number): boolean {
  if (!profile.weeklySchedule?.selectedDays.includes(dayIndex)) return false;
  return ALL_SLOTS.some((slot) => getParticipatingMembers(profile, dayIndex, slot).length > 0);
}

/**
 * Returns the active slots (in B, L, D, M order) that have at least 1 participant on dayIndex.
 */
export function getActiveSlotsForDay(profile: UserProfile, dayIndex: number): MealSlot[] {
  const slots: MealSlot[] = ['B', 'L', 'D', 'M'];
  return slots.filter((slot) => getParticipatingMembers(profile, dayIndex, slot).length > 0);
}

/**
 * Calculates required recipe servings & per-member portion shares for a meal slot based on actual participants.
 * Uses each participant's age/portion preference, gently modulated by their calorie target ratio.
 */
export function calculateSlotServings(participants: HouseholdMember[]): {
  servings: number;
  memberPortions: Record<string, number>;
} {
  if (participants.length === 0) {
    return { servings: 0, memberPortions: {} };
  }
  const memberPortions: Record<string, number> = {};
  let total = 0;

  for (const m of participants) {
    const baseFactor = getMemberPortionFactor(m);
    // Gentle calorie-target calibration around 2,000 kcal baseline (clamped 0.85x..1.20x so portions stay realistic)
    const cal = calculateMemberCalorieTarget(m).dailyTargetKcal;
    const calMod =
      m.age >= 18 ? Math.max(0.85, Math.min(1.2, cal / 2000)) : 1.0;
    const portion = Number((baseFactor * calMod).toFixed(2));
    memberPortions[m.id] = portion;
    total += portion;
  }

  return {
    servings: Number(Math.max(0.5, total).toFixed(2)),
    memberPortions,
  };
}

/**
 * Computes the combined allergy, dietary, and dislike constraints for a set of participating members
 * (unioning member-specific restrictions with household-wide defaults so no participant is ever exposed).
 */
export function getEffectiveConstraintsForParticipants(
  participants: HouseholdMember[],
  profile: UserProfile
): {
  allergies: AllergenId[];
  dietaryPrefs: DietaryPrefId[];
  dislikes: string[];
} {
  const allergies = new Set<AllergenId>(profile.allergies ?? []);
  const dietaryPrefs = new Set<DietaryPrefId>(profile.dietaryPrefs ?? []);
  const dislikes = new Set<string>(profile.dislikes ?? []);

  for (const m of participants) {
    for (const a of m.allergies ?? []) allergies.add(a);
    for (const d of m.dietaryPrefs ?? []) dietaryPrefs.add(d);
    for (const dl of m.dislikes ?? []) dislikes.add(dl);
  }

  return {
    allergies: Array.from(allergies),
    dietaryPrefs: Array.from(dietaryPrefs),
    dislikes: Array.from(dislikes),
  };
}

/**
 * Distributes a member's daily estimated calorie target across ONLY the meal slots
 * they actually eat on a given day, normalizing weights when meal slots are skipped.
 */
export function getMemberDailySlotCalorieTargets(
  member: HouseholdMember,
  dayIndex: number,
  profile: UserProfile
): Record<MealSlot, number> {
  const result: Record<MealSlot, number> = { B: 0, L: 0, M: 0, D: 0 };
  if (!profile.weeklySchedule?.selectedDays.includes(dayIndex)) return result;

  const daySched = profile.weeklySchedule.memberSchedules?.[member.id]?.[dayIndex];
  if (!daySched) return result;

  const activeSlots = ALL_SLOTS.filter((slot) => Boolean(daySched[slot]));
  if (activeSlots.length === 0) return result;

  const totalWeight = activeSlots.reduce((sum, s) => sum + DEFAULT_SLOT_CALORIE_WEIGHTS[s], 0);
  const dailyTarget = calculateMemberCalorieTarget(member).dailyTargetKcal;

  for (const slot of activeSlots) {
    result[slot] = Math.round((dailyTarget * DEFAULT_SLOT_CALORIE_WEIGHTS[slot]) / totalWeight);
  }
  return result;
}

export interface MemberDayNutritionSummary {
  memberId: string;
  memberName: string;
  targetKcal: number;
  plannedKcal: number;
  differenceKcal: number; // planned - target
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealsAttended: MealSlot[];
  isEatingToday: boolean;
  isMinor: boolean;
  calorieMode: 'auto' | 'manual';
  slotTargets: Record<MealSlot, number>;
}

/**
 * Computes an individual household member's estimated nutrition for a specific DayPlan,
 * allocating ONLY the meals they actually participated in, scaled by their individual portion factor.
 */
export function computeMemberDayNutrition(
  day: DayPlan | null,
  member: HouseholdMember,
  profile: UserProfile
): MemberDayNutritionSummary {
  const calEst = calculateMemberCalorieTarget(member);
  const dayIndex = day?.dayIndex ?? 0;
  const slotTargets = getMemberDailySlotCalorieTargets(member, dayIndex, profile);

  if (!day || !day.isPlannedDay) {
    return {
      memberId: member.id,
      memberName: member.label,
      targetKcal: calEst.dailyTargetKcal,
      plannedKcal: 0,
      differenceKcal: -calEst.dailyTargetKcal,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      mealsAttended: [],
      isEatingToday: false,
      isMinor: calEst.isMinor,
      calorieMode: member.calorieMode,
      slotTargets,
    };
  }

  let plannedKcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  const mealsAttended: MealSlot[] = [];

  for (const meal of day.meals) {
    if (!meal.participatingMemberIds?.includes(member.id)) continue;
    mealsAttended.push(meal.slot);
    const portion = meal.memberPortions?.[member.id] ?? getMemberPortionFactor(member);
    plannedKcal += meal.kcalPerServing * portion;
    proteinG += meal.proteinPerServing * portion;
    carbsG += meal.carbsPerServing * portion;
    fatG += meal.fatPerServing * portion;
  }

  const roundedKcal = Math.round(plannedKcal);
  return {
    memberId: member.id,
    memberName: member.label,
    targetKcal: calEst.dailyTargetKcal,
    plannedKcal: roundedKcal,
    differenceKcal: roundedKcal - calEst.dailyTargetKcal,
    proteinG: Number(proteinG.toFixed(1)),
    carbsG: Number(carbsG.toFixed(1)),
    fatG: Number(fatG.toFixed(1)),
    mealsAttended,
    isEatingToday: mealsAttended.length > 0,
    isMinor: calEst.isMinor,
    calorieMode: member.calorieMode,
    slotTargets,
  };
}

export interface MemberWeeklyNutritionOverview {
  memberId: string;
  memberName: string;
  age: number;
  dailyTargetKcal: number;
  avgPlannedKcalPerActiveDay: number;
  differenceKcal: number;
  activeDaysCount: number;
  totalMealsAttended: number;
  avgProteinG: number;
  avgCarbsG: number;
  avgFatG: number;
  isMinor: boolean;
  calorieMode: 'auto' | 'manual';
  portionPreference: HouseholdMember['portionPreference'];
}

export function computeMemberWeeklyNutrition(
  plan: WeeklyMealPlan | null,
  member: HouseholdMember,
  profile: UserProfile
): MemberWeeklyNutritionOverview {
  const calEst = calculateMemberCalorieTarget(member);
  if (!plan) {
    return {
      memberId: member.id,
      memberName: member.label,
      age: member.age,
      dailyTargetKcal: calEst.dailyTargetKcal,
      avgPlannedKcalPerActiveDay: 0,
      differenceKcal: -calEst.dailyTargetKcal,
      activeDaysCount: 0,
      totalMealsAttended: 0,
      avgProteinG: 0,
      avgCarbsG: 0,
      avgFatG: 0,
      isMinor: calEst.isMinor,
      calorieMode: member.calorieMode,
      portionPreference: member.portionPreference,
    };
  }

  let activeDaysCount = 0;
  let totalMealsAttended = 0;
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const day of plan.days) {
    const daySum = computeMemberDayNutrition(day, member, profile);
    if (daySum.isEatingToday) {
      activeDaysCount++;
      totalMealsAttended += daySum.mealsAttended.length;
      totalKcal += daySum.plannedKcal;
      totalProtein += daySum.proteinG;
      totalCarbs += daySum.carbsG;
      totalFat += daySum.fatG;
    }
  }

  const avgKcal = activeDaysCount > 0 ? Math.round(totalKcal / activeDaysCount) : 0;
  return {
    memberId: member.id,
    memberName: member.label,
    age: member.age,
    dailyTargetKcal: calEst.dailyTargetKcal,
    avgPlannedKcalPerActiveDay: avgKcal,
    differenceKcal: activeDaysCount > 0 ? avgKcal - calEst.dailyTargetKcal : 0,
    activeDaysCount,
    totalMealsAttended,
    avgProteinG: activeDaysCount > 0 ? Number((totalProtein / activeDaysCount).toFixed(1)) : 0,
    avgCarbsG: activeDaysCount > 0 ? Number((totalCarbs / activeDaysCount).toFixed(1)) : 0,
    avgFatG: activeDaysCount > 0 ? Number((totalFat / activeDaysCount).toFixed(1)) : 0,
    isMinor: calEst.isMinor,
    calorieMode: member.calorieMode,
    portionPreference: member.portionPreference,
  };
}

/**
 * Helper to check if a meal plan already uses the v2 participant-aware format.
 */
export function hydrateLegacyMealPlan(
  plan: WeeklyMealPlan | null,
  profile: UserProfile
): WeeklyMealPlan | null {
  if (!plan) return null;
  const allIds = profile.household.map((m) => m.id);
  const allNames = profile.household.map((m) => m.label);
  const defaultSlotServings = calculateSlotServings(profile.household);

  return {
    ...plan,
    days: plan.days.map((day) => {
      const isPlannedDay =
        typeof day.isPlannedDay === 'boolean'
          ? day.isPlannedDay
          : profile.weeklySchedule.selectedDays.includes(day.dayIndex) && day.meals.length > 0;
      return {
        ...day,
        isPlannedDay,
        meals: day.meals.map((meal: PlannedMeal) => {
          if (Array.isArray(meal.participatingMemberIds) && typeof meal.servings === 'number') {
            return meal;
          }
          return {
            ...meal,
            participatingMemberIds: allIds,
            participatingMemberNames: allNames,
            servings: defaultSlotServings.servings,
            memberPortions: defaultSlotServings.memberPortions,
          };
        }),
      };
    }),
  };
}

export const DEFAULT_TIMEZONE = 'Asia/Manila';

export interface CalendarDateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

export interface CalendarWeekDay {
  dayIndex: number; // 0 = Monday .. 6 = Sunday
  isoDate: string; // YYYY-MM-DD
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  shortMonth: string; // e.g. "Nov"
  shortDateLabel: string; // e.g. "Nov 22"
  fullDateLabel: string; // e.g. "Sunday, Nov 22, 2026"
  isToday: boolean;
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const LONG_WEEKDAYS_MON_FIRST = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

/**
 * Parses a strict YYYY-MM-DD calendar date string without using local timezone conversion.
 */
export function parseIsoDateParts(iso: string | null | undefined): CalendarDateParts | null {
  if (!iso || typeof iso !== 'string') return null;
  const match = ISO_DATE_RE.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  const maxDay = getDaysInMonth(year, month);
  if (day < 1 || day > maxDay) return null;
  return { year, month, day };
}

export function formatIsoDateParts(parts: CalendarDateParts): string {
  return `${String(parts.year).padStart(4, '0')}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/**
 * Returns today's calendar date (YYYY-MM-DD) in the requested IANA timezone (default: Asia/Manila),
 * preventing UTC/device timezone date shifting.
 */
export function getTodayIsoInTimezone(
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE
): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return formatIsoDateParts({ year, month, day });
    }
  } catch {
    // Fallback if Intl timezone database is unavailable in a minimal runtime
  }
  // Safe UTC+8 fallback for Asia/Manila when Intl fails
  const phMs = now.getTime() + 8 * 60 * 60 * 1000;
  const phDate = new Date(phMs);
  return formatIsoDateParts({
    year: phDate.getUTCFullYear(),
    month: phDate.getUTCMonth() + 1,
    day: phDate.getUTCDate(),
  });
}

/**
 * Pure calendar day arithmetic using UTC noon to completely prevent DST or timezone shifting.
 * Handles month rollovers, year rollovers, and leap years (e.g. Feb 29).
 */
export function addDaysToIso(iso: string, deltaDays: number): string {
  const parts = parseIsoDateParts(iso);
  if (!parts) return getTodayIsoInTimezone();
  const utcNoon = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
  utcNoon.setUTCDate(utcNoon.getUTCDate() + deltaDays);
  return formatIsoDateParts({
    year: utcNoon.getUTCFullYear(),
    month: utcNoon.getUTCMonth() + 1,
    day: utcNoon.getUTCDate(),
  });
}

/**
 * Returns Monday-first weekday index: 0 = Monday .. 6 = Sunday.
 */
export function getDayOfWeekIndex(iso: string): number {
  const parts = parseIsoDateParts(iso);
  if (!parts) return 0;
  const utcNoon = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
  const jsDay = utcNoon.getUTCDay(); // 0 = Sun .. 6 = Sat
  return (jsDay + 6) % 7; // 0 = Mon .. 6 = Sun
}

/**
 * Returns the Monday (YYYY-MM-DD) of the week containing `dateOrIso`.
 */
export function getWeekStartIso(
  dateOrIso?: string | Date,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const targetIso =
    typeof dateOrIso === 'string' && parseIsoDateParts(dateOrIso)
      ? dateOrIso.trim()
      : getTodayIsoInTimezone(dateOrIso instanceof Date ? dateOrIso : new Date(), timeZone);
  const dow = getDayOfWeekIndex(targetIso);
  return addDaysToIso(targetIso, -dow);
}

/**
 * Returns the Sunday (YYYY-MM-DD) of the week starting on `weekStartIso`.
 */
export function getWeekEndIso(weekStartIso: string): string {
  const monday = getWeekStartIso(weekStartIso);
  return addDaysToIso(monday, 6);
}

/**
 * Shifts a week start Monday by `deltaWeeks` (e.g. -1 for Previous Week, +1 for Next Week).
 */
export function shiftWeekIso(weekStartIso: string, deltaWeeks: number): string {
  const monday = getWeekStartIso(weekStartIso);
  return addDaysToIso(monday, deltaWeeks * 7);
}

/**
 * Returns true if `iso` falls within Monday..Sunday of `weekStartIso`.
 */
export function isIsoInWeek(iso: string, weekStartIso: string): boolean {
  const monday = getWeekStartIso(weekStartIso);
  const sunday = getWeekEndIso(monday);
  return iso >= monday && iso <= sunday;
}

/**
 * Builds the 7 Monday..Sunday calendar day descriptors for a given planning week.
 */
export function getWeekDates(
  weekStartIso: string,
  todayIso: string = getTodayIsoInTimezone()
): CalendarWeekDay[] {
  const monday = getWeekStartIso(weekStartIso);
  const result: CalendarWeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const isoDate = addDaysToIso(monday, i);
    const parts = parseIsoDateParts(isoDate)!;
    const shortMonth = SHORT_MONTHS[parts.month - 1];
    const weekdayName = LONG_WEEKDAYS_MON_FIRST[i];
    result.push({
      dayIndex: i,
      isoDate,
      year: parts.year,
      month: parts.month,
      day: parts.day,
      shortMonth,
      shortDateLabel: `${shortMonth} ${parts.day}`,
      fullDateLabel: `${weekdayName}, ${shortMonth} ${parts.day}, ${parts.year}`,
      isToday: isoDate === todayIso,
    });
  }
  return result;
}

/**
 * Formats a YYYY-MM-DD date as e.g. "Sunday, November 22, 2026".
 */
export function formatLongDate(iso: string): string {
  const parts = parseIsoDateParts(iso);
  if (!parts) return iso;
  const weekday = LONG_WEEKDAYS_MON_FIRST[getDayOfWeekIndex(iso)];
  const month = LONG_MONTHS[parts.month - 1];
  return `${weekday}, ${month} ${parts.day}, ${parts.year}`;
}

/**
 * Formats a YYYY-MM-DD date as e.g. "Nov 22, 2026".
 */
export function formatShortDateWithYear(iso: string): string {
  const parts = parseIsoDateParts(iso);
  if (!parts) return iso;
  return `${SHORT_MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

/**
 * Formats a Monday..Sunday week range cleanly across same-month, cross-month, and cross-year spans.
 * Examples:
 * - "Nov 16 – 22, 2026"
 * - "Nov 30 – Dec 6, 2026"
 * - "Dec 28, 2026 – Jan 3, 2027"
 */
export function formatWeekRangeLabel(weekStartIso: string): string {
  const mondayIso = getWeekStartIso(weekStartIso);
  const sundayIso = getWeekEndIso(mondayIso);
  const start = parseIsoDateParts(mondayIso);
  const end = parseIsoDateParts(sundayIso);
  if (!start || !end) return `${mondayIso} – ${sundayIso}`;

  const startMonth = SHORT_MONTHS[start.month - 1];
  const endMonth = SHORT_MONTHS[end.month - 1];

  if (start.year !== end.year) {
    return `${startMonth} ${start.day}, ${start.year} – ${endMonth} ${end.day}, ${end.year}`;
  }
  if (start.month !== end.month) {
    return `${startMonth} ${start.day} – ${endMonth} ${end.day}, ${end.year}`;
  }
  return `${startMonth} ${start.day} – ${end.day}, ${end.year}`;
}

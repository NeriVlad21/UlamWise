import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TIMEZONE,
  addDaysToIso,
  formatLongDate,
  formatWeekRangeLabel,
  getDayOfWeekIndex,
  getTodayIsoInTimezone,
  getWeekDates,
  getWeekEndIso,
  getWeekStartIso,
  isIsoInWeek,
  isLeapYear,
  parseIsoDateParts,
  shiftWeekIso,
} from '../calendar';

test('Asia/Manila timezone detection prevents UTC date shifting across midnight boundary', () => {
  assert.equal(DEFAULT_TIMEZONE, 'Asia/Manila');
  // 2026-11-22 17:30 UTC is already 2026-11-23 01:30 AM in Asia/Manila (UTC+8)
  const utcEvening = new Date('2026-11-22T17:30:00Z');
  assert.equal(getTodayIsoInTimezone(utcEvening, 'Asia/Manila'), '2026-11-23');
  assert.equal(getDayOfWeekIndex('2026-11-23'), 0); // Monday

  // 2026-11-22 15:59 UTC is 2026-11-22 23:59 in Asia/Manila (still Sunday)
  const phLateNight = new Date('2026-11-22T15:59:00Z');
  assert.equal(getTodayIsoInTimezone(phLateNight, 'Asia/Manila'), '2026-11-22');
  assert.equal(getDayOfWeekIndex('2026-11-22'), 6); // Sunday
  assert.equal(formatLongDate('2026-11-22'), 'Sunday, November 22, 2026');
});

test('Weekly bounds, previous/next navigation, month transitions, and year transitions calculate cleanly', () => {
  // Mid-week Wednesday 2026-11-18 -> Monday 2026-11-16 .. Sunday 2026-11-22
  assert.equal(getWeekStartIso('2026-11-18'), '2026-11-16');
  assert.equal(getWeekEndIso('2026-11-16'), '2026-11-22');
  assert.equal(formatWeekRangeLabel('2026-11-16'), 'Nov 16 – 22, 2026');

  // Previous / Next week navigation
  assert.equal(shiftWeekIso('2026-11-16', -1), '2026-11-09');
  assert.equal(shiftWeekIso('2026-11-16', 1), '2026-11-23');

  // Cross-month week: Nov 30 – Dec 6, 2026
  const crossMonthStart = getWeekStartIso('2026-12-02');
  assert.equal(crossMonthStart, '2026-11-30');
  assert.equal(getWeekEndIso(crossMonthStart), '2026-12-06');
  assert.equal(formatWeekRangeLabel(crossMonthStart), 'Nov 30 – Dec 6, 2026');

  // Cross-year week: Dec 28, 2026 – Jan 3, 2027
  const crossYearStart = getWeekStartIso('2027-01-01');
  assert.equal(crossYearStart, '2026-12-28');
  assert.equal(getWeekEndIso(crossYearStart), '2027-01-03');
  assert.equal(formatWeekRangeLabel(crossYearStart), 'Dec 28, 2026 – Jan 3, 2027');
});

test('Leap years and non-leap years handle February 29 accurately', () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2025), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(1900), false);

  // Strict ISO parsing accepts 2024-02-29 and rejects 2025-02-29
  assert.ok(parseIsoDateParts('2024-02-29'));
  assert.equal(parseIsoDateParts('2025-02-29'), null);

  // Leap year week containing Feb 29, 2024: Mon Feb 26 – Sun Mar 3, 2024
  const leapWeekStart = getWeekStartIso('2024-02-29');
  assert.equal(leapWeekStart, '2024-02-26');
  const leapDays = getWeekDates(leapWeekStart, '2024-02-29');
  assert.equal(leapDays.length, 7);
  assert.equal(leapDays[3].isoDate, '2024-02-29');
  assert.equal(leapDays[3].isToday, true);
  assert.equal(leapDays[4].isoDate, '2024-03-01');
  assert.equal(leapDays[6].isoDate, '2024-03-03');
  assert.equal(formatWeekRangeLabel(leapWeekStart), 'Feb 26 – Mar 3, 2024');

  // Non-leap year week: Mon Feb 24 – Sun Mar 2, 2025
  assert.equal(addDaysToIso('2025-02-28', 1), '2025-03-01');
  assert.equal(getWeekEndIso('2025-02-24'), '2025-03-02');
  assert.equal(isIsoInWeek('2024-02-29', leapWeekStart), true);
  assert.equal(isIsoInWeek('2024-03-04', leapWeekStart), false);
});

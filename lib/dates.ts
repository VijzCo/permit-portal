import {
  addDays,
  differenceInCalendarDays,
  format,
  getISOWeek,
  getISOWeekYear,
  isValid,
  parse,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

/**
 * All calendar logic runs in Africa/Maseru (UTC+2, no DST).
 * Dates are stored and exchanged as `YYYY-MM-DD` strings. Internally a
 * date string is parsed to a local-midnight Date purely for calendar
 * arithmetic, and formatted straight back, so the host machine's time
 * zone never leaks into results.
 */
export const APP_TIME_ZONE = "Africa/Maseru";
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const AUTHORISATION_VALIDITY_YEARS = 2;

const ISO_FORMAT = "yyyy-MM-dd";
const REFERENCE_DATE = new Date(2000, 0, 1);

/** True when `value` is a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = parse(value, ISO_FORMAT, REFERENCE_DATE);
  return isValid(parsed) && format(parsed, ISO_FORMAT) === value;
}

function toCalendarDate(iso: string): Date {
  if (!isIsoDate(iso)) {
    throw new RangeError(`Invalid ISO date: ${iso}`);
  }
  return parse(iso, ISO_FORMAT, REFERENCE_DATE);
}

function fromCalendarDate(date: Date): string {
  return format(date, ISO_FORMAT);
}

/** Today's date in Africa/Maseru as `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  return formatInTimeZone(now, APP_TIME_ZONE, ISO_FORMAT);
}

export function addDaysIso(iso: string, days: number): string {
  return fromCalendarDate(addDays(toCalendarDate(iso), days));
}

/** Whole calendar days from `fromIso` to `toIso` (negative if `toIso` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  return differenceInCalendarDays(toCalendarDate(toIso), toCalendarDate(fromIso));
}

/** Days left until `expiryIso`, counted from today in Africa/Maseru. 0 = expires today. */
export function daysUntil(expiryIso: string, now: Date = new Date()): number {
  return daysBetween(todayIso(now), expiryIso);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Default expiry = issued + 2 years − 1 day.
 * A 29 Feb issue date whose anniversary falls in a non-leap year is treated
 * as anniversary 1 Mar, so the expiry is 28 Feb.
 */
export function defaultExpiryDate(issuedIso: string): string {
  const issued = toCalendarDate(issuedIso);
  const year = issued.getFullYear() + AUTHORISATION_VALIDITY_YEARS;
  const month = issued.getMonth();
  const day = issued.getDate();
  const anniversary =
    month === 1 && day === 29 && !isLeapYear(year)
      ? new Date(year, 2, 1)
      : new Date(year, month, day);
  return fromCalendarDate(addDays(anniversary, -1));
}

/** Renewal pre-fill: the new issued date is the day after the old expiry. */
export function renewalIssuedDate(previousExpiryIso: string): string {
  return addDaysIso(previousExpiryIso, 1);
}

/** ISO week key, e.g. `2026-40`. Used for weekly overdue alert idempotency. */
export function isoWeekKey(iso: string): string {
  const date = toCalendarDate(iso);
  const week = String(getISOWeek(date)).padStart(2, "0");
  return `${getISOWeekYear(date)}-${week}`;
}

/** `2026-09-28` → `28 Sep 2026`. Invalid input is returned unchanged. */
export function formatDisplayDate(iso: string): string {
  if (!isIsoDate(iso)) return iso;
  return format(toCalendarDate(iso), "d MMM yyyy");
}

/** Lexicographic comparison is exact for `YYYY-MM-DD`. */
export function compareIsoDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

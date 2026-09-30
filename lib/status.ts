import { daysUntil, isoWeekKey, todayIso } from "@/lib/dates";

export const AUTHORISATION_TYPES = ["WORK_PERMIT", "VISA"] as const;
export type AuthorisationType = (typeof AUTHORISATION_TYPES)[number];

export const AUTHORISATION_TYPE_LABELS: Record<AuthorisationType, string> = {
  WORK_PERMIT: "Work Permit",
  VISA: "Visa",
};

export const STATUSES = ["VALID", "EXPIRING", "EXPIRED", "MISSING"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  VALID: "Valid",
  EXPIRING: "Expiring",
  EXPIRED: "Expired",
  MISSING: "Missing",
};

/** EXPIRING covers 0..30 days left inclusive. */
export const EXPIRING_WINDOW_DAYS = 30;
/** Passport card on the dashboard (informational only). */
export const PASSPORT_WARNING_DAYS = 90;

export function statusFromDaysLeft(daysLeft: number): Exclude<Status, "MISSING"> {
  if (daysLeft < 0) return "EXPIRED";
  if (daysLeft <= EXPIRING_WINDOW_DAYS) return "EXPIRING";
  return "VALID";
}

export interface StatusResult {
  status: Status;
  daysLeft: number | null;
}

/** Status of a current record, or MISSING when there is none. */
export function computeStatus(
  expiryDate: string | null | undefined,
  now: Date = new Date(),
): StatusResult {
  if (!expiryDate) return { status: "MISSING", daysLeft: null };
  const daysLeft = daysUntil(expiryDate, now);
  return { status: statusFromDaysLeft(daysLeft), daysLeft };
}

export function isActionRequired(status: Status): boolean {
  return status === "EXPIRING" || status === "EXPIRED";
}

/** Minimal shape needed to pick the current record of a type. */
export interface CurrentCandidate {
  type: AuthorisationType;
  isCurrent: boolean;
  expiryDate: string;
}

export function findCurrent<T extends CurrentCandidate>(
  records: readonly T[],
  type: AuthorisationType,
): T | undefined {
  return records.find((r) => r.type === type && r.isCurrent);
}

// ---------------------------------------------------------------------------
// Email urgency buckets (Expired → 0–7d → 8–14d → 15–30d)
// ---------------------------------------------------------------------------

export const URGENCY_BUCKETS = ["EXPIRED", "D0_7", "D8_14", "D15_30"] as const;
export type UrgencyBucket = (typeof URGENCY_BUCKETS)[number];

export const URGENCY_LABELS: Record<UrgencyBucket, string> = {
  EXPIRED: "Expired",
  D0_7: "Expiring in 0–7 days",
  D8_14: "Expiring in 8–14 days",
  D15_30: "Expiring in 15–30 days",
};

export function urgencyBucket(daysLeft: number): UrgencyBucket | null {
  if (daysLeft < 0) return "EXPIRED";
  if (daysLeft <= 7) return "D0_7";
  if (daysLeft <= 14) return "D8_14";
  if (daysLeft <= EXPIRING_WINDOW_DAYS) return "D15_30";
  return null;
}

// ---------------------------------------------------------------------------
// Alert thresholds
// ---------------------------------------------------------------------------

export const ALERT_THRESHOLDS = [30, 14, 7, 0] as const;
export type AlertThreshold = (typeof ALERT_THRESHOLDS)[number];

/** `"30" | "14" | "7" | "0" | "OVERDUE_2026-40"` */
export type ThresholdKey = `${AlertThreshold}` | `OVERDUE_${string}`;

export function overdueKey(todayIsoDate: string): ThresholdKey {
  return `OVERDUE_${isoWeekKey(todayIsoDate)}`;
}

/**
 * The threshold an authorisation is currently in, or null if none applies.
 * - daysLeft > 30 → null
 * - 0..30 → the tightest threshold crossed (e.g. 10 days left → "14")
 * - < 0 → weekly overdue key for today's ISO week
 *
 * Because only the tightest crossed threshold is ever returned, a missed day
 * sends one alert for the current threshold, never the skipped ones.
 */
export function currentThresholdKey(daysLeft: number, todayIsoDate: string): ThresholdKey | null {
  if (daysLeft < 0) return overdueKey(todayIsoDate);
  let key: ThresholdKey | null = null;
  for (const t of ALERT_THRESHOLDS) {
    if (daysLeft <= t) key = `${t}`;
  }
  return key;
}

/** Threshold key to send now, or null if nothing is due / already sent. */
export function resolveAlertThreshold(
  expiryDate: string,
  alreadySent: ReadonlySet<string>,
  now: Date = new Date(),
): ThresholdKey | null {
  const today = todayIso(now);
  const key = currentThresholdKey(daysUntil(expiryDate, now), today);
  if (key === null || alreadySent.has(key)) return null;
  return key;
}

/** Firestore doc id for `notificationLog`. */
export function notificationLogId(authId: string, key: ThresholdKey): string {
  return `${authId}_${key}`;
}

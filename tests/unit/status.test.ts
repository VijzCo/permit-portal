import { describe, expect, it } from "vitest";
import {
  computeStatus,
  currentThresholdKey,
  findCurrent,
  isActionRequired,
  notificationLogId,
  resolveAlertThreshold,
  statusFromDaysLeft,
  urgencyBucket,
} from "@/lib/status";

const NOW = new Date("2026-09-30T04:00:00Z"); // 30 Sep 2026, 06:00 Maseru

describe("statusFromDaysLeft", () => {
  it.each([
    [31, "VALID"],
    [30, "EXPIRING"],
    [1, "EXPIRING"],
    [0, "EXPIRING"],
    [-1, "EXPIRED"],
  ] as const)("%i days → %s", (days, status) => {
    expect(statusFromDaysLeft(days)).toBe(status);
  });
});

describe("computeStatus", () => {
  it("returns MISSING without a record", () => {
    expect(computeStatus(null, NOW)).toEqual({ status: "MISSING", daysLeft: null });
    expect(computeStatus(undefined, NOW)).toEqual({ status: "MISSING", daysLeft: null });
  });
  it("computes from Maseru today", () => {
    expect(computeStatus("2026-10-31", NOW)).toEqual({ status: "VALID", daysLeft: 31 });
    expect(computeStatus("2026-10-30", NOW)).toEqual({ status: "EXPIRING", daysLeft: 30 });
    expect(computeStatus("2026-09-30", NOW)).toEqual({ status: "EXPIRING", daysLeft: 0 });
    expect(computeStatus("2026-09-29", NOW)).toEqual({ status: "EXPIRED", daysLeft: -1 });
  });
  it("action required only for EXPIRING/EXPIRED", () => {
    expect(isActionRequired("EXPIRING")).toBe(true);
    expect(isActionRequired("EXPIRED")).toBe(true);
    expect(isActionRequired("VALID")).toBe(false);
    expect(isActionRequired("MISSING")).toBe(false);
  });
});

describe("findCurrent", () => {
  it("picks the current record of the type", () => {
    const records = [
      { id: "a", type: "VISA" as const, isCurrent: false, expiryDate: "2025-01-01" },
      { id: "b", type: "VISA" as const, isCurrent: true, expiryDate: "2027-01-01" },
      { id: "c", type: "WORK_PERMIT" as const, isCurrent: true, expiryDate: "2027-06-01" },
    ];
    expect(findCurrent(records, "VISA")?.id).toBe("b");
    expect(findCurrent(records, "WORK_PERMIT")?.id).toBe("c");
    expect(findCurrent(records.slice(0, 1), "VISA")).toBeUndefined();
  });
});

describe("urgencyBucket", () => {
  it.each([
    [-5, "EXPIRED"],
    [0, "D0_7"],
    [7, "D0_7"],
    [8, "D8_14"],
    [14, "D8_14"],
    [15, "D15_30"],
    [30, "D15_30"],
    [31, null],
  ] as const)("%i → %s", (days, bucket) => {
    expect(urgencyBucket(days)).toBe(bucket);
  });
});

describe("currentThresholdKey", () => {
  it.each([
    [45, null],
    [31, null],
    [30, "30"],
    [15, "30"],
    [14, "14"],
    [8, "14"],
    [7, "7"],
    [1, "7"],
    [0, "0"],
  ] as const)("%i days → %s", (days, key) => {
    expect(currentThresholdKey(days, "2026-09-30")).toBe(key);
  });
  it("uses the weekly overdue key after expiry", () => {
    expect(currentThresholdKey(-1, "2026-09-30")).toBe("OVERDUE_2026-40");
    expect(currentThresholdKey(-100, "2026-10-05")).toBe("OVERDUE_2026-41");
  });
});

describe("resolveAlertThreshold", () => {
  it("sends the threshold on the day it is crossed", () => {
    expect(resolveAlertThreshold("2026-10-30", new Set(), NOW)).toBe("30");
  });
  it("never resends an already-sent threshold (rerun safe)", () => {
    expect(resolveAlertThreshold("2026-10-30", new Set(["30"]), NOW)).toBeNull();
    expect(resolveAlertThreshold("2026-10-20", new Set(["30"]), NOW)).toBeNull(); // 20 days, still in 30 band
  });
  it("after missed days sends only the tightest crossed threshold", () => {
    // 10 days left, 30 was sent, 14 was missed → send 14 (not 30 again, not both)
    expect(resolveAlertThreshold("2026-10-10", new Set(["30"]), NOW)).toBe("14");
    // 3 days left, nothing sent at all → only 7
    expect(resolveAlertThreshold("2026-10-03", new Set(), NOW)).toBe("7");
  });
  it("sends on expiry day then weekly overdue", () => {
    expect(resolveAlertThreshold("2026-09-30", new Set(["7"]), NOW)).toBe("0");
    expect(resolveAlertThreshold("2026-09-01", new Set(["0"]), NOW)).toBe("OVERDUE_2026-40");
    expect(resolveAlertThreshold("2026-09-01", new Set(["OVERDUE_2026-40"]), NOW)).toBeNull();
  });
  it("returns null when not yet in the window", () => {
    expect(resolveAlertThreshold("2027-01-01", new Set(), NOW)).toBeNull();
  });
});

describe("notificationLogId", () => {
  it("joins auth id and key", () => {
    expect(notificationLogId("abc", "14")).toBe("abc_14");
    expect(notificationLogId("abc", "OVERDUE_2026-40")).toBe("abc_OVERDUE_2026-40");
  });
});

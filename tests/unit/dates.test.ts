import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  compareIsoDates,
  daysBetween,
  daysUntil,
  defaultExpiryDate,
  formatDisplayDate,
  isIsoDate,
  isoWeekKey,
  renewalIssuedDate,
  todayIso,
} from "@/lib/dates";

describe("isIsoDate", () => {
  it("accepts real dates", () => {
    expect(isIsoDate("2026-09-30")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
  });
  it("rejects malformed or impossible dates", () => {
    expect(isIsoDate("2026-9-30")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2025-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate(20260930)).toBe(false);
  });
});

describe("todayIso (Africa/Maseru)", () => {
  it("rolls to the next day at 22:00 UTC", () => {
    expect(todayIso(new Date("2026-09-29T21:59:59Z"))).toBe("2026-09-29");
    expect(todayIso(new Date("2026-09-29T22:00:00Z"))).toBe("2026-09-30");
  });
  it("matches the cron run time (04:00 UTC = 06:00 Maseru)", () => {
    expect(todayIso(new Date("2026-09-30T04:00:00Z"))).toBe("2026-09-30");
  });
});

describe("day arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-09-30", "2026-10-30")).toBe(30);
    expect(daysBetween("2026-09-30", "2026-09-29")).toBe(-1);
  });
  it("daysUntil uses Maseru today, not UTC", () => {
    // 23:30 UTC on 29 Sep is already 30 Sep in Maseru
    const now = new Date("2026-09-29T23:30:00Z");
    expect(daysUntil("2026-09-30", now)).toBe(0);
    expect(daysUntil("2026-10-30", now)).toBe(30);
    expect(daysUntil("2026-09-29", now)).toBe(-1);
  });
});

describe("defaultExpiryDate", () => {
  it("is issued + 2 years − 1 day", () => {
    expect(defaultExpiryDate("2026-09-28")).toBe("2028-09-27");
    expect(defaultExpiryDate("2026-01-01")).toBe("2027-12-31");
  });
  it("handles leap days", () => {
    expect(defaultExpiryDate("2024-02-29")).toBe("2026-02-28");
    expect(defaultExpiryDate("2026-03-01")).toBe("2028-02-29");
    expect(defaultExpiryDate("2025-03-01")).toBe("2027-02-28");
  });
  it("throws on invalid input", () => {
    expect(() => defaultExpiryDate("2026-02-30")).toThrow(RangeError);
  });
});

describe("renewalIssuedDate", () => {
  it("is the day after the previous expiry", () => {
    expect(renewalIssuedDate("2026-12-31")).toBe("2027-01-01");
  });
});

describe("isoWeekKey", () => {
  it("uses ISO week-year", () => {
    expect(isoWeekKey("2026-09-28")).toBe("2026-40");
    expect(isoWeekKey("2027-01-01")).toBe("2026-53");
    expect(isoWeekKey("2024-12-30")).toBe("2025-01");
  });
});

describe("formatting and comparison", () => {
  it("formats for display", () => {
    expect(formatDisplayDate("2026-09-28")).toBe("28 Sep 2026");
    expect(formatDisplayDate("bad")).toBe("bad");
  });
  it("compares ISO dates", () => {
    expect(compareIsoDates("2026-01-01", "2026-01-02")).toBe(-1);
    expect(compareIsoDates("2026-01-02", "2026-01-01")).toBe(1);
    expect(compareIsoDates("2026-01-01", "2026-01-01")).toBe(0);
  });
});

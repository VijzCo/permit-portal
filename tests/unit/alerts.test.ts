import { describe, expect, it } from "vitest";
import { candidateLogIds, planDigests, recipientsFor, type AlertInput, type AlertUser } from "@/lib/email/alerts";

const NOW = new Date("2026-09-30T04:00:00Z"); // cron time, 30 Sep in Maseru

const USERS: AlertUser[] = [
  { email: "admin@x.co", role: "admin", companyIds: [], active: true },
  { email: "old-admin@x.co", role: "admin", companyIds: [], active: false },
  { email: "HR.RWD@x.co", role: "hr", companyIds: ["RWD"], active: true },
  { email: "hr.both@x.co", role: "hr", companyIds: ["RWD", "DFS"], active: true },
  { email: "hr.off@x.co", role: "hr", companyIds: ["RWD"], active: false },
];

function input(overrides: Partial<AlertInput> = {}): AlertInput {
  return {
    now: NOW,
    baseUrl: "https://permits.example.com",
    companies: [
      { id: "RWD", name: "RW Design", active: true },
      { id: "DFS", name: "DutyFreeSourcing Inc.", active: true },
      { id: "QA", name: "Quantum Apparel", active: true },
    ],
    users: USERS,
    employees: [
      { id: "e1", firstName: "Li", lastName: "Wei", departmentName: "Sewing", designationName: "Tech", companyId: "RWD", active: true },
      { id: "e2", firstName: "Ann", lastName: "Lee", departmentName: "QC", designationName: "QC", companyId: "RWD", active: true },
      { id: "e3", firstName: "Tom", lastName: "Moyo", departmentName: "Cut", designationName: "IE", companyId: "DFS", active: true },
      { id: "e4", firstName: "Off", lastName: "Boarded", departmentName: "Cut", designationName: "IE", companyId: "DFS", active: false },
      { id: "e5", firstName: "Qa", lastName: "Person", departmentName: "Cut", designationName: "IE", companyId: "QA", active: true },
    ],
    authorisations: [
      { id: "a1", employeeId: "e1", companyId: "RWD", type: "WORK_PERMIT", referenceNumber: "WP1", expiryDate: "2026-10-30", isCurrent: true }, // 30 → "30"
      { id: "a2", employeeId: "e2", companyId: "RWD", type: "VISA", referenceNumber: "V2", expiryDate: "2026-09-25", isCurrent: true }, // -5 → overdue
      { id: "a3", employeeId: "e3", companyId: "DFS", type: "VISA", referenceNumber: "V3", expiryDate: "2026-10-07", isCurrent: true }, // 7 → "7"
      { id: "a3-old", employeeId: "e3", companyId: "DFS", type: "VISA", referenceNumber: "V3-old", expiryDate: "2026-09-01", isCurrent: false },
      { id: "a4", employeeId: "e4", companyId: "DFS", type: "VISA", referenceNumber: "V4", expiryDate: "2026-10-01", isCurrent: true }, // inactive employee
      { id: "a5", employeeId: "e5", companyId: "QA", type: "WORK_PERMIT", referenceNumber: "WP5", expiryDate: "2027-06-01", isCurrent: true }, // valid
    ],
    sentLogIds: new Set(),
    ...overrides,
  };
}

describe("recipientsFor", () => {
  it("sends to active HR of the company and BCCs active admins", () => {
    expect(recipientsFor("RWD", USERS)).toEqual({ to: ["hr.both@x.co", "hr.rwd@x.co"], bcc: ["admin@x.co"] });
    expect(recipientsFor("DFS", USERS)).toEqual({ to: ["hr.both@x.co"], bcc: ["admin@x.co"] });
  });
  it("falls back to admins when a company has no HR", () => {
    expect(recipientsFor("QA", USERS)).toEqual({ to: ["admin@x.co"], bcc: [] });
  });
});

describe("planDigests", () => {
  it("builds one digest per company with due items only", () => {
    const plan = planDigests(input());
    expect(plan.today).toBe("2026-09-30");
    expect(plan.digests.map((d) => d.companyId)).toEqual(["DFS", "RWD"]); // sorted by company name
    const rwd = plan.digests.find((d) => d.companyId === "RWD");
    expect(rwd?.logs.map((l) => l.id).sort()).toEqual(["a1_30", "a2_OVERDUE_2026-40"]);
    expect(rwd?.content.subject).toBe("[Permit/Visa] 1 expiring, 1 expired — RW Design — 2026-09-30");
    const dfs = plan.digests.find((d) => d.companyId === "DFS");
    expect(dfs?.items.map((i) => i.authId)).toEqual(["a3"]); // not superseded, not inactive employee
  });

  it("second run sends nothing once logs exist (idempotent)", () => {
    const first = planDigests(input());
    const sent = new Set(first.digests.flatMap((d) => d.logs.map((l) => l.id)));
    const second = planDigests(input({ sentLogIds: sent }));
    expect(second.digests).toEqual([]);
  });

  it("after a missed day sends only the tightest threshold", () => {
    // a1 now has 10 days left; "30" was sent earlier, "14" is due
    const later = new Date("2026-10-20T04:00:00Z");
    const plan = planDigests(input({ now: later, sentLogIds: new Set(["a1_30"]) }));
    const rwd = plan.digests.find((d) => d.companyId === "RWD");
    expect(rwd?.logs.find((l) => l.authId === "a1")?.threshold).toBe("14");
  });

  it("overdue alerts repeat once per ISO week", () => {
    const sameWeek = planDigests(input({ now: new Date("2026-10-02T04:00:00Z"), sentLogIds: new Set(["a2_OVERDUE_2026-40"]) }));
    expect(sameWeek.digests.find((d) => d.companyId === "RWD")?.logs.some((l) => l.authId === "a2")).toBe(false);
    const nextWeek = planDigests(input({ now: new Date("2026-10-05T04:00:00Z"), sentLogIds: new Set(["a2_OVERDUE_2026-40"]) }));
    expect(nextWeek.digests.find((d) => d.companyId === "RWD")?.logs.find((l) => l.authId === "a2")?.id).toBe("a2_OVERDUE_2026-41");
  });

  it("skips companies without recipients or inactive companies", () => {
    const noUsers = planDigests(input({ users: [] }));
    expect(noUsers.digests).toEqual([]);
    expect(noUsers.skipped.map((s) => s.companyId).sort()).toEqual(["DFS", "RWD"]);
    const inactive = planDigests(input({ companies: [{ id: "RWD", name: "RW Design", active: false }] }));
    expect(inactive.skipped[0]?.reason).toBe("Company is inactive");
  });
});

describe("candidateLogIds", () => {
  it("lists the current threshold id of each current record", () => {
    expect(candidateLogIds(input().authorisations, NOW).sort()).toEqual(["a1_30", "a2_OVERDUE_2026-40", "a3_7", "a4_7"]);
  });
});

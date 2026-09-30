import { describe, expect, it } from "vitest";
import { buildDashboard, countActionRequired, employeeStatuses } from "@/lib/dashboard";
import type { Authorisation, Company, Employee } from "@/lib/schemas";

const NOW = new Date("2026-09-30T08:00:00Z");

const companies: Company[] = [
  { id: "RWD", name: "RW Design", code: "RWD", active: true, createdAt: null },
  { id: "DFS", name: "DutyFreeSourcing Inc.", code: "DFS", active: true, createdAt: null },
];

function emp(id: string, companyId: string, passportExpiry = "2030-01-01", active = true): Employee {
  return {
    id,
    firstName: id.toUpperCase(),
    lastName: "Test",
    email: "",
    companyId,
    departmentId: "d",
    designationId: "g",
    companyName: companyId,
    departmentName: "Dept",
    designationName: "Desig",
    searchText: id,
    passport: { number: `P-${id}`, nationality: "X", issueDate: "2020-01-01", expiryDate: passportExpiry },
    active,
    createdAt: null,
    updatedAt: null,
    createdBy: "",
    updatedBy: "",
  };
}

function auth(id: string, employeeId: string, companyId: string, type: Authorisation["type"], expiryDate: string, isCurrent = true): Authorisation {
  return {
    id,
    employeeId,
    companyId,
    type,
    referenceNumber: `R-${id}`,
    issuedDate: "2025-01-01",
    expiryDate,
    notes: "",
    isCurrent,
    supersededBy: null,
    createdAt: null,
    updatedAt: null,
    createdBy: "",
    updatedBy: "",
  };
}

const employees = [emp("e1", "RWD", "2026-11-15"), emp("e2", "RWD"), emp("e3", "DFS"), emp("e4", "DFS", "2026-10-01", false)];
const auths = [
  auth("a1", "e1", "RWD", "WORK_PERMIT", "2026-10-10"), // expiring 10
  auth("a1-old", "e1", "RWD", "WORK_PERMIT", "2024-10-10", false),
  auth("a2", "e1", "RWD", "VISA", "2027-10-10"), // valid
  auth("a3", "e2", "RWD", "WORK_PERMIT", "2026-09-20"), // expired
  auth("a4", "e3", "DFS", "WORK_PERMIT", "2026-10-30"), // expiring 30
  auth("a5", "e3", "DFS", "VISA", "2026-10-31"), // valid 31
  auth("a6", "e4", "DFS", "VISA", "2026-09-01"), // inactive employee: ignored
];

describe("employeeStatuses", () => {
  it("derives both types incl. MISSING", () => {
    const s = employeeStatuses(employees, auths, NOW);
    expect(s.get("e1")?.WORK_PERMIT.status).toBe("EXPIRING");
    expect(s.get("e1")?.WORK_PERMIT.auth?.id).toBe("a1");
    expect(s.get("e2")?.VISA.status).toBe("MISSING");
    expect(s.get("e3")?.VISA.status).toBe("VALID");
  });
});

describe("buildDashboard", () => {
  it("computes KPIs for all accessible companies, active employees only", () => {
    const d = buildDashboard({ employees, auths, companies, filters: { companyId: "all", type: "all" }, now: NOW });
    expect(d.kpis).toEqual([
      { type: "WORK_PERMIT", counts: { VALID: 0, EXPIRING: 2, EXPIRED: 1, MISSING: 0 } },
      { type: "VISA", counts: { VALID: 2, EXPIRING: 0, EXPIRED: 0, MISSING: 1 } },
    ]);
  });
  it("lists action-required rows sorted by expiry ascending", () => {
    const d = buildDashboard({ employees, auths, companies, filters: { companyId: "all", type: "all" }, now: NOW });
    expect(d.actionRows.map((r) => [r.authId, r.daysLeft, r.status])).toEqual([
      ["a3", -10, "EXPIRED"],
      ["a1", 10, "EXPIRING"],
      ["a4", 30, "EXPIRING"],
    ]);
    expect(d.actionRows[0]?.companyName).toBe("RW Design");
  });
  it("filters by company and type", () => {
    const d = buildDashboard({ employees, auths, companies, filters: { companyId: "DFS", type: "VISA" }, now: NOW });
    expect(d.kpis).toEqual([{ type: "VISA", counts: { VALID: 1, EXPIRING: 0, EXPIRED: 0, MISSING: 0 } }]);
    expect(d.actionRows).toEqual([]);
    expect(d.byCompany.map((b) => b.companyId)).toEqual(["DFS"]);
  });
  it("breaks down by company", () => {
    const d = buildDashboard({ employees, auths, companies, filters: { companyId: "all", type: "WORK_PERMIT" }, now: NOW });
    expect(d.byCompany).toEqual([
      { companyId: "RWD", companyName: "RW Design", VALID: 0, EXPIRING: 1, EXPIRED: 1, MISSING: 0 },
      { companyId: "DFS", companyName: "DutyFreeSourcing Inc.", VALID: 0, EXPIRING: 1, EXPIRED: 0, MISSING: 0 },
    ]);
  });
  it("lists passports expiring within 90 days (active employees)", () => {
    const d = buildDashboard({ employees, auths, companies, filters: { companyId: "all", type: "all" }, now: NOW });
    expect(d.passports.map((p) => [p.employeeId, p.daysLeft])).toEqual([["e1", 46]]);
  });
});

describe("countActionRequired", () => {
  it("counts EXPIRING + EXPIRED current records of active employees", () => {
    expect(countActionRequired(employees, auths, NOW)).toBe(3);
  });
});

import { describe, expect, it } from "vitest";
import {
  accessibleCompanyIds,
  authorisationInputSchema,
  buildSearchText,
  canEditRole,
  companyInputSchema,
  employeeFormSchema,
  employeeInputSchema,
  splitEmployeeForm,
  userInputSchema,
  type AppUser,
} from "@/lib/schemas";

const validEmployee = {
  firstName: "Thabo",
  lastName: "Mokoena",
  email: "thabo@example.com",
  companyId: "RWD",
  departmentId: "d1",
  designationId: "g1",
  passport: {
    number: "A1234567",
    nationality: "South African",
    issueDate: "2022-01-10",
    expiryDate: "2032-01-09",
  },
  active: true,
};

describe("employeeInputSchema", () => {
  it("accepts a valid employee", () => {
    expect(employeeInputSchema.safeParse(validEmployee).success).toBe(true);
  });
  it("allows an empty email but rejects a malformed one", () => {
    expect(employeeInputSchema.safeParse({ ...validEmployee, email: "" }).success).toBe(true);
    expect(employeeInputSchema.safeParse({ ...validEmployee, email: "nope" }).success).toBe(false);
  });
  it("rejects passport expiry on or before issue", () => {
    const r = employeeInputSchema.safeParse({
      ...validEmployee,
      passport: { ...validEmployee.passport, expiryDate: "2022-01-10" },
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["passport", "expiryDate"]);
  });
  it("rejects impossible dates", () => {
    const r = employeeInputSchema.safeParse({
      ...validEmployee,
      passport: { ...validEmployee.passport, issueDate: "2022-02-30" },
    });
    expect(r.success).toBe(false);
  });
  it("builds lower-case search text", () => {
    expect(buildSearchText(validEmployee)).toBe("thabo mokoena thabo@example.com");
  });
});

describe("authorisationInputSchema", () => {
  const base = {
    type: "WORK_PERMIT" as const,
    referenceNumber: "WP-001",
    issuedDate: "2026-01-01",
    expiryDate: "2027-12-31",
    notes: "",
  };
  it("accepts a valid record", () => {
    expect(authorisationInputSchema.safeParse(base).success).toBe(true);
  });
  it("rejects expiry before issued", () => {
    expect(authorisationInputSchema.safeParse({ ...base, expiryDate: "2025-12-31" }).success).toBe(false);
  });
  it("rejects unknown types", () => {
    expect(authorisationInputSchema.safeParse({ ...base, type: "PASSPORT" }).success).toBe(false);
  });
});

describe("userInputSchema", () => {
  it("requires companies for hr", () => {
    const hr = { email: "a@b.co", displayName: "A", role: "hr", companyIds: [], active: true };
    expect(userInputSchema.safeParse(hr).success).toBe(false);
    expect(userInputSchema.safeParse({ ...hr, companyIds: ["RWD"] }).success).toBe(true);
    expect(userInputSchema.safeParse({ ...hr, role: "admin" }).success).toBe(true);
  });
  it("limits hr access to their companies", () => {
    const all = ["DFS", "RWD", "QA"];
    const hr: AppUser = { id: "u", email: "a@b.co", displayName: "A", role: "hr", companyIds: ["RWD", "X"], active: true };
    expect(accessibleCompanyIds(hr, all)).toEqual(["RWD"]);
    expect(accessibleCompanyIds({ ...hr, role: "admin" }, all)).toEqual(all);
  });
});

describe("companyInputSchema", () => {
  it("upper-cases and validates codes", () => {
    const r = companyInputSchema.safeParse({ name: "RW Design", code: "rwd", active: true });
    expect(r.success && r.data.code).toBe("RWD");
    expect(companyInputSchema.safeParse({ name: "X", code: "r-w", active: true }).success).toBe(false);
  });
});

describe("employeeFormSchema (employee + optional first permit / visa)", () => {
  const off = { enabled: false, referenceNumber: "", issuedDate: "", expiryDate: "", notes: "" };
  const on = { enabled: true, referenceNumber: "WP-1", issuedDate: "2026-01-01", expiryDate: "2027-12-31", notes: "" };

  it("ignores disabled sections", () => {
    expect(employeeFormSchema.safeParse({ ...validEmployee, workPermit: off, visa: off }).success).toBe(true);
  });
  it("validates enabled sections", () => {
    expect(employeeFormSchema.safeParse({ ...validEmployee, workPermit: on, visa: off }).success).toBe(true);
    const r = employeeFormSchema.safeParse({ ...validEmployee, workPermit: { ...on, referenceNumber: "", expiryDate: "2025-01-01" }, visa: off });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("workPermit.referenceNumber");
      expect(paths).toContain("workPermit.expiryDate");
    }
  });
  it("splits employee and enabled records", () => {
    const parsed = employeeFormSchema.parse({ ...validEmployee, workPermit: off, visa: on });
    const { employee, workPermit, visa } = splitEmployeeForm(parsed);
    expect(workPermit).toBeNull();
    expect(visa?.referenceNumber).toBe("WP-1");
    expect("visa" in employee).toBe(false);
  });
});

describe("viewer role", () => {
  it("needs at least one company and is read-only", () => {
    const v = { email: "v@x.co", displayName: "V", role: "viewer", companyIds: [], active: true };
    expect(userInputSchema.safeParse(v).success).toBe(false);
    expect(userInputSchema.safeParse({ ...v, companyIds: ["RWD"] }).success).toBe(true);
    expect(canEditRole("viewer")).toBe(false);
    expect(canEditRole("hr")).toBe(true);
    expect(canEditRole("admin")).toBe(true);
  });
  it("sees only its companies", () => {
    const viewer: AppUser = { id: "v", email: "v@x.co", displayName: "V", role: "viewer", companyIds: ["QA"], active: true };
    expect(accessibleCompanyIds(viewer, ["DFS", "RWD", "QA"])).toEqual(["QA"]);
  });
});

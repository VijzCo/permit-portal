import { compareIsoDates, daysUntil } from "@/lib/dates";
import {
  AUTHORISATION_TYPES,
  computeStatus,
  isActionRequired,
  PASSPORT_WARNING_DAYS,
  STATUSES,
  type AuthorisationType,
  type Status,
  type StatusResult,
} from "@/lib/status";
import type { Authorisation, Company, Employee } from "@/lib/schemas";

export type StatusCounts = Record<Status, number>;

export interface TypeStatus extends StatusResult {
  auth: Authorisation | null;
}

export type EmployeeStatuses = Record<AuthorisationType, TypeStatus>;

export interface DashboardFilters {
  companyId: string;
  type: AuthorisationType | "all";
}

export const ALL = "all";

export interface ActionRow {
  authId: string;
  employeeId: string;
  employeeName: string;
  companyName: string;
  companyCode: string;
  departmentName: string;
  designationName: string;
  type: AuthorisationType;
  referenceNumber: string;
  expiryDate: string;
  daysLeft: number;
  status: Status;
}

export interface CompanyBreakdown extends StatusCounts {
  companyId: string;
  companyName: string;
}

export interface PassportRow {
  employeeId: string;
  employeeName: string;
  companyName: string;
  passportNumber: string;
  expiryDate: string;
  daysLeft: number;
}

export interface DashboardData {
  kpis: { type: AuthorisationType; counts: StatusCounts }[];
  actionRows: ActionRow[];
  byCompany: CompanyBreakdown[];
  passports: PassportRow[];
}

export function emptyCounts(): StatusCounts {
  return Object.fromEntries(STATUSES.map((s) => [s, 0])) as StatusCounts;
}

/** Current record per employee per type (records of unknown employees are ignored). */
export function indexCurrent(auths: readonly Authorisation[]): Map<string, Partial<Record<AuthorisationType, Authorisation>>> {
  const map = new Map<string, Partial<Record<AuthorisationType, Authorisation>>>();
  for (const a of auths) {
    if (!a.isCurrent) continue;
    const entry = map.get(a.employeeId) ?? {};
    const existing = entry[a.type];
    // Defensive: if two are flagged current, keep the later expiry.
    if (!existing || compareIsoDates(a.expiryDate, existing.expiryDate) > 0) entry[a.type] = a;
    map.set(a.employeeId, entry);
  }
  return map;
}

/** Work permit + visa status of every employee, keyed by employee id. */
export function employeeStatuses(
  employees: readonly Employee[],
  auths: readonly Authorisation[],
  now: Date,
): Map<string, EmployeeStatuses> {
  const current = indexCurrent(auths);
  const result = new Map<string, EmployeeStatuses>();
  for (const e of employees) {
    const entry = current.get(e.id) ?? {};
    const statuses = {} as EmployeeStatuses;
    for (const type of AUTHORISATION_TYPES) {
      const auth = entry[type] ?? null;
      statuses[type] = { ...computeStatus(auth?.expiryDate, now), auth };
    }
    result.set(e.id, statuses);
  }
  return result;
}

export function fullName(e: Pick<Employee, "firstName" | "lastName">): string {
  return `${e.firstName} ${e.lastName}`.trim();
}

/** Number of current records that are EXPIRING or EXPIRED (header badge). */
export function countActionRequired(employees: readonly Employee[], auths: readonly Authorisation[], now: Date): number {
  let n = 0;
  const statuses = employeeStatuses(
    employees.filter((e) => e.active),
    auths,
    now,
  );
  statuses.forEach((s) => {
    for (const type of AUTHORISATION_TYPES) if (isActionRequired(s[type].status)) n += 1;
  });
  return n;
}

export function buildDashboard(params: {
  employees: readonly Employee[];
  auths: readonly Authorisation[];
  companies: readonly Company[];
  filters: DashboardFilters;
  now: Date;
}): DashboardData {
  const { filters, now } = params;
  const types = filters.type === ALL ? [...AUTHORISATION_TYPES] : [filters.type];
  const companies = params.companies.filter((c) => filters.companyId === ALL || c.id === filters.companyId);
  const companyIds = new Set(companies.map((c) => c.id));
  const companyName = new Map(params.companies.map((c) => [c.id, c.name]));
  const companyCode = new Map(params.companies.map((c) => [c.id, c.code]));
  const employees = params.employees.filter((e) => e.active && companyIds.has(e.companyId));
  const statuses = employeeStatuses(employees, params.auths, now);

  const kpis = types.map((type) => ({ type, counts: emptyCounts() }));
  const byCompanyMap = new Map<string, CompanyBreakdown>(
    companies.map((c) => [c.id, { companyId: c.id, companyName: c.name, ...emptyCounts() }]),
  );
  const actionRows: ActionRow[] = [];

  for (const e of employees) {
    const s = statuses.get(e.id);
    if (!s) continue;
    for (const kpi of kpis) {
      const ts = s[kpi.type];
      kpi.counts[ts.status] += 1;
      const bucket = byCompanyMap.get(e.companyId);
      if (bucket) bucket[ts.status] += 1;
      if (ts.auth && ts.daysLeft !== null && isActionRequired(ts.status)) {
        actionRows.push({
          authId: ts.auth.id,
          employeeId: e.id,
          employeeName: fullName(e),
          companyName: companyName.get(e.companyId) ?? e.companyName,
          companyCode: companyCode.get(e.companyId) ?? e.companyId,
          departmentName: e.departmentName,
          designationName: e.designationName,
          type: kpi.type,
          referenceNumber: ts.auth.referenceNumber,
          expiryDate: ts.auth.expiryDate,
          daysLeft: ts.daysLeft,
          status: ts.status,
        });
      }
    }
  }

  actionRows.sort(
    (a, b) => compareIsoDates(a.expiryDate, b.expiryDate) || a.employeeName.localeCompare(b.employeeName),
  );

  const passports: PassportRow[] = employees
    .filter((e) => e.passport.expiryDate)
    .map((e) => ({
      employeeId: e.id,
      employeeName: fullName(e),
      companyName: companyName.get(e.companyId) ?? e.companyName,
      passportNumber: e.passport.number,
      expiryDate: e.passport.expiryDate,
      daysLeft: daysUntil(e.passport.expiryDate, now),
    }))
    .filter((p) => p.daysLeft <= PASSPORT_WARNING_DAYS)
    .sort((a, b) => compareIsoDates(a.expiryDate, b.expiryDate));

  return { kpis, actionRows, byCompany: [...byCompanyMap.values()], passports };
}

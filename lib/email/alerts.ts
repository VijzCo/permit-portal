import { daysUntil, todayIso } from "@/lib/dates";
import { currentThresholdKey, notificationLogId, type AuthorisationType, type ThresholdKey } from "@/lib/status";
import { renderDigest, type DigestContent, type DigestItem } from "@/lib/email/templates";

/** Plain inputs, loaded by the cron route. Kept free of Firestore types so planning is pure and testable. */
export interface AlertCompany {
  id: string;
  name: string;
  active: boolean;
}

export interface AlertUser {
  email: string;
  role: "admin" | "hr";
  companyIds: string[];
  active: boolean;
}

export interface AlertEmployee {
  id: string;
  firstName: string;
  lastName: string;
  departmentName: string;
  designationName: string;
  companyId: string;
  active: boolean;
}

export interface AlertAuthorisation {
  id: string;
  employeeId: string;
  companyId: string;
  type: AuthorisationType;
  referenceNumber: string;
  expiryDate: string;
  isCurrent: boolean;
}

export interface AlertInput {
  now: Date;
  baseUrl: string;
  companies: AlertCompany[];
  users: AlertUser[];
  employees: AlertEmployee[];
  authorisations: AlertAuthorisation[];
  /** notificationLog ids that already exist */
  sentLogIds: ReadonlySet<string>;
}

export interface PlannedLog {
  id: string;
  authId: string;
  threshold: ThresholdKey;
}

export interface PlannedDigest {
  companyId: string;
  companyName: string;
  to: string[];
  bcc: string[];
  items: DigestItem[];
  content: DigestContent;
  logs: PlannedLog[];
}

export interface SkippedCompany {
  companyId: string;
  companyName: string;
  reason: string;
  itemCount: number;
}

export interface AlertPlan {
  today: string;
  digests: PlannedDigest[];
  skipped: SkippedCompany[];
}

/** notificationLog ids to look up: the current threshold key of every current record. */
export function candidateLogIds(auths: readonly AlertAuthorisation[], now: Date): string[] {
  const today = todayIso(now);
  const ids: string[] = [];
  for (const a of auths) {
    if (!a.isCurrent) continue;
    const key = currentThresholdKey(daysUntil(a.expiryDate, now), today);
    if (key) ids.push(notificationLogId(a.id, key));
  }
  return ids;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean))].sort();
}

export function recipientsFor(companyId: string, users: readonly AlertUser[]): { to: string[]; bcc: string[] } {
  const hr = unique(users.filter((u) => u.active && u.role === "hr" && u.companyIds.includes(companyId)).map((u) => u.email));
  const admins = unique(users.filter((u) => u.active && u.role === "admin").map((u) => u.email)).filter(
    (e) => !hr.includes(e),
  );
  // No HR user for the company: admins become the direct recipients.
  if (hr.length === 0) return { to: admins, bcc: [] };
  return { to: hr, bcc: admins };
}

/**
 * Decides which alerts are due today and builds one digest per company.
 * An item is due when its current threshold (30/14/7/0/weekly overdue) has
 * no notificationLog entry yet — so reruns and missed days never duplicate.
 */
export function planDigests(input: AlertInput): AlertPlan {
  const today = todayIso(input.now);
  const employees = new Map(input.employees.map((e) => [e.id, e]));
  const itemsByCompany = new Map<string, { item: DigestItem; log: PlannedLog }[]>();

  for (const a of input.authorisations) {
    if (!a.isCurrent) continue;
    const employee = employees.get(a.employeeId);
    if (!employee || !employee.active) continue;
    const daysLeft = daysUntil(a.expiryDate, input.now);
    const key = currentThresholdKey(daysLeft, today);
    if (!key) continue;
    const logId = notificationLogId(a.id, key);
    if (input.sentLogIds.has(logId)) continue;

    const entry = {
      item: {
        authId: a.id,
        employeeId: a.employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        departmentName: employee.departmentName,
        designationName: employee.designationName,
        type: a.type,
        referenceNumber: a.referenceNumber,
        expiryDate: a.expiryDate,
        daysLeft,
        threshold: key,
      },
      log: { id: logId, authId: a.id, threshold: key },
    };
    const list = itemsByCompany.get(a.companyId) ?? [];
    list.push(entry);
    itemsByCompany.set(a.companyId, list);
  }

  const digests: PlannedDigest[] = [];
  const skipped: SkippedCompany[] = [];
  const companies = [...input.companies].sort((x, y) => x.name.localeCompare(y.name));

  for (const company of companies) {
    const entries = itemsByCompany.get(company.id);
    if (!entries || entries.length === 0) continue;
    if (!company.active) {
      skipped.push({ companyId: company.id, companyName: company.name, reason: "Company is inactive", itemCount: entries.length });
      continue;
    }
    const { to, bcc } = recipientsFor(company.id, input.users);
    if (to.length === 0) {
      skipped.push({ companyId: company.id, companyName: company.name, reason: "No active HR or admin recipients", itemCount: entries.length });
      continue;
    }
    const items = entries.map((e) => e.item);
    digests.push({
      companyId: company.id,
      companyName: company.name,
      to,
      bcc,
      items,
      content: renderDigest({ companyName: company.name, today, baseUrl: input.baseUrl, items }),
      logs: entries.map((e) => e.log),
    });
  }

  return { today, digests, skipped };
}

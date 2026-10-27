import "server-only";

import { adminDb, adminNow } from "@/lib/firebase/admin";
import type {
  AlertAuthorisation,
  AlertCompany,
  AlertEmployee,
  AlertUser,
  PlannedDigest,
} from "@/lib/email/alerts";

type Data = Record<string, unknown>;

const s = (d: Data, k: string): string => (typeof d[k] === "string" ? (d[k] as string) : "");
const b = (d: Data, k: string): boolean => d[k] === true;
const list = (d: Data, k: string): string[] =>
  Array.isArray(d[k]) ? (d[k] as unknown[]).filter((x): x is string => typeof x === "string") : [];

/** Unknown roles are treated as viewer, so they never receive digests. */
function toAlertRole(v: string): AlertUser["role"] {
  return v === "admin" || v === "hr" ? v : "viewer";
}

export interface AlertData {
  companies: AlertCompany[];
  users: AlertUser[];
  employees: AlertEmployee[];
  authorisations: AlertAuthorisation[];
}

/** Everything the planner needs, read with the Admin SDK. */
export async function loadAlertData(): Promise<AlertData> {
  const db = adminDb();
  const [companies, users, employees, auths] = await Promise.all([
    db.collection("companies").get(),
    db.collection("users").get(),
    db.collection("employees").get(),
    db.collection("authorisations").where("isCurrent", "==", true).get(),
  ]);
  return {
    companies: companies.docs.map((doc) => {
      const d = doc.data();
      return { id: doc.id, name: s(d, "name"), active: b(d, "active") };
    }),
    users: users.docs.map((doc) => {
      const d = doc.data();
      return { email: s(d, "email"), role: toAlertRole(s(d, "role")), companyIds: list(d, "companyIds"), active: b(d, "active") };
    }),
    employees: employees.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        firstName: s(d, "firstName"),
        lastName: s(d, "lastName"),
        departmentName: s(d, "departmentName"),
        designationName: s(d, "designationName"),
        companyId: s(d, "companyId"),
        active: b(d, "active"),
      };
    }),
    authorisations: auths.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        employeeId: s(d, "employeeId"),
        companyId: s(d, "companyId"),
        type: s(d, "type") === "VISA" ? "VISA" : "WORK_PERMIT",
        referenceNumber: s(d, "referenceNumber"),
        expiryDate: s(d, "expiryDate"),
        isCurrent: b(d, "isCurrent"),
      };
    }),
  };
}

/** Which of the given notificationLog ids already exist. */
export async function existingLogIds(ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const db = adminDb();
  const found = new Set<string>();
  const CHUNK = 300;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const refs = ids.slice(i, i + CHUNK).map((id) => db.collection("notificationLog").doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap) => {
      if (snap.exists) found.add(snap.id);
    });
  }
  return found;
}

/** Records the digest's alerts as sent (called only after a successful send). */
export async function recordSent(digest: PlannedDigest): Promise<void> {
  const db = adminDb();
  const batch = db.batch();
  const sentAt = adminNow();
  const recipients = [...digest.to, ...digest.bcc];
  for (const log of digest.logs) {
    batch.set(db.collection("notificationLog").doc(log.id), {
      authId: log.authId,
      threshold: log.threshold,
      companyId: digest.companyId,
      sentAt,
      recipients,
    });
  }
  await batch.commit();
}

/** True when the Firebase ID token belongs to an active admin (used for admin dry runs). */
export async function isActiveAdminUid(uid: string): Promise<boolean> {
  const snap = await adminDb().collection("users").doc(uid).get();
  const d = snap.data();
  return Boolean(d && d.role === "admin" && d.active === true);
}

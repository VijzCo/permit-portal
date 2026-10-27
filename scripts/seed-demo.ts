/**
 * Demo data for the LOCAL EMULATOR ONLY (refuses to run against a live project).
 * Wipes the emulator's Firestore + Auth, then loads companies, master data,
 * users and employees whose permits/visas cover every status and alert threshold
 * relative to today (Africa/Maseru).
 *
 *   npm run emulators      (window 1)
 *   npm run seed           (window 2)
 */
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, type WriteBatch } from "firebase-admin/firestore";
import { addDaysIso, todayIso } from "../lib/dates";
import { initScriptAdmin, SEED_COMPANIES, usingEmulator } from "./admin-init";

const PASSWORD = "Demo#12345";
const PROJECT = process.env.GCLOUD_PROJECT ?? "demo-permit-portal";

const DEPARTMENTS = ["Cutting", "Sewing", "Quality", "Administration"] as const;
const DESIGNATIONS = [
  { id: "des-pm", name: "Production Manager" },
  { id: "des-ie", name: "Industrial Engineer" },
  { id: "des-qc", name: "Quality Controller" },
  { id: "des-tech", name: "Technician" },
  { id: "des-merch", name: "Merchandiser" },
] as const;

type CompanyId = (typeof SEED_COMPANIES)[number]["id"];

interface SeedEmployee {
  id: string;
  first: string;
  last: string;
  nationality: string;
  company: CompanyId;
  dept: (typeof DEPARTMENTS)[number];
  designation: (typeof DESIGNATIONS)[number]["id"];
  /** days until expiry from today, null = no record (MISSING) */
  wp: number | null;
  visa: number | null;
  passportDays: number;
  /** add an older superseded work permit */
  history?: boolean;
  active?: boolean;
}

const EMPLOYEES: SeedEmployee[] = [
  { id: "emp-001", first: "Rajesh", last: "Kumar", nationality: "Indian", company: "RWD", dept: "Cutting", designation: "des-pm", wp: 30, visa: 200, passportDays: 900, history: true },
  { id: "emp-002", first: "Li", last: "Wei", nationality: "Chinese", company: "RWD", dept: "Sewing", designation: "des-tech", wp: 10, visa: 14, passportDays: 60 },
  { id: "emp-003", first: "Anjali", last: "Sharma", nationality: "Indian", company: "RWD", dept: "Quality", designation: "des-qc", wp: -5, visa: 400, passportDays: 1200 },
  { id: "emp-004", first: "Chen", last: "Hao", nationality: "Chinese", company: "RWD", dept: "Administration", designation: "des-merch", wp: 400, visa: null, passportDays: 700 },
  { id: "emp-005", first: "Tendai", last: "Moyo", nationality: "Zimbabwean", company: "DFS", dept: "Sewing", designation: "des-ie", wp: 7, visa: 3, passportDays: 85 },
  { id: "emp-006", first: "Nomsa", last: "Dlamini", nationality: "South African", company: "DFS", dept: "Cutting", designation: "des-tech", wp: 0, visa: 45, passportDays: 1500 },
  { id: "emp-007", first: "Sanjay", last: "Patel", nationality: "Indian", company: "DFS", dept: "Quality", designation: "des-qc", wp: -40, visa: -40, passportDays: 300, history: true },
  { id: "emp-008", first: "Wang", last: "Fang", nationality: "Chinese", company: "DFS", dept: "Administration", designation: "des-pm", wp: 600, visa: 600, passportDays: 2000 },
  { id: "emp-009", first: "Farhan", last: "Rahman", nationality: "Bangladeshi", company: "QA", dept: "Sewing", designation: "des-tech", wp: 20, visa: 25, passportDays: 400 },
  { id: "emp-010", first: "Grace", last: "Banda", nationality: "Malawian", company: "QA", dept: "Cutting", designation: "des-ie", wp: null, visa: null, passportDays: 30 },
  { id: "emp-011", first: "Vikram", last: "Singh", nationality: "Indian", company: "QA", dept: "Quality", designation: "des-merch", wp: 90, visa: 1, passportDays: 800 },
  { id: "emp-012", first: "Zhang", last: "Min", nationality: "Chinese", company: "QA", dept: "Administration", designation: "des-pm", wp: -2, visa: 180, passportDays: 1000, active: false },
];

const USERS: { email: string; displayName: string; role: "admin" | "hr" | "viewer"; companyIds: string[]; active: boolean }[] = [
  { email: "admin@demo.local", displayName: "Demo Admin", role: "admin" as const, companyIds: [] as string[], active: true },
  { email: "hr.rwd@demo.local", displayName: "HR RW Design", role: "hr" as const, companyIds: ["RWD"], active: true },
  { email: "hr.dfs@demo.local", displayName: "HR DutyFreeSourcing", role: "hr" as const, companyIds: ["DFS"], active: true },
  { email: "hr.qa@demo.local", displayName: "HR Quantum Apparel", role: "hr" as const, companyIds: ["QA"], active: true },
  { email: "viewer@demo.local", displayName: "Viewer RW Design", role: "viewer" as const, companyIds: ["RWD"], active: true },
  { email: "inactive@demo.local", displayName: "Inactive HR", role: "hr" as const, companyIds: ["RWD"], active: false },
];

function deptId(company: CompanyId, dept: string): string {
  return `${company.toLowerCase()}-${dept.toLowerCase()}`;
}

async function wipeEmulator(): Promise<void> {
  const fsHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const opts = { method: "DELETE", headers: { Authorization: "Bearer owner" } };
  const fsRes = await fetch(
    `http://${fsHost}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    opts,
  );
  const authRes = await fetch(`http://${authHost}/emulator/v1/projects/${PROJECT}/accounts`, opts);
  if (!fsRes.ok || !authRes.ok) {
    throw new Error(`Could not clear emulators (firestore ${fsRes.status}, auth ${authRes.status}). Are they running?`);
  }
}

async function main(): Promise<void> {
  if (!usingEmulator()) {
    throw new Error("seed-demo only runs against the emulator. Use `npm run seed`.");
  }
  const app = initScriptAdmin();
  const auth = getAuth(app);
  const db = getFirestore(app);
  const today = todayIso();
  const stamp = { createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), createdBy: "seed", updatedBy: "seed" };

  await wipeEmulator();
  console.log("Emulator data cleared.");

  // users
  for (const u of USERS) {
    const rec = await auth.createUser({ email: u.email, password: PASSWORD, displayName: u.displayName, emailVerified: true });
    await db.doc(`users/${rec.uid}`).set({ email: u.email, displayName: u.displayName, role: u.role, companyIds: u.companyIds, active: u.active });
  }
  console.log(`Users: ${USERS.length} (password for all: ${PASSWORD})`);

  const batch: WriteBatch = db.batch();

  // master data
  for (const c of SEED_COMPANIES) {
    batch.set(db.doc(`companies/${c.id}`), { name: c.name, code: c.id, active: true, createdAt: FieldValue.serverTimestamp() });
    for (const d of DEPARTMENTS) {
      batch.set(db.doc(`departments/${deptId(c.id, d)}`), { name: d, companyId: c.id, active: true });
    }
  }
  for (const d of DESIGNATIONS) {
    batch.set(db.doc(`designations/${d.id}`), { name: d.name, active: true });
  }

  // employees + authorisations
  let authCount = 0;
  for (const e of EMPLOYEES) {
    const company = SEED_COMPANIES.find((c) => c.id === e.company);
    const designation = DESIGNATIONS.find((d) => d.id === e.designation);
    const email = `${e.first}.${e.last}@example.com`.toLowerCase();
    const passportExpiry = addDaysIso(today, e.passportDays);
    batch.set(db.doc(`employees/${e.id}`), {
      firstName: e.first,
      lastName: e.last,
      email,
      companyId: e.company,
      departmentId: deptId(e.company, e.dept),
      designationId: e.designation,
      companyName: company?.name ?? "",
      departmentName: e.dept,
      designationName: designation?.name ?? "",
      searchText: `${e.first} ${e.last} ${email}`.toLowerCase(),
      passport: {
        number: `P${e.id.replace(/\D/g, "").padStart(7, "0")}`,
        nationality: e.nationality,
        issueDate: addDaysIso(passportExpiry, -3652),
        expiryDate: passportExpiry,
      },
      active: e.active ?? true,
      ...stamp,
    });

    const records: { type: "WORK_PERMIT" | "VISA"; days: number | null; prefix: string }[] = [
      { type: "WORK_PERMIT", days: e.wp, prefix: "WP" },
      { type: "VISA", days: e.visa, prefix: "V" },
    ];
    for (const r of records) {
      if (r.days === null) continue;
      const expiry = addDaysIso(today, r.days);
      const issued = addDaysIso(expiry, -729);
      const currentId = `auth-${e.id}-${r.type === "VISA" ? "visa" : "wp"}`;
      const withHistory = e.history === true && r.type === "WORK_PERMIT";
      batch.set(db.doc(`authorisations/${currentId}`), {
        employeeId: e.id,
        companyId: e.company,
        type: r.type,
        referenceNumber: `${r.prefix}-${e.company}-${e.id.slice(-3)}-B`,
        issuedDate: issued,
        expiryDate: expiry,
        isCurrent: true,
        supersededBy: null,
        notes: "",
        ...stamp,
      });
      authCount += 1;
      if (withHistory) {
        const oldExpiry = addDaysIso(issued, -1);
        batch.set(db.doc(`authorisations/${currentId}-prev`), {
          employeeId: e.id,
          companyId: e.company,
          type: r.type,
          referenceNumber: `${r.prefix}-${e.company}-${e.id.slice(-3)}-A`,
          issuedDate: addDaysIso(oldExpiry, -729),
          expiryDate: oldExpiry,
          isCurrent: false,
          supersededBy: currentId,
          notes: "Original issuance (seed)",
          ...stamp,
        });
        authCount += 1;
      }
    }
  }

  await batch.commit();
  console.log(`Companies: ${SEED_COMPANIES.length}, departments: ${SEED_COMPANIES.length * DEPARTMENTS.length}, designations: ${DESIGNATIONS.length}`);
  console.log(`Employees: ${EMPLOYEES.length}, authorisations: ${authCount} (today ${today}, Africa/Maseru)`);
  console.log("Seed complete. Log in at http://localhost:3000 with admin@demo.local or hr.rwd@demo.local.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

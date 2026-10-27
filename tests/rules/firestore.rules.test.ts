import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * Security rules matrix: role × collection × operation, incl. cross-company denial.
 * Requires the Firestore emulator on 127.0.0.1:8080 (`npm run emulators`).
 */
const PROJECT_ID = "demo-permit-portal-rules";

const UID = {
  admin: "u-admin",
  hrRwd: "u-hr-rwd",
  hrDfs: "u-hr-dfs",
  inactive: "u-inactive",
  viewerRwd: "u-viewer-rwd",
  noProfile: "u-no-profile",
} as const;

let env: RulesTestEnvironment;

function db(ctx: RulesTestContext): Firestore {
  return ctx.firestore() as unknown as Firestore;
}
const as = (uid: string) => db(env.authenticatedContext(uid));
const anon = () => db(env.unauthenticatedContext());

function employeeData(companyId: string, uid: string, overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Test",
    lastName: "Person",
    email: "test@example.com",
    companyId,
    departmentId: `${companyId}-sewing`,
    designationId: "des-tech",
    companyName: companyId,
    departmentName: "Sewing",
    designationName: "Technician",
    searchText: "test person test@example.com",
    passport: { number: "P1", nationality: "Indian", issueDate: "2020-01-01", expiryDate: "2030-01-01" },
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
    updatedBy: uid,
    ...overrides,
  };
}

function authData(employeeId: string, companyId: string, uid: string, overrides: Record<string, unknown> = {}) {
  return {
    employeeId,
    companyId,
    type: "WORK_PERMIT",
    referenceNumber: "WP-1",
    issuedDate: "2026-01-01",
    expiryDate: "2027-12-31",
    isCurrent: true,
    supersededBy: null,
    notes: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
    updatedBy: uid,
    ...overrides,
  };
}

function auditData(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    entity: "employee",
    entityId: "e-rwd",
    action: "update",
    before: { a: 1 },
    after: { a: 2 },
    uid,
    at: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = db(ctx);
    const past = new Date("2026-01-01T00:00:00Z");
    await setDoc(doc(d, "users", UID.admin), { email: "admin@x.co", displayName: "Admin", role: "admin", companyIds: [], active: true });
    await setDoc(doc(d, "users", UID.hrRwd), { email: "rwd@x.co", displayName: "HR RWD", role: "hr", companyIds: ["RWD"], active: true });
    await setDoc(doc(d, "users", UID.hrDfs), { email: "dfs@x.co", displayName: "HR DFS", role: "hr", companyIds: ["DFS"], active: true });
    await setDoc(doc(d, "users", UID.viewerRwd), { email: "view@x.co", displayName: "Viewer RWD", role: "viewer", companyIds: ["RWD"], active: true });
    await setDoc(doc(d, "users", UID.inactive), { email: "off@x.co", displayName: "Off", role: "hr", companyIds: ["RWD"], active: false });
    for (const c of ["RWD", "DFS"]) {
      await setDoc(doc(d, "companies", c), { name: c, code: c, active: true, createdAt: past });
      await setDoc(doc(d, "departments", `${c}-sewing`), { name: "Sewing", companyId: c, active: true });
    }
    await setDoc(doc(d, "designations", "des-tech"), { name: "Technician", active: true });
    await setDoc(doc(d, "employees", "e-rwd"), { ...employeeData("RWD", "seed"), createdAt: past, updatedAt: past });
    await setDoc(doc(d, "employees", "e-dfs"), { ...employeeData("DFS", "seed"), createdAt: past, updatedAt: past });
    await setDoc(doc(d, "authorisations", "a-rwd"), { ...authData("e-rwd", "RWD", "seed"), createdAt: past, updatedAt: past });
    await setDoc(doc(d, "authorisations", "a-dfs"), { ...authData("e-dfs", "DFS", "seed"), createdAt: past, updatedAt: past });
    await setDoc(doc(d, "notificationLog", "a-rwd_30"), { authId: "a-rwd", threshold: "30", companyId: "RWD", sentAt: past, recipients: [] });
    await setDoc(doc(d, "auditLog", "log-1"), { ...auditData(UID.hrRwd), at: past });
  });
});

// ======================================================================== users
describe("users", () => {
  it("anonymous cannot read", async () => {
    await assertFails(getDoc(doc(anon(), "users", UID.admin)));
  });
  it("any signed-in user can read their own profile (incl. inactive)", async () => {
    await assertSucceeds(getDoc(doc(as(UID.hrRwd), "users", UID.hrRwd)));
    await assertSucceeds(getDoc(doc(as(UID.inactive), "users", UID.inactive)));
  });
  it("hr cannot read other users or list", async () => {
    await assertFails(getDoc(doc(as(UID.hrRwd), "users", UID.admin)));
    await assertFails(getDocs(collection(as(UID.hrRwd), "users")));
  });
  it("admin can read and list", async () => {
    await assertSucceeds(getDoc(doc(as(UID.admin), "users", UID.hrRwd)));
    await assertSucceeds(getDocs(collection(as(UID.admin), "users")));
  });
  it("hr cannot create or update users (no self-escalation)", async () => {
    await assertFails(setDoc(doc(as(UID.hrRwd), "users", "new"), { email: "n@x.co", displayName: "N", role: "hr", companyIds: ["RWD"], active: true }));
    await assertFails(updateDoc(doc(as(UID.hrRwd), "users", UID.hrRwd), { role: "admin" }));
    await assertFails(updateDoc(doc(as(UID.hrRwd), "users", UID.hrRwd), { companyIds: ["RWD", "DFS"] }));
  });
  it("admin can create and update valid users", async () => {
    await assertSucceeds(setDoc(doc(as(UID.admin), "users", "new"), { email: "n@x.co", displayName: "N", role: "hr", companyIds: ["RWD"], active: true }));
    await assertSucceeds(updateDoc(doc(as(UID.admin), "users", UID.hrRwd), { companyIds: ["RWD", "DFS"], active: false }));
  });
  it("admin writes are validated", async () => {
    await assertFails(setDoc(doc(as(UID.admin), "users", "new"), { email: "n@x.co", displayName: "N", role: "hr", companyIds: [], active: true }));
    await assertFails(setDoc(doc(as(UID.admin), "users", "new"), { email: "n@x.co", displayName: "N", role: "owner", companyIds: [], active: true }));
    await assertFails(updateDoc(doc(as(UID.admin), "users", UID.hrRwd), { email: "changed@x.co" }));
  });
  it("nobody can delete users", async () => {
    await assertFails(deleteDoc(doc(as(UID.admin), "users", UID.hrRwd)));
  });
  it("inactive admin-like access is impossible: inactive user cannot read others", async () => {
    await assertFails(getDoc(doc(as(UID.inactive), "users", UID.admin)));
  });
});

// ================================================================== master data
describe.each([
  {
    name: "companies",
    id: "RWD",
    create: () => ({ name: "New Co", code: "NEW", active: true, createdAt: serverTimestamp() }),
    newId: "NEW",
    update: { name: "Renamed" },
  },
  {
    name: "departments",
    id: "RWD-sewing",
    create: () => ({ name: "Finishing", companyId: "RWD", active: true }),
    newId: "RWD-finishing",
    update: { name: "Sewing Line" },
  },
  {
    name: "designations",
    id: "des-tech",
    create: () => ({ name: "Supervisor", active: true }),
    newId: "des-sup",
    update: { name: "Senior Technician" },
  },
])("$name", ({ name, id, create, newId, update }) => {
  it("anonymous and inactive users cannot read", async () => {
    await assertFails(getDoc(doc(anon(), name, id)));
    await assertFails(getDoc(doc(as(UID.inactive), name, id)));
    await assertFails(getDoc(doc(as(UID.noProfile), name, id)));
  });
  it("hr can read and list", async () => {
    await assertSucceeds(getDoc(doc(as(UID.hrRwd), name, id)));
    await assertSucceeds(getDocs(collection(as(UID.hrRwd), name)));
  });
  it("hr cannot create, update or delete", async () => {
    await assertFails(setDoc(doc(as(UID.hrRwd), name, newId), create()));
    await assertFails(updateDoc(doc(as(UID.hrRwd), name, id), update));
    await assertFails(deleteDoc(doc(as(UID.hrRwd), name, id)));
  });
  it("admin can create and update, not delete", async () => {
    await assertSucceeds(setDoc(doc(as(UID.admin), name, newId), create()));
    await assertSucceeds(updateDoc(doc(as(UID.admin), name, id), update));
    await assertFails(deleteDoc(doc(as(UID.admin), name, id)));
  });
});

describe("master data validation", () => {
  it("company code cannot change and must be well-formed", async () => {
    await assertFails(updateDoc(doc(as(UID.admin), "companies", "RWD"), { code: "XYZ" }));
    await assertFails(setDoc(doc(as(UID.admin), "companies", "bad"), { name: "Bad", code: "b-d", active: true, createdAt: serverTimestamp() }));
  });
  it("department cannot move to another company", async () => {
    await assertFails(updateDoc(doc(as(UID.admin), "departments", "RWD-sewing"), { companyId: "DFS" }));
  });
  it("department must reference an existing company", async () => {
    await assertFails(setDoc(doc(as(UID.admin), "departments", "x"), { name: "X", companyId: "NOPE", active: true }));
  });
  it("extra fields are rejected", async () => {
    await assertFails(setDoc(doc(as(UID.admin), "designations", "x"), { name: "X", active: true, extra: 1 }));
  });
});

// ==================================================================== employees
describe("employees", () => {
  it("anonymous, inactive and profile-less users are denied", async () => {
    await assertFails(getDoc(doc(anon(), "employees", "e-rwd")));
    await assertFails(getDoc(doc(as(UID.inactive), "employees", "e-rwd")));
    await assertFails(getDoc(doc(as(UID.noProfile), "employees", "e-rwd")));
    await assertFails(setDoc(doc(as(UID.inactive), "employees", "x"), employeeData("RWD", UID.inactive)));
  });
  it("hr reads own-company employees only", async () => {
    await assertSucceeds(getDoc(doc(as(UID.hrRwd), "employees", "e-rwd")));
    await assertFails(getDoc(doc(as(UID.hrRwd), "employees", "e-dfs")));
  });
  it("hr lists only with an own-company filter", async () => {
    const d = as(UID.hrRwd);
    await assertSucceeds(getDocs(query(collection(d, "employees"), where("companyId", "==", "RWD"))));
    await assertFails(getDocs(query(collection(d, "employees"), where("companyId", "==", "DFS"))));
    await assertFails(getDocs(collection(d, "employees")));
  });
  it("admin reads and lists everything", async () => {
    await assertSucceeds(getDoc(doc(as(UID.admin), "employees", "e-dfs")));
    await assertSucceeds(getDocs(collection(as(UID.admin), "employees")));
  });
  it("hr creates only in own companies", async () => {
    await assertSucceeds(setDoc(doc(as(UID.hrRwd), "employees", "new-rwd"), employeeData("RWD", UID.hrRwd)));
    await assertFails(setDoc(doc(as(UID.hrRwd), "employees", "new-dfs"), employeeData("DFS", UID.hrRwd)));
  });
  it("hr updates own-company employees and cannot move them to another company", async () => {
    const d = as(UID.hrRwd);
    await assertSucceeds(updateDoc(doc(d, "employees", "e-rwd"), { firstName: "Changed", updatedAt: serverTimestamp(), updatedBy: UID.hrRwd }));
    await assertFails(updateDoc(doc(d, "employees", "e-rwd"), { companyId: "DFS", updatedAt: serverTimestamp(), updatedBy: UID.hrRwd }));
    await assertFails(updateDoc(doc(d, "employees", "e-dfs"), { firstName: "X", updatedAt: serverTimestamp(), updatedBy: UID.hrRwd }));
  });
  it("admin can move an employee between companies", async () => {
    await assertSucceeds(updateDoc(doc(as(UID.admin), "employees", "e-rwd"), { companyId: "DFS", updatedAt: serverTimestamp(), updatedBy: UID.admin }));
  });
  it("nobody deletes employees", async () => {
    await assertFails(deleteDoc(doc(as(UID.hrRwd), "employees", "e-rwd")));
    await assertFails(deleteDoc(doc(as(UID.admin), "employees", "e-rwd")));
  });
  it("validates dates, types and audit stamps", async () => {
    const d = as(UID.hrRwd);
    await assertFails(setDoc(doc(d, "employees", "x1"), employeeData("RWD", UID.hrRwd, { passport: { number: "P", nationality: "N", issueDate: "2020-1-1", expiryDate: "2030-01-01" } })));
    await assertFails(setDoc(doc(d, "employees", "x2"), employeeData("RWD", UID.hrRwd, { passport: { number: "P", nationality: "N", issueDate: "2030-01-01", expiryDate: "2020-01-01" } })));
    await assertFails(setDoc(doc(d, "employees", "x3"), employeeData("RWD", UID.hrRwd, { active: "yes" })));
    await assertFails(setDoc(doc(d, "employees", "x4"), employeeData("RWD", UID.hrRwd, { createdBy: UID.admin })));
    await assertFails(setDoc(doc(d, "employees", "x5"), employeeData("RWD", UID.hrRwd, { createdAt: new Date("2020-01-01") })));
    await assertFails(updateDoc(doc(d, "employees", "e-rwd"), { firstName: "X", updatedAt: serverTimestamp(), updatedBy: UID.admin }));
  });
});

// =============================================================== authorisations
describe("authorisations", () => {
  it("hr reads own-company records only", async () => {
    const d = as(UID.hrRwd);
    await assertSucceeds(getDoc(doc(d, "authorisations", "a-rwd")));
    await assertFails(getDoc(doc(d, "authorisations", "a-dfs")));
    await assertSucceeds(getDocs(query(collection(d, "authorisations"), where("companyId", "==", "RWD"), where("isCurrent", "==", true))));
    await assertFails(getDocs(query(collection(d, "authorisations"), where("companyId", "==", "DFS"))));
    await assertFails(getDocs(query(collection(d, "authorisations"), where("isCurrent", "==", true))));
  });
  it("anonymous and inactive users are denied", async () => {
    await assertFails(getDoc(doc(anon(), "authorisations", "a-rwd")));
    await assertFails(getDoc(doc(as(UID.inactive), "authorisations", "a-rwd")));
  });
  it("admin reads everything", async () => {
    await assertSucceeds(getDocs(query(collection(as(UID.admin), "authorisations"), where("isCurrent", "==", true))));
  });
  it("hr creates records for own-company employees", async () => {
    await assertSucceeds(setDoc(doc(as(UID.hrRwd), "authorisations", "n1"), authData("e-rwd", "RWD", UID.hrRwd, { type: "VISA" })));
  });
  it("cross-company creates are denied", async () => {
    await assertFails(setDoc(doc(as(UID.hrRwd), "authorisations", "n2"), authData("e-dfs", "DFS", UID.hrRwd)));
    // companyId spoofed to RWD but employee belongs to DFS
    await assertFails(setDoc(doc(as(UID.hrRwd), "authorisations", "n3"), authData("e-dfs", "RWD", UID.hrRwd)));
  });
  it("new records must be current and not superseded", async () => {
    await assertFails(setDoc(doc(as(UID.hrRwd), "authorisations", "n4"), authData("e-rwd", "RWD", UID.hrRwd, { isCurrent: false })));
    await assertFails(setDoc(doc(as(UID.hrRwd), "authorisations", "n5"), authData("e-rwd", "RWD", UID.hrRwd, { supersededBy: "a-rwd" })));
  });
  it("validates dates and types", async () => {
    const d = as(UID.hrRwd);
    await assertFails(setDoc(doc(d, "authorisations", "b1"), authData("e-rwd", "RWD", UID.hrRwd, { expiryDate: "2027-13-01" })));
    await assertFails(setDoc(doc(d, "authorisations", "b2"), authData("e-rwd", "RWD", UID.hrRwd, { expiryDate: "2025-01-01" })));
    await assertFails(setDoc(doc(d, "authorisations", "b3"), authData("e-rwd", "RWD", UID.hrRwd, { type: "PASSPORT" })));
    await assertFails(setDoc(doc(d, "authorisations", "b4"), authData("e-rwd", "RWD", UID.hrRwd, { issuedDate: new Date() })));
  });
  it("renewal in one batch succeeds", async () => {
    const d = as(UID.hrRwd);
    const batch = writeBatch(d);
    batch.set(doc(d, "authorisations", "a-rwd-2"), authData("e-rwd", "RWD", UID.hrRwd, { issuedDate: "2028-01-01", expiryDate: "2029-12-31", referenceNumber: "WP-2" }));
    batch.update(doc(d, "authorisations", "a-rwd"), { isCurrent: false, supersededBy: "a-rwd-2", updatedAt: serverTimestamp(), updatedBy: UID.hrRwd });
    await assertSucceeds(batch.commit());
  });
  it("a record cannot be retired without a valid superseding record", async () => {
    const d = as(UID.hrRwd);
    await assertFails(updateDoc(doc(d, "authorisations", "a-rwd"), { isCurrent: false, updatedAt: serverTimestamp(), updatedBy: UID.hrRwd }));
    await assertFails(updateDoc(doc(d, "authorisations", "a-rwd"), { isCurrent: false, supersededBy: "a-dfs", updatedAt: serverTimestamp(), updatedBy: UID.hrRwd }));
  });
  it("hr can correct own-company records but not change type or employee", async () => {
    const d = as(UID.hrRwd);
    await assertSucceeds(updateDoc(doc(d, "authorisations", "a-rwd"), { referenceNumber: "WP-1A", updatedAt: serverTimestamp(), updatedBy: UID.hrRwd }));
    await assertFails(updateDoc(doc(d, "authorisations", "a-rwd"), { type: "VISA", updatedAt: serverTimestamp(), updatedBy: UID.hrRwd }));
    await assertFails(updateDoc(doc(d, "authorisations", "a-rwd"), { employeeId: "e-dfs", updatedAt: serverTimestamp(), updatedBy: UID.hrRwd }));
    await assertFails(updateDoc(doc(d, "authorisations", "a-dfs"), { referenceNumber: "X", updatedAt: serverTimestamp(), updatedBy: UID.hrRwd }));
  });
  it("hr DFS is denied RWD records (symmetry)", async () => {
    await assertFails(getDoc(doc(as(UID.hrDfs), "authorisations", "a-rwd")));
    await assertFails(getDoc(doc(as(UID.hrDfs), "employees", "e-rwd")));
  });
  it("nobody deletes authorisations", async () => {
    await assertFails(deleteDoc(doc(as(UID.hrRwd), "authorisations", "a-rwd")));
    await assertFails(deleteDoc(doc(as(UID.admin), "authorisations", "a-rwd")));
  });
});

// ============================================================== notificationLog
describe("notificationLog (Admin SDK only)", () => {
  it("no client access for any role", async () => {
    for (const d of [anon(), as(UID.hrRwd), as(UID.admin)]) {
      await assertFails(getDoc(doc(d, "notificationLog", "a-rwd_30")));
      await assertFails(getDocs(collection(d, "notificationLog")));
      await assertFails(setDoc(doc(d, "notificationLog", "a-rwd_14"), { authId: "a-rwd", threshold: "14" }));
      await assertFails(deleteDoc(doc(d, "notificationLog", "a-rwd_30")));
    }
  });
});

// ===================================================================== auditLog
describe("auditLog", () => {
  it("any active user can create an entry for themselves", async () => {
    await assertSucceeds(setDoc(doc(as(UID.hrRwd), "auditLog", "n1"), auditData(UID.hrRwd)));
    await assertSucceeds(setDoc(doc(as(UID.admin), "auditLog", "n2"), auditData(UID.admin, { before: null })));
  });
  it("cannot forge the uid, action or timestamp", async () => {
    await assertFails(setDoc(doc(as(UID.hrRwd), "auditLog", "n3"), auditData(UID.admin)));
    await assertFails(setDoc(doc(as(UID.hrRwd), "auditLog", "n4"), auditData(UID.hrRwd, { action: "delete" })));
    await assertFails(setDoc(doc(as(UID.hrRwd), "auditLog", "n5"), auditData(UID.hrRwd, { at: new Date("2020-01-01") })));
  });
  it("anonymous and inactive users cannot create", async () => {
    await assertFails(setDoc(doc(anon(), "auditLog", "n6"), auditData("anon")));
    await assertFails(setDoc(doc(as(UID.inactive), "auditLog", "n7"), auditData(UID.inactive)));
  });
  it("only admins can read", async () => {
    await assertFails(getDoc(doc(as(UID.hrRwd), "auditLog", "log-1")));
    await assertFails(getDocs(collection(as(UID.hrRwd), "auditLog")));
    await assertSucceeds(getDoc(doc(as(UID.admin), "auditLog", "log-1")));
    await assertSucceeds(getDocs(collection(as(UID.admin), "auditLog")));
  });
  it("entries are immutable", async () => {
    await assertFails(updateDoc(doc(as(UID.admin), "auditLog", "log-1"), { action: "create" }));
    await assertFails(deleteDoc(doc(as(UID.admin), "auditLog", "log-1")));
  });
});

// ======================================================================= viewer
describe("viewer (read-only, company-scoped)", () => {
  it("reads own-company employees and authorisations", async () => {
    const d = as(UID.viewerRwd);
    await assertSucceeds(getDoc(doc(d, "employees", "e-rwd")));
    await assertSucceeds(getDoc(doc(d, "authorisations", "a-rwd")));
    await assertSucceeds(getDocs(query(collection(d, "employees"), where("companyId", "==", "RWD"))));
    await assertSucceeds(getDocs(query(collection(d, "authorisations"), where("companyId", "==", "RWD"), where("isCurrent", "==", true))));
  });
  it("cannot read other companies", async () => {
    const d = as(UID.viewerRwd);
    await assertFails(getDoc(doc(d, "employees", "e-dfs")));
    await assertFails(getDoc(doc(d, "authorisations", "a-dfs")));
    await assertFails(getDocs(query(collection(d, "employees"), where("companyId", "==", "DFS"))));
  });
  it("reads master data and own profile only", async () => {
    const d = as(UID.viewerRwd);
    await assertSucceeds(getDocs(collection(d, "companies")));
    await assertSucceeds(getDocs(collection(d, "departments")));
    await assertSucceeds(getDocs(collection(d, "designations")));
    await assertSucceeds(getDoc(doc(d, "users", UID.viewerRwd)));
    await assertFails(getDoc(doc(d, "users", UID.admin)));
  });
  it("cannot create or update employees", async () => {
    const d = as(UID.viewerRwd);
    await assertFails(setDoc(doc(d, "employees", "v-new"), employeeData("RWD", UID.viewerRwd)));
    await assertFails(updateDoc(doc(d, "employees", "e-rwd"), { firstName: "X", updatedAt: serverTimestamp(), updatedBy: UID.viewerRwd }));
  });
  it("cannot create, update or renew authorisations", async () => {
    const d = as(UID.viewerRwd);
    await assertFails(setDoc(doc(d, "authorisations", "v-a"), authData("e-rwd", "RWD", UID.viewerRwd, { type: "VISA" })));
    await assertFails(updateDoc(doc(d, "authorisations", "a-rwd"), { referenceNumber: "X", updatedAt: serverTimestamp(), updatedBy: UID.viewerRwd }));
    const batch = writeBatch(d);
    batch.set(doc(d, "authorisations", "a-rwd-v2"), authData("e-rwd", "RWD", UID.viewerRwd, { issuedDate: "2028-01-01", expiryDate: "2029-12-31" }));
    batch.update(doc(d, "authorisations", "a-rwd"), { isCurrent: false, supersededBy: "a-rwd-v2", updatedAt: serverTimestamp(), updatedBy: UID.viewerRwd });
    await assertFails(batch.commit());
  });
  it("cannot write master data, users or the audit log, nor read the audit log", async () => {
    const d = as(UID.viewerRwd);
    await assertFails(setDoc(doc(d, "designations", "v-d"), { name: "X", active: true }));
    await assertFails(updateDoc(doc(d, "users", UID.viewerRwd), { role: "hr" }));
    await assertFails(setDoc(doc(d, "auditLog", "v-log"), auditData(UID.viewerRwd)));
    await assertFails(getDoc(doc(d, "auditLog", "log-1")));
  });
  it("admin can create a viewer, who needs at least one company", async () => {
    const d = as(UID.admin);
    await assertSucceeds(setDoc(doc(d, "users", "new-viewer"), { email: "nv@x.co", displayName: "NV", role: "viewer", companyIds: ["DFS"], active: true }));
    await assertFails(setDoc(doc(d, "users", "bad-viewer"), { email: "bv@x.co", displayName: "BV", role: "viewer", companyIds: [], active: true }));
  });
});

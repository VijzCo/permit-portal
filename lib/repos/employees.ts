import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import {
  appendAudit,
  bool,
  COLLECTIONS,
  str,
  subscribeMerged,
  tsToIso,
  type ErrorHandler,
} from "@/lib/repos/shared";
import { buildSearchText, type Employee, type EmployeeInput } from "@/lib/schemas";
import type { AuthorisationType } from "@/lib/status";

export interface EmployeeNames {
  companyName: string;
  departmentName: string;
  designationName: string;
}

export function mapEmployee(id: string, data: DocumentData): Employee {
  const passport: DocumentData =
    typeof data.passport === "object" && data.passport !== null ? (data.passport as DocumentData) : {};
  return {
    id,
    firstName: str(data, "firstName"),
    lastName: str(data, "lastName"),
    email: str(data, "email"),
    companyId: str(data, "companyId"),
    departmentId: str(data, "departmentId"),
    designationId: str(data, "designationId"),
    companyName: str(data, "companyName"),
    departmentName: str(data, "departmentName"),
    designationName: str(data, "designationName"),
    searchText: str(data, "searchText"),
    passport: {
      number: str(passport, "number"),
      nationality: str(passport, "nationality"),
      issueDate: str(passport, "issueDate"),
      expiryDate: str(passport, "expiryDate"),
    },
    active: bool(data, "active"),
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    createdBy: str(data, "createdBy"),
    updatedBy: str(data, "updatedBy"),
  };
}

/** Live list of employees for the given companies (one query per company, as the rules require). */
export function subscribeEmployees(
  companyIds: readonly string[],
  onData: (items: Employee[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  const col = collection(getDb(), COLLECTIONS.employees);
  const queries = companyIds.map((cid) => query(col, where("companyId", "==", cid)));
  return subscribeMerged(queries, mapEmployee, onData, onError);
}

export function subscribeEmployee(
  id: string,
  onData: (item: Employee | null) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), COLLECTIONS.employees, id),
    (snap) => onData(snap.exists() ? mapEmployee(snap.id, snap.data()) : null),
    onError,
  );
}

function employeeFields(input: EmployeeInput, names: EmployeeNames) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    companyId: input.companyId,
    departmentId: input.departmentId,
    designationId: input.designationId,
    companyName: names.companyName,
    departmentName: names.departmentName,
    designationName: names.designationName,
    searchText: buildSearchText(input),
    passport: { ...input.passport },
    active: input.active,
  };
}

function auditView(e: Employee) {
  const { createdAt: _c, updatedAt: _u, createdBy: _cb, updatedBy: _ub, searchText: _s, id: _id, ...rest } = e;
  return rest;
}

export interface InitialAuthorisationInput {
  type: AuthorisationType;
  referenceNumber: string;
  issuedDate: string;
  expiryDate: string;
  notes: string;
}

/**
 * Creates the employee and, optionally, their first work permit and/or visa
 * in ONE batch (with an audit entry for each document).
 */
export async function createEmployee(
  input: EmployeeInput,
  names: EmployeeNames,
  uid: string,
  initial: InitialAuthorisationInput[] = [],
): Promise<string> {
  const db = getDb();
  const ref = doc(collection(db, COLLECTIONS.employees));
  const fields = employeeFields(input, names);
  const batch = writeBatch(db);
  batch.set(ref, {
    ...fields,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
    updatedBy: uid,
  });
  appendAudit(batch, { entity: "employee", entityId: ref.id, action: "create", before: null, after: fields }, uid);

  for (const a of initial) {
    const authRef = doc(collection(db, COLLECTIONS.authorisations));
    const authFields = {
      employeeId: ref.id,
      companyId: input.companyId,
      type: a.type,
      referenceNumber: a.referenceNumber,
      issuedDate: a.issuedDate,
      expiryDate: a.expiryDate,
      notes: a.notes,
      isCurrent: true,
      supersededBy: null,
    };
    batch.set(authRef, {
      ...authFields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: uid,
      updatedBy: uid,
    });
    appendAudit(batch, { entity: "authorisation", entityId: authRef.id, action: "create", before: null, after: authFields }, uid);
  }

  await batch.commit();
  return ref.id;
}

/** Authorisation updates per batch when an employee changes company (rules access-call limit). */
const MOVE_CHUNK = 8;

/**
 * Updates an employee. If the company changes, the denormalised companyId on
 * all of the employee's authorisations follows: the employee (+ audit) is
 * committed first, then the authorisations in small batches — the rules
 * require each authorisation's companyId to match the employee's.
 */
export async function updateEmployee(
  before: Employee,
  input: EmployeeInput,
  names: EmployeeNames,
  uid: string,
): Promise<void> {
  const db = getDb();
  const fields = employeeFields(input, names);
  const moving = before.companyId !== input.companyId;

  const authRefs = moving
    ? (
        await getDocs(
          query(
            collection(db, COLLECTIONS.authorisations),
            where("companyId", "==", before.companyId),
            where("employeeId", "==", before.id),
          ),
        )
      ).docs.map((d) => d.ref)
    : [];

  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.employees, before.id), {
    ...fields,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  const action = before.active && !input.active ? "deactivate" : "update";
  appendAudit(batch, { entity: "employee", entityId: before.id, action, before: auditView(before), after: fields }, uid);
  await batch.commit();

  for (let i = 0; i < authRefs.length; i += MOVE_CHUNK) {
    const chunk = writeBatch(db);
    authRefs.slice(i, i + MOVE_CHUNK).forEach((ref) => {
      chunk.update(ref, { companyId: input.companyId, updatedAt: serverTimestamp(), updatedBy: uid });
    });
    await chunk.commit();
  }
}

export async function setEmployeeActive(before: Employee, active: boolean, uid: string): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.employees, before.id), {
    active,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  appendAudit(
    batch,
    {
      entity: "employee",
      entityId: before.id,
      action: active ? "update" : "deactivate",
      before: { active: before.active },
      after: { active },
    },
    uid,
  );
  await batch.commit();
}

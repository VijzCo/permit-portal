import {
  collection,
  doc,
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
  nullableStr,
  str,
  subscribeMerged,
  tsToIso,
  type ErrorHandler,
} from "@/lib/repos/shared";
import type { Authorisation, AuthorisationInput, Employee } from "@/lib/schemas";
import type { AuthorisationType } from "@/lib/status";

function mapType(v: string): AuthorisationType {
  return v === "VISA" ? "VISA" : "WORK_PERMIT";
}

export function mapAuthorisation(id: string, data: DocumentData): Authorisation {
  return {
    id,
    employeeId: str(data, "employeeId"),
    companyId: str(data, "companyId"),
    type: mapType(str(data, "type")),
    referenceNumber: str(data, "referenceNumber"),
    issuedDate: str(data, "issuedDate"),
    expiryDate: str(data, "expiryDate"),
    isCurrent: bool(data, "isCurrent"),
    supersededBy: nullableStr(data, "supersededBy"),
    notes: str(data, "notes"),
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    createdBy: str(data, "createdBy"),
    updatedBy: str(data, "updatedBy"),
  };
}

/** Live current records for the given companies (dashboard + list statuses). */
export function subscribeCurrentAuthorisations(
  companyIds: readonly string[],
  onData: (items: Authorisation[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  const col = collection(getDb(), COLLECTIONS.authorisations);
  const queries = companyIds.map((cid) =>
    query(col, where("companyId", "==", cid), where("isCurrent", "==", true)),
  );
  return subscribeMerged(queries, mapAuthorisation, onData, onError);
}

/** Live full history for one employee (current and superseded). */
export function subscribeEmployeeAuthorisations(
  employee: Pick<Employee, "id" | "companyId">,
  onData: (items: Authorisation[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  const q = query(
    collection(getDb(), COLLECTIONS.authorisations),
    where("companyId", "==", employee.companyId),
    where("employeeId", "==", employee.id),
  );
  return subscribeMerged([q], mapAuthorisation, onData, onError);
}

function inputFields(input: AuthorisationInput) {
  return {
    type: input.type,
    referenceNumber: input.referenceNumber,
    issuedDate: input.issuedDate,
    expiryDate: input.expiryDate,
    notes: input.notes,
  };
}

function auditView(a: Authorisation) {
  const { createdAt: _c, updatedAt: _u, createdBy: _cb, updatedBy: _ub, id: _id, ...rest } = a;
  return rest;
}

/** First record of a type for an employee (use renew when one exists). */
export async function addAuthorisation(
  employee: Pick<Employee, "id" | "companyId">,
  input: AuthorisationInput,
  uid: string,
): Promise<string> {
  const db = getDb();
  const ref = doc(collection(db, COLLECTIONS.authorisations));
  const fields = {
    employeeId: employee.id,
    companyId: employee.companyId,
    ...inputFields(input),
    isCurrent: true,
    supersededBy: null,
  };
  const batch = writeBatch(db);
  batch.set(ref, {
    ...fields,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
    updatedBy: uid,
  });
  appendAudit(batch, { entity: "authorisation", entityId: ref.id, action: "create", before: null, after: fields }, uid);
  await batch.commit();
  return ref.id;
}

/** Corrects an existing record (type cannot change). */
export async function updateAuthorisation(
  before: Authorisation,
  input: AuthorisationInput,
  uid: string,
): Promise<void> {
  const db = getDb();
  const fields = { ...inputFields(input), type: before.type };
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.authorisations, before.id), {
    ...fields,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  appendAudit(
    batch,
    { entity: "authorisation", entityId: before.id, action: "update", before: auditView(before), after: fields },
    uid,
  );
  await batch.commit();
}

/**
 * Renewal: one batched write creates the new current record and marks the
 * old one `isCurrent: false, supersededBy: newId`. Nothing is deleted.
 */
export async function renewAuthorisation(
  previous: Authorisation,
  input: AuthorisationInput,
  uid: string,
): Promise<string> {
  if (!previous.isCurrent) {
    throw new Error("Only the current record can be renewed.");
  }
  const db = getDb();
  const newRef = doc(collection(db, COLLECTIONS.authorisations));
  const fields = {
    employeeId: previous.employeeId,
    companyId: previous.companyId,
    ...inputFields({ ...input, type: previous.type }),
    isCurrent: true,
    supersededBy: null,
  };
  const batch = writeBatch(db);
  batch.set(newRef, {
    ...fields,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
    updatedBy: uid,
  });
  batch.update(doc(db, COLLECTIONS.authorisations, previous.id), {
    isCurrent: false,
    supersededBy: newRef.id,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  appendAudit(
    batch,
    {
      entity: "authorisation",
      entityId: newRef.id,
      action: "renew",
      before: auditView(previous),
      after: { ...fields, renewedFrom: previous.id },
    },
    uid,
  );
  await batch.commit();
  return newRef.id;
}

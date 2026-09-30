import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { appendAudit, bool, COLLECTIONS, str, type ErrorHandler } from "@/lib/repos/shared";
import type { Department, DepartmentInput } from "@/lib/schemas";

export function mapDepartment(id: string, data: DocumentData): Department {
  return { id, name: str(data, "name"), companyId: str(data, "companyId"), active: bool(data, "active") };
}

export function subscribeDepartments(onData: (items: Department[]) => void, onError: ErrorHandler): Unsubscribe {
  const q = query(collection(getDb(), COLLECTIONS.departments), orderBy("name"));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => mapDepartment(d.id, d.data()))), onError);
}

export async function createDepartment(input: DepartmentInput, uid: string): Promise<string> {
  const db = getDb();
  const ref = doc(collection(db, COLLECTIONS.departments));
  const batch = writeBatch(db);
  batch.set(ref, { ...input });
  appendAudit(batch, { entity: "department", entityId: ref.id, action: "create", before: null, after: input }, uid);
  await batch.commit();
  return ref.id;
}

export async function updateDepartment(before: Department, input: DepartmentInput, uid: string): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(doc(db, COLLECTIONS.departments, before.id), { ...input });
  const { id: _id, ...prev } = before;
  appendAudit(batch, { entity: "department", entityId: before.id, action: "update", before: prev, after: input }, uid);
  await batch.commit();
}

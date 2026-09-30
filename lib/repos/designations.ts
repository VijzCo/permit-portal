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
import type { Designation, DesignationInput } from "@/lib/schemas";

export function mapDesignation(id: string, data: DocumentData): Designation {
  return { id, name: str(data, "name"), active: bool(data, "active") };
}

export function subscribeDesignations(onData: (items: Designation[]) => void, onError: ErrorHandler): Unsubscribe {
  const q = query(collection(getDb(), COLLECTIONS.designations), orderBy("name"));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => mapDesignation(d.id, d.data()))), onError);
}

export async function createDesignation(input: DesignationInput, uid: string): Promise<string> {
  const db = getDb();
  const ref = doc(collection(db, COLLECTIONS.designations));
  const batch = writeBatch(db);
  batch.set(ref, { ...input });
  appendAudit(batch, { entity: "designation", entityId: ref.id, action: "create", before: null, after: input }, uid);
  await batch.commit();
  return ref.id;
}

export async function updateDesignation(before: Designation, input: DesignationInput, uid: string): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(doc(db, COLLECTIONS.designations, before.id), { ...input });
  const { id: _id, ...prev } = before;
  appendAudit(batch, { entity: "designation", entityId: before.id, action: "update", before: prev, after: input }, uid);
  await batch.commit();
}

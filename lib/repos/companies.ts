import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { appendAudit, bool, COLLECTIONS, str, tsToIso, type ErrorHandler } from "@/lib/repos/shared";
import type { Company, CompanyInput } from "@/lib/schemas";

export function mapCompany(id: string, data: DocumentData): Company {
  return {
    id,
    name: str(data, "name"),
    code: str(data, "code"),
    active: bool(data, "active"),
    createdAt: tsToIso(data.createdAt),
  };
}

export function subscribeCompanies(onData: (items: Company[]) => void, onError: ErrorHandler): Unsubscribe {
  const q = query(collection(getDb(), COLLECTIONS.companies), orderBy("name"));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => mapCompany(d.id, d.data()))), onError);
}

/** The company code is also its document id (e.g. `RWD`) and cannot change. */
export async function createCompany(input: CompanyInput, uid: string): Promise<string> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.companies, input.code);
  if ((await getDoc(ref)).exists()) {
    throw new Error(`A company with code ${input.code} already exists.`);
  }
  const batch = writeBatch(db);
  batch.set(ref, { name: input.name, code: input.code, active: input.active, createdAt: serverTimestamp() });
  appendAudit(batch, { entity: "company", entityId: ref.id, action: "create", before: null, after: input }, uid);
  await batch.commit();
  return ref.id;
}

export async function updateCompany(before: Company, input: CompanyInput, uid: string): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  const next: CompanyInput = { name: input.name, code: before.code, active: input.active };
  batch.update(doc(db, COLLECTIONS.companies, before.id), { name: next.name, active: next.active });
  appendAudit(
    batch,
    {
      entity: "company",
      entityId: before.id,
      action: "update",
      before: { name: before.name, code: before.code, active: before.active },
      after: next,
    },
    uid,
  );
  await batch.commit();
}

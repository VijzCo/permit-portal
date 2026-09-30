import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
  type FirestoreError,
  type Query,
  type Unsubscribe,
  type WriteBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { AuditAction, AuditEntity, AuditSnapshot } from "@/lib/schemas";

export const COLLECTIONS = {
  companies: "companies",
  departments: "departments",
  designations: "designations",
  users: "users",
  employees: "employees",
  authorisations: "authorisations",
  auditLog: "auditLog",
} as const;

export type ErrorHandler = (error: FirestoreError) => void;

// ------------------------------------------------------------ safe readers
export function str(data: DocumentData, key: string): string {
  const v: unknown = data[key];
  return typeof v === "string" ? v : "";
}

export function bool(data: DocumentData, key: string): boolean {
  return data[key] === true;
}

export function strArray(data: DocumentData, key: string): string[] {
  const v: unknown = data[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function nullableStr(data: DocumentData, key: string): string | null {
  const v: unknown = data[key];
  return typeof v === "string" ? v : null;
}

interface HasToDate {
  toDate: () => Date;
}

function hasToDate(v: unknown): v is HasToDate {
  return typeof v === "object" && v !== null && typeof (v as HasToDate).toDate === "function";
}

/** Firestore Timestamp → ISO datetime; null while a server timestamp is pending. */
export function tsToIso(v: unknown): string | null {
  return hasToDate(v) ? v.toDate().toISOString() : null;
}

// ------------------------------------------------------------ audit log
/** JSON-safe copy (drops undefined, which Firestore rejects). */
export function toSnapshot(value: object | null): AuditSnapshot {
  if (value === null) return null;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export function appendAudit(
  batch: WriteBatch,
  entry: {
    entity: AuditEntity;
    entityId: string;
    action: AuditAction;
    before: object | null;
    after: object | null;
  },
  uid: string,
): void {
  const ref = doc(collection(getDb(), COLLECTIONS.auditLog));
  batch.set(ref, {
    entity: entry.entity,
    entityId: entry.entityId,
    action: entry.action,
    before: toSnapshot(entry.before),
    after: toSnapshot(entry.after),
    uid,
    at: serverTimestamp(),
  });
}

// ------------------------------------------------------- live queries
/**
 * Subscribes to several queries (e.g. one per company, which is what the
 * security rules can verify) and emits the merged result once every query
 * has delivered its first snapshot.
 */
export function subscribeMerged<T>(
  queries: Query[],
  map: (id: string, data: DocumentData) => T,
  onData: (items: T[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  if (queries.length === 0) {
    onData([]);
    return () => undefined;
  }
  const results: (T[] | undefined)[] = queries.map(() => undefined);
  const unsubs = queries.map((q, index) =>
    onSnapshot(
      q,
      (snap) => {
        results[index] = snap.docs.map((d) => map(d.id, d.data()));
        if (results.every((r) => r !== undefined)) {
          onData(results.flatMap((r) => r ?? []));
        }
      },
      onError,
    ),
  );
  return () => unsubs.forEach((u) => u());
}

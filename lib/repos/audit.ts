import {
  collection,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { COLLECTIONS, str, tsToIso, type ErrorHandler } from "@/lib/repos/shared";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  type AuditAction,
  type AuditEntity,
  type AuditLogEntry,
  type AuditSnapshot,
} from "@/lib/schemas";

function asEntity(v: string): AuditEntity {
  return (AUDIT_ENTITIES as readonly string[]).includes(v) ? (v as AuditEntity) : "employee";
}

function asAction(v: string): AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(v) ? (v as AuditAction) : "update";
}

function asSnapshot(v: unknown): AuditSnapshot {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function mapAudit(id: string, data: DocumentData): AuditLogEntry {
  return {
    id,
    entity: asEntity(str(data, "entity")),
    entityId: str(data, "entityId"),
    action: asAction(str(data, "action")),
    before: asSnapshot(data.before),
    after: asSnapshot(data.after),
    uid: str(data, "uid"),
    at: tsToIso(data.at),
  };
}

/** Admin only. Newest first. */
export function subscribeAuditLog(
  options: { entity: AuditEntity | "all"; limit: number },
  onData: (items: AuditLogEntry[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  const col = collection(getDb(), COLLECTIONS.auditLog);
  const q =
    options.entity === "all"
      ? query(col, orderBy("at", "desc"), limitTo(options.limit))
      : query(col, where("entity", "==", options.entity), orderBy("at", "desc"), limitTo(options.limit));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => mapAudit(d.id, d.data()))), onError);
}

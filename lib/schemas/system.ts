import type { ThresholdKey } from "@/lib/status";

/** `notificationLog/{authId}_{threshold}` — written only by the cron route (Admin SDK). */
export interface NotificationLogEntry {
  authId: string;
  threshold: ThresholdKey;
  companyId: string;
  sentAt: string;
  recipients: string[];
}

export const AUDIT_ENTITIES = [
  "company",
  "department",
  "designation",
  "user",
  "employee",
  "authorisation",
] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export const AUDIT_ACTIONS = ["create", "update", "renew", "deactivate"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditSnapshot = Record<string, unknown> | null;

/** `auditLog/{id}` — immutable. */
export interface AuditLogEntry {
  id: string;
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  before: AuditSnapshot;
  after: AuditSnapshot;
  uid: string;
  at: string | null;
}

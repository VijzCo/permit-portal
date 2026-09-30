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
import { sendPasswordResetEmail } from "firebase/auth";
import { createAuthAccount, getDb, getFirebaseAuth } from "@/lib/firebase/client";
import { appendAudit, bool, COLLECTIONS, str, strArray, type ErrorHandler } from "@/lib/repos/shared";
import type { AppUser, Role, UserInput } from "@/lib/schemas";

function mapRole(v: string): Role {
  return v === "admin" ? "admin" : "hr";
}

export function mapUser(id: string, data: DocumentData): AppUser {
  return {
    id,
    email: str(data, "email"),
    displayName: str(data, "displayName"),
    role: mapRole(str(data, "role")),
    companyIds: strArray(data, "companyIds"),
    active: bool(data, "active"),
  };
}

/** Own profile (null when users/{uid} does not exist). */
export function subscribeUserProfile(
  uid: string,
  onData: (user: AppUser | null) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), COLLECTIONS.users, uid),
    (snap) => onData(snap.exists() ? mapUser(snap.id, snap.data()) : null),
    onError,
  );
}

/** Admin only. */
export function subscribeUsers(onData: (items: AppUser[]) => void, onError: ErrorHandler): Unsubscribe {
  const q = query(collection(getDb(), COLLECTIONS.users), orderBy("displayName"));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => mapUser(d.id, d.data()))), onError);
}

function toDoc(input: UserInput): UserInput {
  return {
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    companyIds: input.role === "admin" ? [] : [...input.companyIds],
    active: input.active,
  };
}

/**
 * Invite = create the Auth account with a temporary password (secondary app,
 * so the admin stays signed in), then write users/{uid}.
 */
export async function createUser(input: UserInput, temporaryPassword: string, adminUid: string): Promise<string> {
  const uid = await createAuthAccount(input.email, temporaryPassword);
  const db = getDb();
  const batch = writeBatch(db);
  const data = toDoc(input);
  batch.set(doc(db, COLLECTIONS.users, uid), data);
  appendAudit(batch, { entity: "user", entityId: uid, action: "create", before: null, after: data }, adminUid);
  try {
    await batch.commit();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `The sign-in account was created but the portal profile was not saved (${reason}). Retry with the same email and temporary password.`,
    );
  }
  return uid;
}

export async function updateUser(before: AppUser, input: UserInput, adminUid: string): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  const data = toDoc({ ...input, email: before.email });
  batch.set(doc(db, COLLECTIONS.users, before.id), data);
  const { id: _id, ...prev } = before;
  appendAudit(
    batch,
    {
      entity: "user",
      entityId: before.id,
      action: before.active && !data.active ? "deactivate" : "update",
      before: prev,
      after: data,
    },
    adminUid,
  );
  await batch.commit();
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

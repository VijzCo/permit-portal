import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

/**
 * The ONLY app module allowed to import the Admin SDK (used by the cron route).
 * Credentials: FIREBASE_SERVICE_ACCOUNT_JSON = base64 of the service-account JSON.
 * With FIRESTORE_EMULATOR_HOST set, the emulator is used and no key is needed.
 */
interface ServiceAccountJson {
  project_id: string;
  client_email: string;
  private_key: string;
}

function isServiceAccount(value: unknown): value is ServiceAccountJson {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.project_id === "string" &&
    typeof v.client_email === "string" &&
    typeof v.private_key === "string"
  );
}

function initAdminApp(): App {
  if (getApps().length > 0) return getApp();

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({
      projectId:
        process.env.GCLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-permit-portal",
    });
  }

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!encoded) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set.");
  }
  const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  if (!isServiceAccount(parsed)) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not a valid service-account key.");
  }
  return initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    }),
    projectId: parsed.project_id,
  });
}

export function adminDb(): Firestore {
  return getFirestore(initAdminApp());
}

export function adminAuth(): Auth {
  return getAuth(initAdminApp());
}

export function adminNow(): Timestamp {
  return Timestamp.now();
}

/** Verifies a Firebase ID token (incl. revocation) and returns its uid, or null if invalid. */
export async function verifyIdTokenUid(token: string): Promise<string | null> {
  try {
    const decoded = await adminAuth().verifyIdToken(token, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

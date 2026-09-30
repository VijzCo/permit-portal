import { deleteApp, getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

/**
 * Browser Firebase access. Everything is lazy so that importing this module
 * during a server render or `next build` never initialises Firebase.
 * `process.env.NEXT_PUBLIC_*` must be referenced literally so Next inlines them.
 */
export function firebaseConfig(): FirebaseOptions {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function usingEmulators(): boolean {
  return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
}

const EMULATOR_HOST = "127.0.0.1";
let emulatorsConnected = false;

export function getFirebaseApp(): FirebaseApp {
  if (getApps().some((a) => a.name === "[DEFAULT]")) return getApp();
  const config = firebaseConfig();
  if (!config.apiKey || !config.projectId) {
    throw new Error(
      "Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* variables (see .env.example).",
    );
  }
  return initializeApp(config);
}

function connectEmulatorsOnce(auth: Auth, db: Firestore): void {
  if (emulatorsConnected || !usingEmulators()) return;
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  emulatorsConnected = true;
}

export function getFirebaseAuth(): Auth {
  const app = getFirebaseApp();
  const auth = getAuth(app);
  connectEmulatorsOnce(auth, getFirestore(app));
  return auth;
}

export function getDb(): Firestore {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  connectEmulatorsOnce(getAuth(app), db);
  return db;
}

/**
 * Creates a Firebase Auth account with a temporary password WITHOUT signing
 * the current admin out, by using a short-lived secondary app instance.
 * Returns the new uid. The admin then writes users/{uid}.
 *
 * If the account already exists (e.g. an earlier invite created it but the
 * profile write failed) and the same temporary password is given, the
 * existing uid is returned so the profile can be written on retry.
 */
export async function createAuthAccount(email: string, temporaryPassword: string): Promise<string> {
  const name = `user-admin-${Date.now()}`;
  const secondary = initializeApp(firebaseConfig(), name);
  try {
    const auth = getAuth(secondary);
    if (usingEmulators()) {
      connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
    }
    let uid: string;
    try {
      uid = (await createUserWithEmailAndPassword(auth, email, temporaryPassword)).user.uid;
    } catch (err) {
      const code = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
      if (code !== "auth/email-already-in-use") throw err;
      try {
        uid = (await signInWithEmailAndPassword(auth, email, temporaryPassword)).user.uid;
      } catch {
        throw err;
      }
    }
    await signOut(auth);
    return uid;
  } finally {
    await deleteApp(secondary);
  }
}

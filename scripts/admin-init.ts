import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";

/** Minimal .env.local loader for scripts (does not override variables already set). */
export function loadEnvFile(file = ".env.local"): void {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function usingEmulator(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

/** Admin SDK app for scripts: emulator (no credentials) or service account. */
export function initScriptAdmin(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  if (usingEmulator()) {
    if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new Error("FIRESTORE_EMULATOR_HOST is set but FIREBASE_AUTH_EMULATOR_HOST is not.");
    }
    return initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "demo-permit-portal" });
  }

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!encoded) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON (base64) is not set. Put it in .env.local or set the emulator variables.",
    );
  }
  const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  return initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    }),
    projectId: parsed.project_id,
  });
}

export const SEED_COMPANIES = [
  { id: "DFS", name: "DutyFreeSourcing Inc." },
  { id: "RWD", name: "RW Design" },
  { id: "QA", name: "Quantum Apparel" },
] as const;

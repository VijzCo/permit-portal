/**
 * Bootstraps the first admin (and the three companies if missing).
 * Runs locally only, with the Admin SDK.
 *
 *   Real project: set FIREBASE_SERVICE_ACCOUNT_JSON (base64) in .env.local, then
 *     $env:SEED_ADMIN_EMAIL="you@company.com"; $env:SEED_ADMIN_PASSWORD="TempPass#2026"; npm run seed:admin
 *   Emulator: npm run seed already creates admin@demo.local.
 */
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { initScriptAdmin, loadEnvFile, SEED_COMPANIES, usingEmulator } from "./admin-init";

async function main(): Promise<void> {
  loadEnvFile();
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const displayName = process.env.SEED_ADMIN_NAME?.trim() || "Portal Admin";

  if (!email || !password) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 8 characters).");
  }
  if (password.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters.");
  }

  const app = initScriptAdmin();
  const auth = getAuth(app);
  const db = getFirestore(app);

  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    console.log(`Auth user exists: ${email} (${uid}) — password left unchanged.`);
  } catch {
    const created = await auth.createUser({ email, password, displayName, emailVerified: true });
    uid = created.uid;
    console.log(`Created auth user ${email} (${uid}).`);
  }

  await db.doc(`users/${uid}`).set({ email, displayName, role: "admin", companyIds: [], active: true });
  console.log(`users/${uid} set as active admin.`);

  for (const c of SEED_COMPANIES) {
    const ref = db.doc(`companies/${c.id}`);
    if (!(await ref.get()).exists) {
      await ref.set({ name: c.name, code: c.id, active: true, createdAt: FieldValue.serverTimestamp() });
      console.log(`Created company ${c.id} — ${c.name}.`);
    }
  }

  console.log(`Done (${usingEmulator() ? "emulator" : "live project"}).`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

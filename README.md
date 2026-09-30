# Permit & Visa Portal

Internal portal for **DutyFreeSourcing Inc., RW Design and Quantum Apparel** (Maseru) to track migrant employees' **work permits and visas**. It shows a live dashboard of what is expiring or expired and emails HR one digest per company at 30, 14, 7 and 0 days before expiry, then weekly until the record is renewed.

**Full step-by-step go-live guide: [`docs/GO-LIVE.md`](docs/GO-LIVE.md).**

Light / dark / system theme: toggle at the bottom of the sidebar (and on the sign-in page).

**Stack:** Next.js 15 (App Router) · TypeScript strict · Tailwind v4 + shadcn/ui · Firebase Auth + Firestore · Microsoft Graph mail · Vercel (hosting + cron).

---

## 1. Local setup (Windows 11, PowerShell)

Prerequisites: **Node 20.9+**, **Java 17+** (Temurin is fine; the Firestore emulator needs it), VS Code.

```powershell
cd C:\xampp\htdocs\agentic-projects\permit-portal-chat
npm install
Copy-Item .env.emulator.example .env.local
```

The shadcn components are already in `components/ui`, so there is no `shadcn add` step.

### Checks

```powershell
npm run typecheck
npm run lint
npm test            # unit tests (dates, status, schemas, dashboard, templates, alerts, mail transport)
npm run build
```

## 2. Emulators and demo data

Window 1:
```powershell
npm run emulators          # Auth :9099, Firestore :8080, UI http://127.0.0.1:4000
```

Window 2:
```powershell
npm run test:rules         # security-rules matrix (needs the emulator)
npm run seed               # wipes the EMULATOR and loads demo data
npm run dev                # http://localhost:3000
```

Demo users (password `Demo#12345`):

| Email | Role | Companies |
|---|---|---|
| admin@demo.local | admin | all |
| hr.rwd@demo.local | hr | RW Design |
| hr.dfs@demo.local | hr | DutyFreeSourcing |
| hr.qa@demo.local | hr | Quantum Apparel |
| inactive@demo.local | hr (inactive) | blocked at sign-in |

The seed data covers every status and alert threshold relative to today, a renewal history, a missing visa, passports expiring within 90 days, and one inactive employee.

### Cron dry run on localhost

With `npm run dev` running and `CRON_SECRET=local-dev-secret-change-me` in `.env.local`:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/cron/expiry-alerts?dryRun=1" -Headers @{ Authorization = "Bearer local-dev-secret-change-me" } | ConvertTo-Json -Depth 6
```

You can also go to **Admin → Alerts → Send test digest** as an admin. A dry run sends and writes nothing.

To test a **real** run locally, fill in the `GRAPH_*` variables and `MAIL_FROM` in `.env.local` and call the URL without `?dryRun=1`. A second call sends nothing new because of `notificationLog`.

### End-to-end test (Playwright)

```powershell
npx playwright install chromium   # first time only
npm run seed                       # fresh data (the test renews a record)
npm run test:e2e
```

## 3. Firebase project (production)

1. Go to <https://console.firebase.google.com>, click **Add project** (for example `permit-portal-prod`), and turn Analytics off.
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database**, in production mode. Pick a location close to Lesotho, e.g. `africa-south1` (Johannesburg).
4. **Project settings → Your apps → Web (</>)**: register the app and copy the config values into the `NEXT_PUBLIC_FIREBASE_*` variables.
5. **Authentication → Settings → Authorized domains**: add your Vercel domain (e.g. `permits.yourcompany.com` and `*.vercel.app` if used).

### Deploy rules and indexes

```powershell
npx firebase login
npx firebase use --add            # pick the project, alias "prod"
npx firebase deploy --only firestore:rules,firestore:indexes --project prod
```

Index builds take a few minutes. Queries show "index is still building" until they finish.

### Service account (cron route and seed-admin)

**Project settings → Service accounts → Generate new private key.** Keep the JSON file outside the repo, then base64-encode it:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\secure\permit-portal-sa.json")) | Set-Clipboard
```

Paste the result as `FIREBASE_SERVICE_ACCOUNT_JSON`.

### First admin

Put `FIREBASE_SERVICE_ACCOUNT_JSON` (for the **production** project) in `.env.local`, and remove the emulator lines from it (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`). Then run:

```powershell
$env:SEED_ADMIN_EMAIL="vijan@yourcompany.com"; $env:SEED_ADMIN_PASSWORD="Choose-A-Strong-Temp#1"; $env:SEED_ADMIN_NAME="Vijan"
npm run seed:admin
```

This creates the Auth user and `users/{uid}` with the admin role, and also creates the companies `DFS`, `RWD` and `QA` if they are missing. Sign in, then change the password via **Forgot password?**.

Next, in the portal: **Admin → Departments / Designations** (add master data), **Admin → Users → Invite user** (HR accounts with a temporary password; share it privately and ask them to reset it).

## 4. Microsoft Graph mail (Entra app registration)

1. Go to <https://entra.microsoft.com>, then **App registrations → New registration**. Name: `Permit Portal Mailer`, single tenant, no redirect URI.
2. Copy the **Application (client) ID** into `GRAPH_CLIENT_ID` and the **Directory (tenant) ID** into `GRAPH_TENANT_ID`.
3. **Certificates & secrets → New client secret** (e.g. 24 months). Copy the **Value** into `GRAPH_CLIENT_SECRET` and diarise the expiry date.
4. **API permissions → Add → Microsoft Graph → Application permissions → `Mail.Send`**, then **Grant admin consent**.
5. Create the shared mailbox (e.g. `hr-alerts@yourcompany.com`) in the Exchange admin center and set `MAIL_FROM` to it.
6. **Recommended:** restrict the app to that one mailbox (Exchange Online PowerShell):
   ```powershell
   Connect-ExchangeOnline
   New-DistributionGroup -Name "PermitPortalSenders" -Type Security -Members hr-alerts@yourcompany.com
   New-ApplicationAccessPolicy -AppId <GRAPH_CLIENT_ID> -PolicyScopeGroupId PermitPortalSenders@yourcompany.com -AccessRight RestrictAccess -Description "Permit portal may only send as hr-alerts"
   Test-ApplicationAccessPolicy -Identity hr-alerts@yourcompany.com -AppId <GRAPH_CLIENT_ID>
   ```

SMTP basic auth is **not** used, because Microsoft disables it by default from end of Dec 2026. `MAIL_TRANSPORT=smtp` exists only as a fallback for a non-M365 relay.

## 5. Vercel

1. Push the repo to GitHub, then in Vercel go to **Add New → Project → Import**. The framework is detected as Next.js, and the default build settings work.
2. **Settings → Environment Variables** (Production, and Preview if wanted):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_FIREBASE_*` (6) | from the Firebase web app |
   | `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | `false` |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | base64 service account |
   | `CRON_SECRET` | long random string (`[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")`) |
   | `APP_BASE_URL` | `https://permits.yourcompany.com` |
   | `MAIL_TRANSPORT` | `graph` |
   | `MAIL_FROM` | `hr-alerts@yourcompany.com` |
   | `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` | from Entra |

3. **Redeploy** after changing any variable. `NEXT_PUBLIC_*` values are baked in at build time.
4. **Cron:** `vercel.json` schedules `GET /api/cron/expiry-alerts` at `0 4 * * *` (04:00 UTC = 06:00 Maseru). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. Check it under **Settings → Cron Jobs**, where you can also trigger it manually.
5. Add your domain in Vercel, and in Firebase Auth authorised domains.

## 6. How it works

- **Status** (`lib/status.ts`) is derived and never stored. It is computed against today in Africa/Maseru: VALID >30 days, EXPIRING 0–30, EXPIRED <0, MISSING = no current record.
- **Renew** writes one batch: a new current record, the old one marked `isCurrent:false, supersededBy:newId`, and an audit entry. History is never deleted.
- **Alerts:** each current record is in at most one threshold (30/14/7/0, or `OVERDUE_<iso-week>` once expired). A `notificationLog/{authId}_{threshold}` doc is written after a successful send, so reruns and missed days never duplicate, and a missed day sends only the current threshold.
- **Security:** `firestore.rules` denies by default. HR users see and write only their companies (cross-company creates, moves and reads are rejected). Master data and users are admin-only. `notificationLog` has no client access. `auditLog` is create-only and admin-readable. Date formats and field types are validated in the rules.
- Details: `docs/CONTRACTS.md`, `docs/DECISIONS.md`, `docs/REVIEW.md`.

## 7. Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / tsc |
| `npm test` | Vitest unit tests |
| `npm run test:rules` | Security-rules tests (emulator must be running) |
| `npm run test:e2e` | Playwright happy path (emulator + seed) |
| `npm run emulators` | Firebase Auth + Firestore emulators |
| `npm run seed` | Demo data into the emulator (wipes it first) |
| `npm run seed:admin` | Bootstrap the first admin in a real project |
| `npm run clean` | Remove build and test output |

## 8. Manual steps checklist (go-live)

- [ ] Create the Firebase project, enable Email/Password, create Firestore (`africa-south1`)
- [ ] `firebase deploy --only firestore:rules,firestore:indexes`
- [ ] Generate the service-account key and base64 it into `FIREBASE_SERVICE_ACCOUNT_JSON`
- [ ] Entra app registration: `Mail.Send` (application) + admin consent + client secret; create the shared mailbox; application access policy
- [ ] Vercel: import the repo, set all env vars, **redeploy**, confirm the cron job is listed
- [ ] Add the production domain to Firebase Auth authorised domains
- [ ] `npm run seed:admin` against production to create the first admin
- [ ] Add departments, designations and HR users in the portal
- [ ] Admin → Alerts → **Send test digest** (dry run), then trigger the cron once from Vercel and confirm the email arrives
- [ ] Diarise the Graph client-secret expiry

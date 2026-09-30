# Go-Live Guide

Step by step, from the ZIP on your PC to a live portal on Vercel sending alert emails. It takes about 1–2 hours, most of it waiting for consents and DNS.

What you need:
- a Google account for Firebase
- Microsoft 365 **Global Admin** (or Exchange Admin plus Application Admin) for the mailer
- a GitHub account
- a Vercel account
- access to your DNS if you want a custom domain

---

## Step 0 — Local check (15 min)

```powershell
cd C:\xampp\htdocs\agentic-projects\permit-portal-chat
npm install
Copy-Item .env.emulator.example .env.local
npm run typecheck; npm run lint; npm test; npm run build
```

Window 1: `npm run emulators`. Window 2:
```powershell
npm run test:rules
npm run seed
npm run dev
```

- Open http://localhost:3000 and sign in as `admin@demo.local` / `Demo#12345`.
- Try light and dark mode (toggle at the bottom of the sidebar), then renew a permit.
- Check **Admin → Alerts → Send test digest**.
- Optional: `npx playwright install chromium` then `npm run test:e2e`.

## Step 1 — Firebase project (15 min)

1. Go to https://console.firebase.google.com and click **Add project**, e.g. `dfs-permit-portal`. Turn Analytics off.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
3. **Authentication → Settings → User actions:** leave "Email enumeration protection" on.
4. **Build → Firestore Database → Create database →** choose **Production mode** and location **`africa-south1` (Johannesburg)**.
   > The location cannot be changed later.
5. **Project settings (gear) → General → Your apps → Web `</>`:**
   - Register the app as `permit-portal-web` (no Hosting).
   - Copy the 6 config values: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
6. **Project settings → Service accounts → Generate new private key.** Save the file to e.g. `C:\secure\permit-portal-sa.json`, **outside** the repo, then encode it:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\secure\permit-portal-sa.json")) | Set-Clipboard
   ```
   The clipboard now holds `FIREBASE_SERVICE_ACCOUNT_JSON`. Paste it somewhere safe, such as a password manager.

## Step 2 — Deploy rules and indexes (5 min)

```powershell
npx firebase login
npx firebase use --add          # pick dfs-permit-portal, alias: prod
npx firebase deploy --only firestore:rules,firestore:indexes --project prod
```

Then open **Firestore → Indexes** and wait until all 5 composite indexes show **Enabled**.

## Step 3 — First admin (5 min)

Create a production `.env.prod.local` (it is git-ignored). Use the `.env.example` layout with the **real** Firebase values and `FIREBASE_SERVICE_ACCOUNT_JSON`, and **no** emulator variables. Then:

```powershell
Copy-Item .env.local .env.emulator.local   # keep your emulator copy
Copy-Item .env.prod.local .env.local
$env:SEED_ADMIN_EMAIL="vijan@yourcompany.com"
$env:SEED_ADMIN_PASSWORD="Temp#Strong-2026"
$env:SEED_ADMIN_NAME="Vijan"
npm run seed:admin
Copy-Item .env.emulator.local .env.local   # back to emulator mode for development
```

Output should include `users/<uid> set as active admin` and `Created company DFS / RWD / QA`.

## Step 4 — Microsoft Graph mailer (20 min + consent)

1. **Shared mailbox:** in the Exchange admin center (https://admin.exchange.microsoft.com), go to **Recipients → Mailboxes → Add a shared mailbox** and create `hr-alerts@yourcompany.com`. It needs no licence.
2. **App registration:** in https://entra.microsoft.com, go to **Applications → App registrations → New registration**.
   - Name: `Permit Portal Mailer`. Supported accounts: **this organisation only**. No redirect URI.
   - Copy the **Application (client) ID** into `GRAPH_CLIENT_ID`, and the **Directory (tenant) ID** into `GRAPH_TENANT_ID`.
3. **Certificates & secrets → New client secret**, valid 24 months. Copy the **Value** (not the ID) into `GRAPH_CLIENT_SECRET`. **Add the expiry date to your calendar.**
4. **API permissions → Add a permission → Microsoft Graph → Application permissions → `Mail.Send` → Add**, then **Grant admin consent for <tenant>**. The status must show a green tick.
5. **Lock the app to the one mailbox (strongly recommended).** Without this, the app could send as *any* user:
   ```powershell
   Install-Module ExchangeOnlineManagement -Scope CurrentUser   # once
   Connect-ExchangeOnline
   New-DistributionGroup -Name "PermitPortalSenders" -Alias PermitPortalSenders -Type Security -Members hr-alerts@yourcompany.com
   New-ApplicationAccessPolicy -AppId <GRAPH_CLIENT_ID> -PolicyScopeGroupId PermitPortalSenders@yourcompany.com -AccessRight RestrictAccess -Description "Permit portal sends only as hr-alerts"
   Test-ApplicationAccessPolicy -Identity hr-alerts@yourcompany.com -AppId <GRAPH_CLIENT_ID>   # AccessCheckResult: Granted
   Test-ApplicationAccessPolicy -Identity someone.else@yourcompany.com -AppId <GRAPH_CLIENT_ID> # AccessCheckResult: Denied
   ```
   Policies can take up to 30 minutes to apply.

## Step 5 — GitHub (5 min)

```powershell
git init
git add .
git commit -m "Permit & Visa Portal v1"
git branch -M main
git remote add origin https://github.com/<you>/permit-portal.git
git push -u origin main
```

Check that `.env.local`, `.env.prod.local` and the service-account JSON are **not** in the commit. `.gitignore` already excludes them, and `git status` should be clean.

## Step 6 — Vercel (15 min)

1. Go to https://vercel.com/new, **import** the GitHub repo, keep Framework Next.js and the default build settings, and **don't deploy yet**. If it deploys anyway, that's fine; you'll redeploy.
2. **Settings → Environment Variables:** add each one for **Production**, and Preview only if you want previews to reach the real database.

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | from Step 1.5 |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 〃 |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 〃 |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 〃 |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 〃 |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | 〃 |
   | `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | `false` |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | base64 from Step 1.6 |
   | `CRON_SECRET` | `-join ((48..57)+(65..90)+(97..122) \| Get-Random -Count 48 \| % {[char]$_})` |
   | `APP_BASE_URL` | `https://permits.yourcompany.com` (or the `*.vercel.app` URL) |
   | `MAIL_TRANSPORT` | `graph` |
   | `MAIL_FROM` | `hr-alerts@yourcompany.com` |
   | `GRAPH_TENANT_ID` / `GRAPH_CLIENT_ID` / `GRAPH_CLIENT_SECRET` | from Step 4 |

3. **Deployments → ⋯ → Redeploy.** A redeploy is required after *any* variable change, because `NEXT_PUBLIC_*` values are baked into the build.
4. **Settings → Cron Jobs:** confirm `/api/cron/expiry-alerts` is listed with schedule `0 4 * * *` (06:00 Maseru).
   - The **Hobby** plan allows daily crons, but Vercel may run them any time within the hour.
   - **Pro** runs them on time and is also appropriate for business use.

## Step 7 — Domain (10 min + DNS)

1. **Vercel → Settings → Domains → Add** `permits.yourcompany.com`, then create the CNAME it shows at your DNS provider.
2. **Firebase → Authentication → Settings → Authorized domains → Add** `permits.yourcompany.com`. The `*.vercel.app` URL also needs adding if people will use it.
3. Set `APP_BASE_URL` to the final domain, then **redeploy**.

## Step 8 — Smoke test in production (15 min)

1. Open the site and sign in as the admin from Step 3. Then **Forgot password?** to set your own password; check the reset email arrives, including in spam.
2. **Admin → Departments:** add departments per company. **Admin → Designations:** add designations.
3. **Admin → Users → Invite user:** create one HR user per company with a temporary password. Sign in as one of them in a private window; they must see **only** their company.
4. Add one test employee with a work permit expiring in 10 days.
5. **Admin → Alerts → Send test digest:** one digest is listed with the right recipients.
6. Trigger a real run: **Vercel → Settings → Cron Jobs → Run**, or:
   ```powershell
   Invoke-RestMethod -Uri "https://permits.yourcompany.com/api/cron/expiry-alerts" -Headers @{ Authorization = "Bearer <CRON_SECRET>" }
   ```
   The response shows `sent: [...]`, and the email arrives from `hr-alerts@`.
7. Run it again. The response shows `sent: []`, because no duplicate is sent.
8. Deactivate or delete the test data: set the test employee to inactive.

## Step 9 — Load real data

- Enter the migrant employees company by company (HR users can do their own company).
- For each employee, add the current work permit and visa. The expiry defaults to issued + 2 years − 1 day, but use the date on the document.

## Step 10 — Operate

| When | What |
|---|---|
| Daily 06:00 | Digest emails go out automatically. **Vercel → Logs** (filter `/api/cron`) shows each run |
| Staff change | Admin → Users: deactivate leavers (they are blocked at sign-in immediately) |
| Every ~23 months | Rotate `GRAPH_CLIENT_SECRET` in Entra, then update it in Vercel and redeploy |
| Rules change | `npx firebase deploy --only firestore:rules --project prod` |
| Backups | Optional: Firestore → **Disaster recovery → scheduled backups** (daily, 7-day retention) |

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Firebase is not configured" on the login page | `NEXT_PUBLIC_*` variables are missing. Set them in Vercel, then **redeploy** |
| `auth/unauthorized-domain` | Add the domain in Firebase Auth → Authorized domains |
| "A database index is still building" | Wait for Firestore → Indexes to show Enabled |
| Cron returns 401 | `CRON_SECRET` is missing or different; redeploy after setting it |
| Cron returns 500 `ErrorAccessDenied` | Mail.Send consent is missing, or the application access policy doesn't include `MAIL_FROM` |
| Cron returns 500 `FIREBASE_SERVICE_ACCOUNT_JSON` | The value must be the **base64** of the whole JSON file, on one line |
| HR user sees "Account not set up" | The user was created in Auth but has no `users/{uid}` profile. Re-invite them with the same email and temporary password |

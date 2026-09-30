# QA Review

Review of the code against spec §5–§7 and §9.

**Status:** **PASS** means the code implements the item. The *Verified* column says how it was checked in the build environment:

- **auto:** covered by a test or check that ran and passed. That includes lint, typecheck, unit tests and the build.
- **rules-test:** covered by `tests/rules`. These tests need the Firestore emulator, which could not be downloaded in the build sandbox. Run `npm run test:rules` locally.
- **e2e:** covered by Playwright (`npm run test:e2e`, run locally).
- **manual:** use the walkthrough at the end.

## §5 Features

| # | Item | Status | Where | Verified |
|---|---|---|---|---|
| 5.1 | Login, logout, password reset | PASS | `components/auth/login-form.tsx`, `reset-password-form.tsx`, `components/layout/app-header.tsx` | e2e |
| 5.1 | Protected layout; inactive and profile-less users blocked | PASS | `components/layout/app-shell.tsx`, `components/providers/auth-provider.tsx`; rules deny inactive users (`firestore.rules` `isActive`) | rules-test, manual |
| 5.2 | KPI cards per type (Valid / Expiring ≤30d / Expired / Missing) | PASS | `components/dashboard/kpi-cards.tsx`, `lib/dashboard.ts` | auto (`tests/unit/dashboard.test.ts`) |
| 5.2 | Action-required table: all columns, sorted by expiry ascending | PASS | `components/dashboard/action-required-table.tsx`, `buildDashboard` | auto |
| 5.2 | Company filter (accessible companies only) and type filter | PASS | `components/dashboard/dashboard.tsx`, `PortalDataProvider.accessibleCompanies` | auto (filters), manual |
| 5.2 | Breakdown by company (recharts) | PASS | `components/dashboard/company-chart.tsx` | auto (data), manual |
| 5.2 | Passports ≤90 days card, no email | PASS | `components/dashboard/passport-card.tsx`; the alert planner never looks at passports | auto |
| 5.2 | Header badge with action-required count | PASS | `app-header.tsx`, `countActionRequired` | auto, e2e |
| 5.3 | Employee list: search, filters (company / department / designation / status), pagination | PASS | `components/employees/employee-list.tsx` | manual |
| 5.3 | Create and edit with zod (email format, passport expiry after issue) | PASS | `employee-form.tsx`, `lib/schemas/employee.ts` | auto (`schemas.test.ts`) |
| 5.3 | Detail: profile, current permit and visa cards, renewal history per type | PASS | `employee-detail.tsx`, `authorisation-card.tsx`, `history-timeline.tsx` | e2e |
| 5.3 | Add, renew (issued = old expiry + 1), edit, deactivate | PASS | `authorisation-dialog.tsx`, `lib/repos/authorisations.ts`, `setEmployeeActive` | auto (date logic), e2e (renew) |
| 5.4 | Master data (admin): companies, departments, designations, users (invite with temporary password) | PASS | `components/admin/*`, `lib/repos/users.ts` + `createAuthAccount` | rules-test, manual |
| 5.5 | Alerts | PASS | see §6 | auto |
| 5.6 | Audit log for every create / update / renew / deactivate; admin viewer | PASS | `appendAudit` in every repo write; `components/admin/audit-log-view.tsx` | rules-test, manual |
| — | Out of scope (uploads, self-service, Excel) not built | PASS | — | — |

## §6 Expiry alerts

| Item | Status | Where | Verified |
|---|---|---|---|
| Daily 04:00 UTC Vercel Cron | PASS | `vercel.json` (`0 4 * * *`) | auto |
| Rejects requests without `Bearer CRON_SECRET` | PASS | `app/api/cron/expiry-alerts/route.ts` (`authorise`, timing-safe compare) | auto (smoke test: 401 without / with a wrong token) |
| Thresholds 30 / 14 / 7 / 0, then weekly `OVERDUE_<yyyy-ww>` | PASS | `lib/status.ts` `currentThresholdKey` | auto |
| Check the log before sending, write it after a successful send; reruns never duplicate | PASS | `route.ts` → `existingLogIds`, `recordSent` (after `send`) | auto (`alerts.test.ts` "second run sends nothing") |
| Missed day: send only the highest threshold crossed that is still unsent | PASS | tightest-threshold rule (DECISIONS #4) | auto |
| One digest per company; To = HR of that company, Bcc = admins; nothing to employees | PASS | `lib/email/alerts.ts` `recipientsFor`, `planDigests` | auto |
| Subject format, HTML grouped Expired → 0–7 → 8–14 → 15–30, links to each employee, plain-text fallback | PASS | `lib/email/templates.ts`, `lib/email/mime.ts` (multipart/alternative) | auto |
| Pure, unit-tested templates | PASS | `tests/unit/templates.test.ts` | auto |
| Graph `sendMail` app-only through MSAL, behind `MailTransport`; SMTP fallback; `MAIL_TRANSPORT` switch | PASS | `lib/email/transport.ts`, `graph.ts`, `smtp.ts`, `config.ts` | auto (`mail-transport.test.ts`, mocked fetch) |
| `?dryRun=1` returns JSON without sending; admin "Send test digest" | PASS | `route.ts`, `components/admin/test-digest.tsx` (admin ID token, dry run only) | manual |

## §7 Security

| Item | Status | Where | Verified |
|---|---|---|---|
| Deny by default | PASS | `firestore.rules` (only explicit matches) | rules-test |
| HR read/write of employees and authorisations limited to their `companyIds`; create cannot target another company | PASS | `canAccessCompany`; authorisation `companyId` must equal the employee's (`getAfter`) | rules-test (cross-company cases) |
| Only admins write companies, departments, designations and users | PASS | `firestore.rules` | rules-test |
| `notificationLog`: no client access | PASS | `allow read, write: if false` | rules-test |
| `auditLog`: any active user creates, only admins read, immutable, uid and timestamp enforced | PASS | `firestore.rules` `validAudit` | rules-test |
| Field types and `YYYY-MM-DD` validated in rules | PASS | `isIsoDate`, `validEmployee`, `validAuthorisation`, `keysExactly` | rules-test |
| Rules tests cover every role × collection × operation, incl. cross-company denial | PASS | `tests/rules/firestore.rules.test.ts` | rules-test |
| No secrets in client code; service account as base64 env var | PASS | `lib/firebase/admin.ts` (server-only), `.env.example` | auto (build) |

## §9 Definition of done

| Item | Status | Verified |
|---|---|---|
| `lint`, `typecheck`, `test`, `build` pass | PASS | auto (all ran green) |
| `test:rules` passes | Not run here (the emulator download is blocked in the sandbox) | Run locally |
| RW Design HR cannot read or write DFS / QA data (rules and UI) | PASS | rules-test (`hr DFS is denied RWD records`, cross-company cases), e2e (second test) |
| Renew keeps history and updates the dashboard immediately | PASS | e2e (real-time `onSnapshot`) |
| Cron dry run on seed data gives correct digests; a second real run sends nothing new | PASS | auto (`alerts.test.ts`); run locally for real Graph mail |
| No `any`, no Admin SDK imports outside `lib/firebase/admin.ts` / `scripts/`, no `console.log` in app code | PASS | auto (ESLint `no-explicit-any`, `no-restricted-imports`, `no-console`) |
| Handover lists the manual steps | PASS | `README.md` §8 |

## Known limitations (accepted, documented in DECISIONS)

1. **One current record per type** is enforced by the client, not the rules. The rules do enforce the superseding step.
2. **Audit entries** are client-written. Rules make them immutable and tie them to the writer's uid, but they cannot prove that each data write has one.
3. **Calendar validity** (e.g. 31 Feb): rules check the format only; zod checks real dates.
4. **Renamed master data** does not rewrite existing employees' denormalised names until each employee is next saved.

## Manual walkthrough (Phase 5 checklist)

1. `npm run emulators`, then `npm run seed`, then `npm run dev`. Sign in as `admin@demo.local`.
2. **Dashboard:** the badge shows about 12 action items. Filtering by RW Design + Work Permit narrows the KPIs and the table. The chart has 3 companies. The passport card lists 3 employees.
3. **Employees:** search "li" finds Li Wei. The Status → Missing filter shows Chen Hao and Grace Banda. Toggle "Show inactive" shows Zhang Min. Pagination appears after 20 rows.
4. **Add employee:** try a passport expiry before its issue date, which is rejected. Save a valid one, then **Add work permit**; the expiry auto-fills as issued + 2 years − 1 day.
5. **Rajesh Kumar → Renew work permit:** the issued date is pre-filled with the old expiry + 1. After saving, the history shows 3 records (1 current), and the dashboard row disappears.
6. **Deactivate** an employee. They drop off the dashboard, and the audit log shows `deactivate`.
7. **Admin → Users → Invite:** create an HR user for Quantum Apparel, then sign in as them in a private window; only QA is visible.
8. **Admin → Alerts → Send test digest:** 3 digest previews appear (DFS, QA, RWD) with recipients.
9. Sign in as `inactive@demo.local`. The "Account inactive" screen appears.

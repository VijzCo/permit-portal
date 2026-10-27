# Decisions

Choices made where the spec was silent or needed interpretation. Each one is the simplest production-grade option.

| # | Area | Decision | Why |
|---|---|---|---|
| 1 | Versions | Next 15.5, React 19, Tailwind v4, shadcn "new-york" (Tailwind v4 registry), zod 3.24 + @hookform/resolvers 3.10, Firebase JS 11 (matches `@firebase/rules-unit-testing` 4), firebase-admin 13, Recharts 3, Vitest 3 | Stable, compatible combination; Recharts 3 supports React 19 without overrides |
| 2 | shadcn components | Shipped in `components/ui/` (copied from the shadcn v4 registry, unified `radix-ui` package). `sonner` uses a fixed light theme, so no `next-themes` | No `shadcn add` step is needed. `components/ui` is excluded from ESLint as vendored code |
| 3 | Selects | Native `<select>` (shadcn `native-select`) for filters and forms | Simpler with react-hook-form, accessible, and good on mobile |
| 4 | Alert threshold after missed days | Send only the **tightest** threshold crossed (e.g. 10 days left with "30" already sent → send "14"; nothing sent and 3 days left → send "7") | Reading of "highest threshold crossed … not every skipped threshold": the most urgent one, never a backlog |
| 5 | Overdue cadence | After expiry, key = `OVERDUE_<ISO week of today>`, so at most one alert per ISO week (Mon–Sun), starting the day after expiry | Matches `OVERDUE_<yyyy-ww>` in the spec |
| 6 | Digest contents | A digest lists only items whose alert is due today, not every action-required record | Keeps reminders meaningful; the dashboard shows the full picture |
| 7 | Recipients | To = active HR users of the company; Bcc = active admins. With no HR user, the admins go in To. With no recipients at all, the company is skipped and its alerts stay unsent so they retry next day | The spec says admins in BCC; a message needs at least one direct recipient |
| 8 | Graph payload | Graph `sendMail` with a **MIME** body (multipart/alternative, built with nodemailer's MailComposer, Bcc kept in headers) | The JSON sendMail body has a single content type; MIME gives a real plain-text fallback |
| 9 | Inactive data | Inactive employees and inactive companies get no alerts and are excluded from dashboard KPIs | Deactivation means "no longer tracked" |
| 10 | Test digest button | The cron route also accepts an **active admin's Firebase ID token**, for `?dryRun=1` only | The browser must never hold `CRON_SECRET` |
| 11 | User invite | The admin creates the Auth account in the UI using a **secondary Firebase app instance** (`createUserWithEmailAndPassword`), so the admin is not signed out, then writes `users/{uid}`. The temporary password is shared privately; the user resets it via "Forgot password?" | Satisfies "admin sets a temporary password" with no extra server code or Admin SDK outside the cron route |
| 12 | Employee email | Optional (`''` allowed); validated when present | Many factory staff have no email |
| 13 | Search and pagination | Client-side over the live, company-scoped employee list (20 per page). `searchText` is stored lower-case | Hundreds of records at most; Firestore has no full-text search |
| 14 | Employee status filter | Matches if **either** the work permit or the visa has the chosen status | One filter covers both types |
| 15 | Denormalised names | Company/department/designation names are written onto the employee at save time. Renaming master data does not rewrite existing employees (they refresh on the next edit) | Avoids fan-out writes from the client |
| 16 | Company IDs | The company doc id = its code (`DFS`, `RWD`, `QA`), and the code is immutable | Readable IDs; matches the seed |
| 17 | Company-scoped queries | One Firestore query per accessible company (`companyId ==`), merged client-side, for everyone including admins | This is the query shape the rules can prove; same code path for all roles |
| 18 | Deletes | No deletes from the client for any collection; records are deactivated instead | History and audit must be kept |
| 19 | Rules and company moves | HR may move an employee only between their own companies; admins may move anywhere. The employee is committed first, then its authorisations in batches of 8 | Keeps `companyId` consistent for rules and alerts, within the 20-access-call batch limit |
| 20 | Real-time data | `onSnapshot` listeners for master data, employees and current authorisations; "now" re-evaluates every minute | "Renewing immediately updates the dashboard" |
| 21 | Status time zone in the UI | The browser computes status with `todayIso()` in Africa/Maseru, whatever the PC's time zone | Same result as the cron job |
| 22 | Env loading in scripts | `scripts/admin-init.ts` reads `.env.local` itself | `tsx` does not load env files; works on Node 20.9+ |
| 23 | Demo seed | `npm run seed` wipes the **emulator** first and refuses to run against a live project. All demo passwords are `Demo#12345` | Deterministic, repeatable demo data |
| 24 | Security headers | `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a permissions policy in `next.config.ts` | Cheap hardening |
| 25 | Admin SDK boundary | ESLint `no-restricted-imports` blocks `firebase-admin` everywhere except `lib/firebase/admin.ts` and `scripts/` | Enforces the §9 definition of done |
| 26 | Rules scope | The rules validate **format** (`YYYY-MM-DD`), types, company access, company consistency and the superseding step. Calendar validity (no 31 Feb), "one current per type" and "every write has an audit entry" are enforced by the client (zod + repositories), not by the rules | These need sibling queries or more `get()` calls than the rules allow |
| 27 | Department company | A department's `companyId` is immutable once created | Employees must never point at a department in another company |
| 28 | Invite recovery | If an invite creates the Auth account but the profile write fails, retrying with the same email and temporary password reuses the account | No orphaned logins and no Admin SDK needed |
| 29 | Theme | `next-themes` with light / dark / system (default: system), stored per browser. The toggle is at the bottom of the sidebar and on the sign-in page | No flash on load; respects the OS setting |
| 30 | Brand | Ink-navy sidebar and teal primary, with a sidebar layout (fixed on desktop, sheet on mobile). System font stack (Inter / Segoe UI Variable), so there is no web-font download | Looks native on Windows and builds offline |
| 31 | Status colours | Fixed across themes: good `#0ca30c`, warning `#fab219`, critical `#d03b3b`, missing `#8a8f98`. Every use pairs the colour with an icon and label. The chart has a legend, tooltips and a **table view** because warning is below 3:1 on light surfaces | Colour never carries meaning alone |
| 32 | Permit / visa on Add employee | The Add employee form has optional **Work permit** and **Visa** sections (toggle "Enter now"). The employee, the records and their audit entries are written in one batch. Later changes go through the employee page (Add / Edit / Renew) | Data entry in one screen, like the passport; the rules already allow it via `getAfter` |
| 33 | Viewer role | `viewer` = read-only, scoped to its `companyIds` like HR. It can see the dashboard, employees, history and master data, but cannot write anything (including `auditLog`), cannot open admin pages and gets no digest emails. Unknown role values map to `viewer` (least privilege) | Management and audit visibility without edit risk |

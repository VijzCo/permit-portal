# Contracts

Shared interfaces every layer relies on. Changing one of these means updating every file that uses it.

## 1. Dates — `lib/dates.ts`

| Function | Contract |
|---|---|
| `APP_TIME_ZONE` | `"Africa/Maseru"` (UTC+2, no DST) |
| `isIsoDate(v)` | `true` only for a real calendar date in `YYYY-MM-DD` |
| `todayIso(now?)` | Today in Africa/Maseru as `YYYY-MM-DD` |
| `daysUntil(expiry, now?)` | Calendar days from Maseru today to `expiry`. `0` = expires today, negative = expired |
| `defaultExpiryDate(issued)` | issued + 2 years − 1 day (29 Feb issue in a non-leap target year → 28 Feb) |
| `renewalIssuedDate(prevExpiry)` | prevExpiry + 1 day |
| `isoWeekKey(iso)` | `"<ISO week-year>-<ww>"`, e.g. `2026-40` |
| `formatDisplayDate(iso)` | `28 Sep 2026` |

All stored dates are `YYYY-MM-DD` strings. `Date` objects are only used for "now".

## 2. Status — `lib/status.ts`

- `AuthorisationType = "WORK_PERMIT" | "VISA"`
- `Status = "VALID" | "EXPIRING" | "EXPIRED" | "MISSING"`, derived and never stored:
  - `daysLeft > 30` → `VALID`
  - `0 ≤ daysLeft ≤ 30` → `EXPIRING`
  - `daysLeft < 0` → `EXPIRED`
  - no current record → `MISSING`
- `computeStatus(expiryDate | null, now) → { status, daysLeft | null }`
- `urgencyBucket(daysLeft)` → `EXPIRED | D0_7 | D8_14 | D15_30 | null` (email grouping)
- `ALERT_THRESHOLDS = [30, 14, 7, 0]`
- `ThresholdKey = "30" | "14" | "7" | "0" | "OVERDUE_<yyyy-ww>"`
- `currentThresholdKey(daysLeft, today)` → the **tightest** threshold crossed; after expiry it returns `OVERDUE_<ISO week of today>`; `null` when more than 30 days are left
- `resolveAlertThreshold(expiry, alreadySent, now)` → the key to send now, or `null`
- `notificationLogId(authId, key)` → `"<authId>_<key>"`

## 3. Firestore documents

Timestamps (`createdAt`, `updatedAt`, `at`, `sentAt`) are server timestamps. Repositories expose them as ISO datetime strings (`null` while a write is pending).

| Path | Fields |
|---|---|
| `companies/{code}` | `name, code, active, createdAt`. The doc id **is** the code (`DFS`, `RWD`, `QA`), and the code is immutable |
| `departments/{id}` | `name, companyId, active` |
| `designations/{id}` | `name, active` |
| `users/{uid}` | `email, displayName, role: 'admin'\|'hr', companyIds: string[], active`. Admins have `companyIds: []`; hr users need at least one company |
| `employees/{id}` | `firstName, lastName, email ('' allowed), companyId, departmentId, designationId, companyName, departmentName, designationName, searchText, passport{number, nationality, issueDate, expiryDate}, active, createdAt, updatedAt, createdBy, updatedBy` |
| `authorisations/{id}` | `employeeId, companyId, type, referenceNumber, issuedDate, expiryDate, isCurrent, supersededBy (id\|null), notes, createdAt, updatedAt, createdBy, updatedBy` |
| `notificationLog/{authId}_{key}` | `authId, threshold, companyId, sentAt, recipients[]`. Written by the Admin SDK only |
| `auditLog/{id}` | `entity, entityId, action: 'create'\|'update'\|'renew'\|'deactivate', before, after, uid, at`. Immutable |

Invariants:
- `authorisations.companyId` always equals the employee's `companyId`. The rules check this with `getAfter` on every authorisation write. `updateEmployee` commits the employee first, then moves its authorisations in batches of 8 (to stay within the rules' access-call limit).
- At most one `isCurrent: true` per `(employeeId, type)`. The UI enforces this (**Add** is offered only when none exists; otherwise **Renew**). The rules cannot query siblings, but they do enforce the superseding step. Renewal is one batch: the new doc is created with `isCurrent: true, supersededBy: null`, and the old doc is set to `isCurrent: false, supersededBy: newId`. A record can only stop being current when a current record of the same employee and type supersedes it (enforced in the rules). Nothing is deleted.
- Every client write goes into a batch together with its `auditLog` entry.

## 4. Query shape (required by the rules)

Client queries on `employees` and `authorisations` always filter `where("companyId", "==", <one accessible company>)`, one query per company, merged client-side (`subscribeMerged`).

## 5. Zod schemas — `lib/schemas/*`

`companyInputSchema`, `departmentInputSchema`, `designationInputSchema`, `userInputSchema`, `createUserSchema` (+ `temporaryPassword`), `employeeInputSchema` (passport expiry > issue), `authorisationInputSchema` (expiry > issued). Read models: `Company`, `Department`, `Designation`, `AppUser`, `Employee`, `Authorisation`, `AuditLogEntry`.

## 6. Email — `lib/email/*`

```ts
interface MailMessage { from: string; to: string[]; bcc: string[]; subject: string; html: string; text: string }
interface MailTransport { readonly name: "graph" | "smtp"; send(m: MailMessage): Promise<void> }
```

- `createMailTransport()` picks the transport from `MAIL_TRANSPORT` (`graph` by default).
- `renderDigest({ companyName, today, baseUrl, items }) → { subject, html, text }` is pure.
- `planDigests(AlertInput) → { today, digests[], skipped[] }` is pure. It sends one digest per active company: `to` = the company's active HR users, `bcc` = active admins; when a company has no HR user, the admins go in `to`.

## 7. Cron route — `GET /api/cron/expiry-alerts`

- `Authorization: Bearer ${CRON_SECRET}` → real run. It sends, then writes the `notificationLog` entries after each successful send.
- `?dryRun=1` → JSON only, nothing is sent or written. It accepts `CRON_SECRET` or an active admin's Firebase ID token.
- Response: `{ dryRun, today, digests|sent, failed?, skipped }`. Status 500 if any company failed.

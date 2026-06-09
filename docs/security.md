# Security Architecture

## Zero Trust
Every request is verified before data is accessed:
1. Valid session?
2. User role?
3. Tenant/clinic match (ClinicID)?
4. Role has permission for this action?
5. Log the attempt either way

## E2EE (Client-Side Encryption)
Using the Web Crypto API — **the server never sees plaintext user data.**

**Registration:**
- Browser generates AES-GCM-256 master key
- PBKDF2 derives a Key Encryption Key (KEK) from the user's password + random salt
- Master key is wrapped with KEK using AES-KW
- Only `wrappedKey` + `keySalt` are sent to the server

**Login:**
- Server returns `wrappedKey` + `keySalt`
- Browser re-derives KEK from password + salt
- Master key is unwrapped locally → stored in `CryptoProvider` memory only
- Cleared from memory on sign-out

**Data:**
- Encrypt with `encryptData(masterKey, plaintext)` → returns `{ ciphertext, iv }`
- Decrypt with `decryptData(masterKey, ciphertext, iv)`
- Server stores only encrypted blobs — unreadable without the user's password

**Important:** Developers cannot read user data. There is no password recovery that restores access to existing encrypted data. This is intentional.

## Password Policy
Enforced on both client and server (`app/api/auth/sign-up/route.js`):
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character

## Session Policy
- **Token expiry:** 10 minutes (`lib/auth.js` — `maxAge: 60 * 10`)
- **Remember Me:** extends session to 3 days (`maxAge: 60 * 60 * 24 * 3`) — checkbox on sign-in page
- **Inactivity logout:** 30 minutes — tracked in `InactivityProvider`; clears master key and redirects to `/sign-in?reason=inactivity`

## Rate Limiting

IP-based rate limits are enforced on all auth endpoints before any database work is performed. Uses `lib/rateLimit.js` backed by the `RateLimit` Prisma model (table: `rate_limits`) — correct across all Vercel function instances.

| Endpoint | Limit | Window | Key format |
|---|---|---|---|
| `POST /api/auth/sign-in` | 20 requests | 15 min | `ip:sign-in` |
| `POST /api/auth/sign-up` | 10 requests | 60 min | `ip:sign-up` |
| `POST /api/auth/forgot-password` | 5 requests | 60 min | `ip:forgot-password` |
| `POST /api/auth/verify-otp` | 15 requests | 15 min | `ip:verify-otp` |
| `POST /api/clinic-applications` | 5 requests | 60 min | `ip:clinic-apply` |
| `POST /api/clinic-applications/documents` | 50 requests | 60 min | `ip:clinic-docs` |

On limit exceeded: `429 Too Many Requests`. Rate limit checks complement the per-user account lockout — one protects the account, the other protects the infrastructure.

**Implementation:** `lib/rateLimit.js` → `checkRateLimit(key, maxRequests, windowSeconds)`. Expired entries are cleaned up fire-and-forget on each request. The `windowEnd` column is indexed to keep cleanup queries fast.

---

## Multi-Factor Authentication (Email OTP)

> **Status:** Code is fully implemented but currently **disabled** in `app/api/auth/sign-in/route.js` (MFA block is commented out; `sendMfaOtpEmail` import is also commented out). The `MfaOtp` table, `verify-otp` API, and `VerifyOtpPage` are all in place and ready to re-enable.

When enabled: MFA is enforced for **all users** on every sign-in. After credentials are verified, a 6-digit OTP is emailed and the user must enter it before a session is created.

### Flow

```
1. POST /api/auth/sign-in  (email + password)
        │
        ├─ credentials invalid  →  401 / 423 lockout (same as before)
        │
        └─ credentials valid
              │
              ├─ generates 6-digit OTP + secure pendingToken (32 random bytes)
              ├─ bcrypt-hashes OTP (cost 8) → stored in MfaOtp table
              ├─ deletes any previous unused OTPs for this user
              ├─ emails OTP via Gmail/nodemailer (fire-and-forget)
              └─ returns { mfaPending: true, pendingToken, wrappedKey, keySalt }
                    │
                    └─ client stores { password, wrappedKey, keySalt } in sessionStorage
                       redirects to /verify-otp?token={pendingToken}

2. POST /api/auth/verify-otp  (pendingToken + code)
        │
        ├─ invalid/expired token    →  400  (redirect back to /sign-in)
        ├─ already used             →  400
        ├─ expired (> 10 min)       →  400
        ├─ attempts ≥ 5             →  429  (redirect back to /sign-in)
        ├─ wrong code               →  401  (increment attempts, show remaining)
        │
        └─ correct code
              ├─ marks OTP as used (usedAt = now)
              ├─ creates session via setSession()
              ├─ logs LOGIN audit entry
              └─ returns { clinicId }
                    │
                    └─ client reads { password, wrappedKey, keySalt } from sessionStorage
                       derives KEK → unwraps master key → stores in CryptoProvider
                       clears sessionStorage
                       redirects to /{clinicId}/dashboard  or  /super
```

### Database Model

```prisma
model MfaOtp {
  id           String    @id @default(cuid())
  userId       String
  pendingToken String    @unique   // 64-char hex, used as URL token
  codeHash     String              // bcrypt hash of the 6-digit OTP
  rememberMe   Boolean   @default(false)
  attempts     Int       @default(0)
  expiresAt    DateTime            // now + 10 minutes
  usedAt       DateTime?           // set on successful verification
  createdAt    DateTime  @default(now())

  user User @relation(...)

  @@map("mfa_otps")
}
```

### Security Properties

| Property | Detail |
|---|---|
| OTP format | 6 numeric digits (100000–999999) |
| OTP storage | bcrypt hash only (cost 8) — plaintext never persisted |
| `pendingToken` | `crypto.randomBytes(32).toString('hex')` — 256-bit entropy |
| Expiry | 10 minutes from issue |
| Attempt limit | 5 wrong codes → OTP invalidated, user redirected to sign-in |
| Reuse prevention | `usedAt` timestamp; already-used tokens return 400 |
| Cleanup | Previous unused OTPs for the user are deleted before issuing a new one |
| Session timing | Session is **only** created after OTP is verified — not at credential check |
| E2EE continuity | `wrappedKey` + `keySalt` are returned at credential check (they're non-sensitive without the password); master key is unwrapped client-side after OTP success using the password stored in `sessionStorage` |
| `sessionStorage` | Cleared immediately after master key is unwrapped; never written to `localStorage` |

### Files

| File | Purpose |
|---|---|
| `app/api/auth/sign-in/route.js` | Issues OTP instead of session after valid credentials |
| `app/api/auth/verify-otp/route.js` | Validates OTP, creates session |
| `app/(main)/verify-otp/page.jsx` | Page entry point |
| `app/modules/verify-otp-page/VerifyOtpPage.jsx` | OTP entry UI (6 digit boxes, paste support) |
| `lib/email.js` → `sendMfaOtpEmail()` | Sends styled OTP email via Gmail/nodemailer |
| `prisma/schema.prisma` → `MfaOtp` | OTP record model |

---

## DB-Backed Session Management (2026-06-03)

Sessions are now validated against the database on every request, enabling server-side session termination.

### UserSession Model

```prisma
model UserSession {
  id           String    @id @default(cuid())
  userId       String
  clinicId     String?
  sessionToken String    @unique  // 32 random bytes hex
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime  @default(now())
  expiresAt    DateTime
  terminatedAt DateTime?
}
```

### Flow

- `setSession()` creates a `UserSession` record and stores the `sessionToken` in the cookie
- Any existing session token for the user is terminated (`terminatedAt = now()`) before a new one is created
- `getSession()` reads the cookie, parses `sessionToken`, queries `UserSession`, and returns `null` if `terminatedAt` is set
- `clearSession()` (sign-out) sets `terminatedAt = now()` on the active session and deletes the cookie

### Single-Session Mode

When `Clinic.singleSessionEnabled` is `true`, signing in terminates all other active `UserSession` records for that user via `updateMany({ where: { userId, terminatedAt: null }, data: { terminatedAt: now } })` before creating the new session. Controlled via Settings → Password Policy.

### Hard Session Cap

Middleware enforces an absolute 8-hour session limit regardless of sliding renewal. Sessions older than 8 hours are cleared and the user is redirected to sign-in.

---

## Known Device Tracking (2026-06-03)

```prisma
model KnownDevice {
  id            String   @id @default(cuid())
  userId        String
  userAgentHash String              // SHA-256 of User-Agent string
  lastIp        String?
  firstSeenAt   DateTime @default(now())
  lastSeenAt    DateTime @default(now())

  @@unique([userId, userAgentHash])
}
```

On every sign-in, the user agent hash is upserted to `KnownDevice`. This provides a per-user device footprint for future anomaly detection or reporting.

---

## Step-Up Authentication (2026-06-03)

Sensitive operations (CSV/PDF export of audit logs and reports) require a step-up authentication challenge — the user must re-enter their current password.

### Flow

```
1. Client calls GET /api/auth/step-up
   → if stepUpGrantedAt is present and < 15 min old → { valid: true }
   → otherwise → { valid: false }

2. UI shows StepUpModal.jsx — user enters password

3. Client calls POST /api/auth/step-up  (password in body)
   → bcrypt.compare(password, user.password)
   → if valid: sets session.stepUpGrantedAt = Date.now()
   → returns { success: true }

4. Client retries the export — middleware/route checks isStepUpValid()
```

### Properties

| Property | Detail |
|---|---|
| TTL | 15 minutes from grant |
| Storage | `stepUpGrantedAt` timestamp in session cookie (not DB) |
| Scope | Re-verifies current password — not a separate credential |
| Applied to | `GET /api/audit-log/export`, `GET /api/reports/export` |

### Files

| File | Purpose |
|---|---|
| `app/api/auth/step-up/route.js` | POST (grant) + GET (check) |
| `components/commons/StepUpModal.jsx` | Password prompt dialog |
| `lib/auth.js` → `grantStepUp()` / `isStepUpValid()` | Session helpers |

---

## Data Subject Rights / DSAR (2026-06-03)

Patients may submit data rights requests under RA 10173. Three request types are supported:

| Type | Description |
|---|---|
| `ACCESS` | Patient requests a copy of their personal data |
| `CORRECTION` | Patient requests correction of inaccurate data |
| `DELETION` | Patient requests erasure of their personal data |

### Flow

- Patient opens **My Profile → Data Rights** (`DataRightsDialog.jsx`) → fills in request type + description → submits
- `POST /api/data-requests` creates a `DataRequest` record (status: PENDING)
- Admin opens **Data Requests** page (`DataRequestsPage.jsx`) → reviews via `ReviewRequestModal.jsx`
- Admin updates status to IN_REVIEW → RESOLVED or REJECTED; can add `adminNotes`
- `PATCH /api/data-requests/[id]` updates the record

### Model

```prisma
model DataRequest {
  id          String            @id @default(cuid())
  userId      String
  clinicId    String
  type        DataRequestType   // ACCESS | CORRECTION | DELETION
  status      DataRequestStatus @default(PENDING) // PENDING | IN_REVIEW | RESOLVED | REJECTED
  description String?
  adminNotes  String?
  resolvedAt  DateTime?
  createdAt   DateTime          @default(now())
}
```

---

## Record Edit History (2026-06-03)

Every write to `PatientRecord` (create or update) appends a `RecordHistory` entry with a JSON diff.

```prisma
model RecordHistory {
  id        String   @id @default(cuid())
  recordId  String
  userId    String
  diff      Json     // { before: {...}, after: {...} }
  createdAt DateTime @default(now())
}
```

History is retrievable via `GET /api/records/[patientId]/[recordId]/history`. Combined with `contentHash` tamper detection, this provides a full audit trail for every patient record change.

---

## HTTP Security Headers (2026-06-07)

All responses include the following security headers, configured in `next.config.mjs`:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://vitals.vercel-insights.com https://psgc.cloud https://psgc.gitlab.io; frame-src 'self' blob:; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

Note: CSP uses `unsafe-inline` for scripts and styles to support MUI (Emotion's runtime CSS injection). This is a trade-off required by the MUI + Next.js SSR setup.

---

## Suspicious Login & Account Locked Alerts

Two email alerts fire automatically from the sign-in flow:

### Suspicious Login (`sendSuspiciousLoginAlert`)
Fires when a successful sign-in is detected from:
- A **new device** (user agent hash not in `KnownDevice`)
- A **different IP** than the device's last known IP

The alert email includes: device description, IP address, timestamp. The sign-in response also includes `requiresStepUp: true` so the client immediately prompts for step-up authentication before granting access to sensitive operations.

### Account Locked Alert (`sendAccountLockedAlert`)
Fires when repeated failed sign-in attempts trigger account lockout. The alert email includes: the lock duration and a recommendation to contact support if the user did not make these attempts.

Both alerts are fire-and-forget (`.catch(() => {})`) — email failure never blocks sign-in.

---

## Account Lockout
Tracked on the `User` model via `failedLoginAttempts`, `lastFailedAt`, `lockedUntil`.
- **Threshold:** 5 failed attempts within 5 minutes
- **Lock duration:** 15 minutes
- Configurable via env vars: `LOCKOUT_MAX_ATTEMPTS`, `LOCKOUT_WINDOW_MINUTES`, `LOCKOUT_DURATION_MINUTES`
- Resets on successful login

## File Upload Security

Applied to `POST /api/clinic-applications/documents` and `POST /api/clinics/[id]/logo`:

- **Magic-byte validation** — file type is determined from the first bytes of the buffer, not the client-provided `Content-Type` header. Only JPEG (`FF D8 FF`), PNG (`89 50 4E 47 0D 0A 1A 0A`), and PDF (`25 50 44 46`) are accepted.
- **Compressed archive rejection** — the buffer is scanned for known archive signatures before type detection. ZIP, RAR, 7-Zip, GZIP, BZIP2, and XZ magic bytes all result in a `400` rejection with a descriptive error message. This prevents archive-based payload smuggling.
- **Size limit** — 5 MB maximum per file.
- **Extension + content-type from detection** — the `ext` and `contentType` used for Supabase upload come from the magic-byte match, not from the client.

## Terms of Service

Users must explicitly accept the IntelliDent Terms of Service before completing sign-up or submitting a clinic application. The ToS is rendered in a modal (`TermsDialog.jsx`) and the checkbox is required client-side before the form can be submitted. The acceptance is a client-side gate — no separate server-side ToS flag is stored.

## Staff Account Creation Security

When an ADMIN creates a new staff user (Dentist or Receptionist) via `POST /api/users`:

- **Random temporary password** — an 8–12 character password meeting the full policy (upper, lower, digit, special) is generated server-side using `generateStaffPassword()` in `app/api/users/route.js`. The hardcoded `Intellident2026#` default is no longer used.
- **Auto-generated username** — a username in the format `{CLINICCODE}-{LASTNAME}-{####}` (e.g. `MLC-DELA CRUZ-0001`) is generated with collision-safe incrementing and stored in `User.username`. Displayed in the user management table, profile page, and welcome email.
- **First-login forced password change** — `mustChangePassword: true` is set on the `User` record at creation. On sign-in, the route checks this flag and includes `mustChangePassword: true` in the response. `SignInPage.jsx` intercepts this and redirects to `/change-password?reason=first-login` before reaching the dashboard. The `change-password` route always sets `mustChangePassword: false` on any successful password update, preventing a redirect loop.
- **Welcome email** — `sendStaffWelcomeEmail` sends the new user's email address, username, and randomly generated temporary password. The warning message now reads: *"You will be required to change your password on your first sign-in before you can access the system."*

## Admin Password Expiry

An optional 90-day password expiry policy can be enabled per clinic:

- **Toggle** — `Clinic.passwordExpiryEnabled Boolean` (default `false`). Controlled via the "Password Policy" section in Clinic Settings (`ClinicPasswordSettings.jsx`). Saved via `PATCH /api/clinics/[id]/profile` with `{ passwordExpiryEnabled: true/false }`.
- **Enforcement** — only applies to users with `role === ADMIN (1)`. At sign-in, after successful credential validation, the route checks: if the clinic has `passwordExpiryEnabled` and the user's `passwordExpiresAt` is in the past, the response includes `passwordExpired: true`. `SignInPage.jsx` intercepts this and redirects to `/change-password?reason=expired`.
- **Renewal** — when an ADMIN user successfully changes their password via `POST /api/auth/change-password`, the route checks the clinic's `passwordExpiryEnabled`. If enabled, it sets `passwordExpiresAt = now + 90 days` on the user record. No expiry is set for non-ADMIN users or when the feature is disabled.
- **First-time enforcement** — `passwordExpiresAt` is `null` by default and is only set after the first password change. A `null` value is never treated as expired; the check is only triggered once a date has been recorded.

## Staff Account Welcome Email (Legacy Note)

The welcome email previously showed the hardcoded password `Intellident2026#`. As of 2026-06-03 the email shows the randomly generated password and the auto-generated username. The email template (`sendStaffWelcomeEmail` in `lib/email.js`) accepts `{ to, firstName, role, tempPassword, username }`.

## Email Verification on Sign-Up
- `POST /api/auth/sign-up` → validates input, generates E2EE key material client-side, stores everything in `EmailVerification` record (24h expiry). **Does NOT create a `User` yet.**
- A verification email with a tokenized link is sent via Gmail/nodemailer.
- `POST /api/auth/verify` → validates token, creates `User` + profile record (`Patient` / `Dentist` / `Receptionist`). Token is single-use.
- Model: `EmailVerification` (token, email, firstName, lastName, hashed password, wrappedKey, keySalt, clinicId, expiresAt)

## Password Reset & Change
- **Forgot password:** `POST /api/auth/forgot-password` → generates one-time token (10 min expiry), sends reset link via email. Always returns 200 to prevent email enumeration.
- **Reset password:** `POST /api/auth/reset-password` → validates token, enforces policy, checks history, generates fresh E2EE key material (old encrypted data is intentionally inaccessible), sends confirmation email.
- **Change password (authenticated):** `POST /api/auth/change-password` → requires current password verification, re-wraps existing master key with new KEK (encrypted data stays accessible), sends confirmation email. Always clears `mustChangePassword: false`. For ADMIN accounts when the clinic has `passwordExpiryEnabled`, sets `passwordExpiresAt = now + 90 days`.
- **Forced change redirect:** if `mustChangePassword` is `true` or `passwordExpired` is `true` on sign-in response, `SignInPage.jsx` redirects to `/change-password?reason=first-login` or `/change-password?reason=expired` respectively. After a successful forced change, the user is redirected to `/sign-in?changed=true` and must re-authenticate.
- **Password history:** last 3 hashed passwords stored in `User.passwordHistory String[]`; new password cannot match any of them.
- Reset token model: `PasswordResetToken` (token, email, expiresAt, usedAt)
- Email notifications sent via `sendPasswordResetEmail` and `sendPasswordChangedEmail` in `lib/email.js`

## RBAC Roles

| Role | Sidebar Access |
|---|---|
| `PATIENT` | Dashboard, My Schedules (`/schedules`), My Profile |
| `RECEPTIONIST` | Dashboard, Appointments (`/appointments`), Patients, Billing |
| `DENTIST` | Dashboard, Schedule (`/schedule`), Patient Records (`/records`), My Profile |
| `ADMIN` | Dashboard, Users, Services, Schedules (`/appointments`), Billing, Settings, Audit Log |

- Sidebar nav is built per-role in `buildNavGroups()` inside `AppSidebar.jsx`
- `AppSidebar` receives `pendingCount` prop from `layout.jsx` (server-fetched); renders a blue badge on Appointments/Schedules nav items for RECEPTIONIST and ADMIN when count > 0
- Role changes and account deletions applied to the currently logged-in user immediately clear their session and redirect to sign-in
- There is no longer a "Reminders" nav item — notifications are delivered via the bell icon in `PageHeader`

## Multi-Tenancy
All data is scoped to a `ClinicID`. Every DB query must include a clinic scope filter. No cross-clinic data access is allowed regardless of role.

---

## RBAC — Role Assignment Rules

When an ADMIN changes a user's role via `PATCH /api/users/[id]`, only the following roles may be assigned:

| Assignable | Value |
|---|---|
| `DENTIST` | 2 |
| `RECEPTIONIST` | 3 |
| `PATIENT` | 4 |

`ADMIN (1)` and `SUPERADMIN (0)` are **never assignable** through this endpoint. This is enforced server-side via an explicit allowlist in `app/api/users/[id]/route.js`. The same restriction applies to user creation via `POST /api/users`.

`SUPERADMIN` accounts are provisioned only via the seed script (`prisma/seed-super.js`) or direct database access. There is no API path that grants the `SUPERADMIN` role.

---

## Security Audit Log

### 2026-05-12 — Internal Security Review

A security review of the codebase identified two vulnerabilities. Both were remediated immediately.

#### Finding 1 — Privilege Escalation via Role Assignment *(Critical — Fixed)*

**File:** `app/api/users/[id]/route.js`

**Description:** The `PATCH /api/users/[id]` endpoint validated the incoming `role` value against `Object.values(ROLES)`, which includes `SUPERADMIN (0)`. An authenticated ADMIN could send `{ "role": 0 }` to promote themselves or any clinic user to `SUPERADMIN`, gaining access to the `/super` portal and all clinics in the system.

**Fix:** Replaced `Object.values(ROLES)` with an explicit allowlist `[ROLES.DENTIST, ROLES.RECEPTIONIST, ROLES.PATIENT]`, consistent with the restriction already applied in the `POST /api/users` handler.

```js
// Before (vulnerable)
const validRoles = Object.values(ROLES)   // included SUPERADMIN (0) and ADMIN (1)

// After (fixed)
const assignableRoles = [ROLES.DENTIST, ROLES.RECEPTIONIST, ROLES.PATIENT]
```

---

#### Finding 2 — Broken `clinicId` Scoping (TDZ Bug) *(Medium — Fixed)*

**File:** `app/api/users/route.js`

**Description:** Both the `GET` and `POST` handlers resolved `clinicId` using a self-referential `const` declaration:

```js
const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : clinicId
//                                                                      ^^^^^^^
//                                              References itself — TDZ ReferenceError
```

For every non-`SUPERADMIN` caller (i.e. regular clinic admins), this threw a `Temporal Dead Zone ReferenceError` at runtime, making both `GET /api/users` (user listing) and `POST /api/users` (user creation) completely unusable for clinic admins. As a latent risk: if a future error handler were to catch the error and allow execution to continue with `clinicId = undefined`, Prisma would omit the clinic filter and return or write data across all clinics.

**Fix:** Changed both occurrences to reference `caller.clinicId` — matching the correct pattern already used in the `getAdminCaller()` helper in the sibling `[id]/route.js` file.

```js
// Before (broken)
const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : clinicId

// After (fixed)
const clinicId = caller.role === ROLES.SUPERADMIN ? session.clinicId : caller.clinicId
```

---

## Backup and Restore Controls

### Application-Level Backup

**Endpoint:** `GET /api/super/clinics/[id]/backup`
**Access:** SUPERADMIN only + step-up authentication (password re-entry, 15-min TTL)

Produces a signed, downloadable JSON artifact (`intellident-backup-{CODE}-{DATE}.json`) containing all non-deleted clinic data:

| Included | Excluded |
|---|---|
| Clinic profile + schedule + closures | `PatientRecord.encryptedData` (E2EE — server never holds plaintext) |
| Patients (demographics, contact, medical history) | User passwords, wrappedKey, keySalt |
| Services | |
| Appointments (full history + codes) | |
| Billing records + payments | |
| Audit logs (last 5,000 rows) | |

Every backup request creates a `BACKUP` audit log entry recording who triggered it, when, and row counts for each entity. This entry is visible in the Admin audit log UI.

**Usage:** Download and store the JSON file in a secure, access-controlled location (encrypted at rest). Label the file with the generation date and retain per your data retention policy.

### Application-Level Restore (MFA-Gated)

Restoring data at the database level is performed via the **Neon platform console** (point-in-time restore). The IntelliDent application provides a **two-factor authorization gate** that must be completed before any restore is executed:

**Step 1 — Request OTP**
`POST /api/super/clinics/[id]/restore/request-otp`
- Requires SUPERADMIN session + valid step-up (password already re-verified)
- Generates a 6-digit OTP (10-min expiry, bcrypt-hashed, 5-attempt limit)
- Sends OTP to the superadmin's registered email address via a high-priority alert email
- Returns `{ pendingToken, expiresIn: 600 }`

**Step 2 — Confirm with OTP**
`POST /api/super/clinics/[id]/restore/confirm`
```json
{
  "pendingToken": "<token from step 1>",
  "code": "<6-digit OTP>",
  "reason": "Production data loss — incident #XYZ",
  "snapshotDescription": "Neon PITR snapshot 2026-06-07T02:00:00Z"
}
```
- Validates OTP against the stored bcrypt hash
- Records a `RESTORE` audit log entry containing: `reason`, `snapshotDescription`, `confirmationToken`, `authorizedAt`, IP, and User-Agent
- Returns `{ confirmationToken }` — a 32-char hex token to use as the audit reference when executing the Neon restore

**Step 3 — Execute restore in Neon**
Using the `confirmationToken` as the audit reference, open the Neon console and perform the point-in-time restore. Document the token in your incident ticket.

**Authorization controls summary:**

| Control | Implementation |
|---|---|
| Identity verification | Active session (SUPERADMIN role) |
| Knowledge factor | Step-up password re-entry (15-min TTL) |
| Possession factor | Email OTP (6-digit, 10-min, 5-attempt limit) |
| Audit trail | `RESTORE` AuditLog entry with full metadata |
| Rate limiting | 5 OTP requests / 15 min per IP; 10 confirm attempts / 15 min per IP |

### E2EE Restore Limitation

`PatientRecord.encryptedData` **cannot be restored to a readable state from a server-side backup** — the plaintext was never held by the server. This is a deliberate security property of the E2EE architecture. Patients who have had records entered must re-submit data if a database restore is required that predates those records. This limitation must be disclosed to clinic administrators and documented in any data processing agreements per RA 10173.

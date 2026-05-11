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

## Multi-Factor Authentication (Email OTP)

MFA is enforced for **all users** on every sign-in. After credentials are verified, a 6-digit OTP is emailed and the user must enter it before a session is created.

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

## Account Lockout
Tracked on the `User` model via `failedLoginAttempts`, `lastFailedAt`, `lockedUntil`.
- **Threshold:** 5 failed attempts within 5 minutes
- **Lock duration:** 15 minutes
- Configurable via env vars: `LOCKOUT_MAX_ATTEMPTS`, `LOCKOUT_WINDOW_MINUTES`, `LOCKOUT_DURATION_MINUTES`
- Resets on successful login

## Email Verification on Sign-Up
- `POST /api/auth/sign-up` → validates input, generates E2EE key material client-side, stores everything in `EmailVerification` record (24h expiry). **Does NOT create a `User` yet.**
- A verification email with a tokenized link is sent via Gmail/nodemailer.
- `POST /api/auth/verify` → validates token, creates `User` + profile record (`Patient` / `Dentist` / `Receptionist`). Token is single-use.
- Model: `EmailVerification` (token, email, firstName, lastName, hashed password, wrappedKey, keySalt, clinicId, expiresAt)

## Password Reset & Change
- **Forgot password:** `POST /api/auth/forgot-password` → generates one-time token (10 min expiry), sends reset link via email. Always returns 200 to prevent email enumeration.
- **Reset password:** `POST /api/auth/reset-password` → validates token, enforces policy, checks history, generates fresh E2EE key material (old encrypted data is intentionally inaccessible), sends confirmation email.
- **Change password (authenticated):** `POST /api/auth/change-password` → requires current password verification, re-wraps existing master key with new KEK (encrypted data stays accessible), sends confirmation email.
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

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

## Account Lockout
Tracked on the `User` model via `failedLoginAttempts`, `lastFailedAt`, `lockedUntil`.
- **Threshold:** 5 failed attempts within 5 minutes
- **Lock duration:** 15 minutes
- Configurable via env vars: `LOCKOUT_MAX_ATTEMPTS`, `LOCKOUT_WINDOW_MINUTES`, `LOCKOUT_DURATION_MINUTES`
- Resets on successful login

## Email Verification on Sign-Up
- `POST /api/auth/sign-up` → validates input, generates E2EE key material client-side, stores everything in `EmailVerification` record (24h expiry). **Does NOT create a `User` yet.**
- A verification email with a tokenized link is sent via Mailjet.
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

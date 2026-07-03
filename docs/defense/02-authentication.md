# 02 — Authentication & Session Management

## What it is

A **custom-built**, session-based authentication system: password sign-in → mandatory email-OTP MFA → HMAC-signed cookie backed by a database session row. It also carries the E2EE key material handoff (the browser, not the server, decrypts patient data — see `05-records-e2ee.md`). We built it ourselves because no off-the-shelf auth library models our combination of MFA-gated key release, step-up re-auth, and per-clinic password policies.

## Flow 1 — Sign-up (email verification BEFORE account creation)

Files: `app/api/auth/sign-up/route.js` → `app/api/auth/verify/route.js`, UI in `app/modules/sign-up-page/`

1. User submits the form (with confirm-password and Terms of Service acceptance — `TermsDialog.jsx`).
2. Server sanitizes everything via `lib/validate.js`, rate-limits **10/hour per IP** (`lib/rateLimit.js`).
3. **No `User` row is created yet.** Instead an `EmailVerification` row stores the pending data. The emailed link carries a random 32-byte token; the DB stores only its **SHA-256 hash** (`sign-up/route.js` — `createHash('sha256')`), so a DB leak can't be replayed into account takeovers.
4. Clicking the link hits `GET /api/auth/verify`, which hashes the incoming token, looks it up, creates the real `User` + role profile, and **deletes** the verification row (single-use).
5. The user is redirected to `/sign-in?verified=success` — we deliberately do **not** auto-login, so the E2EE keys are always established through the normal sign-in path.

## Flow 2 — Sign-in with MFA (the flow you must know cold)

Files: `app/api/auth/sign-in/route.js` → `app/api/auth/verify-otp/route.js` → `lib/login.js` (`finalizeLogin`)

**Step A — credentials (`sign-in/route.js`):**
1. Parse + sanitize body (`parseJsonBody`, `sanitizeEmail`, `secret`).
2. Rate-limit check (**20 / 15 min per IP**) and user lookup run in parallel.
3. If the email doesn't exist → `bcrypt.compare` against a **dummy hash** anyway, so response time matches the real path (closes the timing side-channel), then return the same generic `Invalid email or password` as a wrong password (prevents **account enumeration**).
4. A currently-locked account also returns that same generic 401 — a locked account is indistinguishable from a bad password.
5. Wrong password → increment `failedLoginAttempts`; **5 failures within 5 minutes → locked 15 minutes** (env-tunable via `LOCKOUT_*`), `LOCKOUT` audit entry + warning email.
6. The deactivated-account check runs **after** password verification, so account status can't be probed without valid credentials.
7. Credentials valid → generate a 6-digit OTP with `crypto.randomInt`, store it **bcrypt-hashed** in the `MfaOtp` table with a 32-byte `pendingToken` and **10-minute expiry**, email the code, and respond with only `{ mfaPending: true, pendingToken }`.
8. **Crucially, `wrappedKey`/`keySalt` (E2EE key material) are withheld here.** A password-only attacker must not be able to exfiltrate the wrapped key and brute-force it offline — that would defeat MFA.

**Step B — OTP (`verify-otp/route.js`):**
1. Rate-limited **15 / 15 min per IP**; token validated as 64-char hex (`hexToken`).
2. Checks: OTP exists, not already used, not expired, fewer than **5 attempts**.
3. `bcrypt.compare` the code; on success mark `usedAt` (single-use) and re-check the clinic is still enabled.
4. Call `finalizeLogin()` and only now return `wrappedKey`, `keySalt`, and the RSA envelope keypair fields to the browser.

**Step C — `finalizeLogin()` (`lib/login.js`):** shared by sign-in and OTP verify so features can't drift:
- **Device fingerprinting:** SHA-256 of the User-Agent, stored in `KnownDevice`. A new device or an IP change on a known device flags the login as suspicious → `sendSuspiciousLoginAlert` email + `requiresStepUp: true` flag.
- **Single-session mode:** if the clinic enables `singleSessionEnabled`, all prior active `UserSession` rows are terminated.
- Creates the session (below), writes a `LOGIN` audit entry, and returns routing flags: `requiresTerms`, `mustChangePassword` (first-login staff), `passwordExpired` (per-clinic expiry policy).

## Sessions — two layers

Files: `lib/session-cookie.js`, `lib/auth.js`, `middleware.js`

1. **HMAC-signed cookie** — payload (userId, email, role, clinicId, flags) signed with `SESSION_SECRET`. If the secret is unset, verification **fails closed** (nobody authenticates). HttpOnly, so XSS can't read it.
2. **DB-backed `UserSession` row** — `getSession()` in `lib/auth.js` validates the cookie's session token against the DB on every request. This is what makes revocation instant: sign-out, role change, or deactivation terminates the row, and the still-valid-looking cookie is refused.

Lifetimes: **10 minutes** default, **3 days** with Remember Me, **8-hour absolute cap** regardless, **30-minute inactivity** auto-logout (`InactivityProvider`).

## Flow 3 — Password lifecycle

| Flow | Route | Key facts |
|---|---|---|
| Forgot password | `app/api/auth/forgot-password/` | Rate-limited 5/hour; reset token SHA-256-hashed at rest; 10-min expiry |
| Reset password | `app/api/auth/reset-password/` | **Generates fresh E2EE keys** — old encrypted data becomes inaccessible because the server never had the old key (this is the honest E2EE trade-off; record access heals via reshare — see `05-records-e2ee.md`) |
| Change password | `app/api/auth/change-password/` | Authenticated; **re-wraps** the existing master key under the new password, so no data is lost; blocks reuse of the **last 3** passwords (`PasswordHistory`); sets `passwordExpiresAt` when the clinic's expiry policy applies |
| Policy | client + server | 8+ chars, upper, lower, digit, special |
| Expiry | `Clinic.passwordExpiryEnabled/Days/Roles` | Per-clinic, per-role (30–365 days); expired accounts get redirected to `/change-password?reason=expired` |
| First login (staff) | `mustChangePassword` flag | Admin-created staff receive a random temp password and are forced to change it |

## Flow 4 — Step-up re-authentication

File: `app/api/auth/step-up/route.js` (+ `send-otp/` for OTP generation)

Sensitive actions require proving identity **again** mid-session (15-minute grant via `grantStepUp()` in `lib/auth.js`):
- **OTP mode** (`OtpStepUpModal`) — required to open patient records; resets on every page navigation.
- **Password mode** (`StepUpModal`) — required for audit/report exports and super-admin backups.
Both modes are rate-limited and audit-logged (`action: VERIFY, entity: StepUp`).

## Key files table

| File | Role |
|---|---|
| `app/api/auth/sign-in/route.js` | Credentials, lockout, enumeration defenses, OTP issuance |
| `app/api/auth/verify-otp/route.js` | OTP check, key-material release, session creation |
| `lib/login.js` | `finalizeLogin` — device fingerprint, suspicious detection, session, flags |
| `lib/session-cookie.js` | HMAC sign/verify of the cookie (fails closed) |
| `lib/auth.js` | `getSession` (DB validation), `setSession`, `grantStepUp`, `getAuthContext` |
| `lib/rateLimit.js` | DB-backed per-IP limiter (`RateLimit` model) |
| `lib/validate.js` | `parseJsonBody` (16 KB cap), `sanitizeEmail`, `secret`, `hexToken`, `bool` |
| `app/api/auth/step-up/route.js` | OTP + password re-auth modes |
| `app/providers/InactivityProvider.jsx` | 30-min idle logout |
| `app/modules/verify-otp-page/` | OTP entry UI |

## Technologies & why

- **bcrypt** for passwords and OTP hashes — deliberately slow, salted; cost 10 for passwords, cost 8 for short-lived OTPs.
- **HMAC (SHA-256)** cookie signature — tamper-evident without server-side lookup on the middleware fast path.
- **`crypto.randomInt` / `crypto.randomBytes`** — CSPRNG for OTPs and tokens (never `Math.random`).
- **DB-backed rate limiting** instead of in-memory — serverless functions don't share memory, so counters must live in Postgres.

## Mock Panel Q&A

**Q: Why did you build custom auth instead of using NextAuth/Auth.js?**
A: Three requirements NextAuth doesn't model: (1) E2EE key material must be released only after MFA succeeds, inside the login response; (2) step-up re-auth with two modes and a 15-minute grant; (3) per-clinic policies (password expiry per role, single-session mode). Building it ourselves also let us implement enumeration-resistant responses and demonstrate the security engineering this capstone is about. The building blocks (bcrypt, HMAC, CSPRNG) are standard, audited primitives — we didn't invent cryptography.

**Q: How do you prevent brute-force attacks?**
A: Four layers. Per-IP rate limiting (20 sign-ins / 15 min, DB-backed so it works across serverless instances). Per-account lockout (5 fails / 5 min → 15-min lock). bcrypt makes each guess expensive. And MFA means a correct password alone still gets nothing — not even the wrapped encryption key.

**Q: Can an attacker tell whether an email is registered?**
A: No. Unknown email, wrong password, and locked account all return the byte-identical generic 401. We even run bcrypt against a dummy hash on the unknown-email path so response timing matches.

**Q: Why is the OTP hashed with bcrypt? It's only 6 digits.**
A: A 6-digit code has only a million possibilities, so a leaked plaintext OTP table would be trivially abused. Hashing plus a 5-attempt counter, 10-minute expiry, and single-use marking means the online guessing chance is 5 in a million per login.

**Q: If the cookie is signed, why also store sessions in the database?**
A: Signatures prove integrity, not currency. A signed cookie alone can't be revoked before it expires. The `UserSession` row gives us instant revocation — sign-out, role change, deactivation, or single-session takeover all kill the row and the cookie becomes useless on the next request.

**Q: What happens if `SESSION_SECRET` is missing in production?**
A: Authentication fails closed — `lib/session-cookie.js` refuses to verify any cookie, so nobody gets in. We chose an outage over silently accepting unsigned cookies.

**Q: A user resets a forgotten password — why do they lose access to old encrypted data?**
A: Because the master key was wrapped under the old password and the server never possessed it — that's the definition of E2EE. Reset generates fresh keys. For patient records specifically, access heals: the envelope scheme lets a dentist or the patient re-wrap the record's content key to the new public key on next access (`reshareRecord` in `lib/clientKeys.js`).

**Q: What stops session hijacking?**
A: HttpOnly cookie (XSS can't read it), HMAC signature (can't be forged), strict CSP from middleware (inline scripts can't run), short 10-minute TTL with an 8-hour hard cap, device fingerprinting that flags new devices/IPs and demands step-up, and instant DB-side revocation.

**Q: Why email OTP for MFA instead of an authenticator app or SMS?**
A: Fit for the user base. Every patient already verified an email address at sign-up, so there's no enrollment friction, no smartphone requirement, and no SMS cost or SIM-swap exposure. TOTP apps are stronger in theory but would exclude less technical patients; the trade-off is documented and the OTP itself is hardened (hashed, 10-min, 5 attempts, single-use).

**Q: If MFA rides on email, what happens when the email account itself is compromised?**
A: That attacker still needs the password — email alone can't log in, and the password reset path deliberately destroys E2EE keys, so record plaintext isn't reachable that way either. Residual signals: suspicious-device alerts, LOGIN/LOCKOUT audit entries, and the breach-scan heuristics. Email compromise is explicitly in our threat model as the strongest single attack, which is why the two factors are password *and* mailbox, not mailbox twice.

**Q: How do you defend against CSRF?**
A: The session cookie is set `sameSite: 'lax'` (plus `httpOnly` and `secure` in production — `lib/auth.js`), so browsers won't attach it to cross-site POSTs — which is where all our state-changing routes live. On top of that, every mutating route requires a JSON body parsed by `parseJsonBody`, which a classic HTML-form CSRF can't produce.

**Q: Rate limiting and account lockout sound like the same thing — why both?**
A: Different axes. Rate limiting is **per IP** and protects the whole endpoint (one attacker spraying many accounts). Lockout is **per account** and protects one victim from many IPs (a distributed attack on a single user). The breach scan then covers the diagonal: one IP causing lockouts on 3+ different accounts raises a BREACH_ALERT.

**Q: You store password history — isn't keeping old hashes a liability?**
A: We keep only the last 3 bcrypt hashes, which are as hard to reverse as the current one. The alternative — allowing instant reuse — makes forced rotation meaningless: users would flip back to the compromised password. Standard, accepted trade-off.

**Q: Isn't a 10-minute session absurdly short?**
A: It's a rolling window, not a stopwatch — activity refreshes it, so a working receptionist never notices. What it guarantees is that an *abandoned* session dies within 10 minutes. Users who opt in get 3 days via Remember Me, but nobody escapes the 30-minute inactivity logout or the 8-hour absolute cap.

**Q: Where are passwords ever visible in plaintext?**
A: Only in the browser's memory during the request, and in transit inside TLS. The server receives it, immediately bcrypt-compares or bcrypt-hashes it, and never logs or stores it. Client-side, the password additionally seeds PBKDF2 for the E2EE keys — also in memory only.

---
Further reading: [`docs/security.md`](../security.md) (§ sessions, § MFA, § lockout).

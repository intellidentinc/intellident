# Security controls

Updated November 6, 2026. These controls supersede the historical assessment in security-review-2026-11-01.md.

## Sessions and access

Cookies are HMAC signed, HTTP-only, SameSite Lax, and Secure in production. Authenticated requests validate the database session, user identity, current role, active/deleted status, selected clinic, and patient enrollment where applicable. Role mismatches invalidate old cookies. Disabled/deleted clinics cannot be accessed by regular users.

Idle expiry is enforced in the database: ten minutes normally, or up to three days with Remember Me, always capped by an eight-hour absolute session lifetime. Browser cookies expire at the absolute deadline; ordinary requests renew only database idle expiry. Notification polling does not renew idle expiry. Clinic switching, terms acceptance, and profile updates preserve the original absolute deadline. Middleware never reissues stale signed cookies during ordinary requests.

Role/status changes, password changes, and password resets revoke all affected database sessions, unused MFA challenges, and recovery tokens. Expired password policies and first-login password changes restrict direct API requests as well as page navigation. Terms acceptance is also enforced server-side. Authentication database failures return 503 instead of allowing access.

Session creation locks the user credential row and checks the password hash verified by MFA before issuing a token. Credential changes and single-session logins therefore serialize against session issuance. Authenticated session rotation requires a still-valid previous token and preserves its absolute deadline.

## Login identity

The global login email is read-only in both patient administration and profile editing. Changing a clinic contact field must not change the global login identity. A future email-change feature must verify account ownership and the replacement mailbox, notify the previous address, and revoke sessions and pending challenges. Do not change login email through ad hoc database edits without a verified recovery procedure.

## MFA and step-up

Login, record-access step-up, and restore challenges share the existing table but store a SHA-256 digest of a random token and its purpose/context. The raw token is returned only to the initiating client. Step-up tokens are bound to the initiating session; restore tokens are additionally bound to the target clinic. A challenge issued for one purpose cannot authorize another.

OTP hashes include a fingerprint of the account credential/status context. A password, role, email, or account-status change invalidates older challenges. Verification uses a PostgreSQL transaction advisory lock, with atomic attempt increments and single-use consumption. The maximum is five failed attempts, with a ten-minute expiry.

Record and record-transfer access require an OTP step-up grant. Audit/report exports and administrator backup/restore require a password step-up grant. Grants last fifteen minutes and cannot be substituted across these policies. Starting a different grant may require reauthentication for the previous action.

The password needed to unlock client keys during MFA stays only in a bounded in-memory module. It is not written to browser storage. Refreshing the MFA page requires restarting sign-in. Password-reset token consumption, credential mutation, stale record-wrap removal, and session revocation are transactional.

## Rate limits and proxy trust

Password verification and login failure/success updates serialize on the user row. Concurrent failed sign-ins cannot overwrite each other's attempt counts, and a queued request cannot clear an active lockout. Invalid lockout environment settings fall back to the documented defaults (five attempts, five-minute window, fifteen-minute lockout).

Password changes are limited before password comparison to five requests per account and twenty per client IP in fifteen minutes. The account limit applies across sessions and IP changes.

Rate limits serialize each key in PostgreSQL before checking or creating a window, including concurrent first requests. Existing duplicate windows count toward the budget. Authentication endpoints, public document/application submissions, AI chat, and AI slot recommendations are limited.

On Vercel, infrastructure-provided forwarded headers are trusted. Other reverse-proxy deployments must set TRUST_PROXY_HEADERS=true only when the proxy sanitizes the header and appends the real client IP. The rightmost IP is validated with Node isIP; untrusted or invalid headers use a shared unknown-client bucket, never a caller-selected identity.

## Record encryption and files

Patient-specific record creation, recipient lookup, reshare, history, and attachment upload/deletion require a current OTP step-up grant, as do record reads, edits, and deletion. Missing, expired, future-dated, or password-mode grants return 403 with requiresStepUp before record or storage operations. The treating-patient directory remains available before step-up; opening a patient's records prompts for verification.

Record notes use browser-side AES-GCM content keys wrapped to authorized RSA recipients. The server stores ciphertext and wrapped keys. File attachments are not end-to-end encrypted; their confidentiality depends on private storage and short-lived signed URLs.

Keypair provisioning atomically fills null fields only for the expected wrapped-master-key context. Competing clients receive the canonical stored pair, and clients fail rather than adopting unpersisted keys. Reset removes the old record wraps for the reset account so another authorized holder can reshare to the new pair. Records with no remaining decrypting holder cannot be recovered by the server.

Uploads verify that their Supabase bucket is private and fail with 503 if privacy cannot be established. Expired record retention deletes storage objects before database attachment references. Storage failures retain references for retry; individual attachment deletion similarly fails instead of silently discarding its retry information.

## Payments and exports

Payment writes lock the billing row before reading and calculating totals. Provider-payment IDs also acquire an advisory lock, preventing duplicate concurrent processing without a schema migration. Distinct real payments are retained even if they overpay an already-paid bill; manual payments cannot exceed the current balance. Amounts must be positive finite whole centavos. Webhooks validate the configured test/live signature and a numeric timestamp.

CSV text cells neutralize formula prefixes after leading whitespace/control characters. Numeric cells remain numeric. Reports, audit exports, and billing exports use the shared encoder.

AI slot recommendations are limited per user and clinic before provider calls. Provider requests use an abort signal, a fifteen-second timeout, and no automatic retries for slot generation. Timeout fallback does not leave an unbounded background request.

## Backups and restore

Administrator backups contain password hashes, encrypted key blobs, demographics, appointments, billing, and reference audit logs. They exclude PatientRecord notes and RecordKey envelopes. Backups are sensitive credential-bearing JSON artifacts; restrict access and encrypt them at rest. They are not cryptographically signed by the application.

In-app restore requires a password step-up grant followed by a restore OTP bound to the session and clinic. The operator uploads a matching-clinic JSON backup, code, token, and reason. Restore validates ownership and performs transactional upserts through importClinicBackup; it actually writes data and does not merely authorize a Neon operation. Audit logs from a backup are not re-imported. Neon PITR is a separate infrastructure recovery process.

## Bootstrap and deployment

- Demo seed scripts refuse production and require ALLOW_DEMO_SEED=true plus SEED_PASSWORD.
- Administrator bootstrap requires ALLOW_ADMIN_BOOTSTRAP=true plus SEED_ADMIN_PASSWORD.
- Bootstrap passwords require at least twelve characters, uppercase, lowercase, number, and symbol. New accounts must change them at first login. Scripts no longer print passwords.
- Rotate previously seeded/default credentials and existing secrets through the verified operational process; changing source does not rotate deployed credentials.
- Verify clinic-documents and record-attachments are private in the actual Supabase project. Review legacy orphan files separately; already-deleted database references cannot identify their storage objects.
- Deploy the updated application and lockfile together. In-progress challenges using the previous unscoped format must restart. No database schema migration is required.
- Validate session revocation, two-clinic ownership, concurrent OTP/reset/payment requests, key reset/reshare, upload privacy failures, and storage deletion retries in an isolated staging database before production rollout.

## Dependency and lint maintenance

Next.js and Nodemailer use patched releases. The old global glob override and ESLint chain have been removed. npm run lint runs Oxlint with native React, hooks, accessibility, and Next.js checks; compiler/style diagnostics remain warnings so the security fix does not require a UI rewrite. See .oxlintrc.json for the explicit error-level rules. Use Node 22.12+ for the tooling.

Run npm run test:security, full and production-only npm audit, npm run lint, and npm run build after security or dependency changes. The security regression suite isolates external services; live PostgreSQL concurrency and browser flows still need staging validation. A clean audit reflects the registry at the time of checking and does not establish that the application has no unknown vulnerabilities.

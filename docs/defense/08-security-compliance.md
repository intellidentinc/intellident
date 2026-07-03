# 08 — Security Controls & Compliance (RA 10173, ISO 27001, NIST CSF)

## What it is

The direct answer to capstone **Objective 6**: how the system aligns with the **Data Privacy Act of 2012 (RA 10173)**, **ISO/IEC 27001 principles**, and the **NIST Cybersecurity Framework**. This file maps each framework to the concrete control and its file. (Auth controls are detailed in `02`, access control in `03`, E2EE in `05` — this file ties them to compliance language and covers the remaining controls: audit, retention, DSAR, breach detection, backup/restore, input sanitization, pentesting.)

## RA 10173 — Data Privacy Act of 2012

| DPA requirement | Our control | Where |
|---|---|---|
| Lawful basis / consent | Mandatory Terms of Service acceptance at sign-up and clinic application; `termsAcceptedAt` on User; login re-gates until accepted | `TermsDialog.jsx` (`app/modules/sign-up-page/`), `app/api/auth/accept-terms/` |
| **Data subject rights** (access, correction, erasure) | DSAR module: patients file ACCESS / CORRECTION / DELETION requests; admins resolve them, all tracked | `app/api/data-requests/` (`DataRequest` model), Settings UI |
| Proportional security of sensitive personal information | Health records are E2EE — the strongest proportionality argument available | `05-records-e2ee.md` |
| Storage limitation / retention | Per-clinic configurable retention for audit logs, patient records, billing (`Clinic.*RetentionDays`, null = keep forever); daily purge cron deletes soft-deleted data past retention (cascading RecordHistory/Attachment/Payment) | `app/api/cron/audit-purge/route.js`, `ClinicDataRetentionSettings.jsx` |
| Breach detection & notification duty | Daily breach-scan cron detects: distributed brute force (one IP locking 3+ accounts), mass record access (100+ views/24 h by one user), bulk export (5+/24 h); writes `BREACH_ALERT` audit entries and **emails clinic admins** | `app/api/cron/breach-scan/route.js` |
| Accountability | Every sensitive action audit-logged with actor, IP, user agent, metadata | `lib/audit.js` + below |

## Audit logging — the accountability backbone

- `logAudit()` (`lib/audit.js`) is called from **33 API route files** — logins (success/fail/lockout), record access, exports, backups, restores, payments, super-admin entry, step-up verifications, breach alerts.
- Fire-and-forget by design: an audit-write failure never breaks the user's request (availability), while `getRequestMeta()` takes the **rightmost** `X-Forwarded-For` value — set by Vercel, not forgeable by clients — so attackers can't spoof their logged IP or dodge rate limits.
- Admin UI: `/[clinicId]/audit-log` (`app/modules/audit-log-page/`) — filters by action/entity/date/search, expandable rows, **CSV + PDF export up to 5,000 rows** (`app/api/audit-log/export/`, step-up password required).
- `AuditLog` rows are clinic-scoped like everything else; retention is per-clinic configurable.

## Input-layer defenses

- **`lib/validate.js`** on all auth routes before any DB call: 16 KB JSON body cap (`parseJsonBody`), `sanitizeEmail` (RFC format, ≤254, lowercased), `secret` (no trim, length-capped), `hexToken` (`/^[a-f0-9]{64}$/`), `bool` (literal true only).
- **SQL injection:** Prisma parameterizes every query — there is no string-concatenated SQL (verified with sqlmap during testing).
- **XSS:** React escapes output by default + the middleware's per-request **nonce + `strict-dynamic` CSP** blocks injected inline scripts.
- **Rate limiting** (`lib/rateLimit.js`, DB-backed): sign-in 20/15 min, sign-up 10/h, forgot-password 5/h, verify-otp 15/15 min, clinic applications 5/h, document uploads 50/h.
- **Upload safety:** clinic-application documents get **magic-byte type detection** (not just extension), compressed-archive rejection, 5 MB cap (`lib/clinicDocs.js`); orphaned uploads purged after 48 h by the orphan-docs cron.

## Backup & restore (NIST "Recover")

- **Backup:** `GET /api/super/clinics/[id]/backup` — super admin only, **step-up password required**, JSON snapshot of profile/patients/services/appointments/billing/audit logs (last 5,000). **Explicitly excludes E2EE record notes** — a backup can't become a plaintext leak. Audit-logged as `BACKUP`.
- **Restore:** 3-step OTP flow (`RestoreModal.jsx`): request OTP (rate-limited 5/15 min, emailed) → confirm → returns a confirmation token for a Neon point-in-time restore. Audit-logged as `RESTORE`. Database-level PITR is Neon's native capability.

## ISO/IEC 27001 principles → controls

| ISO domain | Controls |
|---|---|
| Access control (A.9-style) | RBAC, MFA every login, lockout, step-up re-auth, password policy/history/expiry, instant revocation (`02`, `03`) |
| Cryptography | AES-GCM-256, PBKDF2-210k, RSA-OAEP-2048, HMAC cookies, SHA-256-hashed tokens at rest, bcrypt (`05`, `02`) |
| Operations security | Rate limiting, input sanitization, CSP, cron-secret-protected jobs, fail-closed secrets handling |
| Logging & monitoring | Audit log + breach-scan + suspicious-login device fingerprinting |
| Supplier/communications | HMAC-verified PayMongo webhooks; hosted checkout keeps card data out of scope |
| Business continuity | Backup export, OTP-confirmed PITR restore, keep-alive cron |

## NIST CSF — the five functions (rehearse as a list)

- **Identify** — data models classify sensitivity (E2EE fields vs operational data); audit log + reports give asset/activity visibility.
- **Protect** — E2EE, RBAC + multi-tenancy, MFA, session hardening, CSP, rate limits, input sanitization, upload validation.
- **Detect** — breach-scan cron (3 detection rules), `contentHash` tamper detection, suspicious-login device/IP fingerprinting, failed-login audit trail.
- **Respond** — automatic admin email alerts, account lockout, instant session termination, step-up challenges on suspicious logins, clinic disable switch.
- **Recover** — clinic backup export, Neon point-in-time restore with OTP ceremony, keep-alive to prevent DB sleep.

## Adversarial validation — the pentest program

We tested the system as attackers before the panel could ask (controlled environment only):
- **Plan & matrices:** `docs/security-testing-plan.md`, `docs/pentest-test-matrix.md`, `docs/pentest-priority-test-procedure.md`.
- **Tools:** Burp Suite (auth/session/XSS/IDOR replay across roles and clinics), sqlmap (injection sweep of API params), Hydra (brute-force to validate lockout + rate limits).
- **Findings & fixes:** `docs/security-findings.md`; remediations are visible in git history (`fix: security patches`, `fix: E2EE patch`, `fix: backup and restore patch`, `fix: additional git restrictions`).

## Key files table

| File | Role |
|---|---|
| `lib/audit.js` | `logAudit` (fire-and-forget) + anti-spoof `getRequestMeta` |
| `app/api/audit-log/` + `export/` | Query + CSV/PDF export (ADMIN, step-up) |
| `app/api/cron/breach-scan/route.js` | 3 breach heuristics → BREACH_ALERT + admin email |
| `app/api/cron/audit-purge/route.js` | Retention enforcement |
| `app/api/data-requests/` | DSAR (ACCESS/CORRECTION/DELETION) |
| `app/api/super/clinics/[id]/backup/` + `restore/` | Backup export + OTP restore |
| `lib/validate.js`, `lib/rateLimit.js`, `lib/secureCompare.js` | Input, rate, timing defenses |
| `middleware.js` | CSP nonce + strict-dynamic |
| `docs/security.md` | The authoritative 591-line security spec |

## Mock Panel Q&A

**Q: How does the system comply with the Data Privacy Act specifically?**
A: By implementing its operative duties, not just citing it: consent capture with re-gating, a working DSAR workflow for access/correction/deletion requests, proportional security via E2EE of health data, configurable retention with automated purge, breach detection with admin alerting to support the 72-hour NPC notification duty, and a complete audit trail for accountability.

**Q: You're students — you can't be ISO 27001 *certified*. What do you mean by "aligned"?**
A: Correct — certification audits organizations, not code. We aligned with the standard's control themes: for each relevant domain (access control, cryptography, operations security, logging, continuity) we can point to a concrete implemented control and its file. The claim is engineering alignment, and we can walk any control from policy statement to code.

**Q: Walk me through NIST CSF in your system in one minute.**
A: (Use the five-function list above — one sentence each, each with a named feature.)

**Q: How would you actually know if a breach happened?**
A: Three automated detectors run nightly: one IP locking out 3+ accounts (distributed brute force), any user viewing 100+ records in 24 h (mass access), and 5+ exports in 24 h (bulk exfiltration). Each writes a BREACH_ALERT audit entry and emails the clinic's admins. Underneath, every failed login, record view, and export is already in the audit log for forensics, and suspicious-device logins trigger real-time email alerts plus a step-up challenge.

**Q: Can the audit log itself be tampered with?**
A: There's no API that updates or deletes audit rows — only creation and admin-scoped reads; purging happens solely through the retention cron. Writes are server-side only with the client-unforgeable rightmost X-Forwarded-For IP. Within the app's threat model the trail is append-only; direct-DB tampering is countered at the data layer by `contentHash` on records, and DB credentials never ship to clients.

**Q: What did your penetration testing actually find?**
A: (Summarize 2–3 items from `docs/security-findings.md` honestly — e.g. issues found and patched in the commits `fix: security patches`, `fix: E2EE patch` — and state what the retest showed.) The point to land: we tested with Burp, sqlmap, and Hydra against our own deployment, filed findings like a real engagement, fixed them, and retested.

**Q: Why is the audit write fire-and-forget — isn't losing an audit entry bad?**
A: It's an availability/integrity trade-off made consciously: a logging outage must not block patient care operations. Loss is rare (a failed single-row insert), the security-critical events also have secondary signals (lockout state, breach scan, emails), and the alternative — clinic operations failing whenever logging hiccups — is worse.

**Q: Where does patient data physically live, and is that lawful?**
A: Neon PostgreSQL and Vercel in Singapore (`sin1`), Supabase for files. RA 10173 permits offshore processing when the controller remains accountable and protections are adequate — and our E2EE means the most sensitive content is ciphertext to every one of those providers.

**Q: Map your system to the OWASP Top 10.**
A: Broken Access Control — the zero-trust chain + object-level checks, Burp-tested cross-role/cross-clinic. Cryptographic Failures — E2EE, bcrypt, hashed tokens at rest, HMAC cookies. Injection — Prisma parameterization (sqlmap-verified) + `lib/validate.js`. Insecure Design — threat-modeled features like MFA-gated key release. Security Misconfiguration — strict CSP, fail-closed secrets. Vulnerable Components — minimal dependency surface, native Web Crypto. Auth Failures — MFA, lockout, rate limits, enumeration resistance. Integrity Failures — `contentHash`, signed webhooks. Logging Failures — 33 routes audit-logged + breach scan. SSRF — no user-supplied URL fetching anywhere.

**Q: Under RA 10173, who is your Data Protection Officer and where is your privacy notice?**
A: Those are organizational obligations of the clinics as personal-information controllers — a capstone team can't hold them. What we built is the *technical* substrate those obligations need: the ToS/consent capture at sign-up, the DSAR workflow the DPO would operate, retention configuration, breach alerting, and audit trails. Deployment guidance for a real clinic includes designating a DPO and registering with the NPC.

**Q: A breach is confirmed — walk me through your incident response.**
A: Detect: breach-scan alert or suspicious-login email. Contain: disable the affected clinic (middleware blocks it within 60 s), deactivate compromised accounts — both instantly terminate sessions; rotate `SESSION_SECRET` to invalidate every cookie platform-wide. Assess: the audit log reconstructs who touched what, from which IP, when; E2EE bounds record exposure to authorized key holders. Notify: the BREACH_ALERT email to admins starts the clock for the NPC's 72-hour notification. Recover: Neon point-in-time restore via the OTP ceremony if data was altered. Learn: findings feed the same fix-and-retest loop as our pentest.

**Q: Your breach thresholds (100 views, 5 exports) — why those numbers, and can't an attacker stay under them?**
A: They're clinic-scale heuristics — a dentist reviewing a day's patients views dozens of records, never hundreds; admins export occasionally, not five times daily. A slow attacker under the thresholds is still fully recorded in the audit log for retrospective analysis, still needs valid MFA'd credentials, still trips the suspicious-device alert on first login, and record access additionally demands step-up OTP each session. The cron is a tripwire, not the only fence.

**Q: How do you secure your own development pipeline — secrets, dependencies, git?**
A: Secrets live only in Vercel environment variables and local `.env` files that are git-ignored — never committed; the code fails closed when they're absent (session verification, webhook acceptance). Dependency surface is kept deliberately small — crypto is browser-native Web Crypto, not an npm package. Git history went through a cleanup pass for accidental artifacts (`fix: additional git restrictions`), and the deployed branch is what was pentested.

**Q: What security work would you do next if you had another semester?**
A: In priority order: database exclusion constraints to make the appointment conflict check race-proof at the SQL layer; migrating money columns from Float to Decimal; WebAuthn/passkeys as a stronger MFA option; an append-only external audit sink (hash-chained) to harden the trail against DB-level tampering; and automated dependency scanning in CI. Naming these shows we know the boundary of what we built — each was consciously deferred, not missed.

---
Further reading: [`docs/security.md`](../security.md), [`docs/security-findings.md`](../security-findings.md), [`docs/security-testing-plan.md`](../security-testing-plan.md).

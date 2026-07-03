# 11 — How Each Specific Objective Was Accomplished

The direct, evidence-backed answer to "did you meet your objectives?" — one section per specific objective, each with the claim, the mechanism, and the exact files that prove it. Use this file when writing the defense presentation's results section and when a panelist reads an objective aloud and asks "show me."

---

## Objective 1 — Appointment scheduling with conflict prevention

> *To design an appointment scheduling system that allows patients and authorized clinic personnel to create, confirm, reschedule, and cancel appointments while preventing schedule conflicts and maintaining organized clinic workflows.*

**Accomplished.** The system implements the full appointment lifecycle for every actor, with server-side conflict prevention on every write path.

- **Create/confirm/reschedule/cancel:** Staff manage appointments through `app/api/appointments/route.js` and `app/api/appointments/[id]/route.js`, driven by the UI in `app/modules/appointments-page/` (`CreateAppointmentModal`, `RescheduleAppointmentModal`, `CancelAppointmentModal`, `AppointmentDetailModal` with a full status-history timeline). Patients self-book via `app/api/schedules/route.js` and can cancel their own PENDING/CONFIRMED bookings; dentists get a read-only calendar via `app/api/schedule/`.
- **Conflict prevention:** the POST handler enforces a five-step validation pipeline documented at the top of `app/api/appointments/route.js` — working day, closure dates, open hours, then dentist overlap detection: an appointment is rejected with **HTTP 409** if any non-cancelled appointment satisfies `scheduledAt < endsAt AND endsAt > scheduledAt`. End time is computed server-side as `scheduledAt + duration + bufferTime`, so buffer periods between patients are also protected.
- **Organized workflow:** a strict status state machine (PENDING → CONFIRMED → COMPLETED / CANCELLED / NO_SHOW / RESCHEDULED, terminal states locked), auto-generated reference codes (`APT-{CODE}-{DATE}-{####}`), a pending-requests badge on the sidebar, calendar Day/Week/Month/List views (`react-big-calendar`), and automatic in-app + email notifications on every transition (`lib/notifications.js`) plus 24h/2h cron reminders (`app/api/cron/reminders/route.js`).

*Deep dive: `04-appointments.md`.*

---

## Objective 2 — Centralized encrypted patient record, treatment, and billing database

> *To create a patient record system supported by a centralized encrypted database for managing patient information, treatment records, and billing data.*

**Accomplished, and beyond the stated scope** — the database is not just centrally encrypted at rest (Neon PostgreSQL); clinical notes are **end-to-end encrypted**, so even the server never sees plaintext.

- **Centralized database:** a single PostgreSQL (Neon) instance via Prisma holds all three clinics' patients, records, and billing (`prisma/schema.prisma`), with per-clinic logical separation (Objective 5).
- **Encryption:** `PatientRecord` carries `encryptedData`, `dataIv`, and `contentHash` fields. `lib/crypto.js` implements AES-GCM-256 with PBKDF2 (210,000 iterations) key derivation in the browser via the Web Crypto API, and `lib/recordCrypto.js` adds an RSA-OAEP-2048 envelope: each record gets a per-record content key wrapped to every authorized reader, with the `patientId` bound as AAD so ciphertext cannot be transplanted onto another patient's record. The server re-derives the authorized reader set on every write in `lib/records-access.js` and never trusts the client's list.
- **Integrity:** SHA-256 `contentHash` is computed on every write and re-verified on every read, surfacing a tamper warning on mismatch.
- **Treatment + billing data:** dentists manage records at `/records` (gated by a treating relationship — `dentistTreatsPatient()` requires a CONFIRMED/COMPLETED appointment); patients view their own at `/my-records`. Billing is a full module: `Billing`/`Payment` models, auto-billing on appointment completion, cash payments, PayMongo online checkout with an HMAC-verified idempotent webhook (`app/api/webhooks/paymongo/`), and PDF receipts.

*Deep dives: `05-records-e2ee.md`, `07-billing-payments.md`.*

---

## Objective 3 — AI-powered scheduling with duration calculation and slot assignment

> *To integrate AI-powered scheduling that calculates service duration and assigns the suitable available time slot to prevent overlapping appointments.*

**Accomplished.**

- **Duration calculation:** `lib/slots.js` is the single source of truth for availability. It sums `duration + bufferTime` across all selected services, generates 30-minute candidate slots that fit entirely within opening hours, and filters out closures, non-working days, past times (with a 30-min same-day buffer), and existing appointment conflicts — all in Asia/Manila time.
- **AI slot assignment:** `app/api/ai/slots/route.js` feeds those conflict-free slots to OpenAI `gpt-5-mini` via `generateJSON()` (`lib/ai.js`), which ranks and tags the top 3–5 ("Best match", "Earliest available", "Lowest conflict risk") with a one-sentence reason each. Critically, the AI can only choose from the pre-validated slot list — its output is filtered with `slots.includes(s.time)` — so an AI suggestion can never produce an overlapping appointment. A deterministic algorithmic fallback kicks in on timeout (15 s) or error, so the feature degrades gracefully.
- **Supporting predictor:** a no-show-risk endpoint (`app/api/ai/risk/[patientId]/`) flags high-risk patients (past no-shows ≥ threshold, or last-minute booking under 24 h) to support staff scheduling decisions.

*Deep dive: `06-ai-features.md`.*

---

## Objective 4 — Always-available virtual assistant

> *To provide a virtual assistant that is available at any time within the system to assist patients with inquiries, appointment needs, and basic consultation support based on clinic-defined rules.*

**Accomplished.**

- A floating chat button + Framer Motion drawer (`app/modules/ai-chat/`) is mounted on authenticated pages, giving 24/7 access within the system.
- The backend (`app/api/ai/chat/route.js`) runs multi-turn conversations with `gpt-5` via `chatWithTools()` in `lib/ai.js`, persisting sessions per user (`GET/POST /api/ai/chat`, `[sessionId]` retrieve/delete).
- **Clinic-defined rules are enforced, not requested:** the system prompt (`lib/ai-prompt.js`) is built from the caller's clinic and role, and the assistant's data access goes through role-scoped tools in `lib/ai-tools.js` — `getToolsForRole()` gives a patient only tools like `get_my_appointments`, while every tool executor query is bound to the session's `userId` and `clinicId` server-side. The chatbot therefore answers inquiries, checks appointments, and gives basic guidance without ever being able to read outside the caller's own authorization boundary.

*Deep dive: `06-ai-features.md`.*

---

## Objective 5 — Multi-tenant separation and zero trust

> *To enforce multi-tenant data separation and zero trust access principles, allowing each clinic to access only its own data.*

**Accomplished.** Every request passes through the same chain: **session → role → clinicId → permission → audit log.**

- **Session verification on every request:** an HMAC-signed cookie (`lib/session-cookie.js`, fails closed if `SESSION_SECRET` is unset) plus DB-backed `UserSession` validation in `lib/auth.js` — a token isn't trusted just because it's signed; it must still exist server-side, which is what makes role changes and sign-outs take effect immediately.
- **Tenant scoping:** `clinicId` appears throughout the schema (49 references in `prisma/schema.prisma`), and every API query filters by the session's `clinicId` — patients, appointments, billing, records, notifications, even chatbot tool calls. `middleware.js` additionally verifies the clinic in the URL matches the session, blocks disabled clinics, and applies a nonce-based strict CSP.
- **Least privilege on top of tenancy:** five roles (SUPERADMIN/ADMIN/DENTIST/RECEPTIONIST/PATIENT) enforced per-route; dentists additionally need a treating relationship to open a record (`lib/records-access.js`); step-up re-authentication (15-min TTL, OTP or password mode) is required for record access, exports, and backups. Cross-tenant access is also **cryptographically impossible** for record contents — a user outside the authorized reader set holds no wrapped content key to decrypt with.

*Deep dive: `03-rbac-multitenancy.md`.*

---

## Objective 6 — RA 10173, ISO/IEC 27001, and NIST CSF alignment

> *To align the system with applicable data protection and cybersecurity standards, including the Data Privacy Act of 2012 (RA 10173), ISO/IEC 27001 principles, and the NIST Cybersecurity Framework, to support lawful and accountable handling of patient data.*

**Accomplished**, with concrete controls mapped to each framework:

- **RA 10173 (Data Privacy Act):** data subject access rights via the DSAR module (`app/api/data-requests/` — ACCESS/CORRECTION/DELETION requests with admin resolution); explicit consent through mandatory Terms of Service acceptance on sign-up and clinic application; per-clinic configurable retention with automated purge (`app/api/cron/audit-purge/`); proportional security through E2EE of health data; and breach notification support via the daily breach-scan cron (`app/api/cron/breach-scan/`) that detects distributed brute-force, mass record access, and bulk export, then writes `BREACH_ALERT` entries and emails clinic admins.
- **ISO/IEC 27001 principles:** access control (RBAC + MFA email OTP on every sign-in + account lockout + password policy/history/expiry), cryptography (AES-GCM-256, RSA-OAEP, SHA-256-hashed reset tokens at rest), operations security (rate limiting via `lib/rateLimit.js`, input sanitization via `lib/validate.js`, constant-time comparison in `lib/secureCompare.js`), and accountability — audit logging is wired into 33 API route files, with an admin-facing audit log UI and CSV/PDF export.
- **NIST CSF functions:** *Identify* — audit log + reports; *Protect* — E2EE, RBAC, MFA, session hardening, CSP; *Detect* — breach-scan cron + tamper detection via `contentHash`; *Respond* — admin alerting, account lockout, session termination on role change; *Recover* — super-admin clinic backup export (step-up protected) and 3-step OTP-confirmed restore (`app/api/super/clinics/[id]/backup/`, `RestoreModal.jsx`).
- **Adversarial validation:** the repo contains a full pentest program (`docs/security-testing-plan.md`, `docs/security-findings.md`, test matrices) using Burp Suite, sqlmap, and Hydra in a controlled environment, with remediation visible in the git history (`fix: security patches`, `fix: E2EE patch`, and related commits).

*Deep dive: `08-security-compliance.md`.*

---

## The three strongest claims (close your results section with these)

1. **The AI can never create a conflict** — it only ranks slots the server already validated, and its output is filtered against that list.
2. **Record confidentiality does not depend on the server behaving correctly** — true end-to-end encryption means a compromised server, database, or host yields only ciphertext.
3. **Tenant isolation is enforced at three independent layers** — middleware/layout guard, query scoping, and cryptography — so any single-layer failure still leaves clinics separated.

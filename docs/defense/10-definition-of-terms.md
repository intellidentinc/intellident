# 10 — Definition of Terms

Plain-English definitions of every technical term used in this kit and likely to be probed by the panel. Each entry: what it is, and where it lives in IntelliDent. Grouped by topic; skim your assigned modules' groups first, then the whole list.

## Cryptography & Encryption

**Encryption** — Transforming readable data (plaintext) into unreadable data (ciphertext) using a key, reversible only with the right key.

**End-to-End Encryption (E2EE)** — Encryption where only the communicating endpoints (here: users' browsers) ever hold the keys — the server stores and moves ciphertext it cannot read. *In IntelliDent:* patient record notes (`lib/crypto.js`, `docs/defense/05`).

**AES-GCM-256** — The symmetric cipher we use: AES with a 256-bit key in Galois/Counter Mode, which encrypts *and* authenticates in one pass (any tampering makes decryption fail). *Used for:* record notes, master-key protection.

**Symmetric vs asymmetric encryption** — Symmetric: one shared key encrypts and decrypts (fast; AES). Asymmetric: a public key encrypts, only the matching private key decrypts (lets you encrypt *to* someone; RSA). IntelliDent uses both: AES for content, RSA to share the AES keys.

**RSA-OAEP-2048** — The asymmetric scheme we use (2048-bit keys, OAEP padding, SHA-256). *Used for:* wrapping each record's content key to every authorized reader's public key.

**Key wrapping / AES-KW** — Encrypting one key with another key so it can be stored or transmitted safely. AES-KW is the NIST standard for it. *In IntelliDent:* the master key is stored wrapped under the password-derived KEK.

**KEK (Key Encryption Key)** — A key whose only job is to wrap other keys. *In IntelliDent:* derived from the user's password with PBKDF2; never stored.

**Master key** — Each user's long-lived AES-256 key, stored only in wrapped form (`User.wrappedKey`). It protects the user's RSA private key.

**CEK (Content Encryption Key)** — A fresh AES-256 key generated per patient record; it encrypts that record's notes and is then wrapped to each authorized reader (`RecordKey` rows).

**Envelope encryption** — The pattern of encrypting data once with a content key, then wrapping that content key separately for each recipient — like sealing copies of one letter's key into per-person envelopes. *In IntelliDent:* how one record is readable by both patient and dentist without shared passwords.

**PBKDF2** — Password-Based Key Derivation Function 2: turns a password into a cryptographic key by hashing it many times with a salt. *In IntelliDent:* 210,000 iterations of SHA-256 (`deriveKEK` in `lib/crypto.js`) — deliberately slow to make brute-forcing stolen data expensive.

**Salt** — Random per-user data mixed into hashing/derivation so identical passwords produce different results and precomputed "rainbow tables" are useless. *In IntelliDent:* `User.keySalt` (key derivation) and inside bcrypt hashes.

**IV (Initialization Vector)** — A random, non-secret value used once per encryption so identical plaintexts yield different ciphertexts. Must never repeat under the same key. *In IntelliDent:* stored beside each ciphertext (`dataIv`).

**AAD (Additional Authenticated Data)** — Extra data bound into AES-GCM's authentication without being encrypted; decryption fails if it doesn't match. *In IntelliDent:* the `patientId` is AAD, so ciphertext moved to another patient's record won't decrypt.

**Hash / SHA-256** — A one-way fingerprint function: any input → fixed 256-bit output; infeasible to reverse or to find two inputs with the same output. *Used for:* `contentHash` tamper detection, hashing reset/verification tokens at rest, device fingerprints.

**bcrypt** — A password-hashing algorithm that is deliberately slow and includes its own salt, making stolen hashes expensive to crack. *Used for:* user passwords (cost 10) and MFA OTPs (cost 8).

**HMAC** — Hash-based Message Authentication Code: a keyed hash proving data was produced by someone holding a secret key and wasn't altered. *Used for:* signing the session cookie (`SESSION_SECRET`) and verifying PayMongo webhooks.

**Web Crypto API** — The browser's built-in, native cryptography library (`crypto.subtle`). *Why it matters:* our E2EE uses zero third-party crypto packages.

**Constant-time comparison** — Comparing two secrets in a way that takes the same time whether they match early or late, so attackers can't learn bytes from response timing. *In IntelliDent:* `lib/secureCompare.js`, used in webhook signature checks.

**Tamper detection / integrity verification** — Detecting that stored data was altered. *In IntelliDent:* SHA-256 `contentHash` computed at write, re-verified at read; plus AES-GCM's built-in authentication.

## Authentication & Sessions

**Authentication vs authorization** — Authentication = proving who you are (login). Authorization = what you're allowed to do (RBAC, clinic scoping). The zero-trust chain does both on every request.

**MFA (Multi-Factor Authentication)** — Requiring two different kinds of proof: something you know (password) plus something you have (access to your email inbox). *In IntelliDent:* mandatory on every sign-in.

**OTP (One-Time Password)** — A short-lived single-use code. *In IntelliDent:* 6-digit emailed code, bcrypt-hashed, 10-minute expiry, 5 attempts (`MfaOtp` model).

**Session** — The server-side record that a user is logged in. *In IntelliDent:* two layers — an HMAC-signed HttpOnly cookie plus a `UserSession` database row checked on every request (instant revocation).

**Cookie flags (HttpOnly / Secure / SameSite)** — HttpOnly: JavaScript can't read the cookie (anti-XSS). Secure: sent only over HTTPS. SameSite=Lax: not attached to cross-site POSTs (anti-CSRF). All three set in `lib/auth.js`.

**Step-up authentication** — Re-proving identity mid-session before a sensitive action, even though you're already logged in. *In IntelliDent:* 15-minute grant; OTP mode for opening records, password mode for exports/backups.

**Account lockout** — Temporarily disabling login after repeated failures. *In IntelliDent:* 5 fails in 5 minutes → locked 15 minutes.

**Rate limiting** — Capping how many requests one source (IP) can make per time window. *In IntelliDent:* DB-backed (`lib/rateLimit.js`) because serverless instances don't share memory.

**Account enumeration** — An attack that discovers which emails are registered by comparing responses. *Our defense:* identical generic errors and matched response timing (dummy bcrypt compare) for unknown email, wrong password, and locked account.

**Timing side-channel** — Leaking secrets through how *long* an operation takes. *Our defenses:* the dummy-hash compare at sign-in and constant-time signature comparison.

**Device fingerprinting** — Recognizing a returning browser (we hash the User-Agent) to flag logins from new devices or changed IPs → suspicious-login email + step-up (`KnownDevice`, `lib/login.js`).

**Brute force attack** — Systematically guessing passwords/codes. Countered by rate limits, lockout, bcrypt cost, MFA, and the breach-scan heuristics. Tested with Hydra.

## Access Control & Security

**RBAC (Role-Based Access Control)** — Permissions assigned by role, not per person. *In IntelliDent:* 5 integer roles (0 SUPERADMIN … 4 PATIENT), checked server-side in every route.

**Zero trust** — The principle that no request is trusted by default — identity, role, tenant, and object permission are re-verified every time. *Our chain:* session → role → clinicId → permission → log.

**Least privilege** — Everyone gets the minimum access their job needs — e.g. dentists see only patients they actually treat (treating-relationship gate).

**Multi-tenancy** — One application/database serving multiple isolated customers (tenants). *In IntelliDent:* three clinics, isolated by `clinicId` scoping on every query plus cryptography.

**Tenant** — One clinic and all its data.

**IDOR (Insecure Direct Object Reference)** — Reaching someone else's data by editing an ID in a request. *Our defense:* lookups always combine the ID with `clinicId` and ownership conditions.

**Privilege escalation (horizontal / vertical)** — Horizontal: same role, someone else's data. Vertical: acting as a higher role. Both blocked server-side and tested with Burp Suite session replays.

**XSS (Cross-Site Scripting)** — Injecting malicious JavaScript into pages other users view. *Defenses:* React output escaping + nonce-based `strict-dynamic` CSP + HttpOnly cookies.

**CSP (Content Security Policy)** — A response header telling the browser which scripts may run. *In IntelliDent:* per-request nonce, no `unsafe-inline` (`middleware.js`).

**CSRF (Cross-Site Request Forgery)** — Tricking a logged-in browser into sending a state-changing request. *Defenses:* `SameSite=Lax` cookie + JSON-only mutation endpoints.

**SQL injection** — Smuggling SQL through user input. *Defense:* Prisma parameterizes every query; validated with sqlmap.

**Input sanitization / validation** — Cleaning and type-checking user input before use. *In IntelliDent:* `lib/validate.js` (16 KB body cap, email/length/format checks) before any DB call.

**Fail closed** — When a security dependency is missing/broken, deny rather than allow — e.g. no `SESSION_SECRET` → nobody authenticates; no webhook secret → no webhook accepted.

**Audit log / audit trail** — A tamper-resistant record of who did what, when, from where. *In IntelliDent:* `AuditLog` model, written from 33 route files via `logAudit()`.

**Breach detection** — Automated recognition of attack patterns. *Ours:* nightly cron — 1 IP locking 3+ accounts, 100+ record views/24 h, 5+ exports/24 h → `BREACH_ALERT` + admin email.

**Soft delete** — Flagging rows deleted (`isDeleted`) instead of removing them, preserving history and references; physical deletion happens later per retention policy.

**Data retention** — How long data is kept before purging. *In IntelliDent:* per-clinic configurable days for audit logs, records, billing; enforced by the audit-purge cron.

**Penetration testing (pentest)** — Authorized simulated attacks on your own system to find weaknesses before real attackers do. *Our tools:* Burp Suite (request interception/replay), sqlmap (SQL injection), Hydra (login brute force) — controlled environment only.

**Threat model** — The explicit list of attackers and attacks a design defends against — ours includes the server itself (hence E2EE), stolen databases, malicious insiders, and credential attacks.

## Web & Architecture

**Next.js App Router** — The React framework structure where folders under `app/` define pages and API endpoints; supports server-side rendering.

**Server component / client component** — Server components render on the server (can query the DB directly, e.g. `DashboardPage`); client components run in the browser (interactive modals, forms).

**API route / route handler** — A backend endpoint defined by a `route.js` file under `app/api/` exporting GET/POST/PATCH/DELETE functions.

**Middleware** — Code that runs before every request reaches a page or API route. *In IntelliDent:* `middleware.js` — session TTLs, disabled-clinic gate, CSP.

**Serverless** — Code runs in on-demand function instances instead of a permanent server; scales automatically, keeps no memory between requests (why our rate limits and sessions live in the DB).

**ORM (Object-Relational Mapper)** — A library translating code objects to SQL. *Ours:* Prisma — typed queries, migrations, automatic parameterization.

**Migration** — A versioned, repeatable change to the database schema, generated from `prisma/schema.prisma`.

**Cron job** — A task on a time schedule. *In IntelliDent:* five Vercel Cron jobs hitting `/api/cron/*`, each requiring the `CRON_SECRET` bearer token.

**Webhook** — An HTTP callback a third party sends *to us* when an event happens (PayMongo → "payment paid"). Must be authenticated (HMAC signature) because anyone can POST to a public URL.

**Idempotency** — Designing an operation so running it twice has the same effect as once. *In IntelliDent:* duplicate webhook deliveries are detected by `paymongoPaymentId` and skipped.

**Race condition** — Two near-simultaneous operations interleaving to produce a wrong result (e.g. double-booking); mitigated by transactions, advisory locks, and the PENDING confirmation step.

**Transaction (`$transaction`)** — A group of database writes that succeed or fail as one unit (e.g. payment row + billing update + receipt number).

**Advisory lock** — A Postgres application-level lock used to serialize a critical section — ours serializes receipt-number generation per clinic.

**Environment variable** — Configuration/secrets stored outside code (`DATABASE_URL`, `SESSION_SECRET`…), set in Vercel; never committed to git.

**HTTP status codes we cite** — 401 unauthenticated · 403 authenticated but forbidden · 404 not found · 409 conflict (double-booking) · 423 locked · 429 too many requests (rate limit) · 5xx server error.

**Soft real-time flags: PENDING / CONFIRMED / …** — See the appointment state machine in `04-appointments.md`; "terminal state" = a status with no allowed transitions out.

## Payments

**PayMongo** — Philippine payment gateway providing hosted checkout for GCash, Maya, cards, QRPh; we never handle raw payment credentials.

**Checkout session** — A PayMongo-hosted payment page we create per bill; our `billingId` rides along in its metadata.

**Webhook signature / replay protection** — Proof a callback came from PayMongo (HMAC-SHA256 over `timestamp.body`) and is fresh (timestamps older than 5 minutes rejected).

**Reservation fee** — A deposit charged at booking; if the clinic enables deductibility, it's credited against the final service bill (`applyReservationCredit`).

**PCI-DSS scope** — The card-data security standard; using hosted checkout keeps card numbers entirely out of our system and us out of scope.

## AI

**LLM (Large Language Model)** — A model that generates text from a prompt. *Ours:* OpenAI `gpt-5` (chat) and `gpt-5-mini` (slot ranking) via `lib/ai.js`.

**Prompt / system prompt** — The instructions given to the model; our system prompt is built per request from the caller's clinic and role (`lib/ai-prompt.js`).

**Function calling / tools** — Letting the model *request* named operations that our server executes and returns — the model never touches the DB itself. Tool sets are role-scoped (`lib/ai-tools.js`).

**Hallucination** — A model stating something false with confidence. *Mitigations:* grounding answers in tool-fetched live data, filtering slot suggestions against the server's valid list, restricting scope.

**Prompt injection** — Crafting input that tries to override the model's instructions. *Mitigation:* authorization lives outside the model — executors are hard-bound to the session's userId/clinicId.

**Fallback** — The deterministic path when AI fails: `algorithmicSuggestions()` tags slots without the model after a 15 s timeout.

**JSON mode / structured output** — Forcing the model to answer in machine-checkable JSON so we can validate every field (`generateJSON`).

## Compliance

**RA 10173 / Data Privacy Act of 2012** — The Philippine law governing personal data. Key duties we implement: consent, data-subject rights (DSAR), proportional security, retention limits, breach notification support, accountability.

**NPC (National Privacy Commission)** — The Philippine regulator enforcing the DPA; breach notification is due to the NPC within 72 hours of knowledge.

**DSAR (Data Subject Access Request)** — A person exercising their right to access, correct, or delete their data. *In IntelliDent:* `app/api/data-requests/` with admin resolution workflow.

**PII / SPI (Personal / Sensitive Personal Information)** — Identifying data; health information is *sensitive* under the DPA and gets the strongest protection (E2EE).

**Data minimization** — Processing only the data needed for the purpose — e.g. the AI slot ranker receives only times and a service name.

**ISO/IEC 27001** — The international information-security management standard; we align with its control themes (access control, cryptography, operations, logging, continuity).

**NIST Cybersecurity Framework (CSF)** — The five-function security model: **Identify, Protect, Detect, Respond, Recover** — each mapped to concrete features in `08-security-compliance.md`.

**OWASP Top 10** — The industry's standard list of the ten most critical web-application risks; our mapping is in `08`'s Q&A.

**Data Protection Officer (DPO)** — The person an organization designates to oversee DPA compliance — an organizational duty of each clinic, supported by our technical features.

**Controller vs processor** — The controller decides why/how data is processed (the clinic); the processor handles it on the controller's behalf (the platform/hosting).

## IntelliDent-Specific Vocabulary

**Treating relationship** — Our access rule: a dentist may access a patient's records only with ≥1 CONFIRMED or COMPLETED appointment with them (`dentistTreatsPatient()`).

**Authorized reader set** — The server-derived list of users who may decrypt a record: the patient + treating dentists (`getAuthorizedReaderIds()`); never taken from the client.

**Reshare / access healing** — Re-wrapping a record's CEK to a newly authorized reader (or a reader with reset keys) on next decrypt (`reshareRecord`).

**Effective role** — What a super admin becomes inside a clinic (ADMIN) while keeping role 0 in the session (`superAdmin` flag).

**Buffer time** — Per-service turnover minutes (cleanup/prep) blocked after the treatment inside the conflict window.

**"Any Available"** — A booking with `dentistId = null`; a concrete dentist is assigned at confirmation.

**Reference codes** — Human-readable IDs: `PAT-{CODE}-{YYYY}-{#####}` (patients), `APT-{CODE}-{YYYY/MM/DD}-{####}` (appointments), `RCP-{CODE}-{YYYY}-{#####}` (receipts).

**Pending badge / booking requests** — The sidebar counter of PENDING appointments awaiting staff confirmation.

**Fire-and-forget** — Kicking off a side task (email, audit write, notification) without letting its failure block the user's request.

**Single-session mode** — Per-clinic toggle (`singleSessionEnabled`): a new login terminates the user's previous session.

**Keep-alive** — The 5-day cron ping that stops the Neon free-tier database from cold-sleeping.

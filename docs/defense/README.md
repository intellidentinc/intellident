# IntelliDent — Final Defense Study Kit

A self-contained study kit for the final defense. Each numbered file explains one area from zero: what it does, how it works step by step, where every file lives, which technology is used and why, and ends with **Mock Panel Q&A** to rehearse against.

## How to use this kit

1. **Everyone** reads `01-architecture.md` first (30 min) — it's the vocabulary for everything else.
2. Split the deep-dive files among the four of you, but **everyone must be able to recite the three killer talking points** (below) and the zero-trust chain.
3. For each file: read it top to bottom once, then **open the cited code files** and trace one real flow yourself (e.g., set a breakpoint mindset: "the request lands here, then calls this, then writes that"). You retain what you traced, not what you read.
4. Drill the Q&A sections out loud, in pairs — one asks, one answers without looking.
5. Night before: re-read only the "story in plain English" blocks, the objectives map, and the cheat sheet below.

## Study files

| # | File | Topic | Read this if the panel asks about… |
|---|---|---|---|
| 01 | [01-architecture.md](./01-architecture.md) | Stack, file structure, providers, middleware, cron | "What did you build it with and why?" |
| 02 | [02-authentication.md](./02-authentication.md) | Sign-up/in, MFA OTP, sessions, lockout, passwords, step-up | "How do users log in securely?" |
| 03 | [03-rbac-multitenancy.md](./03-rbac-multitenancy.md) | Roles, zero trust, clinic isolation, super admin | "How do you keep clinics apart?" |
| 04 | [04-appointments.md](./04-appointments.md) | Booking, conflicts, status machine, reminders | "How do you prevent double-booking?" |
| 05 | [05-records-e2ee.md](./05-records-e2ee.md) | Records, encryption keys, envelope, tamper detection | "Explain your encryption." |
| 06 | [06-ai-features.md](./06-ai-features.md) | AI slot picks, chatbot, no-show risk | "What does the AI actually do?" |
| 07 | [07-billing-payments.md](./07-billing-payments.md) | Billing, PayMongo, webhook, receipts | "How does payment work?" |
| 08 | [08-security-compliance.md](./08-security-compliance.md) | Audit, breach scan, retention, DSAR, backup, RA 10173 / ISO / NIST | "How are you compliant?" |
| 09 | [09-supporting-modules.md](./09-supporting-modules.md) | Users, services, patients, settings, onboarding, reports | "How does an admin manage the clinic?" |

## The six specific objectives → where each is proven

| Objective | What to say (one sentence) | Study file(s) |
|---|---|---|
| **1. Appointment scheduling** — create/confirm/reschedule/cancel without conflicts | Full lifecycle for patient + staff, with a server-side 5-step validation pipeline whose overlap check (`scheduledAt < endsAt AND endsAt > scheduledAt`, duration **+ buffer**) makes double-booking return HTTP 409 | `04` |
| **2. Patient records on a centralized encrypted DB** — records + billing | One central Neon PostgreSQL; clinical notes E2EE (AES-GCM-256 + RSA-OAEP envelope) with SHA-256 tamper detection; billing fully integrated | `05`, `07` |
| **3. AI scheduling** — duration-aware slot assignment, no overlaps | `lib/slots.js` computes duration+buffer-aware, conflict-free slots; gpt-5-mini only *ranks* that list and its output is filtered against it — the AI cannot invent or overlap a slot | `06`, `04` |
| **4. Virtual assistant** — 24/7, clinic-rule-based | Floating gpt-5 chatbot on every page; system prompt built from the clinic's real data; role-scoped tools bound to the caller's userId/clinicId | `06` |
| **5. Multi-tenant separation + zero trust** | Chain on every request: session → role → clinicId → permission → log; isolation at 3 layers (layout guard, query scoping, cryptography) | `03` |
| **6. RA 10173 / ISO 27001 / NIST CSF alignment** | DSAR + consent + retention + breach alerting (DPA); mapped controls per ISO domain; all five NIST functions implemented; validated by our own pentest (Burp/sqlmap/Hydra) | `08` |

## Three killer talking points (everyone memorizes)

1. **"The AI can never double-book"** — it only ranks slots the server already validated, its output is filtered against that list, and the final booking re-runs the conflict check anyway.
2. **"Record confidentiality doesn't depend on the server behaving"** — notes are encrypted in the browser; the DB holds only ciphertext and key envelopes; even our super admin and a full DB leak yield nothing readable.
3. **"Tenant isolation is enforced three times"** — URL/layout guard, `clinicId` on every query from the signed cookie, and encryption keys that outsiders simply don't hold.

## One-page cheat sheet (numbers the panel loves)

| Fact | Value |
|---|---|
| Framework / language | Next.js 16 App Router, JavaScript (JSX) |
| DB / ORM | PostgreSQL on Neon / Prisma |
| Password hashing | bcrypt |
| Key derivation | PBKDF2, **210,000** iterations, SHA-256 |
| Record encryption | AES-GCM-**256**, per-record content key |
| Key envelope | RSA-OAEP-**2048** per authorized reader |
| Tamper detection | SHA-256 `contentHash`, verified on every read |
| MFA | 6-digit email OTP, 10-min expiry, 5 attempts, bcrypt-hashed, every login |
| Lockout | 5 fails / 5 min → 15-min lock |
| Sessions | 10 min default · 3 days Remember Me · 8 h hard cap · 30 min inactivity |
| Step-up re-auth | 15-min grant; OTP for records, password for exports/backup |
| Sign-in rate limit | 20 / 15 min per IP (DB-backed) |
| Slot grid | every 30 min, Asia/Manila, duration + buffer aware |
| Conflict rule | `existing.start < new.end AND existing.end > new.start` → 409 |
| Appointment states | PENDING → CONFIRMED → COMPLETED / CANCELLED / NO_SHOW / RESCHEDULED (terminals locked) |
| AI models | gpt-5-mini (slots, 15 s timeout + fallback) · gpt-5 (chat) |
| Webhook defense | HMAC-SHA256, constant-time compare, 5-min replay window, idempotent |
| Cron jobs | 5 — reminders 08:00, purge 01:00, breach-scan 02:00, orphan-docs 03:00 (UTC), keep-alive /5 days |
| Breach heuristics | 1 IP locks 3+ accounts · 100+ record views/24 h · 5+ exports/24 h |
| Roles | 0 SUPERADMIN · 1 ADMIN · 2 DENTIST · 3 RECEPTIONIST · 4 PATIENT |
| Codes | `PAT-{CODE}-{YYYY}-{#####}` · `APT-{CODE}-{YYYY/MM/DD}-{####}` · `RCP-{CODE}-{YYYY}-{#####}` |
| Compliance | RA 10173 · ISO/IEC 27001 principles · NIST CSF |
| Pentest tools | Burp Suite · sqlmap · Hydra (controlled env) |

## Demo accounts (from `prisma/seed.js`)

- Pattern: `{role}.{clinicSlug}@intellident.test` (e.g. `admin.maria@intellident.test`), password `12345678` — MFA OTP arrives by email.
- Super admin: `superadmin@intellident.app` / `12345678` (`prisma/seed-super.js`).
- Remember: seed dentists must be assigned to services in Services settings before they appear in booking pickers.

## Every calculation in the system (formulas reference)

If the panel asks "show us your computation," it's one of these. Each is deep-dived in the listed file.

| Calculation | Formula | Where in code | Study file |
|---|---|---|---|
| Appointment end time | `endsAt = scheduledAt + Σ(service.duration + service.bufferTime)` | `app/api/appointments/route.js` | 04 |
| Conflict detection | overlap if `existing.scheduledAt < new.endsAt AND existing.endsAt > new.scheduledAt` → 409 | `app/api/appointments/route.js` | 04 |
| Available slots | candidate starts every 30 min where `start + totalDuration ≤ closeTime`, minus closures/non-working days/past times (same-day needs `now + 30 min` lead), minus conflicting slots — all in Asia/Manila | `lib/slots.js` (`computeAvailableSlots`) | 04 |
| Billing status | `amountPaid ≤ 0 → UNPAID`; `amountPaid ≥ amount → PAID`; else `PARTIAL` | `lib/billing.js` (`computeBillingStatus`) | 07 |
| Payment application | `newAmountPaid = amountPaid + payment`; `newBalance = max(0, balance − payment)`; webhook amounts arrive in centavos → `÷ 100` | `app/api/webhooks/paymongo/route.js` | 07 |
| Reservation credit | `credited = min(reservationPaid, serviceAmount)` applied as a payment on the SERVICE bill (only if clinic sets `reservationFeeDeductible`) | `lib/billing.js` (`applyReservationCredit`) | 07 |
| Receipt sequence | `next = max(existing sequence for clinic+year) + 1`, zero-padded to 5, under a per-clinic Postgres advisory lock | `lib/billing.js` (`generateReceiptNumber`) | 07 |
| No-show risk | `high risk = noShowCount ≥ threshold (default 2) OR (scheduledAt − createdAt) < 24 h` | `app/api/ai/risk/[patientId]/route.js` | 06 |
| Reports — appointments | Prisma `groupBy` counts by status / service / dentist over the date range | `app/api/reports/route.js` | 09 |
| Reports — revenue | `totalBilled = Σ amount`; `totalCollected = Σ amountPaid`; `outstanding = Σ balance`; per-service + per-month rollups | `app/api/reports/route.js` | 09 |
| Lockout window | `attemptsInWindow = lastFailedAt > now − 5 min ? failed + 1 : 1`; lock 15 min when `≥ 5` | `app/api/auth/sign-in/route.js` | 02 |
| Rate limiting | per-IP counter within a rolling window (e.g. sign-in 20 per 15 min), stored in the `RateLimit` table | `lib/rateLimit.js` | 02 |
| Session lifetimes | cookie maxAge 10 min (or 3 days Remember Me); absolute cap `loginTime + 8 h`; inactivity logout at 30 min idle | `middleware.js`, `InactivityProvider` | 02 |
| Key derivation cost | PBKDF2-SHA-256, 210,000 iterations, per-user salt | `lib/crypto.js` (`deriveKEK`) | 05 |
| Breach heuristics (24 h windows) | same IP locks ≥ 3 accounts; one user views ≥ 100 records; one user makes ≥ 5 exports | `app/api/cron/breach-scan/route.js` | 08 |
| Password expiry | `passwordExpiresAt = now + Clinic.passwordExpiryDays` (30–365) when enabled for the user's role | change-password flow | 02 |

## Curveball questions every member should be ready for

These aren't tied to one module — any of you can be asked any of them.

**Q: How is IntelliDent different from existing dental software or a Google Calendar + spreadsheet setup?**
A: Three things the alternatives don't give these clinics: end-to-end encrypted patient records (commercial practice-management tools hold plaintext server-side), enforced multi-tenant zero-trust across a *network* of partner clinics under one platform, and AI-assisted scheduling grounded in each clinic's real availability. And it's built specifically for Philippine context — PayMongo/GCash payments, +63 validation, RA 10173 workflows.

**Q: Why is this a *cybersecurity* capstone and not just a web app?**
A: Security is the architecture, not a feature list: the E2EE key hierarchy, MFA-gated key release, zero-trust request chain, breach detection, and audit accountability were designed first and the clinic features built on top. We then attacked our own deployment with Burp Suite, sqlmap, and Hydra, filed findings, patched, and retested — the full defensive engineering loop.

**Q: What are the system's honest limitations?**
A: Know these cold — volunteering them builds credibility: encrypted note bodies aren't full-text searchable (E2EE trade-off); forgotten passwords need the reshare healing path for old records; the appointment conflict check is check-then-insert rather than a DB exclusion constraint (mitigated by the PENDING confirmation step); money columns are Float pending a Decimal migration; email OTP is weaker than TOTP/passkeys; Gmail SMTP caps daily sends. Each has a documented rationale and a named next step.

**Q: What would you do differently if you started over?**
A: Pick a real answer per member, e.g.: TypeScript from day one for the refactoring safety; DB-level exclusion constraints for scheduling from the start; designing the E2EE envelope scheme before the first record feature instead of retrofitting (see the E2EE patch commits); and writing the pentest matrix earlier so security tests grew with the features.

**Q: Who did what? / What was *your* contribution?**
A: Agree on this before the defense — divide the modules honestly among the four of you and be able to speak deeply to your own area while sketching the others. The worst answer is four people claiming everything.

**Q: Is the system deployed and actually usable by the three clinics?**
A: Yes — deployed on Vercel (`NEXT_PUBLIC_APP_URL`, region sin1) with the production database on Neon, cron jobs live, PayMongo webhook registered and verified end-to-end. Be ready to log in live during the defense; know the seed credentials from the section above.

**Q: What happens to the system after you graduate?**
A: The honest framing: it's turnover-ready — documented (`docs/` covers architecture through pentest findings), seeded, and running on managed services with no server to maintain; costs at clinic scale are near-zero on free tiers plus small OpenAI usage. Sustainability options: turnover to the clinics with a maintenance guide, or continued stewardship by the team — state whichever your group has actually agreed with your adviser.

**Q: Defend your choice of a capstone-built system over open-source alternatives the clinics could have adopted.**
A: The requirements that drove custom development are exactly our objectives: E2EE records with multi-reader envelopes, Philippine payment rails, RA 10173 DSAR/retention/breach workflows, and multi-clinic tenancy with zero-trust — no off-the-shelf dental system offers that combination, and adopting one would also have taught us nothing about building secure systems, which is the point of the degree.

## Golden rules when answering the panel

- Lead with the plain-English sentence, then offer the technical depth ("Would you like me to walk through the code path?").
- Never claim perfection — pair every control with its trade-off (e.g. E2EE means forgotten passwords need the reshare recovery path; we chose that deliberately).
- If asked something you don't know: state what you *do* know about the adjacent mechanism and where in the code the answer lives. "That's handled in `lib/slots.js`; I'd verify the exact constant there" beats guessing.
- Every security answer can fall back to the chain: **session → role → clinicId → permission → log.**

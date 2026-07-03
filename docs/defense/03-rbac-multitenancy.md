# 03 — RBAC, Multi-Tenancy & Zero Trust

## What it is

One codebase and one database serve three clinics, yet no clinic can ever see another clinic's data, and no user can do more than their role allows. This is enforced by a **zero-trust chain repeated on every single request**:

> **session → role → clinicId → permission → audit log**

Memorize that chain. It is the direct answer to capstone **Objective 5**.

## The five roles

Defined in `lib/roles.js` (`ROLES` constant), stored as an integer on `User.role`:

| Role | Value | Scope | Sidebar access |
|---|---|---|---|
| `SUPERADMIN` | 0 | **No clinic** (`clinicId` null in DB) | `/super` portal — clinic picker, applications, policies, backup/restore |
| `ADMIN` | 1 | One clinic | Dashboard, Users, Services, Appointments, Billing, Settings, Audit Log, Reports |
| `DENTIST` | 2 | One clinic | Dashboard, Schedule (own calendar), Patient Records, Profile |
| `RECEPTIONIST` | 3 | One clinic | Dashboard, Appointments, Patients, Billing |
| `PATIENT` | 4 | One clinic | Dashboard, My Schedules, My Dental Records, My Billing, Profile |

The sidebar (`app/modules/dashboard-page/AppSidebar.jsx`) renders per role, but the sidebar is **cosmetic** — real enforcement is server-side in every API route.

## How every API route enforces the chain

Typical pattern (see any route, e.g. `app/api/patients/route.js`):

1. **Session** — `getSession()` (`lib/auth.js`) verifies the HMAC cookie AND the `UserSession` DB row. No session → 401.
2. **Role** — the route checks the caller's role (many use `getAuthContext()` or a caller helper in `lib/caller.js`). Wrong role → 403. Example: only `ADMIN` can PATCH `/api/users/[id]`.
3. **clinicId** — every Prisma query includes `clinicId: session.clinicId` in its `where`. There is no query in the system that selects across clinics (except super-admin routes, which check role 0 first).
4. **Permission** — object-level checks beyond role, e.g. a dentist must have a **treating relationship** (≥1 CONFIRMED/COMPLETED appointment) with a patient to open their records (`dentistTreatsPatient()` in `lib/records-access.js`); a patient can only cancel **their own** appointment.
5. **Log** — `logAudit()` (`lib/audit.js`) records who did what, from which IP/user-agent (fire-and-forget so it never breaks the request).

## Why cross-clinic access is impossible — three independent layers

This is your strongest defense talking point:

1. **Middleware/layout layer** — `app/(main)/[clinicId]/layout.jsx` compares the URL's clinic with `session.clinicId`; mismatch → redirect out. `middleware.js` blocks disabled clinics entirely.
2. **Query layer** — even if layer 1 were bypassed (e.g. calling the API directly with curl), every DB query is scoped `where: { clinicId: session.clinicId, ... }`. The session's clinicId comes from the signed cookie set at login — the client cannot choose it.
3. **Cryptographic layer** — even if layers 1–2 were bypassed (e.g. a raw DB leak), patient record notes are E2EE: an outsider holds no wrapped content key for records they aren't an authorized reader of, so ciphertext is all they get (see `05-records-e2ee.md`).

## Super Admin flow (role 0)

Files: `app/api/super/enter/route.js`, `app/api/super/exit/route.js`, `app/(main)/super/`, `app/modules/super-page/`

- Super admin has **no clinicId** in the DB. Login lands on `/super` — a clinic picker with two tabs (Clinics + Applications).
- **Enter as Admin:** `POST /api/super/enter` verifies role 0 (`getAuthContext()`), verifies the target clinic exists, then rewrites the session with `clinicId` + `superAdmin: true` flag and audit-logs it (`metadata: superadmin-enter`).
- Inside the clinic, `[clinicId]/layout.jsx` maps role 0 → **effectiveRole ADMIN**, so the super admin sees the admin UI; the sidebar shows a "Back to Super Admin" button.
- **Exit:** `POST /api/super/exit` clears `clinicId` from the session → back to `/super`.
- Super-only powers: approve/reject clinic applications, enable/disable clinics, push bulk password policies (`/api/super/policies`), clinic backup export (step-up required) and OTP-confirmed restore.

## Instant privilege revocation

- Changing a user's role or deactivating them (`PATCH /api/users/[id]`) terminates their active session — the DB-backed session check makes this take effect on their very next request.
- `lib/auth.js` explains why the cookie's embedded role can be trusted: *a role change terminates the session token, forcing re-login with a fresh cookie*.
- Deactivated users (`isActive: false`) stay visible in the users table but are blocked at sign-in with 403.

## Key files table

| File | Role |
|---|---|
| `lib/roles.js` | `ROLES` constants + `sanitizeExpiryRoles()` |
| `lib/auth.js` | `getSession`, `getAuthContext` (session + role + clinicId resolution) |
| `app/(main)/[clinicId]/layout.jsx` | Clinic guard; effectiveRole mapping for super admin; sidebar data |
| `middleware.js` | Clinic-enabled gate, session TTL enforcement |
| `lib/records-access.js` | Object-level permission: treating-relationship gate, authorized-reader derivation |
| `app/api/super/enter/route.js` + `exit/route.js` | Super admin clinic switching |
| `app/modules/dashboard-page/AppSidebar.jsx` | Role-aware navigation (cosmetic layer) |
| `lib/audit.js` | `logAudit` + `getRequestMeta` (rightmost X-Forwarded-For, anti-spoofing) |

## Technologies & why

- **Integer role enum** — simple, indexable, and comparisons like `role !== ROLES.ADMIN` are unambiguous.
- **Shared-schema multi-tenancy** (one DB, `clinicId` column) rather than database-per-tenant — right cost/complexity for 3 clinics, and the E2EE layer covers the residual shared-storage risk.
- **`unstable_cache` (60 s)** for the clinic-enabled flag — the disable switch is enforced at the edge without a DB hit per request.

## Mock Panel Q&A

**Q: What does "zero trust" mean in your system, concretely?**
A: No request is trusted because of where it comes from or what the UI showed. Every API handler independently re-verifies: valid session (checked against the DB, not just the cookie), correct role, correct clinic scope, object-level permission, and then logs the action. Hiding a button is never the security boundary — the server re-checks everything.

**Q: I'm a receptionist at Clinic A. What exactly stops me from reading Clinic B's patients?**
A: Three layers. The clinic layout rejects the URL mismatch; every Prisma query is filtered by the `clinicId` baked into my signed session cookie at login (I can't send a different one — it's HMAC-signed and HttpOnly); and Clinic B's record contents are encrypted to keys I don't hold. To read Clinic B's data I'd need a Clinic B account.

**Q: Couldn't a user just call the API directly with curl and skip your frontend checks?**
A: Yes, and it changes nothing — the frontend checks are convenience only. The API handler re-runs the full chain: session, role, clinicId scope, permission. We verified this during our penetration testing phase with Burp Suite by replaying requests across roles and clinics.

**Q: Why can a dentist not see every patient in their own clinic?**
A: Least privilege beyond RBAC. `dentistTreatsPatient()` in `lib/records-access.js` requires at least one CONFIRMED or COMPLETED appointment between that dentist and that patient. A dentist with no treating relationship gets 403 — and cryptographically, they were never issued a wrapped content key for that patient's records.

**Q: Isn't the super admin a single point of compromise?**
A: It's the most protected account: MFA on every login like everyone else, step-up password re-auth for backups, OTP-by-email confirmation for restores, rate limits on those endpoints, and every enter/exit/backup/restore action is audit-logged. And even the super admin cannot read E2EE record notes — they hold no patient content keys; backups explicitly exclude encrypted note plaintext.

**Q: What happens the moment an admin demotes or deactivates a user?**
A: Their `UserSession` row is terminated. Because `getSession()` validates against the DB on every request, their next click fails with 401 and they're back at sign-in. There's no window where an old cookie keeps old privileges.

**Q: Why one shared database instead of one database per clinic?**
A: Proportionality. Three clinics don't justify the operational cost of per-tenant databases (migrations ×N, backups ×N, connection pools ×N). We get equivalent isolation from strict query scoping plus E2EE, and we can still onboard new clinics instantly — approving an application just inserts a `Clinic` row.

**Q: What is IDOR and how do you prevent it?**
A: Insecure Direct Object Reference — changing an ID in a URL to reach someone else's object, e.g. `PATCH /api/billing/<someone-else's-id>`. Our defense is that no route ever fetches by ID alone: every lookup is `where: { id, clinicId: session.clinicId }` plus ownership checks (a patient's routes filter by *their* patient profile). We specifically replayed cross-role and cross-clinic ID swaps in Burp Suite during testing.

**Q: Distinguish horizontal and vertical privilege escalation and how you tested for both.**
A: Horizontal = same role, someone else's data (patient A reading patient B) — blocked by ownership scoping and, for records, by cryptography. Vertical = lower role acting as a higher one (receptionist calling admin endpoints) — blocked by the role check at the top of each handler. Testing: captured each role's session in Burp and replayed every other role's requests with it, expecting 401/403 across the board.

**Q: Why hard-coded integer roles instead of a flexible permissions table?**
A: Five roles with stable, well-understood duties don't need dynamic permission management — a permissions table would add admin UI, migration surface, and misconfiguration risk (an admin accidentally granting records access). Fixed roles make every check auditable in code: you can grep exactly who can do what.

**Q: Can one person belong to two clinics?**
A: Not with one account — email is globally unique and a user carries exactly one `clinicId`, which is a deliberate isolation guarantee (a session can never straddle tenants). A dentist working at two partner clinics uses two accounts with separate credentials and separate E2EE keys, so each clinic's data stays inside its own boundary.

**Q: How does the super admin account come to exist, and can there be more than one?**
A: It's provisioned by a separate seed script (`prisma/seed-super.js`), not through any public flow — there is no API that creates or promotes to role 0. That's intentional: the most powerful role can only be minted with direct database/deployment access.

**Q: When the super admin "enters" a clinic, are they bypassing your access control?**
A: No — they're *using* it. `POST /api/super/enter` re-verifies role 0 server-side, rewrites the session to that one clinic with a `superAdmin` flag, audit-logs the entry, and from then on they're subject to the same ADMIN-scoped checks as any clinic admin — one clinic at a time, no E2EE record plaintext, every action logged.

---
Further reading: [`docs/security.md`](../security.md), [`docs/super-admin.md`](../super-admin.md).

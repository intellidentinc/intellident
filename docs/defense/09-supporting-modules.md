# 09 — Supporting Modules (Users, Services, Patients, Settings, Onboarding, Reports)

## What it is

The operational modules that make the clinics run day-to-day. Panels often probe these because they're "ordinary" — know the flows and their guard rails.

## User management (ADMIN) — `/users`

Files: `app/api/users/route.js` + `[id]/route.js`, UI `app/modules/rbac-page/` (RbacPage, AddUserModal, EditRoleModal, DeleteUserModal)

- **Create staff:** admin picks role + details → server generates a **random temporary password** (8–12 chars meeting full policy) and a collision-safe **username** `{CLINICCODE}-{LASTNAME}-{####}`; creates the matching profile row (Dentist/Receptionist); sends a welcome email (`sendStaffWelcomeEmail`, fire-and-forget); sets `mustChangePassword: true` so first login forces a password change (`/change-password?reason=first-login`). The E2EE keypair is generated client-side on their first login (`lib/clientKeys.js`).
- **Edit role / deactivate:** `PATCH /api/users/[id]` handles both role changes and the `isActive` toggle. Either one on the *current* user clears their session immediately. Deactivated users stay visible with a Status chip but get 403 at sign-in.
- **Delete:** soft delete (`isDeleted`); deleting yourself logs you out.

## Patients (RECEPTIONIST/ADMIN) — `/patients`

Files: `app/api/patients/` (paginated GET, POST, `[id]` PATCH/DELETE), UI `app/modules/patients-page/`
- Auto-generated `patientCode`: `PAT-{CLINICCODE}-{YYYY}-{#####}`.
- Server-side search + pagination (MUI Autocomplete with `filterOptions={(x) => x}` to disable client filtering).

## Services catalog (ADMIN) — `/services`

Files: `app/api/services/` (+ `dentists/` GET), UI `app/modules/services-page/`
- Each service: **duration, price, buffer time**, and **assigned dentists** — these drive slot math (`lib/slots.js`), conflict windows, and auto-billing amounts. A dentist appears in booking pickers only for services assigned to them.

## Clinic Settings (ADMIN) — `/settings`

UI `app/modules/settings-page/`, APIs under `app/api/clinics/[id]/`:

| Card | What it controls | API |
|---|---|---|
| `ClinicProfileForm` | Name, address (normalized via `normalizeAddress()` in `lib/utils.js`), contacts | `profile/` |
| `ClinicLogoUpload` | Logo → Supabase `clinic-logos` bucket, shown in sidebar | `logo/` |
| `ClinicSchedule` | Working days + open/close hours; savable **presets** | `schedule/`, `schedule/presets/` |
| `ClinicClosures` | Holiday/maintenance dates (block booking) | `closures/` |
| `ClinicPasswordSettings` | Password expiry: toggle + days (30–365) + applicable roles | `Clinic.passwordExpiry*` |
| `ClinicNotificationSettings` | Notification preferences | — |
| `ClinicDataRetentionSettings` / `ClinicAuditRetentionSettings` | Retention days feeding the purge cron | `Clinic.*RetentionDays` |
| `ClinicPaymentSettings` | PayMongo configuration, reservation fee | — |

Super admin can push password policies to **all clinics at once** via `/api/super/policies` (`SuperPoliciesPage.jsx`).

## Clinic onboarding (public → super admin)

Files: `app/api/clinic-applications/` (+ `documents/`), UI `ClinicApplicationForm.jsx` + `FileUploadZone.jsx` in `app/modules/sign-up-page/`; review in `ApplicationsTab.jsx` (`app/modules/super-page/`)

1. Public application form (sign-up page "apply" mode): clinic details, +63-format contacts, BIR documents + applicant IDs uploaded to Supabase `clinic-documents` (magic-byte type checks, 5 MB cap, rate-limited 50/h; submissions 5/h). ToS acceptance required. Confirmation email sent.
2. Super admin reviews in the Applications tab (filterable PENDING/APPROVED/REJECTED).
3. **Approve** → atomic transaction creates the `Clinic` row + emails the applicant a sign-up link. **Reject** → email with optional notes.
4. Unreferenced uploads older than 48 h are cleaned nightly by the orphan-docs cron.

## Reports (ADMIN) — `/reports`

Files: `app/api/reports/` + `export/`, UI `app/modules/reports-page/ReportsPage.jsx`
- Three tabs — **Appointments, Revenue, Patients** — with date-range filter, stat cards, and CSV + PDF export (export requires step-up password; capped rows; audit-logged — exports feed the bulk-export breach heuristic).
- The numbers are computed server-side with Prisma aggregations (`groupBy` + `_count`/`_sum`), always scoped to the clinic and date range:
  - **Appointments tab:** total count + counts grouped by status, by service, by dentist (with completed-per-dentist).
  - **Revenue tab:** `totalBilled = Σ Billing.amount`, `totalCollected = Σ Billing.amountPaid`, `outstanding = Σ Billing.balance`, plus per-service and per-month billed/collected rollups.
  - **Patients tab:** new-patient counts over the range.

## Notifications (all roles)

Files: `lib/notifications.js`, `app/api/notifications/`, UI `app/modules/notifications/`
- `InAppNotification` rows + Gmail emails (fire-and-forget so email outages never block operations). Bell with unread count in every `PageHeader`; Framer Motion drawer; mark-one/mark-all read. (Event catalog in `04-appointments.md`.)

## Profile (any role) — `/profile`

`app/api/profile/route.js` (GET/PATCH own profile) + `profile/keys/` (E2EE key material — see `05`). Shows username, middle initial, contact info.

## Data requests (DSAR)

`app/api/data-requests/` — patients submit ACCESS / CORRECTION / DELETION requests; ADMIN resolves via `[id]` PATCH. Compliance context in `08-security-compliance.md`.

## Mock Panel Q&A

**Q: How does a new staff member get onboarded securely?**
A: The admin creates the account; the server generates a random policy-compliant temporary password and a username like `MLC-SANTOS-0001`, emails a welcome, and flags `mustChangePassword`. First sign-in still requires the email OTP, then forces a password change before anything else; the E2EE keypair is provisioned client-side at that point. At no time does the admin choose or know the staff member's lasting password.

**Q: What happens when you deactivate a user who is logged in right now?**
A: The PATCH terminates their DB session; because every request revalidates the session against the database, their next click returns 401 and they're redirected to sign-in, where the `isActive` check blocks them with 403. Their data and audit history remain (soft delete philosophy).

**Q: How does a new clinic join the platform?**
A: Public application with document proof (BIR registration, IDs) → files validated by content (magic bytes), not extension → super admin reviews and approves → one atomic transaction creates the clinic and emails the applicant a sign-up link → the applicant registers as that clinic's admin and configures Settings (hours, services, staff). Rejection sends notes; abandoned uploads self-clean in 48 h.

**Q: Why do services have both duration and buffer time?**
A: Duration is chair time; buffer is turnover (cleaning, prep). Both are blocked in the conflict window and slot math, so the schedule reflects operational reality — that's part of "organized clinic workflows" in Objective 1.

**Q: Can a receptionist run reports or read the audit log?**
A: No — both are ADMIN-only, enforced in the API handlers, and their exports additionally require step-up password re-auth and are audit-logged and rate-monitored by the breach scan.

**Q: What's soft delete and why use it everywhere?**
A: `isDeleted` + `deletedAt` flags instead of physical deletion; every query filters `isDeleted: false`. It preserves referential integrity (billing history keeps its patient), keeps the audit trail truthful, and enables retention-based purging on *our* schedule — the purge cron does the eventual physical deletion per clinic policy.

**Q: The clinic's only admin forgets their password or leaves — is the clinic locked out?**
A: No. Forgot-password works for admins like anyone else (E2EE keys regenerate, but admins hold no patient record keys of consequence). If the admin is truly gone, the super admin enters the clinic as effective ADMIN and creates or promotes a replacement — every step audit-logged.

**Q: How do walk-in patients work — do they need the app?**
A: No. The receptionist creates the patient (`AddPatientModal` → `POST /api/patients`, auto-assigned `patientCode`) and books the appointment directly — the staff flow never requires the patient to have credentials. If the patient later signs up with the same email, they get self-service access to their schedules, records, and bills.

**Q: Can anyone on the internet sign up as a patient of any clinic?**
A: They can *apply* to one clinic: sign-up requires choosing a clinic, accepting the ToS, and completing email verification before a User row even exists — plus a 10/hour per-IP rate limit. A registered patient still can't see anything beyond their own data, and staff roles can never be self-registered — only an admin creates those.

**Q: Why generate usernames if nobody signs in with them?**
A: They're human-readable staff identifiers — `MLC-SANTOS-0001` on the users table, profile, and welcome email — useful for clinics that track employees by code, without weakening auth: sign-in stays email-based, so the printable identifier isn't a credential.

**Q: You send email via a Gmail account — what are the limits and risks?**
A: Gmail App-Password SMTP caps at roughly 500 sends/day — ample for three clinics' OTPs, reminders, and alerts. All sends are fire-and-forget so an email outage never blocks operations (except sign-in's OTP send, which correctly fails loudly — no code, no login). At more clinics we'd swap `lib/email.js` to a transactional provider; it's one file.

**Q: What stops a fake clinic from applying with forged documents?**
A: Layered review. Uploads are validated by content (magic bytes, size caps, archive rejection) and rate-limited; the application demands BIR registration documents, government IDs, and +63-format contacts; and nothing is created until a human — the super admin — reviews the documents and approves. Approval, not submission, is the trust boundary.

**Q: How do the three seeded clinics differ in configuration?**
A: Structurally they're identical rows — that's the multi-tenant point. Each configures its own hours, closures, services, staff, reservation-fee policy, password expiry, and retention independently through Settings; features like single-session mode are per-clinic toggles on the `Clinic` model.

---
Further reading: [`docs/features.md`](../features.md), [`docs/super-admin.md`](../super-admin.md).

# Super Admin

## Overview

The Super Admin is a privileged account (role `0`) that sits above all clinic-scoped roles. It has no affiliation with any specific clinic and can enter any clinic's admin panel without being a registered user of that clinic.

---

## Credentials (seed)

| Field    | Value                          |
|----------|-------------------------------|
| Email    | `superadmin@intellident.app`  |
| Password | `12345678`                    |
| Role     | `0` (SUPERADMIN)              |
| Clinic   | none                          |

Run the seed once to create the account:

```bash
node prisma/seed-super.js
```

Safe to run multiple times — skips if the account already exists.

---

## How It Works

### 1. Login
Super admin signs in through the normal `/sign-in` page. Because their `clinicId` is `null` in the database, the sign-in redirect sends them to `/super` instead of `/{clinicId}/dashboard`.

### 2. Clinic Picker (`/super`)
The `/super` page has two tabs:
- **Clinics tab** — lists all active clinics (name, code, address, contact info); each card has an "Enter as Admin" button.
- **Applications tab** — lists all `ClinicApplication` records; Super Admin can approve or reject pending applications. Approving creates a new `Clinic` record in a single transaction and emails the applicant a sign-up link. Rejecting emails the applicant with the optional notes as a reason.

- Route: `app/(main)/super/`
- Layout: `app/(main)/super/layout.jsx` — guards the route; redirects to `/sign-in` if the session role is not `0`
- Page component: `app/modules/super-page/SuperPage.jsx`

### 3. Entering a Clinic
Clicking "Enter as Admin" calls:

```
POST /api/super/enter
Body: { clinicId }
```

The API:
1. Verifies the session user has role `0`
2. Verifies the clinic exists
3. Updates the session cookie — sets `clinicId` to the chosen clinic and adds `superAdmin: true`
4. Writes an audit log entry (`action: VIEW`, `entity: Clinic`, metadata: `superadmin-enter`)
5. Returns the `clinicId`; the client then redirects to `/{clinicId}/dashboard`

### 4. Inside the Clinic
The `[clinicId]/layout.jsx` detects `session.superAdmin === true` and:
- Maps role `0` → `effectiveRole = ADMIN` so the full admin sidebar and pages are available
- Passes `isSuperAdmin={true}` to `AppSidebar`

The sidebar shows a **"Back to Super Admin"** button at the bottom (above sign out).

### 5. Exiting a Clinic
Clicking "Back to Super Admin" calls:

```
POST /api/super/exit
```

The API:
1. Verifies the session user has role `0`
2. Resets the session — clears `clinicId` and removes the `superAdmin` flag
3. The client redirects to `/super`

---

## Session Shape

| State | `clinicId` | `superAdmin` |
|---|---|---|
| Just logged in | `null` | not set |
| Inside a clinic | `{chosen clinic id}` | `true` |
| After exiting | `null` | not set |

---

## File Map

| File | Purpose |
|---|---|
| `prisma/seed-super.js` | Creates the super admin user |
| `app/(main)/super/layout.jsx` | Route guard — role 0 only |
| `app/(main)/super/page.jsx` | Server component — fetches all clinics |
| `app/modules/super-page/SuperPage.jsx` | Two-tab portal: Clinics + Applications |
| `app/modules/super-page/ApplicationsTab.jsx` | Clinic application list; approve/reject UI |
| `app/api/super/enter/route.js` | Sets session clinicId + superAdmin flag |
| `app/api/super/exit/route.js` | Resets session to super state |
| `app/api/super/clinic-applications/route.js` | `GET` — list all applications (filterable by status) |
| `app/api/super/clinic-applications/[id]/route.js` | `PATCH` — approve or reject an application |
| `app/api/clinic-applications/route.js` | `POST` — public submission (rate-limited: 5/hr per IP) |
| `app/api/clinic-applications/documents/route.js` | `POST` — Supabase file upload for BIR docs + applicant IDs |
| `app/modules/dashboard-page/ExitSuperAdminButton.jsx` | "Back to Super Admin" button |
| `app/api/super/clinics/[id]/backup/route.js` | Backup export endpoint |
| `app/api/super/clinics/[id]/restore/request-otp/route.js` | OTP request for restore |
| `app/api/super/clinics/[id]/restore/confirm/route.js` | OTP confirmation + audit token |
| `app/modules/super-page/RestoreModal.jsx` | 3-step restore wizard UI |
| `lib/roles.js` | `ROLES.SUPERADMIN = 0` |
| `lib/auth.js` | `setSession(..., superAdmin)` — stores flag in cookie |

---

## Clinic Application Flow

Clinics that are not yet in the system can request onboarding via the public sign-up page ("Register a Clinic" tab).

### Submission (`POST /api/clinic-applications`)
- Public endpoint — no session required
- Rate-limited: 5 submissions per IP per hour
- Required fields: clinic name, business address, business phone (+63 format), business email, contact person name/phone/email, ≥1 BIR document URL, ≥1 applicant ID URL
- Documents must be uploaded first via `POST /api/clinic-applications/documents` (rate-limited: 50/hr per IP); only Supabase `clinic-documents` bucket URLs are accepted — arbitrary external URLs are rejected
- File upload enforces: max 5 MB, JPEG/PNG/PDF only (magic-byte validated), no compressed archives (ZIP/RAR/7-Zip/GZIP/BZIP2/XZ)
- On success: sends confirmation email to business email via `sendClinicApplicationReceived`
- Applicant must also accept the Terms of Service before submitting

### Review (`GET /api/super/clinic-applications`)
Super admin fetches all applications, optionally filtered by `?status=PENDING|APPROVED|REJECTED`.

### Decision (`PATCH /api/super/clinic-applications/[id]`)
Body: `{ "action": "APPROVE" | "REJECT", "notes": "..." }` (notes only required for REJECT)

**APPROVE:**
1. Generates a clinic code from the clinic name initials (up to 5 chars)
2. Creates a `Clinic` record and links it to the `ClinicApplication` in a single DB transaction
3. Emails applicant with a sign-up link via `sendClinicApplicationApproved`

**REJECT:**
1. Updates status to `REJECTED`; stores optional notes as rejection reason
2. Emails applicant with reason via `sendClinicApplicationRejected`

Only PENDING applications can be processed — attempting to re-process returns 409.

---

## Backup & Restore

Super admins can export a clinic's data and initiate a restore workflow from within the clinic admin panel.

### Backup (`GET /api/super/clinics/[id]/backup`)

- Requires superadmin role + valid step-up authentication (re-entered password within 15 min)
- Exports a timestamped JSON file containing: clinic profile, patients, services, appointments, billing records, and the last 5,000 audit log entries
- **Excludes `PatientRecord` notes** — those are E2EE-encrypted and the server never holds the plaintext key
- Audit-logged as `action: BACKUP, entity: Clinic`

### Restore — 3-step wizard (`RestoreModal.jsx`)

The restore flow does not directly modify the database — it produces a confirmation token that the superadmin then uses in the Neon console to trigger a point-in-time restore.

**Step 1 — Reason**
The superadmin enters a free-text reason for the restore (stored in the audit log).

**Step 2 — OTP request (`POST /api/super/clinics/[id]/restore/request-otp`)**
- Requires superadmin role + valid step-up
- Rate-limited: 5 requests per 15 minutes per IP
- Sends a 6-digit OTP to the superadmin's registered email (10-minute expiry, max 5 verification attempts)

**Step 3 — Confirmation (`POST /api/super/clinics/[id]/restore/confirm`)**
- Validates the OTP code
- Creates and returns a confirmation token (UUID)
- Writes an audit log entry (`action: RESTORE`) with the reason, confirmation token, and snapshot reference
- The superadmin uses the confirmation token as an incident reference when performing the actual restore in the Neon dashboard

---

## Security Notes

- The `/super` route is guarded server-side — any non-zero role is rejected before rendering
- `POST /api/super/enter` and `POST /api/super/exit` both verify role `0` from the database, not just the session, before acting
- Every clinic entry is written to `AuditLog` (`action: VIEW`, metadata includes `superadmin-enter`)
- The super admin can use all ADMIN features inside a clinic (users, services, appointments, settings, audit log) but does not have a patient/dentist/receptionist profile record in that clinic
- Because `clinicId` is set in the session when inside a clinic, all existing zero-trust DB queries continue to work without modification

# IntelliDent — Feature Tracker

Track of all features built, in-progress, and pending. Update this file as features are completed.

---

## Legend
- `[x]` Done
- `[-]` Partial / In Progress
- `[ ]` Not started

---

## Authentication & User Management

| Feature | Status | Notes |
|---|---|---|
| Sign up + email verification | `[x]` | Two-phase: `EmailVerification` → `User` on verify |
| Confirm password on sign-up | `[x]` | Client validation + submit guard |
| Middle initial field | `[x]` | `User.middleInitial`; flows through sign-up, profile, admin create |
| Sign-up no auto-login | `[x]` | Redirects to `/sign-in?verified=success` only |
| Sign in / sign out | `[x]` | Session-based, cookie-signed |
| MFA — email OTP | `[x]` | 6-digit, 10 min expiry, 5-attempt limit, bcrypt-hashed |
| Password policy enforcement | `[x]` | 8+ chars, upper, lower, digit, special |
| Account lockout | `[x]` | 5 attempts / 5 min → locked 15 min |
| Session expiry + inactivity logout | `[x]` | 30 min inactivity via `InactivityProvider` |
| Remember Me | `[x]` | 3-day session |
| Forgot / reset password | `[x]` | Email link, 10 min token |
| Change password | `[x]` | Re-wraps master key |
| Password history | `[x]` | Cannot reuse last 3 |
| RBAC sidebar | `[x]` | Role-aware nav per role |
| View + paginate + sort users | `[x]` | Admin only |
| Edit user role | `[x]` | Admin only |
| Delete user (soft delete) | `[x]` | Auto-logout if self |
| Activate / deactivate user | `[x]` | Blocked at sign-in when inactive |
| Create user (admin) | `[x]` | Default password `Intellident2026#`, E2EE key generated client-side |
| hCaptcha on login | `[ ]` | Planned — `@hcaptcha/react-hcaptcha`, needs site key + secret key in env |

---

## Clinic Settings

| Feature | Status | Notes |
|---|---|---|
| Clinic profile | `[x]` | Name, address, email, phone, landline |
| Clinic logo upload | `[x]` | Supabase Storage `clinic-logos` bucket |
| Operating hours | `[x]` | Working days + open/close time |
| Operating hours presets | `[x]` | `SchedulePreset` model; save/apply/delete presets; applied indicator |
| Clinic closure dates | `[x]` | Holidays/maintenance dates |

---

## Service Catalog

| Feature | Status | Notes |
|---|---|---|
| Create / edit / delete services | `[x]` | Admin only |
| Duration, price, buffer time | `[x]` | Per service |
| Assign dentists to services | `[x]` | Many-to-many `ServiceDentists` |

---

## Appointment Scheduling

| Feature | Status | Notes |
|---|---|---|
| Receptionist/Admin: create appointment | `[x]` | Patient, service, dentist or "Any Available" |
| Receptionist/Admin: calendar views | `[x]` | Day / Week / Month + List view |
| Receptionist/Admin: filters + search | `[x]` | Dentist, service, status, patient name, appt ID |
| Receptionist/Admin: status transitions | `[x]` | Full history timeline |
| Receptionist/Admin: cancel appointment | `[x]` | Optional reason |
| Receptionist/Admin: conflict detection | `[x]` | Double-booking prevention |
| Receptionist/Admin: hours + closure enforcement | `[x]` | Validates against clinic schedule |
| Receptionist/Admin: appointment codes | `[x]` | `APT-{CODE}-{DATE}-{####}` |
| Receptionist/Admin: pending badge | `[x]` | Sidebar badge + "Booking Requests" filter |
| Patient: self-booking | `[x]` | Multi-step: service → dentist → date → slots → notes → confirm |
| Patient: view own appointments | `[x]` | Upcoming + past |
| Patient: cancel own appointments | `[x]` | PENDING or CONFIRMED only |
| Dentist: read-only calendar | `[x]` | Day / Week view |
| Rescheduling flow | `[ ]` | Status exists; no UI form yet |
| AI slot suggestions | `[ ]` | Planned — GPT-5 |

---

## Notifications & Reminders

| Feature | Status | Notes |
|---|---|---|
| In-app notification bell | `[x]` | All roles, page header |
| Framer Motion notification drawer | `[x]` | Slide-in on bell click |
| In-app notifications for all events | `[x]` | Booking, confirm, cancel, complete, no-show, reschedule, 24h/2h reminders |
| Email notifications via Mailjet | `[x]` | All notification types |
| Vercel cron reminders | `[x]` | Every 15 min, `CRON_SECRET` protected |
| Mark read (single + all) | `[x]` | |

---

## Patient Record Management

| Feature | Status | Notes |
|---|---|---|
| DB schema | `[x]` | `PatientRecord`, `Attachment`, E2EE fields, `contentHash` |
| Dentist: patient list | `[x]` | Paginated + searchable |
| Dentist: view patient records | `[x]` | Click row → right-side drawer |
| Dentist: create record | `[x]` | Title + notes; `POST /api/records/[patientId]` |
| Dentist: edit record | `[x]` | Title, notes, status; `PATCH /api/records/[patientId]/[recordId]` |
| Dentist: delete record | `[x]` | Soft delete; `DELETE /api/records/[patientId]/[recordId]` |
| Patient: My Dental Records page | `[x]` | `/my-records`; Clinical Records + Visit History tabs |
| E2EE for record notes | `[ ]` | Currently stored as plaintext in `encryptedData` — needs proper AES-GCM wiring |
| `contentHash` tamper detection | `[ ]` | Field exists; SHA-256 compute + verify not wired to API yet |

---

## Billing & Payment

| Feature | Status | Notes |
|---|---|---|
| DB schema | `[x]` | `Billing`, `Payment`, `PaymentStatus` enum |
| Billing creation | `[ ]` | API + UI not built |
| Payment recording | `[ ]` | |
| Receipt tracking | `[ ]` | |

---

## Audit Logging

| Feature | Status | Notes |
|---|---|---|
| DB schema | `[x]` | `AuditLog`, `AuditAction` enum |
| Audit log UI | `[ ]` | Admin-only query/display page not built |

---

## Other

| Feature | Status | Notes |
|---|---|---|
| Virtual Assistant / Chatbot | `[ ]` | Planned |
| Reporting & Exports | `[ ]` | Planned |
| Integrity verification (tamper detection) | `[-]` | Schema field exists; not wired |

---

## Recent Changes

| Date | Change |
|---|---|
| 2026-05-05 | Added confirm password to sign-up |
| 2026-05-05 | Added middle initial to sign-up, profile, admin user creation |
| 2026-05-05 | Added operating hours presets (`SchedulePreset` model) |
| 2026-05-05 | Added patient My Dental Records page (`/my-records`) |
| 2026-05-05 | Added dentist record management (create/edit/delete via drawer) |
| 2026-05-05 | Fixed sign-up auto-login — now redirects to sign-in after verification |
| 2026-05-05 | Fixed `/verify-otp` and `/reset-password` Suspense + `force-dynamic` for Vercel build |

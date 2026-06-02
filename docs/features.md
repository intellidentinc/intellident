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
| Create user (admin) | `[x]` | Default password `Intellident2026#`, E2EE key generated client-side; welcome email sent via `sendStaffWelcomeEmail` |
| Staff account welcome email | `[x]` | Sent on admin-created accounts; contains email + temp password |
| Terms of Service on registration | `[x]` | Required acceptance checkbox + modal (`TermsDialog.jsx`) on sign-up and clinic application |
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
| Rescheduling flow | `[x]` | `RescheduleAppointmentModal`; real-time conflict check; reason field |
| AI slot suggestions | `[x]` | gpt-5 via `lib/ai.js`; fallback algorithmic tagging if AI call fails |

---

## Notifications & Reminders

| Feature | Status | Notes |
|---|---|---|
| In-app notification bell | `[x]` | All roles, page header |
| Framer Motion notification drawer | `[x]` | Slide-in on bell click |
| In-app notifications for all events | `[x]` | Booking, confirm, cancel, complete, no-show, reschedule, 24h/2h reminders |
| Email notifications via Gmail/nodemailer | `[x]` | All notification types |
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
| E2EE for record notes | `[x]` | AES-GCM-256 wired in `RecordFormModal.jsx`; server never sees plaintext |
| `contentHash` tamper detection | `[x]` | SHA-256 computed on write, verified on read; tamper warning shown on mismatch |

---

## Billing & Payment

| Feature | Status | Notes |
|---|---|---|
| DB schema | `[x]` | `Billing`, `Payment`, `PaymentStatus` enum |
| Full CRUD API | `[x]` | `GET/POST /api/billing`, `GET/PATCH /api/billing/[id]` |
| Admin/Receptionist billing UI | `[x]` | `BillingPage`, `BillingDetailDrawer`, `RecordPaymentModal` |
| PDF receipts | `[x]` | `BillingReceiptDocument` via `@react-pdf/renderer` |
| Patient billing page | `[x]` | `MyBillingPage` — outstanding bills, Pay Now, receipt download |
| PayMongo checkout | `[x]` | `POST /api/billing/[id]/checkout`; GCash/Maya QR working |
| PayMongo webhook | `[x]` | `/api/webhooks/paymongo`; HMAC-verified; idempotent |
| Auto-billing on COMPLETED | `[x]` | Billing record created when appointment marked COMPLETED |
| Reservation fee at booking | `[x]` | `POST /api/schedules` — best-effort checkout on confirm |
| Receipt number generation | `[x]` | Atomic via PostgreSQL advisory lock |

---

## Audit Logging

| Feature | Status | Notes |
|---|---|---|
| DB schema | `[x]` | `AuditLog`, `AuditAction` enum |
| Audit log API | `[x]` | `GET /api/audit-log` (paginated, filtered, sortable) + CSV/PDF export |
| Audit log UI | `[x]` | Admin-only; expandable rows, action/entity/date/search filters |

---

## Clinic Onboarding

| Feature | Status | Notes |
|---|---|---|
| Clinic application form (public) | `[x]` | `POST /api/clinic-applications`; rate-limited 5/hr per IP |
| Document upload for applications | `[x]` | `POST /api/clinic-applications/documents`; magic-byte validation; compressed file rejection |
| Terms of Service on application | `[x]` | Required acceptance before submission |
| Super admin application review | `[x]` | `ApplicationsTab.jsx` in SuperPage; approve + reject UI |
| Approve → auto-create clinic | `[x]` | Atomic DB transaction creates `Clinic` + links application |
| Approval email | `[x]` | `sendClinicApplicationApproved` — sends sign-up link |
| Rejection email | `[x]` | `sendClinicApplicationRejected` — sends optional rejection reason |
| Application submission email | `[x]` | `sendClinicApplicationReceived` — confirmation to applicant |

---

## Other

| Feature | Status | Notes |
|---|---|---|
| Virtual Assistant / Chatbot | `[x]` | gpt-5 via `lib/ai.js`; multi-turn; role-aware tools; system prompt cached 5 min; session-persistent; drawer UI |
| Reporting & Exports | `[x]` | Three-tab (Appointments, Revenue, Patients); CSV + PDF; ADMIN only |
| Integrity verification (tamper detection) | `[x]` | `contentHash` SHA-256 on every record write; verified on read |
| Compressed file upload rejection | `[x]` | Magic-byte detection for ZIP/RAR/7z/GZIP/BZIP2/XZ on all upload endpoints |

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
| 2026-05-27 | Added staff welcome email (`sendStaffWelcomeEmail`) on admin-created accounts |
| 2026-06-03 | Migrated AI from Gemini 2.5 Flash to OpenAI gpt-5 (`lib/ai.js`); system prompt caching; history window 5 msgs; `max_completion_tokens: 300` |
| 2026-05-31 | Added clinic onboarding — application form, document upload, super admin review, approve/reject flow |
| 2026-05-31 | Added Terms of Service acceptance to sign-up and clinic application |
| 2026-05-31 | Added compressed file upload rejection (magic-byte scan) to all upload endpoints |

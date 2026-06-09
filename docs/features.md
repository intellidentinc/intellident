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
| Create user (admin) | `[x]` | Random temporary password generated server-side; auto-generated username `{CLINICCODE}-{LASTNAME}-{####}`; `mustChangePassword: true` set on creation; E2EE key generated client-side; welcome email sent via `sendStaffWelcomeEmail` |
| Staff account welcome email | `[x]` | Sent on admin-created accounts; contains email, username, and randomly generated temp password |
| First-login forced password change | `[x]` | Staff accounts have `mustChangePassword: true`; sign-in returns flag → client redirects to `/change-password?reason=first-login`; flag cleared on successful change |
| Auto-generated username | `[x]` | Format `{CLINICCODE}-{LASTNAME}-{####}` with collision-safe increment; stored in `User.username`; shown in user table, profile, and welcome email |
| Admin password expiry (90-day) | `[x]` | Per-clinic toggle in Settings → Password Policy; `Clinic.passwordExpiryEnabled`; ADMIN accounts get `passwordExpiresAt = now + 90 days` on each password change; expired accounts redirected to `/change-password?reason=expired` on sign-in |
| Terms of Service on registration | `[x]` | Required acceptance checkbox + modal (`TermsDialog.jsx`) on sign-up and clinic application |
| DB-backed session validation | `[x]` | `UserSession` model; `sessionToken` in cookie validated on every `getSession()` call; `terminatedAt` enables server-side invalidation |
| Single-session mode | `[x]` | Per-clinic toggle in Settings → Password Policy (`singleSessionEnabled`); new login terminates previous session in DB |
| Known device tracking | `[x]` | `KnownDevice` model; stores user agent hash + IP per user; `firstSeenAt` + `lastSeenAt` |
| Step-up authentication | `[x]` | `POST/GET /api/auth/step-up`; `StepUpModal.jsx`; 15-min TTL; required before audit log + report exports |
| 8-hour hard session cap | `[x]` | Middleware enforces absolute 8-hour session limit regardless of sliding renewal |
| Suspicious login alert email | `[x]` | `sendSuspiciousLoginAlert` fires on sign-in from a new or previously unseen device/IP; `requiresStepUp: true` returned so client prompts re-auth |
| Account locked alert email | `[x]` | `sendAccountLockedAlert` fires when sign-in triggers account lockout; warns user via email |
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
| Password expiry policy toggle | `[x]` | `Clinic.passwordExpiryEnabled`; MUI Switch in Settings → Password Policy section; applies to ADMIN role accounts |
| Single-session mode toggle | `[x]` | `Clinic.singleSessionEnabled`; MUI Switch in Settings → Password Policy; terminates prior session on new login |
| Audit log retention settings | `[x]` | `Clinic.auditLogRetentionDays`; configurable in Settings via `ClinicAuditRetentionSettings.jsx`; auto-purge cron at `/api/cron/audit-purge` |
| Patient record retention settings | `[x]` | `Clinic.patientRecordRetentionDays`; configurable in Settings via `ClinicDataRetentionSettings.jsx`; purge cron at `/api/cron/audit-purge` cascades `RecordHistory` + `Attachment` |
| Billing retention settings | `[x]` | `Clinic.billingRetentionDays`; configurable in Settings via `ClinicDataRetentionSettings.jsx`; purge cron cascades `Payment` records |
| Notification settings | `[x]` | `Clinic.reminder1Hours` + `Clinic.reminder2Hours` (defaults 24h/2h); `Clinic.notifConfig` JSON; `ClinicNotificationSettings.jsx` in Settings |

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
| No-show risk flag (staff) | `[x]` | HIGH risk badge + tooltip shown in both `AppointmentDetailModal` and `CreateAppointmentModal`; "AI Suggested Actions" box with recommended remediation |

---

## Notifications & Reminders

| Feature | Status | Notes |
|---|---|---|
| In-app notification bell | `[x]` | All roles, page header |
| Framer Motion notification drawer | `[x]` | Slide-in on bell click |
| In-app notifications for all events | `[x]` | Booking, confirm, cancel, complete, no-show, reschedule, 24h/2h reminders |
| Email notifications via Gmail/nodemailer | `[x]` | All notification types |
| Vercel cron reminders | `[x]` | Daily at 08:00 UTC, `CRON_SECRET` protected |
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
| Audit log API | `[x]` | `GET /api/audit-log` (paginated, filtered, sortable) + CSV/PDF export (step-up auth required) |
| Audit log UI | `[x]` | Admin-only; expandable rows, action/entity/date/search filters |
| Audit log retention + purge | `[x]` | `Clinic.auditLogRetentionDays`; `/api/cron/audit-purge` prunes records older than configured retention |

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

## Data Subject Rights (DSAR)

| Feature | Status | Notes |
|---|---|---|
| Patient data rights request form | `[x]` | `DataRightsDialog.jsx` in patient profile — submit ACCESS, CORRECTION, or DELETION requests |
| Admin DSAR review | `[x]` | `DataRequestsPage.jsx` + `ReviewRequestModal.jsx`; filter by status (PENDING/IN_REVIEW/RESOLVED/REJECTED) |
| DSAR API | `[x]` | `GET/POST /api/data-requests`; `PATCH /api/data-requests/[id]`; scoped to clinicId |
| Patient sidebar entry | `[x]` | "Data Requests" sidebar item under Profile group for PATIENT role |

---

## Patient Record History

| Feature | Status | Notes |
|---|---|---|
| Record edit diff log | `[x]` | `RecordHistory` model; JSON diff stored on every `PATCH` to `PatientRecord` |
| History API | `[x]` | `GET /api/records/[patientId]/[recordId]/history` — returns ordered history for a record |

---

## Backup & Restore

| Feature | Status | Notes |
|---|---|---|
| Super admin: backup clinic data | `[x]` | `GET /api/super/clinics/[id]/backup`; step-up auth required; exports clinic profile, patients, services, appointments, billing, and last 5,000 audit logs as a timestamped JSON download; excludes E2EE `PatientRecord` entries (server never has plaintext); audit-logged as `BACKUP` |
| Super admin: restore flow (3-step) | `[x]` | `RestoreModal.jsx` — reason → OTP verification → confirmation; `POST /api/super/clinics/[id]/restore/request-otp` rate-limited 5/15 min; OTP sent to superadmin email (10 min expiry, max 5 attempts); `POST /api/super/clinics/[id]/restore/confirm` validates OTP + returns confirmation token for Neon point-in-time restore reference; audit-logged as `RESTORE` |

---

## Performance & Reliability

| Feature | Status | Notes |
|---|---|---|
| Loading skeletons | `[x]` | Skeleton screens for all major pages via `loading.jsx` files in route segments |
| Platform hardening | `[x]` | `compress: true`, `poweredByHeader: false`; 6 security headers in `next.config.mjs`: CSP, HSTS (preload), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy |
| Middleware clinic check | `[x]` | Clinic enabled status cached via `unstable_cache` (60s); blocks disabled clinics at edge |
| Health endpoint | `[x]` | `GET /api/health` — `CRON_SECRET` protected; pings DB with `SELECT 1` |
| Breach scan cron | `[x]` | `/api/cron/breach-scan`, daily at 02:00 UTC; detects distributed brute-force (same IP locks 3+ accounts), mass record access (100+ patient records viewed by one user in 24h), bulk export (5+ exports by one user in 24h); creates `BREACH_ALERT` audit log entry + emails clinic admins |

---

## Other

| Feature | Status | Notes |
|---|---|---|
| Virtual Assistant / Chatbot | `[x]` | gpt-5 via `lib/ai.js`; multi-turn; role-aware tools; system prompt cached 5 min; session-persistent; drawer UI |
| Reporting & Exports | `[x]` | Three-tab (Appointments, Revenue, Patients); CSV + PDF; ADMIN only; step-up auth required for export |
| Integrity verification (tamper detection) | `[x]` | `contentHash` SHA-256 on every record write; verified on read |
| Record edit history | `[x]` | `RecordHistory` model stores JSON diff on every `PatientRecord` update |
| Compressed file upload rejection | `[x]` | Magic-byte detection for ZIP/RAR/7z/GZIP/BZIP2/XZ on all upload endpoints |
| Magic-byte file type validation | `[x]` | Logo upload validates JPEG/PNG magic bytes; clinic document upload validates JPEG/PNG/PDF |

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
| 2026-06-03 | Added first-login forced password change for admin-created staff accounts (`mustChangePassword` flag) |
| 2026-06-03 | Replaced hardcoded `Intellident2026#` with randomly generated 8–12 char temporary password on staff account creation |
| 2026-06-03 | Added auto-generated username (`{CLINICCODE}-{LASTNAME}-{####}`) for Dentist/Receptionist accounts; shown in user table, profile, and welcome email |
| 2026-06-03 | Added Admin password expiry — 90-day optional toggle per clinic; ADMIN accounts get `passwordExpiresAt` set on each password change; expired accounts intercepted at sign-in |
| 2026-06-03 | Migrated AI from Gemini 2.5 Flash to OpenAI gpt-5 (`lib/ai.js`); system prompt caching; history window 5 msgs; `max_completion_tokens: 300` |
| 2026-05-31 | Added clinic onboarding — application form, document upload, super admin review, approve/reject flow |
| 2026-05-31 | Added Terms of Service acceptance to sign-up and clinic application |
| 2026-05-31 | Added compressed file upload rejection (magic-byte scan) to all upload endpoints |
| 2026-06-03 | DB-backed session validation via `UserSession` model; `sessionToken` validated on every `getSession()` call; server-side session termination via `terminatedAt` |
| 2026-06-03 | Added `KnownDevice` tracking model — user agent hash + IP per user |
| 2026-06-03 | Added single-session mode per clinic (`Clinic.singleSessionEnabled`) — new login terminates prior session |
| 2026-06-03 | Added step-up authentication (`POST/GET /api/auth/step-up`, `StepUpModal.jsx`); required before audit log + report CSV/PDF exports |
| 2026-06-03 | Added 8-hour hard session cap in middleware |
| 2026-06-03 | Added `DataRequest` model + full DSAR module — patients request ACCESS/CORRECTION/DELETION; admins review via `DataRequestsPage.jsx` |
| 2026-06-03 | Added `RecordHistory` model — JSON diff stored on every `PatientRecord` edit; `GET /api/records/[patientId]/[recordId]/history` |
| 2026-06-03 | Added `ClinicAuditRetentionSettings.jsx` + `Clinic.auditLogRetentionDays` + audit purge cron (`/api/cron/audit-purge`) |
| 2026-06-03 | Added `ClinicNotificationSettings.jsx` — configurable reminder hours (`reminder1Hours`, `reminder2Hours`) and notification config JSON |
| 2026-06-03 | Added loading skeletons (`loading.jsx`) for all major route segments |
| 2026-06-03 | `next.config.mjs` — added `compress: true`, `poweredByHeader: false`, image remote patterns |
| 2026-06-03 | Middleware: clinic enabled check cached via `unstable_cache`; 8-hour hard cap; terms-of-service gate route added (`/accept-terms`) |
| 2026-06-03 | Added health endpoint (`GET /api/health`, `CRON_SECRET` protected) |
| 2026-06-03 | Magic-byte validation added to clinic logo upload (`detectLogoType()` — JPEG/PNG); closes LOW-03 |
| 2026-06-08 | Added data retention controls for all 3 types — patient records (`Clinic.patientRecordRetentionDays`), billing (`Clinic.billingRetentionDays`), and audit logs; `ClinicDataRetentionSettings.jsx`; purge cron at `/api/cron/audit-purge` |
| 2026-06-08 | Added in-app backup and restore for super admin — `GET /api/super/clinics/[id]/backup` (step-up required, JSON export); 3-step OTP-confirmed restore flow via `RestoreModal.jsx` |
| 2026-06-08 | No-show risk flag now shown in `CreateAppointmentModal` in addition to `AppointmentDetailModal` (commit `21a64d4`) |
| 2026-06-08 | Added daily breach scan cron (`/api/cron/breach-scan`, 02:00 UTC) — detects brute-force, mass record access, bulk export patterns; `BREACH_ALERT` audit entries + admin email alerts |
| 2026-06-07 | Added 6 HTTP security headers in `next.config.mjs`: CSP (default-src self, script-src self unsafe-inline), HSTS (max-age=63072000; includeSubDomains; preload), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (closes security gap) |
| 2026-06-07 | Patched TOCTOU race in rate limiter (`lib/rateLimit.js`) — replaced `findFirst → create/update` with atomic `$executeRaw` UPDATE WHERE `count < maxRequests`; fixes MED-01 |
| 2026-06-07 | Added missing audit log coverage to records API (`GET /api/records`, `GET /api/patient/records`, record views), audit-log export, and reports export |
| 2026-06-07 | Added suspicious login alert email (`sendSuspiciousLoginAlert`) — fires on sign-in from new or different-IP device; returns `requiresStepUp: true` to force step-up re-auth |
| 2026-06-07 | Added account locked alert email (`sendAccountLockedAlert`) — fires when repeated failed attempts trigger account lockout |

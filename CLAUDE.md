# IntelliDent — CLAUDE.md

## What This Is

IntelliDent is a capstone project by four BS Information Technology (Cybersecurity) students from FEU Institute of Technology. It is an AI-powered, multi-tenant scheduling and patient record system for a network of three partner dental clinics:

- Maria Laura Cruz Dental Clinic
- KH Dental Aesthetics
- Cabasal Dental Clinic

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | JavaScript (JSX) |
| UI Library | MUI v7 (system pages) + Tailwind CSS (landing page only) |
| Date Picker | `@mui/x-date-pickers` v8 + `dayjs` adapter |
| Calendar | `react-big-calendar` + `dayjsLocalizer` |
| Animation | Framer Motion (`AnimatePresence` + `motion.div`) |
| Database ORM | Prisma + PostgreSQL (Neon) |
| Auth | Custom session-based (cookies via `lib/auth.js`) |
| Encryption | Web Crypto API — AES-GCM E2EE, PBKDF2 key derivation |
| File Storage | Supabase Storage (`clinic-logos` bucket) |
| Email | Gmail SMTP via nodemailer (`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME`) |
| Cron | Vercel Cron Jobs (every 15 min) → `CRON_SECRET` bearer token |
| AI | Gemini 2.5 Flash (current) — slot suggestions (`app/api/ai/slots`) + virtual assistant chatbot (`app/api/ai/chat`); **planned migration to OpenAI — not yet integrated** |
| Analytics | Vercel Analytics |

---

## File Structure

```
app/
├── (main)/                   # Route group — wraps all authenticated + auth pages
│   ├── layout.jsx            # Mounts ThemeRegistry, CryptoProvider, ToastProvider, InactivityProvider
│   ├── page.jsx              # Landing page (Tailwind only)
│   ├── super/                # Super admin portal (role 0 only)
│   │   ├── layout.jsx        # Guards: role must be SUPERADMIN
│   │   └── page.jsx          # Clinic picker — server-fetches all clinics
│   ├── [clinicId]/           # Authenticated clinic-scoped routes
│   │   ├── layout.jsx        # Session + clinic guard; fetches role, clinic name/logo, pendingCount for sidebar; super admin enters with effectiveRole=ADMIN
│   │   ├── dashboard/page.jsx
│   │   ├── appointments/page.jsx   # RECEPTIONIST + ADMIN
│   │   ├── schedule/page.jsx       # DENTIST — their own calendar
│   │   ├── schedules/page.jsx      # PATIENT — book + view own appointments
│   │   ├── records/page.jsx        # DENTIST — patient records
│   │   ├── my-records/page.jsx     # PATIENT — My Dental Records (E2EE decrypt on demand)
│   │   ├── my-billing/page.jsx     # PATIENT — My Bills + Pay Now + receipt download
│   │   ├── billing/page.jsx        # ADMIN + RECEPTIONIST — billing list + payments
│   │   ├── audit-log/page.jsx      # ADMIN — audit log query + CSV/PDF export
│   │   ├── reports/page.jsx        # ADMIN — reports (appointments, revenue, patients) + CSV/PDF export
│   │   ├── patients/page.jsx
│   │   ├── services/page.jsx
│   │   ├── users/page.jsx
│   │   ├── profile/page.jsx
│   │   └── settings/page.jsx
│   ├── sign-in/page.jsx
│   └── sign-up/page.jsx
├── api/
│   ├── auth/                 # Auth API routes (signin, signout, signup, verify, forgot-password, reset-password, change-password, verify-otp)
│   │                         # Note: sign-up creates EmailVerification (not User); verify creates the User + profile
│   ├── users/                # User list + PATCH role / DELETE / activate (ADMIN only)
│   ├── patients/             # GET (paginated) + POST (RECEPTIONIST); [id]/ PATCH + DELETE
│   ├── services/             # GET + POST (ADMIN); [id]/ PATCH + DELETE; dentists/ GET
│   ├── profile/              # GET + PATCH (any authenticated user)
│   ├── appointments/         # See Appointments API section below
│   ├── schedules/            # Patient-facing booking API (PATIENT role); [id]/ PATCH cancel; slots/ GET
│   ├── schedule/             # Dentist's own schedule API (DENTIST role only)
│   ├── records/              # DENTIST: GET patient list; [patientId]/[recordId]/ POST + PATCH + DELETE (E2EE)
│   ├── billing/              # GET + POST (ADMIN/RECEPTIONIST); [id]/ GET + PATCH; [id]/checkout/ POST (PayMongo)
│   ├── audit-log/            # GET paginated + filtered; export/ GET (CSV/PDF, up to 5000 rows) — ADMIN only
│   ├── reports/              # GET aggregated data (appointments/revenue/patients); export/ GET raw rows — ADMIN only
│   ├── patient/              # Patient-scoped routes: billing/ GET, records/ GET
│   ├── notifications/        # GET list + PATCH mark-all-read; [id]/ PATCH mark-one-read
│   ├── ai/                   # slots/ GET (Gemini slot suggestions); chat/ POST (multi-turn chatbot); risk/ GET (no-show risk)
│   ├── super/                # enter/ POST + exit/ POST — SuperAdmin clinic switching; clinic-applications/ GET + [id]/ PATCH (approve/reject)
│   ├── clinic-applications/  # POST — public submission (rate-limited 5/hr); documents/ POST — Supabase upload (rate-limited 50/hr)
│   ├── webhooks/
│   │   └── paymongo/         # POST — HMAC-verified PayMongo webhook (idempotent)
│   ├── cron/
│   │   └── reminders/        # GET — Vercel cron job; sends 24h + 2h appointment reminders
│   └── clinics/
│       ├── route.js          # GET — public (unauthenticated); lists all clinics for sign-in/sign-up selector
│       ├── schedule/         # GET session-based (any role) — for appointment form
│       ├── closures/         # GET session-based (any role) — for appointment form
│       └── [id]/
│           ├── profile/      # GET + PATCH clinic profile fields (ADMIN)
│           ├── logo/         # POST logo upload → Supabase Storage (ADMIN)
│           ├── schedule/     # GET + PATCH operating hours (ADMIN); presets/ GET + POST + DELETE
│           └── closures/     # GET + POST closure dates; [closureId]/ DELETE (ADMIN)
├── modules/                  # Page-level components (one folder per route)
│   ├── landing-page/         # Tailwind — public facing
│   ├── sign-in-page/
│   ├── sign-up-page/         # SignUpPage (join/apply mode toggle), ClinicApplicationForm, FileUploadZone, TermsDialog
│   ├── forgot-password-page/
│   ├── reset-password-page/
│   ├── change-password-page/
│   ├── verify-otp-page/
│   ├── dashboard-page/       # AppSidebar (with pendingCount badge), DashboardPage (role-aware), SignOutButton
│   ├── appointments-page/    # AppointmentsPage, AppointmentCalendar, CreateAppointmentModal, AppointmentDetailModal, CancelAppointmentModal, RescheduleAppointmentModal
│   ├── schedules-page/       # SchedulesPage (patient), BookAppointmentModal, CancelScheduleModal
│   ├── schedule-page/        # SchedulePage (dentist), ScheduleEventModal
│   ├── records-page/         # RecordsPage (dentist patient list + RecordFormModal + RecordViewModal with E2EE)
│   ├── my-records-page/      # MyDentalRecordsPage (patient) — Clinical Records + Visit History tabs
│   ├── billing-page/         # BillingPage, BillingDetailDrawer, RecordPaymentModal, BillingReceiptDocument
│   ├── my-billing-page/      # MyBillingPage (patient) — outstanding bills, Pay Now, receipt download
│   ├── audit-log-page/       # AuditLogPage — filters, expandable rows, CSV + PDF export
│   ├── reports-page/         # ReportsPage — 3 tabs, date range, stat cards, CSV + PDF export
│   ├── patients-page/        # PatientsPage, AddPatientModal, EditPatientModal, DeletePatientModal
│   ├── services-page/        # ServicesPage, ServiceFormModal, DeleteServiceModal
│   ├── rbac-page/            # RbacPage, AddUserModal, EditRoleModal, DeleteUserModal
│   ├── profile-page/         # ProfilePage
│   ├── settings-page/        # SettingsPage, ClinicLogoUpload, ClinicProfileForm, ClinicSchedule, ClinicClosures
│   ├── super-page/           # SuperPage.jsx — two tabs: Clinics + Applications; ApplicationsTab.jsx for onboarding review
│   ├── ai-chat/              # AIChatButton.jsx, AIChatDrawer.jsx — floating chat button + Framer Motion drawer
│   └── notifications/        # NotificationBell.jsx, NotificationDrawer.jsx
├── providers/                # App-level React context providers
│   ├── ThemeRegistry.jsx     # MUI + Emotion SSR setup
│   ├── ToastProvider.jsx     # Global toast/snackbar (useToast hook)
│   ├── CryptoProvider.jsx    # Holds master key in memory (useCrypto hook)
│   └── InactivityProvider.jsx # Auto logout after 30 min inactivity
components/
├── commons/                  # Reusable MUI-based UI primitives
│   ├── theme.js              # Design tokens + MUI component overrides
│   ├── Button.jsx            # Custom button with loading state
│   ├── Input.jsx             # Label-above input field (no floating label); supports error + helperText
│   ├── Select.jsx            # Custom MUI select wrapper
│   └── PageHeader.jsx        # Shared page header — SidebarTrigger + page title + NotificationBell
└── ui/                       # shadcn/ui primitives (used by sidebar + layout)
    ├── button.jsx, input.jsx, separator.jsx
    ├── sheet.jsx, sidebar.jsx, skeleton.jsx, tooltip.jsx
lib/
├── auth.js                   # Session helpers (getSession, setSession, clearSession)
├── prisma.js                 # Prisma client singleton
├── crypto.js                 # Web Crypto API helpers (E2EE)
├── supabase.js               # Supabase client (service role — server-side only)
├── notifications.js          # In-app + email notification helpers (see Notification System section)
├── email.js                  # Gmail/nodemailer email helpers (auth emails + appointment notifications + staff welcome + clinic application emails)
├── validate.js               # Input sanitization helpers (parseJsonBody, sanitizeEmail, str, secret, bool, hexToken)
├── rateLimit.js              # DB-backed IP rate limiter — checkRateLimit(key, max, windowSeconds)
└── utils.js                  # cn() — clsx + tailwind-merge class name helper
prisma/
├── schema.prisma
└── seed.js                   # Seeds 3 clinics + 4 users per clinic (all roles) + profile records
vercel.json                   # Vercel Cron Job configuration
```

---

## Architecture Rules

### Page Structure
Every `page.jsx` contains **only** metadata + one import. All content lives in `app/modules/[page-name]/`.

```jsx
// app/(main)/[clinicId]/settings/page.jsx
import SettingsPage from '@/app/modules/settings-page/SettingsPage';
export const metadata = { title: 'Settings | IntelliDent' };
export default function Page() { return <SettingsPage />; }
```

### Module Structure
Each page module lives in `app/modules/[page-name]/`. Page-specific sub-components go in the **same folder** — not in `components/`.

### Components vs Commons
- `components/commons/` — base MUI UI primitives used system-wide (Button, Input, PageHeader)
- `components/` root — truly reusable system-wide components (not page-specific)
- Page-specific components — stay inside their own `app/modules/[page-name]/` folder

### Page Header
Every authenticated page uses `<PageHeader title="..." />` from `components/commons/PageHeader.jsx`.
- Renders: `SidebarTrigger` | divider | page title | `NotificationBell`
- Do **not** add a custom `<header>` in page modules — use `PageHeader` instead
- It is a client component; Next.js App Router allows server components to import it

### Styling Rules
- **Landing page** (`app/modules/landing-page/`) → Tailwind CSS only
- **All system pages** (dashboard, auth, settings, etc.) → MUI only, no Tailwind
- Never mix Tailwind and MUI in the same component
- Exception: `SidebarInset` header bar uses Tailwind utility classes (from shadcn sidebar)

### Providers
- `ThemeRegistry` — MUI SSR, wraps everything in `(main)`
- `CryptoProvider` — holds the decrypted master key in memory, cleared on sign-out
- `ToastProvider` — global toast via `useToast()` hook
- `InactivityProvider` — tracks user activity; auto signs out after 30 min of inactivity on authenticated pages

---

## Design System

All tokens are defined in `components/commons/theme.js`.

| Token | Hex | Usage |
|---|---|---|
| Primary Blue | `#2563eb` | CTAs, buttons, active states, nav highlights |
| Soft Sky | `#60a5fa` | Hover states, icons, secondary buttons |
| Light Blue | `#dbeafe` | Card backgrounds, badges, tags |
| Mist | `#F8FAFC` | Page background, section dividers |
| White | `#ffffff` | Cards, modals, input fields |
| Slate Text | `#334155` | Body text, labels, headings |
| Error Red | `#E05C6A` | Required fields, validation errors |

### Status Chip Colors (Appointments)
```
PENDING     → bg #fef9c3  color #854d0e   (amber)
CONFIRMED   → bg #dbeafe  color #1d4ed8   (blue)
COMPLETED   → bg #dcfce7  color #15803d   (green)
CANCELLED   → bg #fee2e2  color #b91c1c   (red)
NO_SHOW     → bg #f1f5f9  color #475569   (slate)
RESCHEDULED → bg #ede9fe  color #7c3aed   (purple)
```

---

## Security Architecture

> Full details: [`docs/security.md`](./docs/security.md)

**Key rules:**
- Zero trust on every request: session → role → clinicId → permission → log
- Input sanitization on all auth routes via `lib/validate.js`: 16 KB payload cap, type checking, field length limits, email normalization, hex token validation — applied before any DB call
- E2EE via Web Crypto API (AES-GCM-256 + PBKDF2) — server never sees plaintext; `lib/crypto.js`
- Password policy: 8+ chars, upper, lower, digit, special — enforced client + server
- Session: 10 min token, 3-day Remember Me, 30 min inactivity logout (`InactivityProvider`)
- Account lockout: 5 failed attempts / 5 min → locked 15 min
- Rate limiting: DB-backed IP rate limits on all auth endpoints via `lib/rateLimit.js` + `RateLimit` Prisma model; sign-in 20/15 min, sign-up 10/hour, forgot-password 5/hour, verify-otp 15/15 min; clinic-apply 5/hour, clinic-docs 50/hour
- Sign-up creates `EmailVerification` (not `User`) until email verified; token single-use
- Password reset generates fresh E2EE keys (old data inaccessible); change-password re-wraps existing key
- Password history: cannot reuse last 3
- MFA (email OTP): code is complete (`MfaOtp` model, `verify-otp` route, `VerifyOtpPage`) but currently disabled in `app/api/auth/sign-in/route.js` (commented out block lines 125–139)

**RBAC:**

| Role | Value | Sidebar Access |
|---|---|---|
| `SUPERADMIN` | 0 | `/super` portal — clinic picker, enters any clinic as ADMIN |
| `PATIENT` | 4 | Dashboard, My Schedules, My Dental Records, My Profile |
| `RECEPTIONIST` | 3 | Dashboard, Appointments, Patients, Billing |
| `DENTIST` | 2 | Dashboard, Schedule, Patient Records, My Profile |
| `ADMIN` | 1 | Dashboard, Users, Services, Appointments, Billing, Settings, Audit Log |

- Multi-tenancy: every DB query must include `clinicId` scope — no cross-clinic access
- Role/account changes on current user immediately clear session + redirect to sign-in

**Super Admin (role 0):**
- No `clinicId` in DB — not bound to any clinic
- Login redirects to `/super` (clinic picker portal)
- "Enter as Admin" → `POST /api/super/enter` → sets `session.clinicId` + `session.superAdmin = true` → redirect to `/{clinicId}/dashboard`
- `[clinicId]/layout.jsx` detects `superAdmin` flag and maps role 0 → effectiveRole ADMIN
- AppSidebar shows "Back to Super Admin" button when `isSuperAdmin=true`
- "Back to Super Admin" → `POST /api/super/exit` → clears `clinicId` from session → redirect to `/super`
- Seed: `node prisma/seed-super.js` — credentials: `superadmin@intellident.app` / `12345678`

---

## Data Models (key)

> Full details: [`docs/data-models.md`](./docs/data-models.md)

**Key patterns:**
- Soft delete on all major models (`isDeleted Boolean` + `deletedAt`) — all queries filter `isDeleted: false`
- `User` has `isActive Boolean @default(true)` — deactivated users remain visible in the users table but are blocked at sign-in (403); `isActive` is toggled via `PATCH /api/users/[id]` with `{ isActive: boolean }`
- `User` is not created on sign-up; `EmailVerification` record holds pending data until email verified
- `Appointment.dentistId` is nullable (null = "Any Available"); `endsAt = scheduledAt + duration + bufferTime`
- `patientCode` format: `PAT-{CLINICCODE}-{YYYY}-{#####}`; `appointmentCode`: `APT-{CODE}-{YYYY/MM/DD}-{####}`
- `PatientRecord` has E2EE fields (`encryptedData`, `dataIv`, `contentHash` for tamper detection)
- `Billing`/`Payment` schema + full CRUD API + Admin/Patient UI built; PayMongo integrated; webhook registered and end-to-end flow verified
- `AuditLog` schema + `GET /api/audit-log` (paginated, filtered, CSV export) + full Admin UI built
- `Notification` model is legacy — system uses `InAppNotification` + Gmail fire-and-forget

**Key enums:** `UserRole`, `AppointmentStatus` (PENDING/CONFIRMED/RESCHEDULED/CANCELLED/COMPLETED/NO_SHOW), `ApplicationStatus` (PENDING/APPROVED/REJECTED), `NotificationType`, `AuditAction`, `PaymentStatus`, `RecordStatus`, `ConsentStatus`

---

## Notification System

> Full details: [`docs/notifications.md`](./docs/notifications.md)

All appointment events → in-app bell + Gmail email. No Reminders page — bell opens Framer Motion drawer.

**Helpers in `lib/notifications.js`:**
- `notifyStaffBooking(...)` — new booking → all staff (in-app + email)
- `notifyPatientStatusChange(...)` — status change → patient (in-app + email)
- `sendAppointmentReminder({ appointment, hoursAhead })` — cron reminders (24h / 2h)

**Cron:** `app/api/cron/reminders/route.js` — every 15 min, Bearer `CRON_SECRET`, sets `reminderSent24h`/`reminderSent2h` to prevent duplicates.

**API:** `GET/PATCH /api/notifications`, `PATCH /api/notifications/[id]`

---

## Appointments, Schedules & Dentist Calendar

> Full details: [`docs/appointments.md`](./docs/appointments.md)

**Appointments** (RECEPTIONIST + ADMIN, `/appointments`):
- Status flow: PENDING → CONFIRMED → COMPLETED/NO_SHOW/CANCELLED/RESCHEDULED (terminal states cannot transition)
- Calendar: `react-big-calendar` Day/Week/Month + List view; click empty slot pre-fills `CreateAppointmentModal`
- POST validates: working day, not closure, within open hours, no dentist overlap
- `appointmentCode`: `APT-{CODE}-{YYYY/MM/DD}-{####}` generated server-side
- Pending badge on sidebar via `pendingCount` prop from `layout.jsx`; "Booking Requests" quick-filter button

**Patient Schedules** (PATIENT, `/schedules`):
- Multi-step `BookAppointmentModal`: service → dentist → date → 30-min time slots → notes → confirm
- Always creates as PENDING; notifies all staff; patient can cancel own PENDING or CONFIRMED appointments
- Slots API: `GET /api/schedules/slots?date&serviceId&dentistId` — filters closed days, past times, conflicts

**Dentist Calendar** (DENTIST, `/schedule`): read-only Day/Week view via `GET /api/schedule?from&to`

**Dashboard** (`DashboardPage.jsx`, server component): role-aware stat cards + recent appointments, all queries scoped to `clinicId`

**Settings** (ADMIN, `/settings`): `ClinicLogoUpload` (Supabase), `ClinicProfileForm`, `ClinicSchedule` (working days/hours), `ClinicClosures`

**Dentist Records** (DENTIST, `/records`): patients with ≥1 CONFIRMED/COMPLETED appt with that dentist; paginated + searchable

---

## Core Modules to Build

- [x] User Access & Authentication
  - [x] Sign up / email verification
  - [x] Sign in / sign out
  - [x] Multi-factor authentication — email OTP (6-digit, 10 min expiry, 5-attempt limit, bcrypt-hashed); enforced for all users on every sign-in; see `docs/security.md#multi-factor-authentication-email-otp`
  - [x] Password policy enforcement
  - [x] Account lockout
  - [x] Session expiry + inactivity logout
  - [x] Remember Me (3-day session)
  - [x] Forgot password / reset password (email link, 10 min token)
  - [x] Change password (authenticated, re-wraps master key)
  - [x] Password history (cannot reuse last 3)
  - [x] RBAC sidebar
  - [x] User management (ADMIN)
  - [x] View + paginate + sort users
  - [x] Edit user role
  - [x] Delete user (soft delete; auto-logout if self)
  - [x] Activate / deactivate user — `isActive Boolean @default(true)` on `User`; deactivated users are shown in the table (with a Status chip) but blocked at sign-in with a 403; PATCH `/api/users/[id]` handles both role updates and `isActive` toggle; deactivating self clears session
  - [x] Create user (admin-set, default password `Intellident2026#`, E2EE key generated client-side, creates Dentist/Receptionist profile)
  - [x] Middle initial field — `User.middleInitial String?` on schema; flows through sign-up, profile edit, and admin user creation
  - [x] Confirm password field on sign-up — client-side match validation + submit-time guard
  - [x] Sign-up no longer auto-logs in after email verification — redirects to `/sign-in?verified=success` only
- [x] Clinic Settings (ADMIN)
  - [x] Clinic profile (name, address, email, phone, landline)
  - [x] Clinic logo upload (Supabase Storage, shown in sidebar)
  - [x] Operating hours (working days + open/close time)
  - [x] Operating hours presets — `SchedulePreset` model; CRUD via `GET/POST /api/clinics/[id]/schedule/presets` + `DELETE /api/clinics/[id]/schedule/presets/[presetId]`; apply preset fills fields without saving; applied indicator on card
  - [x] Clinic closure dates (holidays/maintenance)
- [x] Service Catalog (ADMIN)
  - [x] Create / edit / delete dental services
  - [x] Duration, price, buffer time per service
  - [x] Assign dentists to services
- [x] Appointment Scheduling
  - [x] Receptionist/Admin: create appointment (patient, service, dentist or "Any Available", date/time, notes, status)
  - [x] Receptionist/Admin: calendar views (Day / Week / Month) + List view
  - [x] Receptionist/Admin: filters (dentist, service, status) + search (patient name, appt ID)
  - [x] Receptionist/Admin: status transitions with full history timeline
  - [x] Receptionist/Admin: cancel appointment with optional reason
  - [x] Receptionist/Admin: conflict detection (double-booking prevention)
  - [x] Receptionist/Admin: operating hours + closure date enforcement
  - [x] Receptionist/Admin: auto-generated appointment reference codes (`APT-{CODE}-{DATE}-{####}`)
  - [x] Receptionist/Admin: pending booking badge on sidebar + "Booking Requests" quick-filter
  - [x] Patient: self-booking via My Schedules (service → dentist preference → date → time slots → notes → confirm)
  - [x] Patient: view own upcoming + past appointments
  - [x] Patient: cancel own PENDING or CONFIRMED appointments
  - [x] Dentist: read-only calendar of own appointments (Day / Week view)
  - [x] Dentist: patient records page (patients with CONFIRMED or COMPLETED appointment with them)
  - [x] AI slot suggestions — `app/api/ai/slots`; currently using Gemini 2.5 Flash; planned migration to OpenAI not yet integrated
  - [x] Rescheduling flow — `RescheduleAppointmentModal` with dentist/date/time picker, real-time conflict check, reason field; "Reschedule" button on `AppointmentDetailModal` for CONFIRMED appointments; creates new CONFIRMED appointment then patches original to RESCHEDULED
- [x] Notifications & Reminders
  - [x] In-app notification bell in page header (all roles)
  - [x] Framer Motion slide-in notification drawer
  - [x] In-app notifications for: booking request, confirmation, cancellation, completion, no-show, rescheduled, 24h reminder, 2h reminder
  - [x] Email notifications via Gmail/nodemailer for all notification types
  - [x] Vercel cron job for 24h + 2h appointment reminders (every 15 min, protected by CRON_SECRET)
  - [x] Mark-read (single + all) functionality
- [x] Virtual Assistant / Chatbot — multi-turn AI chat via `app/api/ai/chat`; drawer UI at `app/modules/ai-chat/`; currently using Gemini 2.5 Flash; planned migration to OpenAI not yet integrated
- [x] Patient Record Management
  - [x] DB schema complete (`PatientRecord`, `Attachment` with E2EE fields + `contentHash`)
  - [x] `GET /api/records` — dentist's patient list (paginated, searchable — patients with ≥1 CONFIRMED or COMPLETED appt)
  - [x] Dentist: click patient row → right-side drawer with full record list; add/edit/delete records via `POST/PATCH/DELETE /api/records/[patientId]/[recordId]`
  - [x] Patient: My Dental Records page (`/my-records`) — two tabs: Clinical Records + Visit History; `GET /api/patient/records`; sidebar entry under Health group
  - [x] E2EE encryption wired to record notes — `encryptData`/`decryptData` called in `RecordFormModal.jsx`; server never sees plaintext
  - [x] `contentHash` SHA-256 tamper detection — computed on write, verified on read in `RecordFormModal.jsx` + `RecordViewModal.jsx`; mismatch shows tamper warning
- [x] Billing & Payment Tracking
  - [x] DB schema complete (`Billing`, `Payment` models with PaymentStatus enum)
  - [x] Full CRUD API (`GET/POST /api/billing`, `GET/PATCH /api/billing/[id]`, `GET /api/patient/billing`)
  - [x] Admin/Receptionist billing list + detail drawer; cash payment via `RecordPaymentModal`; PDF receipts
  - [x] Patient `MyBillingPage` — outstanding bills, Pay Now, receipt download
  - [x] PayMongo checkout session + webhook handler (`/api/webhooks/paymongo`); clinic payment settings
  - [x] Auto-billing creation when appointment marked COMPLETED
  - [x] PayMongo webhook registered and verified end-to-end
  - [x] Reservation fee charged at booking — creates billing record + PayMongo checkout session; patient redirected to payment on confirm; best-effort (booking succeeds even if checkout fails)
- [x] Audit Logging
  - [x] DB schema complete (`AuditLog` model with AuditAction enum, ip/userAgent/metadata fields)
  - [x] `GET /api/audit-log` (paginated, filtered, sortable) + `GET /api/audit-log/export` (CSV, up to 5000 rows)
  - [x] Full Admin UI with expandable rows, action/entity/date/search filters
- [x] Integrity Verification (tamper detection via encrypted hashes)
  - [x] `PatientRecord.contentHash` field for SHA-256 tamper detection exists in schema
  - [x] `contentHash` computed on every record write; recomputed and verified on every read; tamper warning on mismatch
- [x] Reporting & Exports — `app/modules/reports-page/ReportsPage.jsx`; three tabs: Appointments, Revenue, Patients; date range filter; CSV + PDF export; ADMIN only
- [x] Clinic Onboarding
  - [x] Public application form — `ClinicApplicationForm.jsx`; multi-field with document upload (`FileUploadZone.jsx`)
  - [x] Document upload — `POST /api/clinic-applications/documents`; Supabase `clinic-documents` bucket; magic-byte type detection; compressed archive rejection; 5 MB limit; rate-limited 50/hr
  - [x] Application submission — `POST /api/clinic-applications`; rate-limited 5/hr; requires BIR docs + applicant IDs + all contact fields in +63 format
  - [x] Terms of Service acceptance required on sign-up and clinic application (`TermsDialog.jsx`)
  - [x] Super admin Applications tab — `ApplicationsTab.jsx` in `SuperPage.jsx`; filterable by status
  - [x] Approve → auto-creates `Clinic` record (atomic DB transaction) + emails applicant sign-up link
  - [x] Reject → emails applicant with optional rejection notes
  - [x] Submission confirmation email via `sendClinicApplicationReceived`
  - [x] Staff welcome email on admin-created accounts — `sendStaffWelcomeEmail` fire-and-forget on `POST /api/users`

---

## Common Patterns

### Toast
```js
const { showToast } = useToast();
showToast('Saved!', 'success');
showToast('Something went wrong', 'error', 'Optional description');
// severities: 'success' | 'error' | 'info' | 'warning'
```

### Encryption
```js
import { encryptData, decryptData } from '@/lib/crypto';
const { masterKey } = useCrypto();

const { ciphertext, iv } = await encryptData(masterKey, 'some text');
const plaintext = await decryptData(masterKey, ciphertext, iv);
```

### Custom Commons Components
```jsx
import Button from '@/components/commons/Button';
import Input from '@/components/commons/Input';
import PageHeader from '@/components/commons/PageHeader';

<Button variant="contained" loading={loading}>Save</Button>
<Button variant="outlined">Cancel</Button>
<Input id="field" label="Label" value={val} onChange={...} placeholder="..." />
<Input id="field" label="Label" error={!!err} helperText={err} required />
<PageHeader title="Page Title" />   // use in every page module's SidebarInset
```

### MUI Date/Time Pickers
```jsx
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import dayjs from 'dayjs'

// Wrap usage in LocalizationProvider (can be inside the component/modal, not required at app root)
<LocalizationProvider dateAdapter={AdapterDayjs}>
  <DatePicker value={date} onChange={setDate} shouldDisableDate={fn} slotProps={{ textField: { size: 'small', fullWidth: true } }} />
  <TimePicker value={time} onChange={setTime} minTime={dayjs('2000-01-01T08:00')} slotProps={{ textField: { size: 'small' } }} />
</LocalizationProvider>
```

### react-big-calendar
```jsx
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Calendar, dayjsLocalizer } from 'react-big-calendar'
import dayjs from 'dayjs'

const localizer = dayjsLocalizer(dayjs)

// Override default styles via MUI sx (no global CSS conflicts):
<Box sx={{ '& .rbc-toolbar': { display: 'none' }, '& .rbc-header': { ... } }}>
  <Calendar localizer={localizer} toolbar={false} ... />
</Box>
```

### Server-side Search Autocomplete (MUI)
Always set `filterOptions={(x) => x}` when results come from a server-side search to disable MUI's client-side filtering:
```jsx
<Autocomplete
  options={results}
  filterOptions={(x) => x}   // disable client-side filtering
  inputValue={query}
  onInputChange={(_, val) => setQuery(val)}
  ...
/>
```

### Sending Notifications
```js
import { notifyStaffBooking, notifyPatientStatusChange } from '@/lib/notifications'

// New patient booking — notify all staff (in-app + email)
await notifyStaffBooking({ clinicId, appointmentId, patientName, serviceName, scheduledAt, appointmentCode })

// Status change — notify patient (in-app + email)
await notifyPatientStatusChange({
  userId, clinicId, appointmentId, status,          // status: 'CONFIRMED' | 'CANCELLED' | etc.
  patientEmail, patientFirstName, serviceName, scheduledAt, appointmentCode,
})
```

### Class Name Merging (Tailwind)
```js
import { cn } from '@/lib/utils';

// Merges Tailwind classes safely (clsx + tailwind-merge)
<div className={cn('base-class', condition && 'conditional-class', props.className)} />
```

### Input Sanitization (API Routes)
All auth API routes use `lib/validate.js` helpers before touching the DB:

```js
import { parseJsonBody, sanitizeEmail, str, secret, bool, hexToken } from '@/lib/validate';

// In any POST handler:
const parsed = await parseJsonBody(request); // rejects if body > 16 KB or not a JSON object
if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
const { body } = parsed;

const email    = sanitizeEmail(body.email);        // trim, lowercase, format check, ≤ 254 chars
const password = secret(body.password, 128);       // no trim, ≤ 128 chars (passwords may have spaces)
const name     = str(body.firstName, 100);         // trim, ≤ 100 chars
const flag     = bool(body.rememberMe);            // only literal true → true
const token    = hexToken(body.token);             // exactly 64 lowercase hex chars
```

| Helper | Trims | Max length | Extra validation |
|---|---|---|---|
| `sanitizeEmail` | yes | 254 | RFC format, lowercased |
| `str` | yes | caller-defined | — |
| `secret` | **no** | caller-defined | passwords/key material |
| `bool` | — | — | literal `true` only |
| `hexToken` | yes | 64 | `/^[a-f0-9]{64}$/` |

Applied to: `sign-in`, `sign-up`, `forgot-password`, `reset-password`, `change-password`, `verify` (query param).

### Address Normalization
All address fields are normalized server-side via `normalizeAddress()` from `lib/utils.js`:
- Trims leading/trailing whitespace
- Collapses internal multiple spaces into one
- Title-cases each word (`"123 rizal street"` → `"123 Rizal Street"`)
- Returns `null` for empty/nullish input

Applied in: `app/api/profile/route.js` (user address) and `app/api/clinics/[id]/profile/route.js` (clinic address).

```js
import { normalizeAddress } from '@/lib/utils'
address: normalizeAddress(address)
```

### Supabase File Upload (server-side)
```js
import { supabase } from '@/lib/supabase';

const { error } = await supabase.storage.from('clinic-logos').upload(path, buffer, { contentType });
const { data: { publicUrl } } = supabase.storage.from('clinic-logos').getPublicUrl(path);
```

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `SESSION_SECRET` | Cookie signing secret |
| `GMAIL_USER` | Gmail sender address |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not the account password) |
| `GMAIL_FROM_NAME` | Sender display name |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the app (e.g. `https://intellident-ai.org`) — used in verification, password-reset, and clinic approval emails |
| `CRON_SECRET` | Bearer token protecting `/api/cron/reminders`; must match Vercel env var |
| `LOCKOUT_MAX_ATTEMPTS` | (optional) default 5 |
| `LOCKOUT_WINDOW_MINUTES` | (optional) default 5 |
| `LOCKOUT_DURATION_MINUTES` | (optional) default 15 |

---

## Seed

```bash
npx prisma db seed
```

Creates 3 clinics (with `code`: MLC, KH, CAB) + 4 users per clinic (one per role) + profile records (`Patient`, `Dentist`, `Receptionist`) for each user + `patientCode` for each patient. Password for all: `12345678`.
Email pattern: `{role}.{clinicSlug}@intellident.test` (e.g. `admin.maria@intellident.test`)

**Important:** The seed also backfills missing profile records and missing patientCodes for pre-existing users on re-run — safe to run multiple times.

**Dentist assignment:** Seed dentists are NOT automatically assigned to services. After seeding, go to Services (as Admin) → edit each service → assign the relevant dentist. The dentist will then appear in the appointment creation form and the patient booking time slot picker.

---

## Compliance
- Philippine Data Privacy Act of 2012 (RA 10173)
- ISO/IEC 27001 principles
- NIST Cybersecurity Framework (Identify, Protect, Detect, Respond, Recover)

## Security Testing Tools (controlled environment only)
- Burp Suite — XSS, auth testing
- sqlmap — SQL injection
- Hydra — brute force auth testing

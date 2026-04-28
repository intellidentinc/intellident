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
| Email | Mailjet (`MJ_APIKEY_PUBLIC`, `MJ_APIKEY_PRIVATE`, `MJ_FROM_EMAIL`, `MJ_FROM_NAME`) |
| Cron | Vercel Cron Jobs (every 15 min) → `CRON_SECRET` bearer token |
| AI | GPT-5 (for appointment scheduling suggestions — not yet implemented) |
| Analytics | Vercel Analytics |

---

## File Structure

```
app/
├── (main)/                   # Route group — wraps all authenticated + auth pages
│   ├── layout.jsx            # Mounts ThemeRegistry, CryptoProvider, ToastProvider, InactivityProvider
│   ├── page.jsx              # Landing page (Tailwind only)
│   ├── [clinicId]/           # Authenticated clinic-scoped routes
│   │   ├── layout.jsx        # Session + clinic guard; fetches role, clinic name/logo, pendingCount for sidebar
│   │   ├── dashboard/page.jsx
│   │   ├── appointments/page.jsx   # RECEPTIONIST + ADMIN
│   │   ├── schedule/page.jsx       # DENTIST — their own calendar
│   │   ├── schedules/page.jsx      # PATIENT — book + view own appointments
│   │   ├── records/page.jsx        # DENTIST — patient records
│   │   ├── patients/page.jsx
│   │   ├── services/page.jsx
│   │   ├── users/page.jsx
│   │   ├── profile/page.jsx
│   │   └── settings/page.jsx
│   ├── sign-in/page.jsx
│   └── sign-up/page.jsx
├── api/
│   ├── auth/                 # Auth API routes (signin, signout, signup, verify, forgot-password, reset-password, change-password)
│   │                         # Note: sign-up creates EmailVerification (not User); verify creates the User + profile
│   ├── users/                # User list + PATCH role / DELETE (ADMIN only)
│   ├── patients/             # GET (paginated) + POST (RECEPTIONIST); [id]/ PATCH + DELETE
│   ├── services/             # GET + POST (ADMIN); [id]/ PATCH + DELETE; dentists/ GET
│   ├── profile/              # GET + PATCH (any authenticated user)
│   ├── appointments/         # See Appointments API section below
│   ├── schedules/            # Patient-facing booking API (PATIENT role); [id]/ PATCH cancel; slots/ GET
│   ├── schedule/             # Dentist's own schedule API (DENTIST role only)
│   ├── records/              # GET patient list for dentist (DENTIST role only)
│   ├── notifications/        # GET list + PATCH mark-all-read; [id]/ PATCH mark-one-read
│   ├── cron/
│   │   └── reminders/        # GET — Vercel cron job; sends 24h + 2h appointment reminders
│   └── clinics/
│       ├── route.js          # GET — public (unauthenticated); lists all clinics for sign-in/sign-up selector
│       ├── schedule/         # GET session-based (any role) — for appointment form
│       ├── closures/         # GET session-based (any role) — for appointment form
│       └── [id]/
│           ├── profile/      # GET + PATCH clinic profile fields (ADMIN)
│           ├── logo/         # POST logo upload → Supabase Storage (ADMIN)
│           ├── schedule/     # GET + PATCH operating hours (ADMIN)
│           └── closures/     # GET + POST closure dates; [closureId]/ DELETE (ADMIN)
├── modules/                  # Page-level components (one folder per route)
│   ├── landing-page/         # Tailwind — public facing
│   ├── sign-in-page/
│   ├── sign-up-page/
│   ├── forgot-password-page/
│   ├── reset-password-page/
│   ├── change-password-page/
│   ├── dashboard-page/       # AppSidebar (with pendingCount badge), DashboardPage (role-aware), SignOutButton
│   ├── appointments-page/    # AppointmentsPage, AppointmentCalendar, CreateAppointmentModal, AppointmentDetailModal, CancelAppointmentModal
│   ├── schedules-page/       # SchedulesPage (patient), BookAppointmentModal, CancelScheduleModal
│   ├── schedule-page/        # SchedulePage (dentist), ScheduleEventModal
│   ├── records-page/         # RecordsPage (dentist patient list)
│   ├── patients-page/        # PatientsPage, AddPatientModal, EditPatientModal, DeletePatientModal
│   ├── services-page/        # ServicesPage, ServiceFormModal, DeleteServiceModal
│   ├── rbac-page/            # RbacPage, AddUserModal, EditRoleModal, DeleteUserModal
│   ├── profile-page/         # ProfilePage
│   ├── settings-page/        # SettingsPage, ClinicLogoUpload, ClinicProfileForm, ClinicSchedule, ClinicClosures
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
├── email.js                  # Mailjet email helpers (auth emails + all appointment notification emails)
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
- E2EE via Web Crypto API (AES-GCM-256 + PBKDF2) — server never sees plaintext; `lib/crypto.js`
- Password policy: 8+ chars, upper, lower, digit, special — enforced client + server
- Session: 10 min token, 3-day Remember Me, 30 min inactivity logout (`InactivityProvider`)
- Account lockout: 5 failed attempts / 5 min → locked 15 min
- Sign-up creates `EmailVerification` (not `User`) until email verified; token single-use
- Password reset generates fresh E2EE keys (old data inaccessible); change-password re-wraps existing key
- Password history: cannot reuse last 3

**RBAC:**

| Role | Sidebar Access |
|---|---|
| `PATIENT` | Dashboard, My Schedules, My Profile |
| `RECEPTIONIST` | Dashboard, Appointments, Patients, Billing |
| `DENTIST` | Dashboard, Schedule, Patient Records, My Profile |
| `ADMIN` | Dashboard, Users, Services, Appointments, Billing, Settings, Audit Log |

- Multi-tenancy: every DB query must include `clinicId` scope — no cross-clinic access
- Role/account changes on current user immediately clear session + redirect to sign-in

---

## Data Models (key)

> Full details: [`docs/data-models.md`](./docs/data-models.md)

**Key patterns:**
- Soft delete on all major models (`isDeleted Boolean` + `deletedAt`) — all queries filter `isDeleted: false`
- `User` is not created on sign-up; `EmailVerification` record holds pending data until email verified
- `Appointment.dentistId` is nullable (null = "Any Available"); `endsAt = scheduledAt + duration + bufferTime`
- `patientCode` format: `PAT-{CLINICCODE}-{YYYY}-{#####}`; `appointmentCode`: `APT-{CODE}-{YYYY/MM/DD}-{####}`
- `PatientRecord` has E2EE fields (`encryptedData`, `dataIv`, `contentHash` for tamper detection)
- `Billing`/`Payment` schema complete; API/UI not yet built
- `AuditLog` schema complete; query UI not yet built
- `Notification` model is legacy — system uses `InAppNotification` + Mailjet fire-and-forget

**Key enums:** `UserRole`, `AppointmentStatus` (PENDING/CONFIRMED/RESCHEDULED/CANCELLED/COMPLETED/NO_SHOW), `NotificationType`, `AuditAction`, `PaymentStatus`, `RecordStatus`, `ConsentStatus`

---

## Notification System

> Full details: [`docs/notifications.md`](./docs/notifications.md)

All appointment events → in-app bell + Mailjet email. No Reminders page — bell opens Framer Motion drawer.

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
  - [x] Create user (admin-set, default password `Intellident2026#`, E2EE key generated client-side, creates Dentist/Receptionist profile)
- [x] Clinic Settings (ADMIN)
  - [x] Clinic profile (name, address, email, phone, landline)
  - [x] Clinic logo upload (Supabase Storage, shown in sidebar)
  - [x] Operating hours (working days + open/close time)
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
  - [ ] AI slot suggestions (GPT-5)
  - [ ] Rescheduling flow (RESCHEDULED status transition exists; no UI rescheduling form yet)
- [x] Notifications & Reminders
  - [x] In-app notification bell in page header (all roles)
  - [x] Framer Motion slide-in notification drawer
  - [x] In-app notifications for: booking request, confirmation, cancellation, completion, no-show, rescheduled, 24h reminder, 2h reminder
  - [x] Email notifications via Mailjet for all notification types
  - [x] Vercel cron job for 24h + 2h appointment reminders (every 15 min, protected by CRON_SECRET)
  - [x] Mark-read (single + all) functionality
- [ ] Virtual Assistant / Chatbot
- [ ] Patient Record Management
  - [x] DB schema complete (`PatientRecord`, `Attachment` with E2EE fields + `contentHash`)
  - [x] `GET /api/records` — dentist's patient list (paginated, searchable — patients with ≥1 CONFIRMED or COMPLETED appt)
  - [ ] View individual patient record (encrypted notes)
  - [ ] Create / edit / delete patient records via API + UI
- [ ] Billing & Payment Tracking
  - [x] DB schema complete (`Billing`, `Payment` models with PaymentStatus enum)
  - [ ] API routes + UI for billing creation, payment recording, receipt tracking
- [ ] Audit Logging
  - [x] DB schema complete (`AuditLog` model with AuditAction enum, ip/userAgent/metadata fields)
  - [ ] API routes + UI to query/display audit log (ADMIN only)
- [ ] Integrity Verification (tamper detection via encrypted hashes)
  - [x] `PatientRecord.contentHash` field for SHA-256 tamper detection exists in schema
  - [ ] Wire contentHash computation + verification to API routes
- [ ] Reporting & Exports

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
| `MJ_APIKEY_PUBLIC` | Mailjet public API key |
| `MJ_APIKEY_PRIVATE` | Mailjet private API key |
| `MJ_FROM_EMAIL` | Sender email address |
| `MJ_FROM_NAME` | Sender display name |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
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

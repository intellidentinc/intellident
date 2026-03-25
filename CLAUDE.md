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
| Database ORM | Prisma + PostgreSQL (Neon) |
| Auth | Custom session-based (cookies via `lib/auth.js`) |
| Encryption | Web Crypto API — AES-GCM E2EE, PBKDF2 key derivation |
| File Storage | Supabase Storage (`clinic-logos` bucket) |
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
│   │   ├── patients/page.jsx
│   │   ├── services/page.jsx
│   │   ├── users/page.jsx
│   │   ├── profile/page.jsx
│   │   └── settings/page.jsx
│   ├── sign-in/page.jsx
│   └── sign-up/page.jsx
├── api/
│   ├── auth/                 # Auth API routes (signin, signout, signup, verify, forgot-password, reset-password, change-password)
│   ├── users/                # User list + PATCH role / DELETE (ADMIN only)
│   ├── patients/             # GET (paginated) + POST (RECEPTIONIST); [id]/ PATCH + DELETE
│   ├── services/             # GET + POST (ADMIN); [id]/ PATCH + DELETE; dentists/ GET
│   ├── profile/              # GET + PATCH (any authenticated user)
│   ├── appointments/         # See Appointments API section below
│   ├── schedules/            # Patient-facing booking API (PATIENT role); [id]/ PATCH cancel; slots/ GET
│   ├── schedule/             # Dentist's own schedule API (DENTIST role only)
│   └── clinics/
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
│   ├── patients-page/        # PatientsPage, AddPatientModal, EditPatientModal, DeletePatientModal
│   ├── services-page/        # ServicesPage, ServiceFormModal, DeleteServiceModal
│   ├── rbac-page/            # RbacPage, AddUserModal, EditRoleModal, DeleteUserModal
│   ├── profile-page/         # ProfilePage
│   └── settings-page/        # SettingsPage, ClinicLogoUpload, ClinicProfileForm, ClinicSchedule, ClinicClosures
├── providers/                # App-level React context providers
│   ├── ThemeRegistry.jsx     # MUI + Emotion SSR setup
│   ├── ToastProvider.jsx     # Global toast/snackbar (useToast hook)
│   ├── CryptoProvider.jsx    # Holds master key in memory (useCrypto hook)
│   └── InactivityProvider.jsx # Auto logout after 30 min inactivity
components/
└── commons/                  # Reusable MUI-based UI primitives
    ├── theme.js              # Design tokens + MUI component overrides
    ├── Button.jsx            # Custom button with loading state
    └── Input.jsx             # Label-above input field (no floating label); supports error + helperText
lib/
├── auth.js                   # Session helpers (getSession, setSession, clearSession)
├── prisma.js                 # Prisma client singleton
├── crypto.js                 # Web Crypto API helpers (E2EE)
├── supabase.js               # Supabase client (service role — server-side only)
└── email.js                  # Mailjet email helpers (sendPasswordResetEmail, sendPasswordChangedEmail)
prisma/
├── schema.prisma
└── seed.js                   # Seeds 3 clinics + 4 users per clinic (all roles) + profile records
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
- `components/commons/` — base MUI UI primitives used system-wide (Button, Input, etc.)
- `components/` root — truly reusable system-wide components (not page-specific)
- Page-specific components — stay inside their own `app/modules/[page-name]/` folder

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

### Zero Trust
Every request is verified before data is accessed:
1. Valid session?
2. User role?
3. Tenant/clinic match (ClinicID)?
4. Role has permission for this action?
5. Log the attempt either way

### E2EE (Client-Side Encryption)
Using the Web Crypto API — **the server never sees plaintext user data.**

**Registration:**
- Browser generates AES-GCM-256 master key
- PBKDF2 derives a Key Encryption Key (KEK) from the user's password + random salt
- Master key is wrapped with KEK using AES-KW
- Only `wrappedKey` + `keySalt` are sent to the server

**Login:**
- Server returns `wrappedKey` + `keySalt`
- Browser re-derives KEK from password + salt
- Master key is unwrapped locally → stored in `CryptoProvider` memory only
- Cleared from memory on sign-out

**Data:**
- Encrypt with `encryptData(masterKey, plaintext)` → returns `{ ciphertext, iv }`
- Decrypt with `decryptData(masterKey, ciphertext, iv)`
- Server stores only encrypted blobs — unreadable without the user's password

**Important:** Developers cannot read user data. There is no password recovery that restores access to existing encrypted data. This is intentional.

### Password Policy
Enforced on both client and server (`app/api/auth/sign-up/route.js`):
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character

### Session Policy
- **Token expiry:** 10 minutes (`lib/auth.js` — `maxAge: 60 * 10`)
- **Remember Me:** extends session to 3 days (`maxAge: 60 * 60 * 24 * 3`) — checkbox on sign-in page
- **Inactivity logout:** 30 minutes — tracked in `InactivityProvider`; clears master key and redirects to `/sign-in?reason=inactivity`

### Account Lockout
Tracked on the `User` model via `failedLoginAttempts`, `lastFailedAt`, `lockedUntil`.
- **Threshold:** 5 failed attempts within 5 minutes
- **Lock duration:** 15 minutes
- Configurable via env vars: `LOCKOUT_MAX_ATTEMPTS`, `LOCKOUT_WINDOW_MINUTES`, `LOCKOUT_DURATION_MINUTES`
- Resets on successful login

### Password Reset & Change
- **Forgot password:** `POST /api/auth/forgot-password` → generates one-time token (10 min expiry), sends reset link via email. Always returns 200 to prevent email enumeration.
- **Reset password:** `POST /api/auth/reset-password` → validates token, enforces policy, checks history, generates fresh E2EE key material (old encrypted data is intentionally inaccessible), sends confirmation email.
- **Change password (authenticated):** `POST /api/auth/change-password` → requires current password verification, re-wraps existing master key with new KEK (encrypted data stays accessible), sends confirmation email.
- **Password history:** last 3 hashed passwords stored in `User.passwordHistory String[]`; new password cannot match any of them.
- Reset token model: `PasswordResetToken` (token, email, expiresAt, usedAt)
- Email notifications sent via `sendPasswordResetEmail` and `sendPasswordChangedEmail` in `lib/email.js`

### RBAC Roles

| Role | Sidebar Access |
|---|---|
| `PATIENT` | Dashboard, My Schedules (`/schedules`), Reminders, My Profile |
| `RECEPTIONIST` | Dashboard, Appointments (`/appointments`), Patients, Reminders, Billing |
| `DENTIST` | Dashboard, Schedule (`/schedule`), Patient Records, My Profile |
| `ADMIN` | Dashboard, Users, Services, Schedules (`/appointments`), Billing, Settings, Audit Log |

- Sidebar nav is built per-role in `buildNavGroups()` inside `AppSidebar.jsx`
- `AppSidebar` receives `pendingCount` prop from `layout.jsx` (server-fetched); renders a blue badge on Appointments/Schedules nav item for RECEPTIONIST and ADMIN when count > 0
- Role changes and account deletions applied to the currently logged-in user immediately clear their session and redirect to sign-in

### Multi-Tenancy
All data is scoped to a `ClinicID`. Every DB query must include a clinic scope filter. No cross-clinic data access is allowed regardless of role.

---

## Data Models (key)

- `User` — auth + role. Source of truth for role (`PATIENT | RECEPTIONIST | DENTIST | ADMIN`). Also holds `passwordHistory String[]`, `failedLoginAttempts`, `lastFailedAt`, `lockedUntil`
- `PasswordResetToken` — one-time reset tokens (email, token, expiresAt, usedAt)
- `Clinic` — multi-tenant root. Holds `name`, `code` (e.g. `MLC`, `KH`, `CAB`), `address`, `email`, `phone`, `landline`, `logoUrl`
- `ClinicSchedule` — one per clinic; `workingDays String[]` (e.g. `["MON","TUE"]`), `openTime`, `closeTime` (HH:mm strings). Upserted via PATCH.
- `ClinicClosure` — many per clinic; `date DateTime`, `reason String?` for holidays/maintenance
- `Receptionist` — profile extension for `RECEPTIONIST` users (linked via `userId`)
- `Dentist` — profile extension for `DENTIST` users; has `specialty`; linked to `Appointment` via `dentistId`; assigned to services via `ServiceDentists` join table
- `Patient` — profile extension for `PATIENT` users; has `patientCode String?` for display reference IDs
- `Service` — dental services with `duration`, `price`, `bufferTime`; many-to-many with `Dentist` via `ServiceDentists`
- `Appointment` — scheduling record; has `appointmentCode String?` (e.g. `APT-MLC-2026/03/25-0001`); `dentistId` is **nullable** (null = "Any Available"); `endsAt = scheduledAt + duration + bufferTime`
- `AppointmentStatusHistory` — audit trail of every status transition on an appointment; fields: `appointmentId`, `status`, `changedById`, `changedAt`, `note`

---

## Appointments Module (`/[clinicId]/appointments`)

RECEPTIONIST + ADMIN access.

### Workflow
1. **Patient self-booking** — patient logs in → My Schedules → Book Appointment → selects service, dentist preference, date, time slot → submitted as `PENDING`
2. **Receptionist/Admin** — sees all appointments in calendar or list view; PENDING bookings from patients show with a badge on the sidebar and a "Booking Requests" quick-filter button on the appointments page
3. **Receptionist confirms** — opens appointment detail, transitions PENDING → CONFIRMED
4. **Day of appointment** — CONFIRMED → COMPLETED (or NO_SHOW if patient doesn't show)
5. **Cancellation** — any non-terminal status can be cancelled via the Cancel modal

### Status Transition Rules
| From → To | Allowed |
|---|---|
| PENDING → CONFIRMED | ✅ |
| PENDING → CANCELLED | ✅ |
| CONFIRMED → COMPLETED | ✅ |
| CONFIRMED → CANCELLED | ✅ |
| CONFIRMED → NO_SHOW | ✅ |
| COMPLETED / CANCELLED / NO_SHOW → any | ❌ terminal |

### appointmentCode Generation
Format: `APT-{clinic.code}-{YYYY/MM/DD}-{####}`
- Generated server-side on `POST /api/appointments`
- Sequential counter per clinic per date (zero-padded to 4 digits)
- Requires `Clinic.code` to be set (MLC, KH, CAB — set via seed)

### Calendar Views
`AppointmentCalendar.jsx` wraps `react-big-calendar` with `dayjsLocalizer`:
- Supported views: `day`, `week`, `month` (+ `list` as a separate MUI table)
- `'& .rbc-*'` CSS overrides applied via MUI `sx` prop — no global CSS conflicts
- Custom `EventComponent` shows patient name + service
- `eventPropGetter` applies status-based `border-left` colors
- `toolbar={false}` — AppointmentsPage has its own custom toolbar
- Click empty slot → `onSelectSlot` → opens CreateAppointmentModal pre-filled with that date/time via `defaultScheduledAt` prop

### Appointments API Routes

| Route | Method | Role | Purpose |
|---|---|---|---|
| `/api/appointments` | GET | RECEPTIONIST, ADMIN | Paginated list; params: `page`, `pageSize`, `sortField`, `sortOrder`, `status`, `dentistId`, `serviceId`, `search` |
| `/api/appointments` | POST | RECEPTIONIST, ADMIN | Create appointment with full validation |
| `/api/appointments/calendar` | GET | RECEPTIONIST, ADMIN | All appointments in a date range (no pagination); params: `from`, `to` (ISO) |
| `/api/appointments/[id]` | GET | RECEPTIONIST, ADMIN | Detail + statusHistory with changedBy user |
| `/api/appointments/[id]` | PATCH | RECEPTIONIST, ADMIN | Status transition; body: `{ status, note? }` |
| `/api/appointments/patients` | GET | RECEPTIONIST, ADMIN | Patient search autocomplete; param: `q` |
| `/api/appointments/services` | GET | RECEPTIONIST, ADMIN, **PATIENT** | Services list for appointment form |
| `/api/appointments/dentists` | GET | RECEPTIONIST, ADMIN, **PATIENT** | Dentists for a service; param: `serviceId` |
| `/api/appointments/slots/check` | GET | RECEPTIONIST, ADMIN | Real-time conflict check; params: `dentistId`, `scheduledAt`, `serviceId`, `excludeAppointmentId?` |

### Server-side Validation on POST
1. Date is a working day (`ClinicSchedule.workingDays`)
2. Date is not a closure (`ClinicClosure`)
3. Time within `openTime ≤ scheduledAt < closeTime`
4. Dentist has no overlapping appointment (if specific dentist chosen)
5. `endsAt = scheduledAt + service.duration + service.bufferTime`

### Appointment Form Notes
- **Patient field** uses MUI `Autocomplete` with `filterOptions={(x) => x}` — client-side filtering is disabled because results come from server-side search
- **Dentist dropdown** only shows dentists assigned to the selected service — assign dentists to services in the Services page first
- **Date picker** disables past dates, non-working days, and closure dates
- **Time picker** restricts to clinic open/close hours
- Conflict warning shows inline when a dentist is double-booked
- DatePicker/TimePicker require `LocalizationProvider` + `AdapterDayjs` — wrapped inside the modal component itself
- `defaultScheduledAt` prop on `CreateAppointmentModal` pre-fills date and time when clicking a calendar slot

### Pending Bookings Badge
- `[clinicId]/layout.jsx` (server component) counts PENDING appointments for RECEPTIONIST/ADMIN roles on every page load
- Passed as `pendingCount` prop to `AppSidebar`
- Sidebar renders a blue pill badge on the Appointments nav item when `pendingCount > 0`
- On the Appointments page, a "Booking Requests" button under the title quick-filters to PENDING + switches to List view

### Session-based Clinic Endpoints (any authenticated role)
- `GET /api/clinics/schedule` — returns current clinic's schedule (working days, open/close time)
- `GET /api/clinics/closures` — returns current clinic's closure dates
- These are separate from the ADMIN-only `GET /api/clinics/[id]/schedule` endpoints

---

## Patient Schedules Module (`/[clinicId]/schedules`)

PATIENT role only.

### Workflow
1. Patient opens My Schedules — sees Upcoming / Past tabs with appointment cards
2. Clicks "Book Appointment" → `BookAppointmentModal` progressive disclosure:
   - Step 1: Service cards (visual selection)
   - Step 2: Dentist preference chips (Any Available or specific)
   - Step 3: `DatePicker` — disables non-working days and closure dates
   - Step 4: Time slot chips grouped by Morning / Afternoon — fetched from `/api/schedules/slots`
   - Step 5: Optional notes
   - Step 6: Booking summary card before submit
3. Submit → `POST /api/schedules` → creates appointment as `PENDING`
4. Patient can cancel own PENDING appointments from the card
5. Receptionist then sees it in their Appointments page (pending badge triggers)

### Patient Schedules API Routes

| Route | Method | Role | Purpose |
|---|---|---|---|
| `/api/schedules` | GET | PATIENT | Own appointments; param: `tab=upcoming\|past` |
| `/api/schedules` | POST | PATIENT | Book appointment (always creates as PENDING) |
| `/api/schedules/[id]` | PATCH | PATIENT | Cancel own PENDING appointment only |
| `/api/schedules/slots` | GET | PATIENT | Available 30-min time slots for a date/service/dentist |

### Slot Generation (`/api/schedules/slots`)
- Params: `date`, `serviceId`, `dentistId` (or `ANY`)
- Validates working day + not closure
- Generates slots every 30 min: `openTime` to `closeTime - serviceDuration`
- Filters past slots if date = today (30-min buffer from now)
- Specific dentist: conflict-checks each slot against existing non-cancelled appointments
- `ANY` dentist: returns all open slots (no conflict check — receptionist assigns on confirmation)

### Zero Trust in Patient Routes
- `getPatientCaller()` verifies `patient.clinicId === user.clinicId`
- Appointment PATCH verifies `appointment.clinicId === caller.clinicId` AND `appointment.patientId === caller.patient.id`
- POST verifies `dentistId` belongs to `caller.clinicId` before using it
- All queries include `clinicId` scope

---

## Dentist Schedule Module (`/[clinicId]/schedule`)

DENTIST role only.

### Features
- Day / Week calendar view (no month or list — not relevant for a dentist's daily workflow)
- Today's stat chips: confirmed count + pending count for the current calendar view
- Status color legend
- Click any appointment event → `ScheduleEventModal` (read-only: patient, service, time, notes, status)
- No create/edit capabilities — read-only view

### Dentist Schedule API
- `GET /api/schedule?from=&to=` — DENTIST role only
- Looks up `Dentist` profile by `userId`, verifies `dentist.clinicId === user.clinicId`
- Returns only appointments where `dentistId = dentist.id` for the given range
- Includes patient name/patientCode + service name/duration

---

## Dashboard (Role-Aware)

`DashboardPage.jsx` is a server component. All DB queries run server-side — no client-side fetch. Each role sees a different dashboard:

| Role | Dashboard Content |
|---|---|
| `PATIENT` | Next appointment card + status chip, stat chips (Upcoming / Completed / Cancelled), "Book Appointment" CTA |
| `RECEPTIONIST` | Stat cards (pending bookings, today's appointments, confirmed upcoming, total patients) + amber alert CTA if pending > 0 + recent appointments list |
| `ADMIN` | Stat cards (total users, patients, services, appointments this month, pending bookings) + amber alert CTA if pending > 0 + recent appointments list |
| `DENTIST` | Stat cards (today's appointments, upcoming this week, my patients) + next appointment card + quick links to Schedule and Records |

All dashboard queries include `clinicId` scope (zero trust). StatCards with `href` are clickable and navigate to the relevant section.

---

## Dentist Patient Records (`/[clinicId]/records`)

DENTIST role only.

- Shows all patients who have at least one CONFIRMED or COMPLETED appointment with the logged-in dentist
- Paginated table with search (name, patientCode)
- Columns: Patient ID, Name, Last Service, Last Visit, Status, Total Visits
- API: `GET /api/records?page=&pageSize=&search=`
- Query: `Patient.findMany` filtered by `appointments.some { dentistId, status IN [CONFIRMED, COMPLETED] }`
- Zero trust: looks up `Dentist` profile by `userId`, verifies `dentist.clinicId === user.clinicId`

---

## Settings Page (`/[clinicId]/settings`)

ADMIN-only. Split into four sections, each its own component:

| Component | Responsibility |
|---|---|
| `ClinicLogoUpload` | Avatar preview, file input (jpg/png ≤5MB), POST to `/api/clinics/[id]/logo` |
| `ClinicProfileForm` | Name, address, email, mobile (optional), landline (optional) — PATCH profile |
| `ClinicSchedule` | Toggle working days (MON–SUN), set open/close time — PATCH schedule |
| `ClinicClosures` | Add/delete clinic closure dates with optional reason |

Logo is stored in Supabase bucket `clinic-logos` at path `{clinicId}/{timestamp}.{ext}`. Old logo is deleted on upload. `logoUrl` is persisted to the `Clinic` record and rendered in the sidebar header (`AppSidebar.jsx`).

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
  - [x] Patient: cancel own PENDING appointments
  - [x] Dentist: read-only calendar of own appointments (Day / Week view)
  - [x] Dentist: patient records page (patients with CONFIRMED or COMPLETED appointment with them)
  - [ ] AI slot suggestions (GPT-5)
  - [ ] Rescheduling flow (RESCHEDULED status exists but no UI yet)
- [ ] Virtual Assistant / Chatbot
- [ ] Patient Record Management
- [ ] Billing & Payment Tracking
- [ ] Reminders & Notifications (email/SMS)
- [ ] Audit Logging
- [ ] Integrity Verification (tamper detection via encrypted hashes)
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

<Button variant="contained" loading={loading}>Save</Button>
<Button variant="outlined">Cancel</Button>
<Input id="field" label="Label" value={val} onChange={...} placeholder="..." />
<Input id="field" label="Label" error={!!err} helperText={err} required />
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

### Supabase File Upload (server-side)
```js
import { supabase } from '@/lib/supabase';

const { error } = await supabase.storage.from('clinic-logos').upload(path, buffer, { contentType });
const { data: { publicUrl } } = supabase.storage.from('clinic-logos').getPublicUrl(path);
```

---

## Seed

```bash
npx prisma db seed
```

Creates 3 clinics (with `code`: MLC, KH, CAB) + 4 users per clinic (one per role) + profile records (`Patient`, `Dentist`, `Receptionist`) for each user. Password for all: `12345678`.
Email pattern: `{role}.{clinicSlug}@intellident.test` (e.g. `admin.maria@intellident.test`)

**Important:** The seed also backfills missing profile records for pre-existing users on re-run — safe to run multiple times.

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

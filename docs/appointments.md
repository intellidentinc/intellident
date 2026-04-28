# Appointments Module (`/[clinicId]/appointments`)

RECEPTIONIST + ADMIN access.

## Workflow
1. **Patient self-booking** — patient logs in → My Schedules → Book Appointment → selects service, dentist preference, date, time slot → submitted as `PENDING` → staff notified (in-app + email)
2. **Receptionist/Admin** — sees all appointments in calendar or list view; PENDING bookings from patients show with a badge on the sidebar and a "Booking Requests" quick-filter button on the appointments page
3. **Receptionist confirms** — opens appointment detail, transitions PENDING → CONFIRMED → patient notified (in-app + email)
4. **Day of appointment** — CONFIRMED → COMPLETED (or NO_SHOW) → patient notified
5. **Cancellation** — any non-terminal status can be cancelled → patient + staff notified
6. **Rescheduling** — CONFIRMED → RESCHEDULED status transition → patient notified

## Status Transition Rules
| From → To | Allowed |
|---|---|
| PENDING → CONFIRMED | ✅ |
| PENDING → CANCELLED | ✅ |
| CONFIRMED → COMPLETED | ✅ |
| CONFIRMED → CANCELLED | ✅ |
| CONFIRMED → NO_SHOW | ✅ |
| CONFIRMED → RESCHEDULED | ✅ |
| COMPLETED / CANCELLED / NO_SHOW / RESCHEDULED → any | ❌ terminal |

## appointmentCode Generation
Format: `APT-{clinic.code}-{YYYY/MM/DD}-{####}`
- Generated server-side on `POST /api/appointments`
- Sequential counter per clinic per date (zero-padded to 4 digits)
- Requires `Clinic.code` to be set (MLC, KH, CAB — set via seed)

## Calendar Views
`AppointmentCalendar.jsx` wraps `react-big-calendar` with `dayjsLocalizer`:
- Supported views: `day`, `week`, `month` (+ `list` as a separate MUI table)
- `'& .rbc-*'` CSS overrides applied via MUI `sx` prop — no global CSS conflicts
- Custom `EventComponent` shows patient name + service
- `eventPropGetter` applies status-based `border-left` colors
- `toolbar={false}` — AppointmentsPage has its own custom toolbar
- Click empty slot → `onSelectSlot` → opens CreateAppointmentModal pre-filled with that date/time via `defaultScheduledAt` prop

## Appointments API Routes

| Route | Method | Role | Purpose |
|---|---|---|---|
| `/api/appointments` | GET | RECEPTIONIST, ADMIN | Paginated list; params: `page`, `pageSize`, `sortField`, `sortOrder`, `status`, `dentistId`, `serviceId`, `search` |
| `/api/appointments` | POST | RECEPTIONIST, ADMIN | Create appointment with full validation; notifies patient if CONFIRMED |
| `/api/appointments/calendar` | GET | RECEPTIONIST, ADMIN | All appointments in a date range (no pagination); params: `from`, `to` (ISO) |
| `/api/appointments/[id]` | GET | RECEPTIONIST, ADMIN | Detail + statusHistory with changedBy user |
| `/api/appointments/[id]` | PATCH | RECEPTIONIST, ADMIN | Status transition; body: `{ status, note? }`; triggers notifications |
| `/api/appointments/patients` | GET | RECEPTIONIST, ADMIN | Patient search autocomplete; param: `q` |
| `/api/appointments/services` | GET | RECEPTIONIST, ADMIN, PATIENT | Services list for appointment form |
| `/api/appointments/dentists` | GET | RECEPTIONIST, ADMIN, PATIENT | Dentists for a service; param: `serviceId` |
| `/api/appointments/slots/check` | GET | RECEPTIONIST, ADMIN | Real-time conflict check; params: `dentistId`, `scheduledAt`, `serviceId`, `excludeAppointmentId?` |

## Server-side Validation on POST
1. Date is a working day (`ClinicSchedule.workingDays`)
2. Date is not a closure (`ClinicClosure`)
3. Time within `openTime ≤ scheduledAt < closeTime`
4. Dentist has no overlapping appointment (if specific dentist chosen)
5. `endsAt = scheduledAt + service.duration + service.bufferTime`

## Appointment Form Notes
- **Patient field** uses MUI `Autocomplete` with `filterOptions={(x) => x}` — client-side filtering is disabled because results come from server-side search
- **Dentist dropdown** only shows dentists assigned to the selected service — assign dentists to services in the Services page first
- **Date picker** disables past dates, non-working days, and closure dates
- **Time picker** restricts to clinic open/close hours
- Conflict warning shows inline when a dentist is double-booked
- DatePicker/TimePicker require `LocalizationProvider` + `AdapterDayjs` — wrapped inside the modal component itself
- `defaultScheduledAt` prop on `CreateAppointmentModal` pre-fills date and time when clicking a calendar slot

## Pending Bookings Badge
- `[clinicId]/layout.jsx` (server component) counts PENDING appointments for RECEPTIONIST/ADMIN roles on every page load
- Passed as `pendingCount` prop to `AppSidebar`
- Sidebar renders a blue pill badge on the Appointments nav item when `pendingCount > 0`
- On the Appointments page, a "Booking Requests" button under the title quick-filters to PENDING + switches to List view

## Public Clinic Endpoint (unauthenticated)
- `GET /api/clinics` — returns list of all clinics (id, name, code); used by sign-in and sign-up pages to populate the clinic selector dropdown. No session required.

## Session-based Clinic Endpoints (any authenticated role)
- `GET /api/clinics/schedule` — returns current clinic's schedule (working days, open/close time)
- `GET /api/clinics/closures` — returns current clinic's closure dates
- These are separate from the ADMIN-only `GET /api/clinics/[id]/schedule` endpoints

---

# Patient Schedules Module (`/[clinicId]/schedules`)

PATIENT role only.

## Workflow
1. Patient opens My Schedules — sees Upcoming / Past tabs with appointment cards
2. Clicks "Book Appointment" → `BookAppointmentModal` progressive disclosure:
   - Step 1: Service cards (visual selection)
   - Step 2: Dentist preference chips (Any Available or specific)
   - Step 3: `DatePicker` — disables non-working days and closure dates
   - Step 4: Time slot chips grouped by Morning / Afternoon — fetched from `/api/schedules/slots`
   - Step 5: Optional notes
   - Step 6: Booking summary card before submit
3. Submit → `POST /api/schedules` → creates appointment as `PENDING` → all staff notified (in-app + email)
4. Patient can cancel own PENDING appointments from the card
5. Receptionist then sees it in their Appointments page (pending badge triggers)

## Patient Schedules API Routes

| Route | Method | Role | Purpose |
|---|---|---|---|
| `/api/schedules` | GET | PATIENT | Own appointments; param: `tab=upcoming\|past` |
| `/api/schedules` | POST | PATIENT | Book appointment (always creates as PENDING); fires staff notifications |
| `/api/schedules/[id]` | PATCH | PATIENT | Cancel own PENDING appointment only |
| `/api/schedules/slots` | GET | PATIENT | Available 30-min time slots for a date/service/dentist |

## Slot Generation (`/api/schedules/slots`)
- Params: `date`, `serviceId`, `dentistId` (or `ANY`)
- Validates working day + not closure
- Generates slots every 30 min: `openTime` to `closeTime - serviceDuration`
- Filters past slots if date = today (30-min buffer from now)
- Specific dentist: conflict-checks each slot against existing non-cancelled appointments
- `ANY` dentist: returns all open slots (no conflict check — receptionist assigns on confirmation)

## Zero Trust in Patient Routes
- `getPatientCaller()` verifies `patient.clinicId === user.clinicId`
- Appointment PATCH verifies `appointment.clinicId === caller.clinicId` AND `appointment.patientId === caller.patient.id`
- POST verifies `dentistId` belongs to `caller.clinicId` before using it
- All queries include `clinicId` scope

---

# Dentist Schedule Module (`/[clinicId]/schedule`)

DENTIST role only.

## Features
- Day / Week calendar view (no month or list — not relevant for a dentist's daily workflow)
- Today's stat chips: confirmed count + pending count for the current calendar view
- Status color legend
- Click any appointment event → `ScheduleEventModal` (read-only: patient, service, time, notes, status)
- No create/edit capabilities — read-only view

## Dentist Schedule API
- `GET /api/schedule?from=&to=` — DENTIST role only
- Looks up `Dentist` profile by `userId`, verifies `dentist.clinicId === user.clinicId`
- Returns only appointments where `dentistId = dentist.id` for the given range
- Includes patient name/patientCode + service name/duration

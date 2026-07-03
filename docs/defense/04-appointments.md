# 04 — Appointment Scheduling

## What it is

The scheduling core of the system (capstone **Objective 1**): staff and patients create, confirm, reschedule, and cancel appointments; the server makes double-booking impossible; every change notifies the affected people. Three surfaces, one rulebook:

| Surface | Role | Page | API |
|---|---|---|---|
| Appointments | ADMIN + RECEPTIONIST | `/[clinicId]/appointments` (`app/modules/appointments-page/`) | `app/api/appointments/` |
| My Schedules (self-booking) | PATIENT | `/[clinicId]/schedules` (`app/modules/schedules-page/`) | `app/api/schedules/` |
| Schedule (read-only calendar) | DENTIST | `/[clinicId]/schedule` (`app/modules/schedule-page/`) | `app/api/schedule/` |

## The 5-step validation pipeline (staff create — `POST /api/appointments`)

File: `app/api/appointments/route.js`. Every create passes, in order:

1. **Working day** — the date's weekday must be in `ClinicSchedule.workingDays`.
2. **Not a closure** — the date must not appear in `ClinicClosure` (holidays/maintenance).
3. **Within open hours** — start AND computed end must fit between `openTime` and `closeTime`.
4. **Dentist conflict (overlap detection)** — the anti-double-booking core. If a specific dentist is chosen, the server searches for any non-cancelled appointment of that dentist satisfying the classic interval-overlap test:
   ```
   existing.scheduledAt < new.endsAt   AND   existing.endsAt > new.scheduledAt
   ```
   Any hit → **HTTP 409 "This dentist has a conflicting appointment at that time"**. The appointment is never written.
5. **`endsAt` calculation** — `endsAt = scheduledAt + Σ(service.duration + service.bufferTime)`. Buffer time (cleanup/prep between patients) is part of the blocked interval, so back-to-back bookings can't squeeze it out.

Patient self-booking (`POST /api/schedules`) enforces the same pipeline (future-time check, working day, closure, open hours, dentist existence/conflict) and **always creates the appointment as PENDING** — staff must confirm it.

## The status state machine

File: `app/api/appointments/[id]/route.js` — `ALLOWED_TRANSITIONS` map, enforced server-side:

```
PENDING ──→ CONFIRMED ──→ COMPLETED
   │            │──→ CANCELLED / NO_SHOW / RESCHEDULED
   └──→ CANCELLED
Terminal states (COMPLETED, CANCELLED, NO_SHOW, RESCHEDULED) reject ALL transitions.
```

Every transition is appended to a status history (with `changedBy` — who did it), shown as a timeline in `AppointmentDetailModal.jsx`. Marking COMPLETED auto-creates the billing record (see `07-billing-payments.md`). Rescheduling (`RescheduleAppointmentModal.jsx`) creates a **new CONFIRMED appointment** (with live conflict check) and then patches the original to RESCHEDULED — the history of both is preserved.

## Slot computation — `lib/slots.js` (single source of truth)

`computeAvailableSlots({ clinicId, serviceIds, dentistId, dateStr })` powers both the visible slot list (`GET /api/schedules/slots`) and the AI ranking (`GET /api/ai/slots`), so they can never disagree:

1. Load services, clinic schedule, closures (parallel Prisma queries).
2. Reject non-working days and closures — all date math in **Asia/Manila** via `moment-timezone`.
3. Total duration = Σ(duration + buffer) across all selected services (multi-service booking supported).
4. Generate candidate start times on a **30-minute grid** that fit entirely before closing time.
5. Drop past times (same-day bookings need 30 min lead).
6. Drop candidates that overlap existing non-cancelled appointments of the chosen dentist (or all dentists for "Any Available").
7. Return `['09:00', '09:30', ...]` — or `[]`.

## Patient booking UX

`BookAppointmentModal.jsx` (multi-step): service(s) → dentist or "Any Available" → date (closed days disabled) → 30-min slot picker (with optional "AI Pick" — see `06-ai-features.md`) → notes → confirm. Booking may also create a **reservation-fee billing + PayMongo checkout** (best-effort — booking succeeds even if checkout creation fails). Patients can cancel their own PENDING/CONFIRMED appointments (`PATCH /api/schedules/[id]`).

## Workflow organization (Objective 1's second half)

- **Reference codes** generated server-side: `APT-{CLINICCODE}-{YYYY/MM/DD}-{####}`.
- **Pending badge** — `[clinicId]/layout.jsx` counts PENDING appointments and shows it on the sidebar; a "Booking Requests" quick-filter jumps to them.
- **Calendar** — `react-big-calendar` Day/Week/Month + List view; clicking an empty slot pre-fills the create modal; filters by dentist/service/status + search by patient name or code.
- **`Appointment.dentistId` is nullable** — null means "Any Available"; a dentist gets assigned at confirmation.

## Notifications & reminders

Files: `lib/notifications.js`, `app/api/cron/reminders/route.js`

- New booking → `notifyStaffBooking()` — in-app bell + Gmail email to all staff.
- Any status change → `notifyPatientStatusChange()` — in-app + email to the patient.
- Cron (daily 08:00 UTC, `CRON_SECRET`-protected) sends **24 h and 2 h reminders**; `reminderSent24h`/`reminderSent2h` flags prevent duplicates.
- Bell UI: `app/modules/notifications/NotificationBell.jsx` + Framer Motion `NotificationDrawer.jsx`; mark-one/mark-all-read via `/api/notifications`.

## Key files table

| File | Role |
|---|---|
| `app/api/appointments/route.js` | Staff create + list; the 5-step validation pipeline |
| `app/api/appointments/[id]/route.js` | Detail + status state machine (`ALLOWED_TRANSITIONS`) |
| `app/api/schedules/route.js` | Patient self-booking (always PENDING) + own-appointment list |
| `app/api/schedules/slots/route.js` | Visible slot list |
| `lib/slots.js` | `computeAvailableSlots` — shared availability math |
| `app/api/schedule/route.js` | Dentist read-only calendar (`?from&to`) |
| `lib/appointments.js` | Shared appointment helpers |
| `app/modules/appointments-page/` | Calendar, Create/Detail/Cancel/Reschedule modals |
| `app/modules/schedules-page/BookAppointmentModal.jsx` | Patient booking wizard |
| `lib/notifications.js` + `app/api/cron/reminders/route.js` | Notifications + reminder cron |

## Technologies & why

- **`react-big-calendar` + dayjs localizer** — mature calendar with Day/Week/Month out of the box; styled via MUI `sx` overrides to avoid global CSS conflicts.
- **`moment-timezone` on the server** — availability must be computed in clinic-local time (Asia/Manila) regardless of the serverless region.
- **Interval-overlap query in SQL (via Prisma)** — the conflict check runs where the data lives; two nearly-simultaneous requests still funnel through the same check against committed rows.

## Mock Panel Q&A

**Q: How exactly do you prevent double-booking?**
A: Server-side interval overlap: a new appointment for a dentist is rejected with 409 if any existing non-cancelled appointment satisfies `existing.start < new.end AND existing.end > new.start`. The end time includes service duration plus buffer time and is computed by the server, never trusted from the client. The same check runs for staff creates, patient bookings, and reschedules, and the slot picker only ever offers times that already pass it.

**Q: What's buffer time and why is it inside the conflict window?**
A: Each service defines cleanup/preparation minutes. We add it to the blocked interval (`endsAt = start + duration + buffer`), so the next booking physically cannot start until the room is ready. If it were cosmetic, back-to-back bookings would erase it.

**Q: Two patients click the same slot at almost the same moment — what happens?**
A: Both requests hit the overlap check; the first to commit wins, the second finds the newly committed row and receives 409, and the UI tells them to pick another slot. The slot list also refreshes on selection, so the window is seconds wide at most.

**Q: Why do patient bookings always start as PENDING?**
A: Clinic workflow control. Staff review each request (right dentist? plausible service?) and confirm it — that's the "organized clinic workflow" in Objective 1. The pending sidebar badge makes sure requests aren't missed, and the patient is emailed at every status change.

**Q: Why is rescheduling implemented as new-appointment-plus-RESCHEDULED instead of editing the date?**
A: Auditability. The original appointment keeps its full history and terminal RESCHEDULED status; the new one gets a fresh conflict check and its own code. Nothing is overwritten, so reports and the audit trail stay truthful.

**Q: How do reminders work on a serverless platform with no long-running process?**
A: A Vercel Cron job calls `GET /api/cron/reminders` daily at 08:00 UTC with a `CRON_SECRET` bearer token. It selects appointments in the 24 h and 2 h windows, sends in-app + email reminders, and sets `reminderSent24h`/`reminderSent2h` so re-runs never duplicate.

**Q: What happens across a clinic closure or outside opening hours?**
A: Steps 1–3 of the pipeline reject the write, and the slot generator never offers such times in the first place — the date picker even disables closed days. Enforcement is dual: UI for usability, server for security.

**Q: Is the conflict check truly atomic? What about a race between check and insert?**
A: The check-then-insert window exists but is milliseconds wide, and the loser of a genuine tie is caught in practice: both requests query committed rows, the first insert commits, the second request's check (or the staff confirmation step for patient bookings — everything starts PENDING) surfaces the clash. A stricter design would use a database exclusion constraint on the time range; we documented that as future hardening, and note the receptionist confirmation step is a human backstop for the residual case.

**Q: How does "Any Available" dentist work?**
A: `Appointment.dentistId` is nullable — null means no dentist committed yet, so no dentist's calendar is blocked. Slot computation for "ANY" only offers times where at least one dentist assigned to that service is free, and staff assign the concrete dentist when confirming, at which point the overlap check runs against that dentist.

**Q: A patient books from abroad — whose timezone wins?**
A: The clinic's, always. All availability math runs in Asia/Manila via `moment-timezone` on the server (`lib/slots.js`), and slots are presented as clinic-local times. Appointments are physical visits to a Manila-area chair, so there is exactly one correct timezone.

**Q: Why a fixed 30-minute slot grid instead of arbitrary start times?**
A: Predictable, scannable schedules for staff and patients, and dramatically fewer candidate slots to conflict-check. Services longer than 30 minutes simply span multiple grid cells — the overlap math is continuous even though start times are quantized.

**Q: What happens to existing appointments if a service is deleted or a dentist is deactivated?**
A: Nothing destructive — deletion is soft (`isDeleted` flag), so existing appointments keep their references and history. The service/dentist just stops being offered for *new* bookings; staff handle in-flight appointments through the normal cancel/reschedule flow, with the patient notified automatically.

**Q: How are no-shows handled, and what are the consequences?**
A: Staff mark a CONFIRMED appointment NO_SHOW — a terminal state, recorded in the status history and the patient's record of visits. It feeds the no-show risk endpoint (`app/api/ai/risk/[patientId]`): patients crossing the threshold (default 2) are flagged high-risk to staff, who can e.g. require the reservation fee or confirm by phone before booking.

**Q: Can a patient spam the clinic with bookings?**
A: Each booking must clear a real available slot, lands as PENDING for staff review, can carry a reservation fee, and the account itself passed email verification and MFA. Junk requests are visible in the pending queue and cancellable in bulk, and the audit log ties every booking to the account.

---
Further reading: [`docs/appointments.md`](../appointments.md), [`docs/notifications.md`](../notifications.md).

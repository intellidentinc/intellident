# Data Models

## Soft Delete Pattern
All major models (`User`, `Patient`, `Dentist`, `Receptionist`, `Clinic`, `Service`, `Appointment`, `PatientRecord`, `Attachment`, `Billing`, `Payment`) have `isDeleted Boolean` + `deletedAt DateTime?` for audit-trail-preserving soft deletes. All queries filter `isDeleted: false`.

## Auth & Pre-Registration
- `EmailVerification` — pre-registration holding record created by sign-up; `User` is not created until email is verified. Fields: `token` (unique), `email`, `firstName`, `lastName`, `password` (hashed), `wrappedKey`, `keySalt`, `clinicId?`, `expiresAt` (24h), `createdAt`
- `PasswordResetToken` — one-time reset tokens; fields: `token` (unique), `email`, `expiresAt` (10 min), `usedAt?`, `createdAt`
- `User` — auth + role. Source of truth for role (`PATIENT | RECEPTIONIST | DENTIST | ADMIN`). Also holds `passwordHistory String[]`, `failedLoginAttempts`, `lastFailedAt`, `lockedUntil`, `address?`, `dateOfBirth?`

## Clinic & Schedule
- `Clinic` — multi-tenant root. Holds `name`, `code` (e.g. `MLC`, `KH`, `CAB`), `address`, `email`, `phone`, `landline`, `logoUrl`
- `ClinicSchedule` — one per clinic; `workingDays String[]` (e.g. `["MON","TUE"]`), `openTime`, `closeTime` (HH:mm strings). Upserted via PATCH.
- `ClinicClosure` — many per clinic; `date DateTime`, `reason String?` for holidays/maintenance

## User Profiles
- `Receptionist` — profile extension for `RECEPTIONIST` users (linked via `userId`)
- `Dentist` — profile extension for `DENTIST` users; has `specialty`; linked to `Appointment` via `dentistId`; assigned to services via `ServiceDentists` join table
- `Patient` — profile extension for `PATIENT` users; fields: `patientCode` (format: `PAT-{CLINICCODE}-{YYYY}-{#####}`), `dateOfBirth?`, `gender?` (Gender enum), `phone?`, `address?`, `consentStatus` (ConsentStatus enum, default `PENDING`), `consentGivenAt?`

## Services & Appointments
- `Service` — dental services; fields: `name`, `description?`, `duration`, `price?`, `bufferTime`; many-to-many with `Dentist` via `ServiceDentists`
- `Appointment` — scheduling record; `appointmentCode` (e.g. `APT-MLC-2026/03/25-0001`); `dentistId` is **nullable** (null = "Any Available"); `endsAt = scheduledAt + duration + bufferTime`; `reminderSent24h Boolean` + `reminderSent2h Boolean` (prevent duplicate cron reminders); `aiSuggested Boolean` (default false — reserved for future GPT-5 integration)
- `AppointmentStatusHistory` — audit trail of every status transition; fields: `appointmentId`, `status`, `changedById`, `changedAt`, `note`

## Patient Records (schema built; CRUD API not yet implemented)
- `PatientRecord` — E2EE encrypted clinical notes per patient; fields: `patientId`, `clinicId`, `title`, `encryptedData?`, `dataIv?`, `contentHash?` (SHA-256 hash for tamper detection — not yet wired to API), `status` (RecordStatus enum: `ACTIVE | ARCHIVED`)
- `Attachment` — file references linked to a `PatientRecord`; fields: `recordId`, `fileName`, `fileUrl`, `mimeType`

## Billing (schema built; API/UI not yet implemented)
- `Billing` — invoice per appointment; fields: `clinicId`, `patientId`, `appointmentId` (unique), `amount`, `amountPaid`, `balance`, `status` (PaymentStatus enum: `UNPAID | PARTIAL | PAID | REFUNDED`), `receiptNumber` (unique)
- `Payment` — individual payment entries linked to a `Billing`; fields: `billingId`, `amount`, `method?`, `notes?`, `paidAt`

## Audit & Notifications
- `AuditLog` — system-wide audit trail (schema built; query API/UI not yet implemented); fields: `userId?`, `clinicId?`, `action` (AuditAction enum), `entity`, `entityId?`, `ipAddress?`, `userAgent?`, `metadata` (Json)
- `InAppNotification` — in-app bell notifications; fields: `userId`, `clinicId`, `type` (NotificationType), `title`, `body`, `appointmentId?`, `isRead`, `createdAt`
- `Notification` — **legacy email queue model; not actively used.** System uses `InAppNotification` for bell + Mailjet fire-and-forget for email.

## Enums

```
UserRole:         PATIENT | RECEPTIONIST | DENTIST | ADMIN
Gender:           MALE | FEMALE | OTHER | PREFER_NOT_TO_SAY
AppointmentStatus: PENDING | CONFIRMED | RESCHEDULED | CANCELLED | COMPLETED | NO_SHOW
RecordStatus:     ACTIVE | ARCHIVED
PaymentStatus:    UNPAID | PARTIAL | PAID | REFUNDED
ConsentStatus:    PENDING | GIVEN | REVOKED
NotificationStatus: PENDING | SENT | FAILED  (legacy Notification model only)
AuditAction:      LOGIN | LOGOUT | CREATE | UPDATE | DELETE | VIEW | EXPORT | VERIFY
```

## NotificationType Enum
```
BOOKING_REQUEST         — new patient booking (→ staff)
APPOINTMENT_CONFIRMED   — booking confirmed (→ patient)
APPOINTMENT_CANCELLED   — booking cancelled (→ patient + staff)
APPOINTMENT_COMPLETED   — visit completed (→ patient)
APPOINTMENT_NO_SHOW     — patient no-show (→ patient)
APPOINTMENT_RESCHEDULED — appointment rescheduled (→ patient)
REMINDER_24H            — 24-hour reminder (→ patient, via cron)
REMINDER_2H             — 2-hour reminder (→ patient, via cron)
```

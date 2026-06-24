# Data Models

## Soft Delete Pattern
All major models (`User`, `Patient`, `Dentist`, `Receptionist`, `Clinic`, `Service`, `Appointment`, `PatientRecord`, `Attachment`, `Billing`, `Payment`) have `isDeleted Boolean` + `deletedAt DateTime?` for audit-trail-preserving soft deletes. All queries filter `isDeleted: false`.

## Auth & Pre-Registration
- `EmailVerification` — pre-registration holding record created by sign-up; `User` is not created until email is verified. Fields: `token` (unique — stores the **SHA-256 hash** of the verification token; the raw token is only in the emailed link), `email`, `firstName`, `lastName`, `password` (hashed), `wrappedKey`, `keySalt`, `clinicId?`, `expiresAt` (24h), `createdAt`
- `PasswordResetToken` — one-time reset tokens; fields: `token` (unique — stores the **SHA-256 hash** of the reset token; the raw token is only in the emailed link), `email`, `expiresAt` (10 min), `usedAt?`, `createdAt`
- `MfaOtp` — bcrypt-hashed 6-digit OTP records used for both MFA sign-in and super admin restore confirmation; fields: `userId`, `pendingToken` (unique 64-char hex, used as URL token or restore token), `codeHash` (bcrypt hash of the 6-digit OTP), `rememberMe Boolean`, `expiresAt` (10 min), `attempts` (max 5), `usedAt?`
- `User` — auth + role. Source of truth for role (stored as Int: 0=SUPERADMIN, 1=ADMIN, 2=DENTIST, 3=RECEPTIONIST, 4=PATIENT; see `lib/roles.js`). Also holds `passwordHistory String[]`, `failedLoginAttempts`, `lastFailedAt`, `lockedUntil`, `address?`, `dateOfBirth?`, `middleInitial String?`, `username String?` (auto-generated as `{CLINICCODE}-{LASTNAME}-{####}` for admin-created staff), `mustChangePassword Boolean` (default `false`; set `true` on admin-created accounts; cleared on first successful password change), `passwordExpiresAt DateTime?` (set to `now + 90 days` for ADMIN accounts on each password change when the clinic has `passwordExpiryEnabled`), and the **E2EE envelope keypair**: `publicKey String?` (SPKI base64), `encryptedPrivateKey String?` (PKCS8, AES-GCM-encrypted under the master key), `privateKeyIv String?` — provisioned set-if-null via `POST /api/profile/keys`, cleared on password reset (see [`records.md`](./records.md))
- `UserSession` — DB-backed session record per login; `sessionToken` (stored in cookie, validated on every `getSession()` call), `expiresAt`, `terminatedAt?` (set on sign-out or single-session eviction; enables immediate server-side invalidation), `userId`, `clinicId?`, `userAgent?`, `ipAddress?`
- `KnownDevice` — tracks user agent hash + IP per user; fields: `userId`, `userAgentHash`, `ipAddress`, `firstSeenAt`, `lastSeenAt`
- `RateLimit` — DB-backed IP rate limiter backing `lib/rateLimit.js`; fields: `key` (IP + action composite), `count`, `windowStart`

## Clinic & Schedule
- `Clinic` — multi-tenant root. Fields: `name`, `code` (e.g. `MLC`, `KH`, `CAB`), `address`, `email`, `phone`, `landline`, `logoUrl`, `isEnabled Boolean` (default `true`; disabled clinics blocked at middleware), `passwordExpiryEnabled Boolean` (default `false`; when `true`, ADMIN accounts have `passwordExpiresAt` updated on each password change), `singleSessionEnabled Boolean` (default `false`; when `true`, new login terminates any existing active session), `reservationFeeAmount Float` (default `0`), `paymongoEnabled Boolean` (default `false`), `notifConfig Json?` (per-event notification toggles), `reminder1Hours Int` (default 24), `reminder2Hours Int` (default 2), `auditLogRetentionDays Int?` (null = keep forever), `patientRecordRetentionDays Int?` (applies to soft-deleted records; cascades `RecordHistory` + `Attachment`), `billingRetentionDays Int?` (applies to soft-deleted billing; cascades `Payment`)
- `ClinicSchedule` — one per clinic; `workingDays String[]` (e.g. `["MON","TUE"]`), `openTime`, `closeTime` (HH:mm strings). Upserted via PATCH.
- `SchedulePreset` — saved operating hour templates per clinic; fields: `clinicId`, `name`, `workingDays String[]`, `openTime`, `closeTime`; applying a preset fills the schedule form without saving to live schedule
- `ClinicClosure` — many per clinic; `date DateTime`, `reason String?` for holidays/maintenance
- `ClinicApplication` — onboarding request submitted via the public sign-up form; fields: `clinicName`, `businessAddress`, `businessPhone`, `businessEmail`, `contactPersonName`, `contactPersonPhone`, `contactPersonEmail?`, document arrays `birDocuments String[]`, `businessPermitDocs String[]`, `dtiSecDocs String[]`, `applicantIds String[]`, `prcLicenseDocs String[]` (bucket-relative paths in the private `clinic-documents` Supabase bucket — see `lib/clinicDocs.js`), `message?`, `status` (ApplicationStatus, default `PENDING`), `notes?` (rejection reason), `clinicId?` (set when approved — links to the created `Clinic`). On APPROVE: a `Clinic` record is created atomically in a transaction and the applicant is emailed a sign-up link. On REJECT: the applicant is emailed with the optional rejection notes.

## User Profiles
- `Receptionist` — profile extension for `RECEPTIONIST` users (linked via `userId`)
- `Dentist` — profile extension for `DENTIST` users; has `specialty`; linked to `Appointment` via `dentistId`; assigned to services via `ServiceDentists` join table
- `Patient` — profile extension for `PATIENT` users; fields: `patientCode` (format: `PAT-{CLINICCODE}-{YYYY}-{#####}`), `dateOfBirth?`, `gender?` (Gender enum), `phone?`, `address?`, `consentStatus` (ConsentStatus enum, default `PENDING`), `consentGivenAt?`

## Services & Appointments
- `Service` — dental services; fields: `name`, `description?`, `duration`, `price?`, `bufferTime`; many-to-many with `Dentist` via `ServiceDentists`
- `Appointment` — scheduling record; `appointmentCode` (e.g. `APT-MLC-2026/03/25-0001`); `dentistId` is **nullable** (null = "Any Available"); `endsAt = scheduledAt + duration + bufferTime`; `reminderSent24h Boolean` + `reminderSent2h Boolean` (prevent duplicate cron reminders); `aiSuggested Boolean` (default `false`)
- `AppointmentStatusHistory` — audit trail of every status transition; fields: `appointmentId`, `status`, `changedById`, `changedAt`, `note`

## Patient Records

> Full E2EE + sharing model: [`records.md`](./records.md).

- `PatientRecord` — E2EE encrypted clinical notes per patient; fields: `patientId`, `clinicId`, `title`, `encryptedData?` (AES-GCM ciphertext), `dataIv?`, `contentHash?` (SHA-256 tamper detection — computed on every write, verified on every read; mismatch surfaces a warning), `status` (RecordStatus enum: `ACTIVE | ARCHIVED`). Notes are encrypted with a per-record content key (CEK) using `patientId` as AAD.
- `RecordKey` — one row per authorized reader holding the record's CEK wrapped (RSA-OAEP) to that reader's public key; fields: `recordId`, `userId`, `wrappedKey`; `@@unique([recordId, userId])`; cascade-deletes with the record. This is how the patient and treating dentists each decrypt the same record without sharing a key.
- `RecordHistory` — JSON diff stored on every `PatientRecord` PATCH; fields: `recordId`, `userId`, `diff Json` (e.g. `title`/`status` before-after, `notesChanged: true`), `createdAt`; accessible via `GET /api/records/[patientId]/[recordId]/history`
- `Attachment` — file references linked to a `PatientRecord`; fields: `recordId`, `fileName`, `fileUrl` (Supabase `record-attachments` path), `mimeType`, `isDeleted` + `deletedAt`

## Billing & Payment
- `Billing` — invoice per appointment; fields: `clinicId`, `patientId`, `appointmentId` (unique), `amount`, `amountPaid`, `balance`, `status` (PaymentStatus enum: `UNPAID | PARTIAL | PAID | REFUNDED`), `receiptNumber` (unique; generated atomically via PostgreSQL advisory lock)
- `Payment` — individual payment entries linked to a `Billing`; fields: `billingId`, `amount`, `method?`, `notes?`, `paidAt`

## Audit & Notifications
- `AuditLog` — system-wide audit trail; fields: `userId?`, `clinicId?`, `action` (AuditAction enum), `entity`, `entityId?`, `ipAddress?`, `userAgent?`, `metadata` (Json). Purged per `Clinic.auditLogRetentionDays` by the daily cron.
- `InAppNotification` — in-app bell notifications; fields: `userId`, `clinicId`, `type` (NotificationType), `title`, `body`, `appointmentId?`, `isRead`, `createdAt`
- `Notification` — **legacy email queue model; not actively used.** System uses `InAppNotification` for bell + Gmail fire-and-forget for email.

## AI Chat
- `ChatSession` — persistent AI conversation per user per clinic; fields: `userId`, `clinicId`, `title String?` (first 80 chars of opening message), `isDeleted Boolean` (soft delete), `createdAt`, `updatedAt`, `deletedAt?`
- `ChatMessage` — individual messages within a `ChatSession`; fields: `sessionId`, `role` (ChatRole enum: `USER | ASSISTANT`), `content Text`, `createdAt`

## Data Subject Rights (DSAR)
- `DataRequest` — patient-submitted DSAR requests; fields: `userId`, `clinicId`, `type` (DataRequestType: `ACCESS | CORRECTION | DELETION`), `status` (DataRequestStatus: `PENDING | IN_REVIEW | RESOLVED | REJECTED`), `description?`, `adminNotes?`, `resolvedAt?`

## Enums

```
UserRole (stored as Int):
  0 = SUPERADMIN  — no clinicId; accesses /super portal; enters any clinic as ADMIN
  1 = ADMIN
  2 = DENTIST
  3 = RECEPTIONIST
  4 = PATIENT

Gender:            MALE | FEMALE | OTHER | PREFER_NOT_TO_SAY
AppointmentStatus: PENDING | CONFIRMED | RESCHEDULED | CANCELLED | COMPLETED | NO_SHOW
RecordStatus:      ACTIVE | ARCHIVED
PaymentStatus:     UNPAID | PARTIAL | PAID | REFUNDED
ConsentStatus:     PENDING | GIVEN | REVOKED
ApplicationStatus: PENDING | APPROVED | REJECTED  (ClinicApplication only)
NotificationStatus: PENDING | SENT | FAILED  (legacy Notification model only)
ChatRole:          USER | ASSISTANT

AuditAction:
  LOGIN | LOGIN_FAILED | LOGOUT | CREATE | UPDATE | DELETE | VIEW | EXPORT | VERIFY
  AI_INTERACTION  — chatbot + slot recommendation calls
  LOCKOUT         — account locked after failed attempts
  BREACH_ALERT    — breach scan detection event
  BACKUP          — super admin clinic data export
  RESTORE         — super admin restore confirmation

DataRequestType:   ACCESS | CORRECTION | DELETION
DataRequestStatus: PENDING | IN_REVIEW | RESOLVED | REJECTED
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
PAYMENT_RECEIVED        — online payment confirmed via PayMongo webhook (→ patient + staff)
```

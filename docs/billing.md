# Billing & PayMongo Integration

## Overview

IntelliDent's billing module covers the full payment lifecycle for a dental appointment:

1. **Reservation fee** — charged via PayMongo Checkout Session when a patient self-books, locking in the appointment slot.
2. **Remaining balance** — after the appointment is marked `COMPLETED`, staff can record cash payments or generate a new PayMongo checkout link; patients can also pay online from their My Bills page.

Billing is clinic-scoped and multi-tenant. Every query enforces `clinicId` from the verified session.

---

## Architecture

### Data Models

The existing `Billing` and `Payment` models in `prisma/schema.prisma` were extended with the following fields:

**`Clinic` model additions:**
```prisma
reservationFeeAmount Float   @default(0)  // upfront fee on patient booking
paymongoEnabled      Boolean @default(false)
```

**`Payment` model additions:**
```prisma
type                      String  @default("FULL") // "RESERVATION" | "FULL" | "PARTIAL"
paymongoCheckoutSessionId String?
paymongoPaymentId         String?
```

**`NotificationType` enum addition:**
```prisma
PAYMENT_RECEIVED
```

**Key relationships:**
- `Billing` has a `@unique` constraint on `appointmentId` — one billing per appointment.
- `Billing` → `Payment[]` (one-to-many) — supports partial payments and installments.
- `Payment.type = "RESERVATION"` marks the upfront deposit; `"FULL"` marks a full or remaining balance payment.

**Status flow (`PaymentStatus`):**
```
UNPAID → PARTIAL → PAID
                 ↘ REFUNDED  (manual, staff only)
```

Status is computed from `amountPaid` vs `amount` — never set directly except for `REFUNDED`.

---

## File Structure

### New files

```
lib/paymongo.js                                     PayMongo API client
lib/billing.js                                      Receipt number generator + status helper
app/api/billing/route.js                            GET (list) + POST (create)
app/api/billing/[id]/route.js                       GET (detail) + PATCH (cash payment / refund)
app/api/billing/[id]/checkout/route.js              POST (initiate PayMongo checkout)
app/api/patient/billing/route.js                    GET (patient's own billings)
app/api/webhooks/paymongo/route.js                  PayMongo webhook handler
app/modules/billing-page/BillingPage.jsx            Staff billing list
app/modules/billing-page/BillingDetailDrawer.jsx    Right-side drawer with actions
app/modules/billing-page/RecordPaymentModal.jsx     Cash payment form
app/modules/billing-page/BillingReceiptDocument.jsx @react-pdf/renderer A5 receipt
app/modules/my-billing-page/MyBillingPage.jsx       Patient billing + payment history
app/modules/settings-page/ClinicPaymentSettings.jsx Admin payment config (toggle + fee)
app/(main)/[clinicId]/billing/page.jsx              Staff billing page route
app/(main)/[clinicId]/my-billing/page.jsx           Patient billing page route
```

### Modified files

| File | Change |
|---|---|
| `prisma/schema.prisma` | New Clinic fields, Payment fields, `PAYMENT_RECEIVED` enum value |
| `app/api/schedules/route.js` | POST: creates Billing + PayMongo checkout after patient booking |
| `app/api/appointments/[id]/route.js` | PATCH: auto-creates Billing when status → `COMPLETED` |
| `app/api/clinics/[id]/profile/route.js` | GET/PATCH: exposes and updates `reservationFeeAmount`, `paymongoEnabled` |
| `app/modules/schedules-page/BookAppointmentModal.jsx` | Redirects to PayMongo if `checkoutUrl` returned |
| `app/modules/settings-page/SettingsPage.jsx` | Added Payment Settings section |
| `app/modules/dashboard-page/AppSidebar.jsx` | "My Bills" added to PATIENT sidebar (Health group) |

---

## Environment Variables

Add these to `.env` (local) and Vercel project settings (production):

| Variable | Purpose |
|---|---|
| `PAYMONGO_SECRET_KEY` | PayMongo secret key (`sk_test_…` or `sk_live_…`) |
| `PAYMONGO_PUBLIC_KEY` | PayMongo public key (`pk_test_…` or `pk_live_…`) |
| `PAYMONGO_WEBHOOK_SECRET` | Webhook signing secret from the PayMongo dashboard |
| `NEXT_PUBLIC_APP_URL` | Base URL of the deployed app (already set — used for redirect URLs) |

---

## Payment Flows

### 1. Reservation Fee (Patient Booking)

```
Patient submits BookAppointmentModal
    ↓
POST /api/schedules
    → create Appointment (PENDING)
    → create Billing (amount = service.price, status = UNPAID)
    → createCheckoutSession (amount = reservationFeeAmount, type = "RESERVATION")
    → return { appointment, checkoutUrl }
    ↓
Frontend: window.location.href = checkoutUrl
    ↓
Patient pays on PayMongo-hosted page
    ↓
PayMongo fires POST /api/webhooks/paymongo
    → verify signature
    → idempotency check on paymongoPaymentId
    → create Payment (type = "RESERVATION")
    → update Billing (amountPaid += fee, balance -= fee, status → PARTIAL)
    → notify patient (PAYMENT_RECEIVED)
    ↓
Patient redirected to /[clinicId]/my-billing?payment=success
```

**If `paymongoEnabled = false` or `reservationFeeAmount = 0`:** checkout is skipped; booking proceeds normally with no billing created.

### 2. Auto-Billing on Completion (Staff)

```
Staff sets appointment status → COMPLETED
    ↓
PATCH /api/appointments/[id]
    → if no Billing exists: create Billing (amount = service.price, status = UNPAID) + assign receiptNumber
    → if Billing exists but no receiptNumber: assign receiptNumber
```

The receipt number format is: `RCP-{CLINICCODE}-{YYYY}-{#####}` (5-digit zero-padded, per-clinic per-year sequence).

### 3. Cash Payment (Staff)

```
Staff opens Billing Detail Drawer → "Record Cash"
    ↓
PATCH /api/billing/[id]   { amount, notes, method: "CASH" }
    → validate amount ≤ balance
    → $transaction: create Payment + update Billing amountPaid/balance/status
    → return updated billing
```

### 4. Online Payment — Remaining Balance (Patient or Staff-Initiated)

```
Patient clicks "Pay Now" on My Bills page  (or staff clicks "Payment Link" in drawer)
    ↓
POST /api/billing/[id]/checkout
    → validate status ≠ PAID / REFUNDED
    → createCheckoutSession (amount = billing.balance, type = "FULL")
    → return { checkoutUrl }
    ↓
Frontend redirects (patient) or opens new tab (staff)
    ↓
PayMongo webhook → same handler as reservation fee
```

---

## API Reference

### `GET /api/billing`
**Auth:** ADMIN | RECEPTIONIST | SUPERADMIN

**Query params:**
| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int | 0 | Zero-indexed |
| `pageSize` | int | 10 | Max 100 |
| `sortField` | string | `createdAt` | `createdAt`, `updatedAt`, `amount`, `amountPaid`, `balance` |
| `sortOrder` | string | `desc` | `asc` or `desc` |
| `status` | string | — | `UNPAID`, `PARTIAL`, `PAID`, `REFUNDED` |
| `dateFrom` | ISO date | — | Filter by `createdAt ≥` |
| `dateTo` | ISO date | — | Filter by `createdAt ≤` |
| `search` | string | — | Matches patient name or appointment code |

**Response:** `{ billings: [...], total: number }`

Each billing includes: `patient`, `appointment.service`, `appointment.dentist`, `payments[]`.

---

### `POST /api/billing`
**Auth:** ADMIN | RECEPTIONIST | SUPERADMIN

**Body:** `{ appointmentId: string }`

Creates a billing record manually for a specific appointment. Fails with 409 if one already exists.

**Response:** `{ billing }` · 201

---

### `GET /api/billing/[id]`
**Auth:** Staff (any clinic-scoped staff) or the Patient who owns the billing.

**Response:** `{ billing }` with full payments, appointment, and patient detail.

---

### `PATCH /api/billing/[id]`
**Auth:** ADMIN | RECEPTIONIST | SUPERADMIN

**Body A — Record cash payment:**
```json
{ "amount": 500.00, "notes": "Paid in cash", "method": "CASH" }
```
Creates a `Payment` record and recalculates `amountPaid`, `balance`, `status` in a transaction.

**Body B — Mark as refunded:**
```json
{ "status": "REFUNDED" }
```

**Response:** `{ billing }` with updated payments list.

---

### `POST /api/billing/[id]/checkout`
**Auth:** PATIENT (own billing only) | ADMIN | RECEPTIONIST

Initiates a PayMongo Checkout Session for the outstanding `balance`.

**Response:** `{ checkoutUrl: string }`

Frontend should redirect (`window.location.href`) or open in a new tab.

---

### `GET /api/patient/billing`
**Auth:** PATIENT only

Returns all of the authenticated patient's billing records, ordered by `createdAt desc`.

**Response:** `{ billings: [...] }` with `appointment.service`, `appointment.dentist`, `payments[]`.

---

### `POST /api/webhooks/paymongo`
**Auth:** PayMongo webhook signature (HMAC-SHA256, verified via `PAYMONGO_WEBHOOK_SECRET`)

Handled event: `checkout_session.payment.paid`

- Verifies signature before processing.
- Idempotent: checks `paymongoPaymentId` before inserting.
- Creates `Payment`, updates `Billing` status, fires `PAYMENT_RECEIVED` in-app notification.
- Always returns 200 (PayMongo retries on non-2xx).

---

## PayMongo Integration Details

### Client (`lib/paymongo.js`)

```js
import { createCheckoutSession, verifyWebhookSignature } from '@/lib/paymongo'

// Create a checkout session
const { checkoutSessionId, checkoutUrl } = await createCheckoutSession({
  lineItems: [{ amount: 50000, currency: 'PHP', name: 'Cleaning Fee', quantity: 1 }],
  successUrl: 'https://app.example.com/my-billing?payment=success',
  cancelUrl:  'https://app.example.com/my-billing',
  metadata:   { billingId, clinicId, paymentType: 'RESERVATION' },
})

// Verify a webhook
const valid = verifyWebhookSignature(rawBody, request.headers.get('paymongo-signature'))
```

**Supported payment methods:** keyed off `PAYMONGO_SECRET_KEY`. Live keys (`sk_live_*`) enable `card`, `gcash`, `paymaya`, `qrph`, `dob`, `brankas_landbank`, `brankas_metrobank`; test keys enable `card`, `gcash`, `qrph`.

**Note:** `amount` is in **centavos** (PHP × 100). The client library handles conversion both ways.

### Webhook Signature Format

PayMongo sends: `paymongo-signature: t=<timestamp>,te=<test_hmac>,li=<live_hmac>`

Verification (`verifyWebhookSignature`): the timestamp must be **within 300 seconds** of now (replay protection), then `HMAC-SHA256(secret, "${timestamp}.${rawBody}")` must match either `te` (test) or `li` (live) via constant-time comparison. Fails closed if `PAYMONGO_WEBHOOK_SECRET` is unset.

### Setting Up Webhooks in PayMongo Dashboard

1. Go to [PayMongo Dashboard](https://dashboard.paymongo.com) → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/paymongo`
3. Subscribe to event: `checkout_session.payment.paid`
4. Copy the signing secret → set as `PAYMONGO_WEBHOOK_SECRET`

---

## Receipt PDF (`BillingReceiptDocument.jsx`)

Built with `@react-pdf/renderer`. Rendered client-side via dynamic import to avoid SSR issues:

```js
const { pdf } = await import('@react-pdf/renderer')
const BillingReceiptDocument = (await import('@/app/modules/billing-page/BillingReceiptDocument')).default
const blob = await pdf(<BillingReceiptDocument billing={billing} clinic={clinic} />).toBlob()
```

**Receipt sections:**
1. Clinic logo, name, address, email, phone
2. "OFFICIAL RECEIPT" heading + receipt number + date issued
3. Patient name + patient code
4. Appointment reference + service + scheduled date
5. Itemized breakdown: service total | reservation fee paid | additional payments | **TOTAL PAID** | outstanding balance
6. Payment methods list (CASH / Online) per payment record
7. Thank-you footer

A5 page size. Downloads as `receipt-{receiptNumber}.pdf`.

---

## UI Components

### Staff: `BillingPage` (`/[clinicId]/billing`)
- Accessible to **ADMIN** and **RECEPTIONIST** (already in sidebar).
- Paginated MUI Table with columns: Appt. Code | Patient | Service | Total | Paid | Balance | Status
- Filter by status, debounced search (350ms) by patient name or appointment code.
- Click any row → opens `BillingDetailDrawer`.

### Staff: `BillingDetailDrawer`
- MUI Drawer (480px, anchor right).
- Sections: appointment info | amount summary | payment history timeline.
- Action buttons (context-aware):
  - **Receipt PDF** — shown if `PARTIAL` or `PAID`
  - **Payment Link** — opens PayMongo checkout in new tab (for patient to pay)
  - **Record Cash** — opens `RecordPaymentModal`

### Staff: `RecordPaymentModal`
- Standard Dialog pattern (icon header + Divider + body + Divider + footer).
- Fields: `amount` (max = balance), `notes` (optional).

### Patient: `MyBillingPage` (`/[clinicId]/my-billing`)
- Accessible to **PATIENT** (added to sidebar under Health → "My Bills").
- Two sections:
  - **Outstanding Bills** — UNPAID/PARTIAL; "Pay Now" button → PayMongo redirect
  - **Payment History** — PAID/REFUNDED; "Receipt" button → PDF download
- Payment success banner: shown when redirected back with `?payment=success`

### Admin: `ClinicPaymentSettings` (in `/settings`)
- Toggle: Enable PayMongo Online Payments
- Number input: Reservation Fee Amount (₱) — disabled if PayMongo is off
- Save button → `PATCH /api/clinics/[id]/profile`

---

## Status Chip Reference

| Status | Background | Text | Meaning |
|---|---|---|---|
| `UNPAID` | `#fee2e2` | `#b91c1c` | No payment received |
| `PARTIAL` | `#fef3c7` | `#92400e` | Reservation fee paid; balance remains |
| `PAID` | `#dcfce7` | `#15803d` | Fully settled |
| `REFUNDED` | `#f3e8ff` | `#7c3aed` | Manually marked as refunded by staff |

---

## Security Notes

- **Webhook signature verification** is enforced before any DB write. Invalid signatures return 401.
- **Idempotency** on `paymongoPaymentId` prevents double-crediting from retried webhooks.
- **Patients** can only view and pay their own billing records — `patientId` is verified server-side, never trusted from the client.
- **Amount bounds** — cash payment amount is validated server-side against `billing.balance`; checkout session amount is derived from `billing.balance`, not from any client-supplied value.
- **No amount in request body for checkout** — the payable amount is read from the DB, not the request.
- All routes enforce `clinicId` scoping from the verified session (zero-trust multi-tenancy).

---

## Known Limitations / Future Work

- **Rescheduled appointments:** If an appointment is rescheduled to a different service/price, the billing `amount` is not automatically updated. Staff must manually adjust.
- **Partial refunds:** The API supports `REFUNDED` status but does not create a negative `Payment` record. A future version could support itemized refunds.
- **PayMongo webhook registration:** Not yet automated. Must be set up manually in the PayMongo dashboard (see Setup section above).
- **E-invoice email:** The system does not yet email the receipt PDF to the patient after payment. This can be added to the webhook handler using `lib/email.js`.
- **Cancellation and billing:** If an appointment is cancelled after a reservation fee was paid, the billing persists as `PARTIAL`. Staff must manually mark it `REFUNDED` and process the refund through PayMongo's dashboard.

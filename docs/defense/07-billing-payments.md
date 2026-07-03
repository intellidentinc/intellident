# 07 — Billing & Payments

## What it is

Complete billing lifecycle (part of capstone **Objective 2**'s "billing data"): bills are created automatically from appointments, paid in cash at the desk or online through **PayMongo** (GCash, Maya, cards, QRPh), confirmed by a cryptographically verified webhook, and receipted with sequential numbers. Data model: `Billing` (one per charge, with `amount`, `amountPaid`, `balance`, `status`, `billingType`) and `Payment` (one row per payment event) in `prisma/schema.prisma`.

## How bills come to exist

1. **Auto-billing on completion** — when staff mark an appointment COMPLETED (`PATCH /api/appointments/[id]`), a SERVICE billing is created from the appointment's services.
2. **Reservation fee at booking** — patient self-booking (`POST /api/schedules`) creates a RESERVATION billing plus a PayMongo checkout session and redirects the patient to pay. This is **best-effort**: if checkout creation fails, the booking still succeeds. If the clinic sets `reservationFeeDeductible`, `applyReservationCredit()` (`lib/billing.js`) later credits the paid deposit against the SERVICE bill inside the same transaction.
3. **Manual** — staff can create bills via `POST /api/billing` (ADMIN/RECEPTIONIST).

Status is always derived, never hand-set: `computeBillingStatus()` in `lib/billing.js` → `UNPAID` (nothing paid), `PARTIAL`, `PAID` (amountPaid ≥ amount).

## Payment flows

**Cash (staff):** `app/modules/billing-page/RecordPaymentModal.jsx` → `PATCH /api/billing/[id]` records a Payment, recomputes amounts/status, issues a receipt number when fully paid.

**Online (patient):**
1. `/my-billing` (`app/modules/my-billing-page/`) → **Pay Now** → `POST /api/billing/[id]/checkout`.
2. Server calls `createCheckoutSession()` (`lib/paymongo.js`) — PayMongo REST API with `PAYMONGO_SECRET_KEY` Basic auth; `billingId`/`clinicId` ride along in the session **metadata**; live keys unlock more payment methods (bank debits) than test keys.
3. Patient pays on PayMongo's hosted page (we never touch card/GCash credentials).
4. PayMongo calls our **webhook** — the step to know cold, below.

## The webhook — `app/api/webhooks/paymongo/route.js`

1. **Signature verification** (`verifyWebhookSignature()` in `lib/paymongo.js`): header format `t=<timestamp>,te=<test-sig>,li=<live-sig>`; recompute `HMAC-SHA256(timestamp + "." + rawBody, PAYMONGO_WEBHOOK_SECRET)` and compare **constant-time** (`lib/secureCompare.js`). **Fails closed** if the secret is unconfigured. Invalid → 401.
2. **Replay protection** — timestamps older than **5 minutes** are rejected, so a captured webhook can't be re-sent later.
3. Only `checkout_session.payment.paid` events proceed.
4. **Idempotency** — if a `Payment` with this `paymongoPaymentId` already exists, respond `{received:true}` and change nothing (PayMongo retries deliveries; retries must not double-credit).
5. Inside a **Prisma `$transaction`**: create the `Payment`, update the `Billing` (amountPaid/balance/status), and if it just became PAID, generate the receipt number — atomically.
6. Fire-and-forget afterwards: in-app "Payment Confirmed" notification to the patient (`after()`), audit log entry (`entity: Payment`, userAgent `paymongo-webhook`).

## Receipt numbers — `generateReceiptNumber()` (`lib/billing.js`)

Format `RCP-{CLINICCODE}-{YEAR}-{#####}`. Two subtleties worth mentioning:
- A **Postgres advisory lock** keyed on the clinicId (`pg_advisory_xact_lock`) serializes concurrent generation within the transaction, so two simultaneous payments can't mint the same number.
- The next number is based on the **highest existing** sequence, not a row count — counts collide when the sequence has gaps.

PDF receipts render client-side (`BillingReceiptDocument.jsx`), downloadable by staff and by the patient from My Billing.

## Staff UI

`app/modules/billing-page/BillingPage.jsx` — list with filters + `BillingDetailDrawer.jsx` (payment history, record payment, receipt). Clinic PayMongo settings live in Settings (`ClinicPaymentSettings`). Billing rows are soft-deleted and covered by the per-clinic retention purge (`Clinic.billingRetentionDays`).

## Key files table

| File | Role |
|---|---|
| `lib/billing.js` | `computeBillingStatus`, `generateReceiptNumber` (advisory lock), `applyReservationCredit` |
| `lib/paymongo.js` | Checkout session creation + webhook signature/replay verification |
| `app/api/webhooks/paymongo/route.js` | Verified, idempotent, transactional payment recording |
| `app/api/billing/route.js`, `[id]/route.js`, `[id]/checkout/route.js` | Staff CRUD + checkout |
| `app/api/patient/billing/route.js` | Patient's own bills |
| `app/modules/billing-page/`, `app/modules/my-billing-page/` | Staff and patient UIs |
| `lib/secureCompare.js` | Constant-time comparison used by signature check |

## Technologies & why

- **PayMongo** — the Philippine payment aggregator: GCash/Maya/QRPh/cards in one integration; hosted checkout keeps us out of PCI-DSS card-data scope.
- **HMAC-SHA256 webhook signatures + constant-time compare** — proves the callback is from PayMongo and defeats timing-based signature guessing.
- **DB transaction + idempotency key** — money movement must be exactly-once even with at-least-once webhook delivery.
- **Postgres advisory locks** — cheap, transaction-scoped mutual exclusion for the receipt sequence without a dedicated counter table.

## Mock Panel Q&A

**Q: How do you know a "payment confirmed" callback really came from PayMongo?**
A: The `paymongo-signature` header. We recompute HMAC-SHA256 over `timestamp.rawBody` with the shared webhook secret and compare in constant time. No valid signature → 401 and nothing is recorded. If the secret isn't configured at all we fail closed and accept nothing.

**Q: An attacker captures a legitimate webhook and replays it tomorrow. What happens?**
A: Two independent rejections. The signature check refuses timestamps older than 5 minutes. And even inside the window, idempotency catches it: we look up the `paymongoPaymentId` and, if a Payment already exists, acknowledge without touching the bill.

**Q: PayMongo retries a delivery it thinks failed — do you double-credit the bill?**
A: No — that's exactly the idempotency check. Webhook delivery is at-least-once by design, so the handler is written to be safely re-runnable: same paymentId in, no-op out.

**Q: Why is payment recording wrapped in a database transaction?**
A: The Payment row, the Billing update, and the receipt number must be all-or-nothing. A crash between them would otherwise leave a paid bill showing unpaid, or a receipt number consumed by nothing. `$transaction` plus the advisory lock (released on commit) guarantees consistency under concurrency.

**Q: Do you store card numbers or GCash credentials?**
A: Never. The patient pays on PayMongo's hosted checkout page; we only receive an event saying which bill was paid and how much. That keeps sensitive payment credentials entirely out of our system and out of PCI scope.

**Q: What if a patient pays the reservation fee but the appointment gets cancelled — or pays partially?**
A: Bills track `amountPaid` and `balance` independently, so partial payments land as PARTIAL status. Reservation deposits are separate RESERVATION bills; when the clinic enables deductibility, the deposit is credited against the final SERVICE bill transactionally via `applyReservationCredit()`. Cancellation/refund handling is a staff workflow on the billing detail drawer.

**Q: How are receipt numbers kept gapless-safe and unique under concurrent payments?**
A: A per-clinic Postgres advisory lock serializes generation inside the transaction, and the next number derives from the maximum existing sequence rather than a count — so concurrent payments queue for a millisecond, and historical gaps never cause collisions.

**Q: A patient paid on PayMongo but the webhook never arrives — now what?**
A: The bill shows unpaid until it does. PayMongo retries failed webhook deliveries automatically, and our handler is idempotent, so late or duplicate delivery is harmless. If the patient reports it first, staff verify the payment in the PayMongo dashboard and record it manually via the billing drawer — the manual path and the webhook path converge on the same Payment + status recomputation, with the audit log showing which path was taken.

**Q: How do refunds work?**
A: An admin marks the bill REFUNDED via `PATCH /api/billing/[id]` — an audited status change; the money movement itself is executed in PayMongo (or as cash at the desk). The webhook handler ignores further payment events on REFUNDED bills, so state can't regress.

**Q: You store amounts as floats — is that safe for money?**
A: It's a known limitation we can speak to honestly. PayMongo transacts in integer centavos (we convert `amount / 100` on receipt), amounts are two-decimal PHP values well inside float precision, and status thresholds use `>=` comparisons, so no drift shows up at clinic scale. The textbook-correct type is `Decimal`, and migrating the `Billing`/`Payment` columns is on our hardening list.

**Q: What's the difference between test mode and live mode in your PayMongo setup?**
A: The key prefix decides (`sk_live_` vs test keys), and `lib/paymongo.js` even narrows payment methods in test mode (card/GCash/QRPh) versus live (adds Maya and bank debits). The webhook verifies both the test signature (`te`) and live signature (`li`) fields, so the same handler serves both environments — our defense demo runs on test keys with PayMongo's test cards.

**Q: Could a malicious patient pay ₱1 against a ₱5,000 bill and mark it paid?**
A: No. The webhook credits exactly the amount PayMongo says was collected, and status is *derived*: `computeBillingStatus()` returns PARTIAL until `amountPaid >= amount`. The client never supplies amounts or statuses on this path — the checkout line items are built server-side from the bill, and confirmation comes only from the signed webhook.

**Q: Why does the booking still succeed if the reservation-fee checkout fails?**
A: Deliberate priority: care over payment. Failing a booking because a payment gateway hiccuped punishes the patient for our dependency. The bill still exists as UNPAID, staff see it at confirmation time, and the patient can pay from My Billing — best-effort checkout, guaranteed bookkeeping.

---
Further reading: [`docs/billing.md`](../billing.md).

# Patient Records — End-to-End Encryption & Sharing

> How clinical record notes are encrypted, who can read them, and how access is granted and healed over time.

IntelliDent patient-record notes are **end-to-end encrypted**: they are encrypted in the browser and the server only ever stores ciphertext. Because more than one person legitimately needs to read a record (the patient and every dentist treating them), the system uses an **asymmetric-envelope** scheme rather than a single shared key.

All crypto primitives live in [`lib/crypto.js`](../lib/crypto.js) (low-level) and [`lib/recordCrypto.js`](../lib/recordCrypto.js) (record-level flow). Server-side authorization lives in [`lib/records-access.js`](../lib/records-access.js).

---

## The envelope model

Each user owns an **RSA-OAEP 2048** keypair. Each record gets a fresh **AES-GCM-256 content key (CEK)**.

```
notes ──AES-GCM-256(CEK, AAD=patientId)──▶ encryptedData + dataIv   (stored on server)

CEK ──RSA-OAEP(reader₁ public key)──▶ wrappedKey₁  ┐
CEK ──RSA-OAEP(reader₂ public key)──▶ wrappedKey₂  ├─ one RecordKey row per reader
CEK ──RSA-OAEP(reader₃ public key)──▶ wrappedKey₃  ┘
```

- The notes are encrypted once with the per-record CEK.
- The CEK is **wrapped** (RSA-encrypted) once to each authorized reader's public key, producing one `RecordKey` row per reader.
- To read a record, a user fetches their own `RecordKey` wrap, unwraps the CEK with their **private key**, then decrypts the notes with the CEK.
- The server never sees the CEK, any private key, or any plaintext — it only stores public keys, wrapped CEKs, and ciphertext.

### AAD binding
`encryptData` / `decryptData` bind `patientId` as **AES-GCM Additional Authenticated Data**. Ciphertext cannot be moved to another patient's record without failing decryption. Decryption falls back to no-AAD for records written before AAD was introduced (`lib/crypto.js`).

---

## Key provisioning

Keypairs are provisioned lazily on login by [`lib/clientKeys.js`](../lib/clientKeys.js) → `loadOrProvisionKeys(authData, password)`:

1. Derive the KEK from the password (PBKDF2, 210 000 iterations, `AES-KW`) and unwrap the **master key** (`deriveKEK` → `unwrapMasterKey`).
2. If the auth response already carries `publicKey` + `encryptedPrivateKey` + `privateKeyIv`, decrypt the private key with the master key and use it.
3. Otherwise (pre-existing users, brand-new signups, or a just-reset account) generate a fresh RSA keypair, encrypt the private key under the master key, and persist it via **`POST /api/profile/keys`** (set-if-null on the server).

The private key is stored **encrypted under the master key** (which is itself wrapped by the password-derived KEK). On **password reset**, the server clears these fields so a fresh keypair is provisioned on next login — old wraps become unreadable, which is the intended behavior (reset deliberately discards old E2EE access). The decrypted keypair is held in memory by `CryptoProvider` and cleared on sign-out.

`POST /api/profile/keys` is **set-if-null**: once a keypair is stored it is never overwritten, so a transient client cannot clobber a working keypair.

### Unlock after page reload

The decrypted keypair and master key live **only** in `CryptoProvider` React state, so a full page reload wipes them while the session cookie stays valid. Rather than forcing a re-login (which the still-valid session just bounces back to the dashboard), [`components/commons/UnlockRecordsModal.jsx`](../components/commons/UnlockRecordsModal.jsx) prompts for the account password, fetches the wrapped key material from **`GET /api/profile/keys`**, and re-derives the keys locally via `loadOrProvisionKeys`. Nothing is persisted to disk; a wrong password simply fails the unwrap. It is shown when a records view needs keys that are not in memory (e.g. `MyRecordsPage`, `PatientRecordsDrawer` after reload).

---

## Authorized readers

The authoritative reader set for a patient's records (`lib/records-access.js`):

- The **patient's own** user account.
- Every **dentist** with at least one `CONFIRMED` or `COMPLETED` appointment with that patient **in the same clinic**.

The server re-derives this set on every write and reshare and **never trusts the client's list**:

| Helper | Purpose |
|---|---|
| `getRecordsDentist(session)` | Resolve the caller's `Dentist` profile, scoped to their clinic. |
| `dentistTreatsPatient({ dentistId, patientId, clinicId })` | Gate: dentist must have a CONFIRMED/COMPLETED appointment with the patient. |
| `getAuthorizedReaderIds({ patientId, clinicId })` | The authoritative `Set` of reader user IDs (patient + treating dentists). |
| `getRecordRecipients({ patientId, clinicId })` | Maps readers to `{ userId, publicKey }`, skipping anyone who hasn't provisioned a keypair yet. |
| `validateWraps({ keys, recipientIds })` | On write, requires **exact coverage**: no wrap for a non-recipient, and no recipient left out — a malicious client cannot silently drop the patient or a dentist. |

Readers without a provisioned keypair simply receive no wrap until they have one; their access self-heals via reshare (below).

---

## Reshare / self-healing access

A dentist who starts treating a patient **after** a record was written has no `RecordKey` wrap for that record. On read, the server returns `needsReshare: true` (record is encrypted but the caller has no wrap).

To heal access, a current key-holder (the patient, or another dentist who can already read it) re-wraps the in-memory CEK to the current recipients:

1. Reader decrypts the record → `decryptRecordNotes` returns `{ notes, cek }` (the CEK is kept in memory).
2. Client calls `reshareRecord({ patientId, recordId, cek })` (`lib/recordCrypto.js`), which fetches current recipients, wraps the CEK to each, and `POST`s to `.../reshare`.
3. The server re-derives the authoritative recipient set and stores **only wraps for recipients that don't already have one**.

This is best-effort and idempotent — access heals on the next holder view.

---

## API routes

All record routes require an authenticated session **and** valid step-up auth (`isStepUpValid`); see [`security.md`](./security.md) — Step-Up Mode 1 (OTP). The client-side gate (`OtpStepUpModal`) resets on every page navigation, so users must verify via email OTP each time they load the records page, regardless of the 15-min server TTL. Dentist routes additionally pass the `dentistTreatsPatient` gate.

| Method | Route | Role | Purpose |
|---|---|---|---|
| `GET` | `/api/records` | DENTIST | Patient list (paginated, searchable — patients with ≥1 CONFIRMED/COMPLETED appt). |
| `GET` | `/api/records/[patientId]` | DENTIST | List a patient's records. |
| `POST` | `/api/records/[patientId]` | DENTIST | Create a record. Body: `{ title, encryptedData, dataIv, contentHash, keys: [{ userId, wrappedKey }] }`; `validateWraps` enforces exact recipient coverage. |
| `GET` | `/api/records/[patientId]/recipients` | DENTIST / PATIENT | Authorized readers' public keys → `[{ userId, publicKey }]`. |
| `GET` | `/api/records/[patientId]/[recordId]` | DENTIST | Fetch a record + the caller's own CEK wrap; sets `needsReshare` when no wrap exists. Generates 1-hour signed attachment URLs. |
| `PATCH` | `/api/records/[patientId]/[recordId]` | DENTIST | Update title/status/notes. On `notesChanged: true`, full re-key: client supplies new wraps for all recipients; old `RecordKey` rows are replaced in a transaction. |
| `DELETE` | `/api/records/[patientId]/[recordId]` | DENTIST | Soft-delete (`isDeleted: true`). |
| `POST` | `/api/records/[patientId]/[recordId]/reshare` | DENTIST / PATIENT | Heal access — store CEK wraps for recipients that lack one. |
| `POST` | `/api/records/[patientId]/[recordId]/attachments` | DENTIST | Upload a file (see below). |
| `DELETE` | `/api/records/[patientId]/[recordId]/attachments/[attachmentId]` | DENTIST | Soft-delete an attachment (best-effort storage removal). |
| `GET` | `/api/records/[patientId]/[recordId]/history` | DENTIST | `RecordHistory` audit trail (field-level diffs). |
| `GET` | `/api/records/[patientId]/visits` | DENTIST | Appointment visit history for a patient (CONFIRMED/COMPLETED appts). |
| `GET` | `/api/profile/keys` | any | Fetch the caller's wrapped key material (used by `UnlockRecordsModal` after a page reload). |
| `POST` | `/api/profile/keys` | any | Provision the caller's envelope keypair (set-if-null). |
| `GET` | `/api/patient/records` + `/[recordId]` | PATIENT | Patient's own records + visit history (My Dental Records page). |

Reads/writes/deletes are written to the `AuditLog` as `VIEW` / `UPDATE` / `DELETE` on entity `PatientRecord` via `lib/audit.js`.

---

## Attachments

- Supabase **`record-attachments`** bucket, path `{clinicId}/{patientId}/{recordId}/{timestamp}-{random}.{ext}`.
- Max **5 MB**; only PDF / JPG / PNG (magic-byte validated, compressed files rejected); file names sanitized (no path separators, ≤ 255 chars).
- Rate-limited **30 uploads/hour per IP**.
- Served via **1-hour signed URLs** generated on read (never public).

---

## Data models

| Model | Key fields |
|---|---|
| `PatientRecord` | `title`, `encryptedData` (AES-GCM ciphertext), `dataIv`, `contentHash` (SHA-256 tamper detection), `status` (`ACTIVE`/`ARCHIVED`), `isDeleted` + `deletedAt`. |
| `RecordKey` | `recordId`, `userId`, `wrappedKey` (RSA-OAEP-wrapped CEK). `@@unique([recordId, userId])`; cascade-deletes with the record. |
| `Attachment` | `recordId`, `fileName`, `fileUrl` (bucket path), `mimeType`, `isDeleted` + `deletedAt`. |
| `RecordHistory` | `recordId`, `userId`, `diff` (JSON field-level changes — `title`, `status`, `notesChanged`), `createdAt`. |
| `User` (envelope fields) | `publicKey` (SPKI base64), `encryptedPrivateKey` (PKCS8, AES-GCM under master key), `privateKeyIv`. |

See [`data-models.md`](./data-models.md) and [`schema.md`](./schema.md) for full schema.

---

## `contentHash` tamper detection

A SHA-256 `contentHash` is computed over the record content on every write and re-verified on read (`RecordFormModal.jsx`, `RecordViewModal.jsx`). A mismatch surfaces a tamper warning — this complements the AAD binding (AAD prevents cross-patient swaps; `contentHash` detects in-place modification of stored ciphertext).

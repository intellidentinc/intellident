# 05 — Patient Records & End-to-End Encryption

## What it is

Patient clinical records (capstone **Objective 2**) stored in the centralized database, with the sensitive notes **end-to-end encrypted**: they are encrypted *in the browser* before they leave the user's machine and decrypted only in the browser of an authorized reader. **The server, the database, Neon, Vercel, and even our own super admin can never read them.** All crypto uses the browser-native **Web Crypto API** — no third-party crypto library.

## The story in plain English (rehearse this)

> "When a dentist saves a record, their browser generates a fresh random key, encrypts the notes with it, and then locks a copy of that key inside a digital 'envelope' for each person allowed to read it — the patient and each treating dentist — using each person's public key. The database stores only ciphertext and sealed envelopes. To read, your browser opens *your* envelope with *your* private key, which itself is protected by your password. The server only ever moves sealed boxes around."

## The key hierarchy (bottom-up)

All primitives in `lib/crypto.js`:

1. **Password → KEK** — `deriveKEK()`: PBKDF2, **210,000 iterations**, SHA-256, per-user random salt (`keySalt`). Slow on purpose: brute-forcing a stolen `wrappedKey` costs 210k hashes per guess.
2. **KEK wraps the Master Key** — a random **AES-GCM-256** master key, wrapped with **AES-KW** and stored as `User.wrappedKey`. The server stores the wrapped blob, never the key.
3. **Master Key encrypts the RSA private key** — each user owns an **RSA-OAEP-2048 (SHA-256)** keypair: `publicKey` stored in plaintext (it's public), `encryptedPrivateKey` + `privateKeyIv` stored encrypted under the master key.
4. **Per-record CEK (Content Encryption Key)** — every record write generates a *fresh* AES-GCM-256 key that encrypts the notes.
5. **Envelope** — the CEK is wrapped (RSA-OAEP) to *every authorized reader's public key*; each wrap is one `RecordKey` row `{ recordId, userId, wrappedKey }` in `prisma/schema.prisma`.

**Key handoff at login:** `wrappedKey`/`keySalt` are released only **after MFA succeeds** (`verify-otp` — see `02-authentication.md`). `loadOrProvisionKeys()` in `lib/clientKeys.js` then derives the KEK, unwraps the master key, and decrypts the private key — all client-side. Keys live only in `CryptoProvider` memory; after a page reload, `components/commons/UnlockRecordsModal.jsx` asks for the password to re-derive them.

## Write path (dentist saves a record)

Files: `app/modules/records-page/RecordFormModal.jsx` → `lib/clientKeys.js` (`encryptRecordNotes`) → `POST /api/records/[patientId]`

1. Browser generates a fresh CEK; encrypts notes with AES-GCM, binding **`patientId` as AAD** (Additional Authenticated Data) — so a ciphertext copied onto another patient's record fails decryption. (`encryptData` in `lib/crypto.js`.)
2. Browser fetches the authorized readers' public keys (`GET /api/records/[patientId]/recipients`) and wraps the CEK to each.
3. Browser computes a **SHA-256 `contentHash`** of the plaintext for tamper detection.
4. Server stores `encryptedData`, `dataIv`, `contentHash`, and the `RecordKey` wraps — but first **re-derives the authorized reader set itself** (`getAuthorizedReaderIds()` in `lib/records-access.js`: the patient + every dentist with a CONFIRMED/COMPLETED appointment). It never trusts the client's recipient list, so a malicious client can't quietly add themselves as a reader.

## Read path

Files: `RecordViewModal.jsx` (dentist + patient variants) → `GET /api/records/[patientId]/[recordId]` or `/api/patient/records/[recordId]` → `decryptRecordNotes()` in `lib/clientKeys.js`

1. Server authorization first: dentist must pass the **treating-relationship gate** (`dentistTreatsPatient()`); patients only reach their own records; record access additionally requires **step-up OTP** re-auth (`OtpStepUpModal`), and reads are audit-logged (this feeds the mass-access breach scan).
2. Server returns ciphertext + the caller's own `RecordKey` wrap.
3. Browser unwraps the CEK with its RSA private key, decrypts with AAD verification, recomputes SHA-256 and compares to `contentHash` — **mismatch shows a tamper warning** (Objective: integrity verification).

## Access healing & lifecycle edge cases

- **New dentist gains a treating relationship** (or a patient reset their keys): they lack a CEK wrap for older records. On the next read by someone who *can* decrypt, `reshareRecord()` (`lib/clientKeys.js`) re-wraps the in-memory CEK to all current recipients via `POST .../reshare`; the server stores wraps only for readers it independently verifies and that don't already have one.
- **Change password** — re-wraps the same master key under the new KEK; nothing is lost.
- **Forgot-password reset** — server never had the master key, so fresh keys are generated; old record access heals via reshare when a still-authorized reader (e.g. the treating dentist) next opens the record.
- **Attachments** — `record-attachments` Supabase bucket, with add/delete via `.../attachments/`; record history via `.../history`.
- **Patient view** — `/my-records` (`app/modules/my-records-page/`): Clinical Records + Visit History tabs, decrypt-on-demand.

## Key files table

| File | Role |
|---|---|
| `lib/crypto.js` | All Web Crypto primitives: PBKDF2 (210k), AES-GCM, AES-KW, RSA-OAEP, AAD binding |
| `lib/clientKeys.js` | Client orchestration: `loadOrProvisionKeys`, `encryptRecordNotes`, `decryptRecordNotes`, `reshareRecord` |
| `lib/recordCrypto.js` | Envelope helpers (CEK wrap/unwrap with AAD) |
| `lib/records-access.js` | Server authorization: treating gate + authoritative reader-set derivation |
| `app/api/records/...` | Records CRUD, recipients, reshare, history, attachments |
| `app/api/profile/keys/route.js` | GET wrapped key material (unlock flow); POST set-if-null keypair provisioning |
| `app/providers/CryptoProvider.jsx` | In-memory key store (`useCrypto()`), cleared on sign-out |
| `components/commons/UnlockRecordsModal.jsx` | Password → re-derive keys after reload |
| `prisma/schema.prisma` | `PatientRecord` (`encryptedData`, `dataIv`, `contentHash`), `RecordKey`, `RecordHistory`, `Attachment` |

## Technologies & why (one line each — memorize)

- **AES-GCM-256** — authenticated encryption: confidentiality + built-in integrity, and supports AAD.
- **PBKDF2 @ 210,000 iterations** — OWASP-recommended order of magnitude for PBKDF2-SHA-256 password key derivation.
- **AES-KW** — the standard NIST construction for wrapping one key with another.
- **RSA-OAEP-2048** — lets us encrypt *to* someone using only their public key: the whole multi-reader envelope depends on this.
- **AAD = patientId** — cryptographically binds ciphertext to its patient; blocks ciphertext-swap attacks.
- **SHA-256 contentHash** — end-to-end tamper evidence independent of the transport and DB.
- **Web Crypto API** — the browser's native, audited crypto; keys can be generated as non-extractable; zero crypto dependencies to supply-chain-attack.

## Mock Panel Q&A

**Q: Prove the server can't read patient records.**
A: Follow the keys. Notes are encrypted client-side under a CEK that exists only in the browser. The CEK copies stored server-side are RSA-wrapped to readers' public keys. Private keys are stored encrypted under the master key; the master key is stored wrapped under a KEK derived from the user's password with PBKDF2 — and the password never leaves the browser in a form the server stores. Every link in that chain would require a secret the server doesn't have.

**Q: Then how does a dentist read a record the patient wrote about— or vice versa?**
A: The envelope. At write time the CEK is wrapped separately to each authorized reader's public key — one `RecordKey` row per reader. Each reader opens their own wrap with their own private key. Nobody shares passwords or keys.

**Q: Who decides the list of authorized readers? Couldn't a hacked client add themselves?**
A: The server decides, every time — `getAuthorizedReaderIds()` derives it as the patient plus dentists with a CONFIRMED/COMPLETED appointment, and ignores any client-supplied list on write and reshare. A client-side attacker can only wrap keys to people the server independently agrees are readers.

**Q: What if someone with database access flips a record's ciphertext, or copies one patient's ciphertext onto another patient?**
A: Three tripwires. AES-GCM authentication fails on any bit-flip. The AAD binds the ciphertext to the patientId, so a cross-patient transplant fails decryption outright. And the SHA-256 `contentHash` check in the view modal surfaces a visible tamper warning.

**Q: A patient forgets their password. Are their records gone forever?**
A: Their *own* key is unrecoverable — that's inherent to E2EE and a deliberate trade-off. But the records aren't lost: the treating dentist still holds valid CEK wraps. When the dentist next opens the record, `reshareRecord()` re-wraps the CEK to the patient's new public key, restoring the patient's access. We trade a small recovery ritual for the guarantee that no master back-door key exists.

**Q: Why per-record CEKs instead of one key per patient?**
A: Granularity and blast radius. Revoking or resharing operates per record; a single compromised CEK exposes one record, not a patient's entire history; and fresh keys per write mean no IV/key-reuse concerns under AES-GCM.

**Q: Where do decrypted keys live in the browser? localStorage?**
A: Never localStorage — only React memory inside `CryptoProvider`, wiped on sign-out and lost on refresh (the unlock modal re-derives them from the password). Combined with the strict CSP and HttpOnly cookies, there's no persistent client-side secret for XSS to steal.

**Q: Is billing data also E2EE?**
A: No, by design. Billing amounts and statuses must be server-computable (webhooks mark bills paid, reports aggregate revenue). They're protected at rest by Neon's storage encryption plus the full access-control chain and audit logging. E2EE is reserved for clinical content where confidentiality outweighs server-side processability — that's proportional security under the Data Privacy Act.

**Q: You already have HTTPS — why isn't TLS enough?**
A: TLS protects data *in motion* only; the moment it lands, the server and anyone who compromises it can read plaintext. Our threat model for health records includes the server itself — a leaked database, a stolen backup, a malicious insider, a compromised hosting account. E2EE is the only control that survives all of those, because plaintext never exists server-side.

**Q: If the notes are encrypted, how do dentists search records?**
A: They can't full-text-search encrypted note bodies — that's the honest cost of E2EE. Searching and filtering work on deliberately unencrypted metadata: patient name/code, record type, dates, treating dentist. We judged that clinicians locate records by patient and date in practice, so the lost capability is minor next to the confidentiality gain. (Searchable encryption exists but leaks patterns; we chose the conservative design.)

**Q: What's the IV stored next to the ciphertext, and why is it safe in plaintext?**
A: The initialization vector — a per-encryption random value that makes identical plaintexts produce different ciphertexts. IVs are not secrets; the requirement is that they're never *reused* under the same key. We generate a fresh random IV per encryption, and because each record also has a fresh CEK, key/IV reuse can't happen.

**Q: Doesn't doing cryptography in the browser hurt performance?**
A: Not perceptibly. Web Crypto runs native (not JavaScript) code: an AES-GCM pass over note text is sub-millisecond, RSA wrapping a 32-byte key takes a few milliseconds per reader, and the deliberately slow part — PBKDF2's 210k iterations — happens once per login by design, as a brute-force tax.

**Q: Why RSA-OAEP-2048 and not elliptic-curve cryptography?**
A: RSA-OAEP is the encryption scheme with first-class, universal Web Crypto support for the wrap/unwrap operations our envelope needs; ECC in Web Crypto (ECDH) would require an extra key-agreement construction. 2048-bit RSA is NIST-acceptable through 2030, and it only ever protects 32-byte CEKs — swapping the wrap algorithm later wouldn't require re-encrypting any record content.

**Q: What if a dentist's laptop is stolen while they're logged in?**
A: The thief has, at most, minutes: keys live only in tab memory, the session dies after 30 idle minutes (10-min token otherwise, 8-hour cap), reopening the records page demands a step-up OTP sent to the dentist's email, and a reload wipes the in-memory keys entirely until the password is re-entered. Nothing key-like is on disk.

**Q: Could you comply with a lawful request to hand over a patient's records?**
A: Yes — through the authorized readers, which is the correct path anyway: the patient can decrypt and export their own records (that's also our DSAR access mechanism), or the treating dentist can. What we *cannot* do is hand over plaintext without an authorized key holder — and that inability is a feature we can defend, not a bug.

---
Further reading: [`docs/records.md`](../records.md) — the authoritative envelope-scheme spec.

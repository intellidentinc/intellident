# IntelliDent security review

## Remediation status

Updated November 1, 2026. The reported application defects have been addressed in this checkout. Both the full dependency audit and production-only audit now report **zero vulnerabilities**. Next.js resolves to 16.4.3, Nodemailer to 10.3.1, and lint tooling is now Oxlint 1.90.0, replacing the vulnerable ESLint/minimatch chain.

| Validation after remediation | Result |
| --- | --- |
| Full and production-only npm audits | Exit 0, zero reported vulnerabilities in both. |
| Production build | Exit 0; all 61 pages generated. |
| Oxlint | Exit 0; zero errors and 106 warnings, primarily UI/compiler/style diagnostics. |
| Prisma schema validation | Passed; no schema migration is required. |
| Local source regression checks | 111 assertions passed across mocked session, challenge, recovery, storage, key provisioning, restore and payment flows, plus real Web Crypto encryption/reset/reshare checks. Session creation was also checked against credential revocation and concurrent single-session logins. No live database concurrency or browser end-to-end test was performed. |

A01-A06 now use current database identity/status and expiry, revoke sessions/challenges on credential changes and restore, bind OTPs to purpose/context, and serialize token use. A02 is closed by making login email read-only; clinic administrators also cannot disable/delete global patient identities through staff management. A07-A10 now fail closed on storage privacy/deletion, serialize payment totals, bound and cancel AI requests, and neutralize spreadsheet formula text. Key provisioning, reset/reshare lifecycle, rate-limit first-request races, browser password storage, and bootstrap defaults were also addressed.

Deploy the updated source and lockfile together. Existing deployed credentials still require operational rotation, existing storage buckets need verification, and legacy orphan files need an inventory; source changes do not perform these external operations. In-progress MFA flows must restart. See [current security controls and deployment requirements](security.md).

## Historical assessment

The findings, package counts, and source line references below describe the checkout before remediation on November 1, 2026.

The original installed dependency audit reported **21 affected package entries: 1 critical and 20 moderate**. Production dependencies accounted for **1 critical and 1 moderate**. The highest priority application defects were ineffective session revocation, unverified changes to global login email addresses, and OTPs that were interchangeable across security operations.

## Installation and verification

| Check | Result |
| --- | --- |
| `npm install --fetch-retries=0 --fetch-timeout=20000` | Exit 0; dependencies already up to date. No tracked package or lockfile changes. |
| `npm audit --json --fetch-retries=0 --fetch-timeout=20000` | Exit 1; 21 affected package entries, including propagated dependency findings. |
| `npm audit --omit=dev --json --fetch-retries=0 --fetch-timeout=20000` | Exit 1; Next.js critical and Nodemailer moderate. |
| `npm run lint -- . --ext .js,.jsx,.mjs` | Exit 1; 5 errors and 7 warnings. |
| `npm run build` | Initial sandbox run could not fetch Google Fonts. An approved network-enabled retry compiled and generated all 61 pages, then exited 1 with Next.js `SecurityFatalError` recommending an upgrade. This is not a passing build. |
| Isolated checks against source with mocked dependencies | Reproduced ignored database session expiry, stale cookie roles, OTP purpose confusion, concurrent OTP consumption, direct patient login-email replacement, and concurrent payment total corruption. |

The earlier lockfile-only audit reported 18 entries. The installed-tree audit additionally propagated findings through `rimraf`, `flat-cache`, and `file-entry-cache`; these are development tooling findings. Counts are affected package entries, not counts of independent CVEs or confirmed application exploits.

Verification used Node 24.15.0 and npm 11.12.1. No migrations, seed scripts, live attack requests, payment requests, SMTP sends, or storage writes were intentionally executed. The local reproductions replaced external services and database operations with in-memory fixtures.

## Dependency findings

### Next.js 16.4.0

npm identifies two critical advisories and one high advisory under a single critical package entry. **Upgrade Next.js to at least 16.4.1**, then repeat the audits and build. This is an upgrade recommendation, not a claim that all three attacks work against this checkout.

| Advisory | Applicability to this checkout |
| --- | --- |
| [Image optimization RCE](https://github.com/advisories/GHSA-2464-fhr4-w9xw) | The advisory concerns image processing on glibc Linux and lists `sharp >=0.35.5` as a workaround. Both the lockfile and installed tree already contain `sharp 0.35.5`, so this checkout meets that workaround. Verify the deployed tree separately. |
| [RCE in cache functions returning typed arrays](https://github.com/advisories/GHSA-673q-mjm6-r5xr) | Requires Cache Components and a qualifying `use cache` function. No `use cache` directive was found in tracked application source; the configuration does not enable Cache Components. No matching vulnerable application path was identified. |
| [Server Actions denial of service](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) | Requires at least one Server Action. No `use server` directive was found, and the generated server reference manifest contains zero Node or Edge actions. No matching vulnerable application path was identified. |

### Nodemailer 10.1.0

Moderate recipient-parsing issues can cause mail to reach unintended recipients when crafted addresses reach the parser. Upgrade to **10.1.4 or newer**. The package version is affected; delivery to an unintended recipient was not tested against real mailboxes. Application email validation reduces some input shapes but does not replace the dependency patch. Advisories: [nested comments](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8), [address groups](https://github.com/advisories/GHSA-m943-m63m-w62w), and [quoted local parts](https://github.com/advisories/GHSA-85x2-q946-cp5h).

### Development dependencies

The remaining 19 moderate package entries are in the ESLint dependency tree. Root advisories include [minimatch pattern amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249) and [glob cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). Installed root versions include `minimatch 3.1.5` and the overridden `glob 10.5.0`.

Affected entries: `@eslint-community/eslint-utils`, `@eslint/eslintrc`, `@humanwhocodes/config-array`, `@next/eslint-plugin-next`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/utils`, `eslint`, `eslint-config-next`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, `file-entry-cache`, `flat-cache`, `glob`, `minimatch`, and `rimraf`.

Review the ESLint stack together: `eslint-config-next 14.2.35` is from a different major than Next.js 16, and the global `glob` override prevents normal parent-selected resolution. npm's proposed automatic fixes include downgrades to old ESLint/config versions; do not apply those blindly. Update compatible tooling, migrate configuration as needed, and revalidate parent compatibility before replacing transitive majors.

## Application findings

Severities below are assessment judgments based on the stated prerequisites. “Confirmed” means the defect is visible in source, with isolated reproductions identified where performed; it does not mean exploitation occurred in production.

### A01 High Session revocation and account status checks are incomplete

Evidence: `lib/auth.js:22`, `lib/auth.js:50`, `app/api/users/[id]/route.js:44`, `app/api/auth/reset-password/route.js:77`, and `app/api/auth/change-password/route.js:123`.

`getSession` checks only whether a database session exists and is terminated. It does not validate the current user's active/deleted status. `getAuthContext` trusts the signed cookie's role whenever present. User administration clears a session only when the administrator modifies their own account; modifying another user does not revoke that user's sessions. Password reset revokes no sessions, and password change clears only the caller's current session. OTP login also omits a fresh active/deleted-user check after issuance.

A disabled/deleted staff member or a holder of a stolen cookie can continue using routes that rely on these helpers. A receptionist changed to dentist can retain receptionist API permissions in the old cookie. Patient clinical routes have additional checks in `getActivePatientContext`, so this is not a claim that every route is equally affected. Local mocks reproduced stale-role authorization without a user lookup and OTP acceptance for a user disabled after issuance.

Remediation: validate current account status and authorization centrally; revoke all affected sessions and pending login challenges transactionally on role/status/password changes. Recheck status before completing MFA. A session version can make role caching safe if every relevant mutation increments it and validation checks it.

### A02 High Clinic staff can change a global patient login identity

Evidence: `app/api/patients/[id]/route.js:52`, `app/api/profile/route.js:65`, and `app/api/auth/forgot-password/route.js:31`.

An authorized receptionist/admin with one clinic enrollment can replace the patient's global `User.email` directly. The route verifies clinic enrollment but requires neither patient confirmation nor verification of the replacement address. That address receives password-reset links and future MFA codes. A malicious clinic staff member can therefore redirect account recovery to a mailbox they control, affecting the same patient's other clinic enrollments. Existing encrypted notes are not automatically decrypted by a reset; account access, billing, appointments, and server-served attachments remain material exposure.

The self-service profile endpoint also changes login email without fresh authentication or mailbox verification, allowing a stolen session to establish persistent account control. An isolated route check confirmed that a receptionist request writes the replacement global email and returns 200.

Remediation: separate clinic contact details from the global login identity. Require patient-controlled, freshly authenticated email-change confirmation, verify the new mailbox, notify the previous mailbox, and revoke sessions and outstanding recovery challenges when the identity changes.

### A03 High OTPs are not bound to their intended action

Evidence: `app/api/auth/verify-otp/route.js:37`, `app/api/auth/step-up/send-otp/route.js:42`, and `app/api/super/clinics/[id]/restore/confirm/route.js:90`.

Login, record-access step-up, and restore use the same `MfaOtp` table without purpose or target-clinic fields. Login accepts any matching unused token/code from that table. Restore checks the user but cannot establish that a code was issued for restore or for the selected clinic. A code requested for one operation can authorize a different operation, subject to that endpoint's other session/role checks. The local login-handler reproduction accepted a challenge representing another purpose.

Remediation: bind each challenge to a purpose, user, initiating context, and target clinic/action where relevant. Enforce these fields at consumption, expire existing untyped challenges during migration, and keep step-up grants specific to the intended policy when different factors are required.

### A04 Moderate OTP and recovery token consumption can race

Evidence: `app/api/auth/verify-otp/route.js:70`, `app/api/auth/verify-otp/route.js:84`, `app/api/auth/step-up/route.js:60`, `app/api/super/clinics/[id]/restore/confirm/route.js:109`, and `app/api/auth/reset-password/route.js:77`.

Handlers read challenge state and later write attempts/used state without a conditional atomic claim. Parallel verification requests can both observe an unused token and succeed. Failed attempts overwrite the same old count instead of incrementing it atomically. Password-reset validation also occurs before a transaction whose token update is unconditional. The OTP reproduction created two sessions from simultaneous verification snapshots.

Remediation: claim an unexpired, unused, correctly scoped challenge atomically and require exactly one successful claim before its protected action. Serialize attempt-limit checks and increments; make recovery-token consumption and password mutation one transaction. Verify parallel success, parallel failure, expiry, and replay cases.

### A05 Moderate Database session expiry is not enforced

Evidence: `lib/auth.js:22`, `lib/auth.js:86`, and `middleware.js:144`.

Session creation stores `expiresAt`, but validation selects only `terminatedAt`. Cookie `maxAge` is enforced by the browser, not by a caller replaying the cookie manually. The middleware's eight-hour cap limits replay but does not enforce the shorter ten-minute database expiry; renewal does not update that database expiry. A local mock confirmed acceptance of an expired database session.

Remediation: define idle and absolute expiry explicitly, enforce them server-side, and update idle expiry during legitimate renewal. Keep one consistent policy across middleware and route helpers. Reject expired rows before granting step-up or rotating sessions.

### A06 Moderate Password expiry is a client routing flag

Evidence: `lib/login.js:82`, `lib/auth.js:93`, `middleware.js:171`, and `app/modules/verify-otp-page/VerifyOtpPage.jsx:131`.

When a clinic enables password expiry, login returns `passwordExpired`, but the signed session does not retain that restriction and middleware enforces only the separate `mustChangePassword` flag. A user with an expired password and valid MFA can ignore the browser redirect and call APIs directly.

Remediation: enforce the expiry restriction in the server session/authorization path and allow only password change, required onboarding, and sign-out until satisfied. Test direct API requests independently of UI navigation.

### A07 Moderate Sensitive uploads can proceed without verified private storage

Evidence: `app/api/clinic-applications/documents/route.js:78` and `app/api/records/[patientId]/[recordId]/attachments/route.js:86`.

The application-document handler logs a failure to make an existing bucket private and continues uploading. The record-attachment handler ignores bucket-creation errors and never enforces privacy on an existing bucket. If either bucket is already public, sensitive uploads can remain publicly retrievable. This is a confirmed failure-handling defect with exposure conditional on bucket configuration; deployed Supabase policies were not inspected.

Remediation: provision and verify private buckets outside the request path, fail uploads when required privacy cannot be established, and test existing-public-bucket and permission-denied cases. Notes have browser encryption; attachments are uploaded as plaintext files to storage and depend on storage access controls.

### A08 Moderate Concurrent payments corrupt billing totals

Evidence: `app/api/webhooks/paymongo/route.js:65` and `app/api/billing/[id]/route.js:113`.

Webhook and manual payment handlers read billing totals outside the write transaction and later assign totals computed from that stale snapshot. Distinct concurrent valid payments can each insert a payment row while one overwrites the other's billing update. A local mocked webhook reproduction recorded payments totaling 100 while leaving `amountPaid=60` and `balance=40`. A transaction around the writes alone does not serialize the earlier reads.

Remediation: lock or conditionally claim the billing row before reading and validating totals, retain database uniqueness for provider payment IDs, and recalculate or atomically update totals inside the same transaction. Test distinct concurrent payments, duplicate deliveries, and simultaneous manual/provider payments.

### A09 Moderate AI slot recommendations have no spend limit

Evidence: `app/api/ai/slots/route.js:37`, `app/api/ai/slots/route.js:86`, and `lib/ai.js:70`.

Any valid session with usable slot parameters can repeatedly trigger paid model requests. The slot endpoint has no rate limit or concurrency/budget control, unlike chat. Its timeout uses `Promise.race`, which returns a fallback without cancelling the provider request. An authenticated account can exhaust API spend or worker capacity; no live spend test was performed.

Remediation: apply user/clinic rate and concurrency limits before provider calls, cache equivalent recommendations where appropriate, and propagate an abort signal/request timeout to the provider. Test provider cancellation as well as the fallback response.

### A10 Moderate CSV exports preserve spreadsheet formulas

Evidence: `app/modules/billing-page/BillingPage.jsx:175`, `app/modules/audit-log-page/AuditLogPage.jsx:378`, and `app/modules/reports-page/ReportsPage.jsx:391`.

CSV exporters escape quotation marks but do not neutralize formula prefixes. User-controlled names and other exported text can begin with `=`, `+`, `-`, or `@`. Opening such an export in a spreadsheet can interpret a cell as a formula; exact behavior and any external access depend on the spreadsheet's protections and user actions. CSV quotation alone does not force text interpretation.

Remediation: share a spreadsheet-safe text-cell encoder or export text-typed workbook cells. Test formula prefixes, leading control characters, commas, quotes, and line breaks while preserving numeric amount columns.

## Other confirmed weaknesses and conditional risks

- **Encryption key lifecycle:** `app/api/profile/keys/route.js:78` checks for a null key and later updates unconditionally; simultaneous provisioning can overwrite a working pair. `lib/clientKeys.js` also returns a newly generated pair even when the server says a different pair already exists. After password reset, old `RecordKey` rows still exist, while `app/api/records/[patientId]/[recordId]/reshare/route.js:69` skips readers with any existing wrap. The documented automatic healing cannot replace those stale wraps. Use atomic provisioning with a canonical response, key versions, and a verified holder-assisted rewrap workflow. This affects availability of encrypted records; it does not expose plaintext by itself.
- **Rate-limit concurrency:** `prisma/schema.prisma:722` gives rate-limit rows a nonunique key/window index. Concurrent first requests in `lib/rateLimit.js:49` can all create rows and pass; the claimed unique-conflict protection is absent. Use one atomically updated row per logical window/key. Some uploads/application endpoints additionally trust the leftmost forwarded IP, unlike the shared request-meta helper. Spoofability depends on the deployment proxy; verify the actual trusted header contract before changing it.
- **Storage retention:** `app/api/cron/audit-purge/route.js:61` deletes attachment database rows without deleting their Supabase objects. Individual attachment deletion also soft-deletes despite storage removal errors. Retired patient files can remain in storage beyond the intended retention period. Use durable cleanup jobs with retries and retain object identifiers until removal succeeds.
- **Seed credentials:** `prisma/seed-super.js:19` and `prisma/make-superadmin.js:18` use a public fixed password and do not force a first-login change. Risk is high if these scripts initialize a reachable environment with unchanged credentials; production use was not established. Require explicit development-only execution or unique operator-provided bootstrap secrets and mandatory rotation. MFA remains an additional barrier.
- **Password in browser storage:** `app/modules/sign-in-page/SignInPage.jsx:76` stores the raw password in `sessionStorage` during MFA. It is removed on success and some terminal errors but can remain on abandonment or key-loading failure. Prefer deriving and retaining necessary key material in memory with bounded lifetime. No independent browser XSS path was demonstrated.
- **Documentation drift:** security docs claim role changes terminate sessions and describe backup exports without credential material and a confirmation-only restore. Current backup includes password hashes and encrypted key blobs; restore actually writes data through `importClinicBackup`. Treat exported backups as credential-bearing sensitive artifacts and reconcile documentation with the tested behavior before relying on the documented controls.

## Lint failures

The five errors are two unescaped apostrophes in `app/modules/accept-terms-page/AcceptTermsPage.jsx:146` and `:163`, an unavailable `react-hooks/set-state-in-effect` rule in `app/modules/my-records-page/MyRecordsPage.jsx:75`, and two unescaped quotes in `app/modules/super-page/ApplicationsTab.jsx:411`.

Seven warnings cover hook dependencies and an image alt property. They were not changed as part of the assessment. There is no configured test script in `package.json`; the isolated checks did not add a persistent test suite.

## Coverage and follow-up

The project-wide inventory and static checks covered 299 tracked JavaScript/JSX/MJS files, including 96 API route files, and inspected dependency configuration, Prisma models, middleware, layouts/providers, scripts, and security/feature documentation. Manual inspection focused on authentication, authorization, clinic ownership, record keys and transfers, uploads, payments, AI tools, exports, backup/restore, and retention. UI source received static scanning and ESLint parsing; this is not a claim of a line-by-line manual review of every presentation component. Generated dependencies/build files, local secret values, and the binary schema PDF were excluded from manual content review.

Deployment-specific bucket policies, proxy header guarantees, deployed dependency versions, and real concurrency behavior need verification in an isolated staging environment. Local mocked reproductions establish handler logic defects, not production incident evidence.

Prioritize A01-A03 and the framework/mail dependency upgrades, then transaction safety and server-enforced expiry. Validate fixes using separate users in two clinics, a patient enrolled in both clinics, direct API requests, simultaneous challenge/payment submissions, expired or revoked sessions, and storage privacy failures. Do not perform attack tests against live patient data.

## Steps to clone for other members:

1. Git clone the repo
2. npm i
3. create .env file in root folder
4. add the env vars (see the **Environment Variables** table in `CLAUDE.md` — at minimum `DATABASE_URL`, `SESSION_SECRET`; plus `GMAIL_*`, `SUPABASE_*`, `OPENAI_API_KEY`, `PAYMONGO_*`, `CRON_SECRET` for full functionality)
5. npx prisma generate
6. npx prisma db push (sync schema to the database)
7. Set ALLOW_DEMO_SEED=true and a unique SEED_PASSWORD (12+ characters with uppercase, lowercase, number, and symbol), then run npx prisma db seed in a non-production environment.
8. Set ALLOW_ADMIN_BOOTSTRAP=true and a unique SEED_ADMIN_PASSWORD, then run node prisma/seed-super.js if you need an administrator. Bootstrapped accounts must change their password on first login.
9. npm run dev to run in local
10. BOOM!


## Commands

For database changes or prisma changes:
 - npx prisma generate (sync in cloud database)
 - npx prisma db push (push in cloud)
 - npx prisma db seed (seed clinics + users — safe to re-run)
 - node prisma/seed-super.js (seed the super admin)

For local & code shits:
 - npm run dev (to run system in local)
 - npm install (to install dependencies)

## Docs

Architecture & feature reference lives in `CLAUDE.md` and `docs/` (security, records E2EE, appointments, billing, notifications, AI, schema, super-admin).

## Security and validation

Run npm run lint (Oxlint), npm run build, and npm audit before deployment. Security controls and deployment requirements are documented in [docs/security.md](docs/security.md). Use Node 22.12+ for the lint tooling.

## Email delivery and temporary judges access

Email uses `GMAIL_USER` and a Google **App Password** in `GMAIL_APP_PASSWORD`, not the normal account password. Formatting spaces are removed automatically. SMTP authentication error `EAUTH` / `535` means the configured credentials need replacement. Update the local `.env` and the deployment environment, then restart/redeploy. Successful SMTP acceptance does not guarantee inbox placement; verify delivery to a controlled inbox before judging.

Login and record-access email OTP are disabled for **all accounts** until **November 17, 2026, 11:31:29 PM Philippine time** (`2026-11-17T15:31:29.891Z`). Sign in with the normal account password; no judges code is needed. Record permissions and encryption remain enforced. Backup-restore email codes, signup verification links, password-reset links, and password step-up for exports/backup remain active.

The deadline is fixed in the server-side `lib/email-otp-policy.js` policy and checked on each request. OTP resumes automatically at expiry, including for record access from existing sessions. There is no persistent waiver in the session. The previous `JUDGES_OTP_BYPASS_*` settings and shared code are obsolete and have no effect; remove those settings from deployment environments.

Deploy this version to activate the policy on the hosted website. No environment changes or database migration are required. Verify hosted password login and record access after deployment. Gmail credentials must be working before the deadline for normal OTP delivery to resume successfully.

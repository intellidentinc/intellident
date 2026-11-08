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

Judges can enter a temporary six-digit code at the existing login and record-access OTP prompts. Passwords and record permissions are still required. Read the private code from `JUDGES_OTP_BYPASS_CODE` in the local `.env` and share it privately with judges.

The server requires all three settings: `JUDGES_OTP_BYPASS_ENABLED=true`, `JUDGES_OTP_BYPASS_CODE` (exactly six digits), and `JUDGES_OTP_BYPASS_EXPIRES_AT` (a fixed ISO timestamp with a timezone). The initial local configuration lasts nine days. For hosted testing, copy these settings to the deployment environment and redeploy; use the same fixed expiry so redeployments do not extend the window. Never use `NEXT_PUBLIC_` variables for the code.

While active, login and record-access OTP emails are skipped. Challenges still expire after ten minutes and retain five-attempt and single-use protections. Backup-restore OTPs always require the emailed code. After the fixed deadline, normal email OTP behavior resumes automatically; judges must request a new challenge. Disable early by setting `JUDGES_OTP_BYPASS_ENABLED=false`, or remove all three settings, then restart/redeploy. The code is never returned by an API or written to audit logs; successful bypass use is audited.


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


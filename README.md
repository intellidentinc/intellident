## Steps to clone for other members:

1. Git clone the repo
2. npm i
3. create .env file in root folder
4. add the env vars (see the **Environment Variables** table in `CLAUDE.md` — at minimum `DATABASE_URL`, `SESSION_SECRET`; plus `GMAIL_*`, `SUPABASE_*`, `OPENAI_API_KEY`, `PAYMONGO_*`, `CRON_SECRET` for full functionality)
5. npx prisma generate
6. npx prisma db push (sync schema to the database)
7. npx prisma db seed (3 clinics + 4 users per clinic; password `12345678`)
8. node prisma/seed-super.js (super admin: `superadmin@intellident.app` / `12345678`)
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


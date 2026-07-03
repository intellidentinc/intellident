# 01 — Architecture & Tech Stack

> Study this first. Every other file in this kit assumes you know the structure described here.

## What it is

IntelliDent is a **Next.js 16 (App Router)** web application written in **JavaScript (JSX)**, deployed on **Vercel**, backed by a **PostgreSQL database hosted on Neon** and accessed through **Prisma ORM**. It is one codebase and one database serving three partner clinics (multi-tenant — see `03-rbac-multitenancy.md`).

## The big picture (say this in one breath)

> "It's a server-rendered React app. Pages live under `app/`, every API endpoint is a route handler under `app/api/`, all database access goes through Prisma, files go to Supabase Storage, emails go out via Gmail SMTP, payments via PayMongo, AI via OpenAI, and five scheduled jobs run as Vercel Cron."

## Technology stack — what and why

| Layer | Technology | Why we chose it (defense-ready answer) |
|---|---|---|
| Framework | Next.js 16 App Router | One project gives us server-rendered pages AND API endpoints; file-based routing; built-in middleware for security headers |
| UI | MUI v7 (system pages), Tailwind CSS (landing page only) | MUI gives accessible, consistent components fast; Tailwind for the marketing page's custom design. Rule: **never mix both in one component** |
| Database | PostgreSQL on Neon, via Prisma | Relational data (appointments ↔ patients ↔ billing) needs foreign keys and transactions; Prisma gives type-safe queries and migrations; Neon is serverless Postgres that pairs with Vercel |
| Auth | **Custom** session system (HMAC cookie + DB sessions) | We needed E2EE key handoff, MFA, step-up re-auth, and per-clinic policies that off-the-shelf libraries don't model — see `02-authentication.md` |
| Encryption | Web Crypto API (browser-native) | AES-GCM-256 + PBKDF2 + RSA-OAEP with **no third-party crypto library** — the browser's audited implementation; see `05-records-e2ee.md` |
| File storage | Supabase Storage | Buckets: `clinic-logos`, `clinic-documents`, `record-attachments`; server-side uploads with the service-role key (`lib/supabase.js`) |
| Email | Gmail SMTP via nodemailer (`lib/email.js`) | Free, reliable for capstone scale; App Password auth (`GMAIL_APP_PASSWORD`) |
| Payments | PayMongo (`lib/paymongo.js`) | Philippine payment methods (GCash, Maya, cards, QRPh); webhook-driven confirmation |
| AI | OpenAI — `gpt-5` (chatbot) and `gpt-5-mini` (slot ranking) via `lib/ai.js` | See `06-ai-features.md` |
| Calendar UI | `react-big-calendar` + `dayjsLocalizer` | Day/Week/Month calendar views |
| Dates | `dayjs` (UI pickers) + `moment-timezone` (server slot math, Asia/Manila) | Server logic must be timezone-correct regardless of where Vercel runs the function |
| Animation | Framer Motion | Notification drawer + AI chat drawer slide-ins |
| Cron | Vercel Cron Jobs (`vercel.json`) | 5 scheduled jobs, all protected by a `CRON_SECRET` bearer token (`lib/cron-auth.js`) |

## How the codebase is organized

The single most important convention: **pages are thin, modules are fat.**

```
app/(main)/[clinicId]/settings/page.jsx     ← ~5 lines: metadata + one import
app/modules/settings-page/SettingsPage.jsx  ← the actual page content
```

Every `page.jsx` only sets the page title and imports one component from `app/modules/<page-name>/`. Page-specific sub-components (modals, forms) live in that same module folder — never in `components/`.

```
app/
├── (main)/                # route group: landing page, sign-in/up, /super, /[clinicId]/...
│   ├── layout.jsx         # mounts the 4 providers (below)
│   ├── [clinicId]/layout.jsx  # per-clinic auth guard (session + role + clinic match)
│   └── super/             # super admin portal (role 0)
├── api/                   # ~40 route handler folders — every backend endpoint
├── modules/               # one folder per page (appointments-page, records-page, ...)
└── providers/             # app-wide React contexts
components/
├── commons/               # our MUI primitives: Button, Input, Select, PageHeader, theme.js, UnlockRecordsModal
└── ui/                    # shadcn/ui primitives used by the sidebar/layout
lib/                       # ~30 server/client helpers (auth, crypto, slots, billing, audit, ...)
prisma/schema.prisma       # entire data model
middleware.js              # runs on EVERY request before anything else
vercel.json                # cron schedules + region (sin1 = Singapore)
```

## The four providers (mounted in `app/(main)/layout.jsx`)

| Provider | File | What it does |
|---|---|---|
| `ThemeRegistry` | `app/providers/ThemeRegistry.jsx` | MUI + Emotion server-side-rendering setup; loads design tokens from `components/commons/theme.js` |
| `CryptoProvider` | `app/providers/CryptoProvider.jsx` | Holds the decrypted E2EE keys **in React memory only** (never localStorage); exposes `useCrypto()`; cleared on sign-out |
| `ToastProvider` | `app/providers/ToastProvider.jsx` | Global snackbar via `useToast()` — `showToast('Saved!', 'success')` |
| `InactivityProvider` | `app/providers/InactivityProvider.jsx` | Watches user activity; auto signs out after **30 minutes** idle |

## `middleware.js` — the front door

Runs on every request before any page or API handler:

1. **Session cookie verification** — `verifyCookie()` from `lib/session-cookie.js` checks the HMAC signature; enforces the 10-min default / 3-day Remember-Me maxAge and an **8-hour absolute session cap**.
2. **Clinic-enabled check** — a disabled clinic (`Clinic.isEnabled = false`) is blocked for all its users; the lookup is cached 60 s with `unstable_cache` so it doesn't hit the DB on every request.
3. **Content-Security-Policy** — builds a per-request **nonce + `'strict-dynamic'`** CSP (no `unsafe-inline`), so injected inline `<script>` tags cannot execute (XSS mitigation).
4. Public paths (`/api/auth/*`, `/api/clinics`, `/api/webhooks`, `/api/cron`, `/api/super`) skip the clinic check but the handlers do their own auth.

## Vercel Cron Jobs (`vercel.json`)

All five hit `GET /api/cron/<name>` with `Authorization: Bearer $CRON_SECRET`, verified in `lib/cron-auth.js`:

| Job | Schedule (UTC) | Purpose |
|---|---|---|
| `reminders` | daily 08:00 | 24 h + 2 h appointment reminder emails/notifications |
| `audit-purge` | daily 01:00 | Delete soft-deleted data past each clinic's retention setting |
| `breach-scan` | daily 02:00 | Detect brute-force / mass-access / bulk-export patterns |
| `orphan-docs` | daily 03:00 | Delete unreferenced clinic-application uploads (> 48 h) from Supabase |
| `keep-alive` | 06:00 every 5 days | DB ping so Neon's free tier doesn't cold-sleep |

## Environment variables (know these cold)

`DATABASE_URL` (Neon), `SESSION_SECRET` (HMAC key — auth **fails closed** if unset), `GMAIL_USER`/`GMAIL_APP_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `OPENAI_API_KEY`, `PAYMONGO_SECRET_KEY` + `PAYMONGO_WEBHOOK_SECRET`, optional lockout tuning (`LOCKOUT_MAX_ATTEMPTS`, `LOCKOUT_WINDOW_MINUTES`, `LOCKOUT_DURATION_MINUTES`).

## Key files table

| File | Role |
|---|---|
| `middleware.js` | Session TTLs, clinic-enabled gate, CSP nonce |
| `app/(main)/layout.jsx` | Mounts the four providers |
| `app/(main)/[clinicId]/layout.jsx` | Auth + clinic guard for every authenticated page; feeds sidebar (role, logo, pending count) |
| `lib/prisma.js` | Prisma client singleton (prevents connection exhaustion in dev) |
| `prisma/schema.prisma` | Entire data model (~30 models) |
| `prisma/seed.js` | 3 clinics + 4 users/clinic (one per role), password `12345678`, emails `{role}.{clinicSlug}@intellident.test` |
| `components/commons/theme.js` | Design tokens (Primary Blue `#2563eb`, etc.) + MUI overrides |
| `vercel.json` | Cron schedules, region `sin1` |

## Mock Panel Q&A

**Q: Why Next.js and not a separate React frontend + Express backend?**
A: The App Router gives us both in one deployable unit — server components fetch data directly with Prisma (no extra API hop), route handlers under `app/api/` are our REST API, and `middleware.js` applies security policy to every request. One repo, one deploy, fewer moving parts for a four-person team.

**Q: Why JavaScript instead of TypeScript?**
A: Team familiarity and iteration speed for a capstone timeline. We compensate with strict server-side input sanitization (`lib/validate.js`) and Prisma's generated query layer, which catches schema mismatches at the database boundary.

**Q: What happens when a request comes in — walk me through it.**
A: `middleware.js` runs first: verifies the HMAC-signed session cookie, checks the clinic isn't disabled, and attaches a CSP header. Then the route handler runs: it calls `getSession()` (`lib/auth.js`) which re-validates the token against the `UserSession` table, checks the caller's role, scopes every query by `clinicId`, does the work, and writes an audit log entry.

**Q: Where is state stored on the client?**
A: Almost nowhere. The session is an HttpOnly cookie (JS can't read it). Decrypted E2EE keys live only in `CryptoProvider` React memory and vanish on refresh or sign-out — that's why `UnlockRecordsModal` asks for the password again after a reload.

**Q: Why is the deployment region `sin1`?**
A: Singapore is the closest Vercel region to the Philippines, minimizing latency for clinic staff and patients; the Neon database is co-located in the same region.

**Q: How do scheduled tasks work if this is serverless?**
A: Vercel Cron invokes our five `/api/cron/*` route handlers on the schedules in `vercel.json`. Each handler rejects any request without the `CRON_SECRET` bearer token, so outsiders can't trigger a purge or spam reminders.

**Q: Why both dayjs and moment-timezone?**
A: `dayjs` powers the MUI date pickers and calendar UI (their adapters expect it). Server-side slot math uses `moment-timezone` because slot availability must be computed in **Asia/Manila** clinic time no matter which region the serverless function runs in.

**Q: Why MUI for the system but Tailwind for the landing page?**
A: Different jobs. The system needs dozens of consistent, accessible, data-heavy components (tables, dialogs, pickers) fast — MUI ships those with theming (`components/commons/theme.js`). The landing page is a one-off marketing design where utility classes are quicker. We enforce a hard rule — never both in one component — so styles can't conflict.

**Q: What is Prisma and why use an ORM at all?**
A: Prisma generates a typed query client from `prisma/schema.prisma` and manages migrations. Two wins for us: every query is **parameterized automatically** (structural SQL-injection defense — sqlmap found nothing), and the schema file is a single readable source of truth for ~30 models that we can defend from.

**Q: How do you change the database schema safely?**
A: Edit `prisma/schema.prisma`, run a Prisma migration, and the migration history is versioned in the repo. The seed script (`prisma/seed.js`) is written to be idempotent — it backfills missing profiles and patient codes on re-run rather than duplicating.

**Q: What are the limitations of a serverless architecture for this system?**
A: No long-running processes (solved with Vercel Cron), no shared memory between instances (why rate limiting is DB-backed), and cold starts (mitigated by the keep-alive cron for Neon and generous AI timeouts). In exchange we get zero server maintenance, automatic scaling, and per-request isolation — the right trade for a clinic-scale app maintained by four students.

**Q: Why Neon, Supabase, and Vercel specifically?**
A: They integrate natively (Vercel + Neon are partnered), have free tiers suitable for a capstone with production-grade behavior (Neon gives point-in-time restore, which powers our Recover function), and each does one thing: Neon = Postgres, Supabase = object storage, Vercel = compute/CDN/cron. No credit-card-scale infrastructure to babysit.

**Q: If 30 more clinics joined tomorrow, what breaks?**
A: Architecturally nothing — onboarding a clinic is one `Clinic` row and every query is already tenant-scoped; Vercel scales function instances automatically. The practical ceilings are free-tier quotas: Neon connections/storage, Gmail's daily send limit (we'd move to a transactional email service), and OpenAI cost — all swappable services behind our `lib/` helpers, not architectural rewrites.

---
Further reading: [`docs/features.md`](../features.md), [`docs/schema.md`](../schema.md), root [`CLAUDE.md`](../../CLAUDE.md).

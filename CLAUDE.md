# IntelliDent — CLAUDE.md

## What This Is

IntelliDent is a capstone project by four BS Information Technology (Cybersecurity) students from FEU Institute of Technology. It is an AI-powered, multi-tenant scheduling and patient record system for a network of three partner dental clinics:

- Maria Laura Cruz Dental Clinic
- KH Dental Aesthetics
- Cabasal Dental Clinic

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | JavaScript (JSX) |
| UI Library | MUI v7 (system pages) + Tailwind CSS (landing page only) |
| Database ORM | Prisma + PostgreSQL |
| Auth | Custom session-based (cookies via `lib/auth.js`) |
| Encryption | Web Crypto API — AES-GCM E2EE, PBKDF2 key derivation |
| AI | GPT-5 (for appointment scheduling suggestions) |
| Analytics | Vercel Analytics |

---

## File Structure

```
app/
├── (main)/                   # Route group — wraps all authenticated + auth pages
│   ├── layout.jsx            # Mounts ThemeRegistry, CryptoProvider, ToastProvider
│   ├── page.jsx              # Landing page (Tailwind only)
│   ├── dashboard/page.jsx
│   ├── sign-in/page.jsx
│   └── sign-up/page.jsx
├── api/auth/                 # Auth API routes (signin, signout, signup)
├── modules/                  # Page-level components (one folder per route)
│   ├── landing-page/         # Tailwind — public facing
│   ├── sign-in-page/
│   ├── sign-up-page/
│   └── dashboard-page/
├── providers/                # App-level React context providers
│   ├── ThemeRegistry.jsx     # MUI + Emotion SSR setup
│   ├── ToastProvider.jsx     # Global toast/snackbar (useToast hook)
│   └── CryptoProvider.jsx    # Holds master key in memory (useCrypto hook)
components/
└── commons/                  # Reusable MUI-based UI primitives
    ├── theme.js              # Design tokens + MUI component overrides
    ├── Button.jsx            # Custom button with loading state
    └── Input.jsx             # Label-above input field (no floating label)
lib/
├── auth.js                   # Session helpers (getSession, setSession)
├── prisma.js                 # Prisma client singleton
└── crypto.js                 # Web Crypto API helpers (E2EE)
prisma/
└── schema.prisma
```

---

## Architecture Rules

### Page Structure
Every `page.jsx` contains **only** metadata + one import. All content lives in `app/modules/[page-name]/`.

```jsx
// app/(main)/dashboard/page.jsx
import DashboardPage from '@/app/modules/dashboard-page/DashboardPage';
export const metadata = { title: 'Dashboard | IntelliDent' };
export default function Page() { return <DashboardPage />; }
```

### Module Structure
Each page module lives in `app/modules/[page-name]/`. Page-specific sub-components go in the **same folder** — not in `components/`.

### Components vs Commons
- `components/commons/` — base MUI UI primitives used system-wide (Button, Input, etc.)
- `components/` root — truly reusable system-wide components (not page-specific)
- Page-specific components — stay inside their own `app/modules/[page-name]/` folder

### Styling Rules
- **Landing page** (`app/modules/landing-page/`) → Tailwind CSS only
- **All system pages** (dashboard, auth, etc.) → MUI only, no Tailwind
- Never mix Tailwind and MUI in the same component

### Providers
- `ThemeRegistry` — MUI SSR, wraps everything in `(main)`
- `CryptoProvider` — holds the decrypted master key in memory, cleared on sign-out
- `ToastProvider` — global toast via `useToast()` hook

---

## Design System

All tokens are defined in `components/commons/theme.js`.

| Token | Hex | Usage |
|---|---|---|
| Primary Blue | `#2563eb` | CTAs, buttons, active states, nav highlights |
| Soft Sky | `#60a5fa` | Hover states, icons, secondary buttons |
| Light Blue | `#dbeafe` | Card backgrounds, badges, tags |
| Mist | `#F8FAFC` | Page background, section dividers |
| White | `#ffffff` | Cards, modals, input fields |
| Slate Text | `#334155` | Body text, labels, headings |
| Error Red | `#E05C6A` | Required fields, validation errors |

---

## Security Architecture

### Zero Trust
Every request is verified before data is accessed:
1. Valid session?
2. User role?
3. Tenant/clinic match (ClinicID)?
4. Role has permission for this action?
5. Log the attempt either way

### E2EE (Client-Side Encryption)
Using the Web Crypto API — **the server never sees plaintext user data.**

**Registration:**
- Browser generates AES-GCM-256 master key
- PBKDF2 derives a Key Encryption Key (KEK) from the user's password + random salt
- Master key is wrapped with KEK using AES-KW
- Only `wrappedKey` + `keySalt` are sent to the server

**Login:**
- Server returns `wrappedKey` + `keySalt`
- Browser re-derives KEK from password + salt
- Master key is unwrapped locally → stored in `CryptoProvider` memory only
- Cleared from memory on sign-out

**Data:**
- Encrypt with `encryptData(masterKey, plaintext)` → returns `{ ciphertext, iv }`
- Decrypt with `decryptData(masterKey, ciphertext, iv)`
- Server stores only encrypted blobs — unreadable without the user's password

**Important:** Developers cannot read user data. There is no password recovery that restores access to existing encrypted data. This is intentional.

### RBAC Roles
- `Patient` — book appointments, view own records
- `Clinic Staff` — manage appointments, update records
- `Admin` — full access, audit logs, reporting

### Multi-Tenancy
All data is scoped to a `ClinicID`. Every DB query must include a clinic scope filter. No cross-clinic data access is allowed regardless of role.

---

## Core Modules to Build

- [ ] User Access & Authentication (in progress)
- [ ] Appointment Scheduling + AI slot suggestions (GPT-5)
- [ ] Virtual Assistant / Chatbot
- [ ] Patient Record Management
- [ ] Billing & Payment Tracking
- [ ] Reminders & Notifications (email/SMS)
- [ ] Audit Logging
- [ ] Integrity Verification (tamper detection via encrypted hashes)
- [ ] Reporting & Exports

---

## Common Patterns

### Toast
```js
const { showToast } = useToast();
showToast('Saved!', 'success');
showToast('Something went wrong', 'error', 'Optional description');
// severities: 'success' | 'error' | 'info' | 'warning'
```

### Encryption
```js
import { encryptData, decryptData } from '@/lib/crypto';
const { masterKey } = useCrypto();

const { ciphertext, iv } = await encryptData(masterKey, 'some text');
const plaintext = await decryptData(masterKey, ciphertext, iv);
```

### Custom Commons Components
```jsx
import Button from '@/components/commons/Button';
import Input from '@/components/commons/Input';

<Button variant="contained" loading={loading}>Save</Button>
<Button variant="outlined">Cancel</Button>
<Input id="field" label="Label" value={val} onChange={...} placeholder="..." />
```

---

## Compliance
- Philippine Data Privacy Act of 2012 (RA 10173)
- ISO/IEC 27001 principles
- NIST Cybersecurity Framework (Identify, Protect, Detect, Respond, Recover)

## Security Testing Tools (controlled environment only)
- Burp Suite — XSS, auth testing
- sqlmap — SQL injection
- Hydra — brute force auth testing

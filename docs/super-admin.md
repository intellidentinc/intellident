# Super Admin

## Overview

The Super Admin is a privileged account (role `0`) that sits above all clinic-scoped roles. It has no affiliation with any specific clinic and can enter any clinic's admin panel without being a registered user of that clinic.

---

## Credentials (seed)

| Field    | Value                          |
|----------|-------------------------------|
| Email    | `superadmin@intellident.app`  |
| Password | `12345678`                    |
| Role     | `0` (SUPERADMIN)              |
| Clinic   | none                          |

Run the seed once to create the account:

```bash
node prisma/seed-super.js
```

Safe to run multiple times — skips if the account already exists.

---

## How It Works

### 1. Login
Super admin signs in through the normal `/sign-in` page. Because their `clinicId` is `null` in the database, the sign-in redirect sends them to `/super` instead of `/{clinicId}/dashboard`.

### 2. Clinic Picker (`/super`)
The `/super` page lists all clinics (name, code, address, contact info). Each clinic card has an **"Enter as Admin"** button.

- Route: `app/(main)/super/`
- Layout: `app/(main)/super/layout.jsx` — guards the route; redirects to `/sign-in` if the session role is not `0`
- Page component: `app/modules/super-page/SuperPage.jsx`

### 3. Entering a Clinic
Clicking "Enter as Admin" calls:

```
POST /api/super/enter
Body: { clinicId }
```

The API:
1. Verifies the session user has role `0`
2. Verifies the clinic exists
3. Updates the session cookie — sets `clinicId` to the chosen clinic and adds `superAdmin: true`
4. Writes an audit log entry (`action: VIEW`, `entity: Clinic`, metadata: `superadmin-enter`)
5. Returns the `clinicId`; the client then redirects to `/{clinicId}/dashboard`

### 4. Inside the Clinic
The `[clinicId]/layout.jsx` detects `session.superAdmin === true` and:
- Maps role `0` → `effectiveRole = ADMIN` so the full admin sidebar and pages are available
- Passes `isSuperAdmin={true}` to `AppSidebar`

The sidebar shows a **"Back to Super Admin"** button at the bottom (above sign out).

### 5. Exiting a Clinic
Clicking "Back to Super Admin" calls:

```
POST /api/super/exit
```

The API:
1. Verifies the session user has role `0`
2. Resets the session — clears `clinicId` and removes the `superAdmin` flag
3. The client redirects to `/super`

---

## Session Shape

| State | `clinicId` | `superAdmin` |
|---|---|---|
| Just logged in | `null` | not set |
| Inside a clinic | `{chosen clinic id}` | `true` |
| After exiting | `null` | not set |

---

## File Map

| File | Purpose |
|---|---|
| `prisma/seed-super.js` | Creates the super admin user |
| `app/(main)/super/layout.jsx` | Route guard — role 0 only |
| `app/(main)/super/page.jsx` | Server component — fetches all clinics |
| `app/modules/super-page/SuperPage.jsx` | Clinic picker UI |
| `app/api/super/enter/route.js` | Sets session clinicId + superAdmin flag |
| `app/api/super/exit/route.js` | Resets session to super state |
| `app/modules/dashboard-page/ExitSuperAdminButton.jsx` | "Back to Super Admin" button |
| `lib/roles.js` | `ROLES.SUPERADMIN = 0` |
| `lib/auth.js` | `setSession(..., superAdmin)` — stores flag in cookie |

---

## Security Notes

- The `/super` route is guarded server-side — any non-zero role is rejected before rendering
- `POST /api/super/enter` and `POST /api/super/exit` both verify role `0` from the database, not just the session, before acting
- Every clinic entry is written to `AuditLog` (`action: VIEW`, metadata includes `superadmin-enter`)
- The super admin can use all ADMIN features inside a clinic (users, services, appointments, settings, audit log) but does not have a patient/dentist/receptionist profile record in that clinic
- Because `clinicId` is set in the session when inside a clinic, all existing zero-trust DB queries continue to work without modification

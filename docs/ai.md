# AI-Assisted Scheduling & Optimization (Module 6)

## Overview

IntelliDent integrates **OpenAI gpt-5** to provide three AI capabilities:

1. **AI Chatbot** — a role-aware conversational assistant accessible to all authenticated users
2. **Slot Recommendations** — AI-ranked appointment time slots with explanation tags
3. **No-show Risk Flagging** — automated risk assessment for patient appointments

All AI outputs are **suggestions only**. Staff must confirm any changes. Every AI interaction is audit-logged.

---

## Tech

| Item | Value |
|---|---|
| Model | `gpt-5` (OpenAI) |
| SDK | `openai` |
| Env var | `OPENAI_API_KEY` |
| Helper | `lib/ai.js` |

---

## 1. AI Chatbot

### User-facing behaviour

- Floating **bot button** (bottom-right corner) on every authenticated page
- Opens a **right-side drawer** (640 px wide on desktop, full-screen on mobile)
- Left panel: chat session history (up to 30 sessions, soft-deletable)
- Right panel: active chat with markdown-rendered responses
- Quick-prompt suggestions shown on empty state
- Enter to send, Shift+Enter for newline
- Chat history is **persisted to the database** (not localStorage)

### Role-aware context injection

Every request includes a system prompt built server-side from the authenticated user's session. The injected context differs by role:

| Role | Context injected |
|---|---|
| All roles | Clinic name, phone, email, working days, operating hours, full service list |
| `PATIENT` (4) | Patient's own upcoming appointments (next 5, PENDING + CONFIRMED) |
| `DENTIST` / `RECEPTIONIST` / `ADMIN` (1–3) | Staff-level guidance; no individual patient data |

The system prompt explicitly instructs the model to **never disclose other patients' data** and to label all suggestions as non-confirmed.

### Chat history schema

```
ChatSession
  id          cuid
  userId      → User
  clinicId    → Clinic
  title       String?   (first 80 chars of opening message)
  isDeleted   Boolean   (soft delete)
  createdAt / updatedAt / deletedAt

ChatMessage
  id          cuid
  sessionId   → ChatSession
  role        ChatRole  (USER | ASSISTANT)
  content     Text
  createdAt
```

### API routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/ai/chat` | List current user's sessions (most-recent first, max 30) |
| `POST` | `/api/ai/chat` | Send a message; creates session if `sessionId` omitted |
| `GET` | `/api/ai/chat/[sessionId]` | Load a session with all messages |
| `DELETE` | `/api/ai/chat/[sessionId]` | Soft-delete a session |

**POST `/api/ai/chat` body:**
```json
{
  "message": "What services do you offer?",
  "sessionId": "optional-existing-session-id"
}
```

**POST `/api/ai/chat` response:**
```json
{
  "sessionId": "cm...",
  "message": { "role": "ASSISTANT", "content": "We offer..." }
}
```

### Security

- Session-gated on every route (`getSession()`)
- `clinicId` scoped — users cannot access sessions from other clinics
- User can only access their own sessions (`userId` + `clinicId` check)
- System prompt explicitly restricts patient data exposure
- Every interaction creates an `AuditLog` entry (`action: AI_INTERACTION`, `entity: ChatSession`)

---

## 2. Slot Recommendations

### User-facing behaviour

Available in two places:

- **`CreateAppointmentModal`** (staff) — purple "Get suggestions" button appears once service + dentist + date are selected; clicking a suggestion pre-fills the Time picker
- **`BookAppointmentModal`** (patient) — "AI Pick" button in Step 4; suggestions appear as tappable chips above the full slot list

Each suggestion shows:
- The time (`9:00 AM`)
- An **explanation tag**: `"Earliest available"`, `"Best match"`, `"Morning available"`, `"Afternoon available"`, `"Lowest conflict risk"`, `"Flexible option"`
- A one-sentence reason from the AI

A disclaimer reads: *"AI suggestions only — staff confirmation required."*

### How it works

1. Generates available 30-min slots using the same logic as `/api/schedules/slots` (respects working days, closures, open/close hours, same-day 30-min buffer)
2. For a specific dentist, removes slots that conflict with existing non-cancelled appointments
3. Passes the slot list + service name + date to gpt-5 with a structured JSON prompt
4. The model returns the top 3–5 slots ranked by suitability
5. Falls back to algorithmic tagging (earliest / mid-morning / afternoon) if the AI call fails

### API route

| Method | Route | Query params |
|---|---|---|
| `GET` | `/api/ai/slots` | `serviceId`, `dentistId` (`ANY` or dentist ID), `date` (YYYY-MM-DD) |

**Response:**
```json
{
  "suggestions": [
    { "time": "09:00", "tag": "Best match", "reason": "Mid-morning slots are typically preferred by patients." },
    { "time": "08:00", "tag": "Earliest available", "reason": "First available slot of the day." },
    { "time": "14:00", "tag": "Afternoon available", "reason": "Good option for patients who prefer afternoons." }
  ]
}
```

Returns `{ suggestions: [] }` on closed days, closure dates, or no available slots.

### Audit logging

Every call creates an `AuditLog` entry:
```
action:   AI_INTERACTION
entity:   SlotRecommendation
metadata: { serviceId, dentistId, date, suggestionsCount }
```

---

## 3. No-show Risk Flagging

### User-facing behaviour

Shown in **`AppointmentDetailModal`** (staff only) when the modal opens:

- A red **"High Risk"** badge appears inline next to the patient name
- Hovering the badge shows the reason(s) in a tooltip
- An amber **"AI Suggested Actions"** box lists recommended actions below the patient info card

### Risk criteria

A patient is flagged **High Risk** if either condition is true:

| Condition | Default threshold |
|---|---|
| Patient has ≥ N previous `NO_SHOW` appointments at this clinic | N = 2 (configurable via `NOSHOW_RISK_THRESHOLD` env var) |
| The current upcoming appointment was booked < 24 hours before its scheduled time | — |

### Suggested actions (when High Risk)

- *"Require confirmation call before appointment"*
- *"Send an extra reminder 1 hour before"*

These are UI suggestions only — no automated action is taken.

### API route

| Method | Route | Auth |
|---|---|---|
| `GET` | `/api/ai/risk/[patientId]` | Staff only (role 1–3); 403 for patients |

**Response:**
```json
{
  "risk": "HIGH",
  "noShowCount": 3,
  "isLastMinuteBooking": false,
  "reasons": ["3 previous no-shows (threshold: 2)"],
  "suggestions": [
    "Require confirmation call before appointment",
    "Send an extra reminder 1 hour before"
  ]
}
```

`risk` is `"LOW"` when neither condition is met (`reasons` and `suggestions` are empty arrays).

### Security

- Staff-only: returns `403` for role 4 (PATIENT)
- `clinicId` scoped — verifies the patient belongs to the session's clinic before querying

---

## `lib/ai.js` API

```js
import { chatWithTools, generateJSON } from '@/lib/ai'

// Multi-turn chat with system prompt, history, and role-aware tools
const reply = await chatWithTools(systemPrompt, messages, userMessage, tools, executeFunction)
// messages: [{ role: 'USER' | 'ASSISTANT', content: string }, ...]
// tools: OpenAI-format tool array (from getToolsForRole in lib/ai-tools.js)
// executeFunction: async (name, args) => any — called per tool call round
// returns: string (model's final reply after all tool rounds complete)

// Structured JSON generation (used by slot recommendations)
const data = await generateJSON(prompt)
// returns: parsed JSON object — throws if model returns invalid JSON
```

### `lib/ai-tools.js` — role-aware function calling

The chatbot's tools come from `lib/ai-tools.js`:

- `getToolsForRole(role)` returns the OpenAI tool set allowed for that role:
  - **Patient** — `get_my_appointments(filter)`
  - **Dentist** — `get_my_schedule(date?)`, `get_my_upcoming_appointments()`, `get_my_patients()`
  - **Staff (ADMIN/RECEPTIONIST)** — `get_appointments_today()`, `get_pending_appointments()`, `get_appointments_by_date(date)`, `get_week_schedule()`, `get_patient_appointments(patient_name)`, `get_dentist_schedule(dentist_name, date?)`, `get_appointment_counts(date?)`, `get_dentist_list()`
- `buildExecutor(session)` returns the async tool executor. It **re-validates** the requested tool against the caller's role on every call (defense against prompt injection) and runs every query clinic-scoped, formatting dates/times in `en-PH` locale.

### `lib/ai-prompt.js` — system prompts

Builds the role-based system prompt from cached templates so the static prefix can be reused across turns (prompt caching).

---

## File Map

```
lib/
├── ai.js                                  OpenAI client + chatWithTools + generateJSON
├── ai-prompt.js                           Role-based system-prompt builder (cached templates)
└── ai-tools.js                            Role-filtered tool definitions + buildExecutor(session)

app/api/ai/
├── chat/route.js                          GET (list sessions) + POST (send message)
├── chat/[sessionId]/route.js              GET (load session) + DELETE (soft-delete)
├── slots/route.js                         GET (slot recommendations)
└── risk/[patientId]/route.js              GET (no-show risk)

app/modules/ai-chat/
├── AIChatButton.jsx                       Floating FAB (bottom-right, all clinic pages)
└── AIChatDrawer.jsx                       Right sidebar — session list + chat window
```

Modifications to existing files:

```
app/(main)/[clinicId]/layout.jsx           + <AIChatButton /> mount
app/modules/appointments-page/
  AppointmentDetailModal.jsx               + no-show risk badge + AI suggestions box
  CreateAppointmentModal.jsx               + AI slot suggestions section
app/modules/schedules-page/
  BookAppointmentModal.jsx                 + AI slot suggestions in Step 4
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key (platform.openai.com → API keys) |
| `NOSHOW_RISK_THRESHOLD` | No | Integer; no-show count that triggers High Risk (default: `2`) |

---

## Schema Migration

After pulling this feature, run:

```bash
npx prisma migrate dev --name add_ai_chat
```

This creates the `chat_sessions` and `chat_messages` tables and adds `AI_INTERACTION` to the `AuditAction` enum and `ChatRole` enum.

# AI-Assisted Scheduling & Optimization (Module 6)

## Overview

IntelliDent integrates **Google Gemini 2.5 Flash** (free tier) to provide three AI capabilities:

1. **AI Chatbot** — a role-aware conversational assistant accessible to all authenticated users
2. **Slot Recommendations** — AI-ranked appointment time slots with explanation tags
3. **No-show Risk Flagging** — automated risk assessment for patient appointments

All AI outputs are **suggestions only**. Staff must confirm any changes. Every AI interaction is audit-logged.

---

## Tech

| Item | Value |
|---|---|
| Model | `gemini-2.5-flash` (Google Gemini free tier) |
| SDK | `@google/generative-ai` v0.24+ |
| Env var | `GEMINI_API_KEY` |
| Helper | `lib/gemini.js` |

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

Every request to Gemini includes a system prompt built server-side from the authenticated user's session. The injected context differs by role:

| Role | Context injected |
|---|---|
| All roles | Clinic name, phone, email, working days, operating hours, full service list |
| `PATIENT` (4) | Patient's own upcoming appointments (next 5, PENDING + CONFIRMED) |
| `DENTIST` / `RECEPTIONIST` / `ADMIN` (1–3) | Staff-level guidance; no individual patient data |

The system prompt explicitly instructs Gemini to **never disclose other patients' data** and to label all suggestions as non-confirmed.

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
- A one-sentence reason from Gemini

A disclaimer reads: *"AI suggestions only — staff confirmation required."*

### How it works

1. Generates available 30-min slots using the same logic as `/api/schedules/slots` (respects working days, closures, open/close hours, same-day 30-min buffer)
2. For a specific dentist, removes slots that conflict with existing non-cancelled appointments
3. Passes the slot list + service name + date to Gemini with a structured JSON prompt
4. Gemini returns the top 3–5 slots ranked by suitability
5. Falls back to algorithmic tagging (earliest / mid-morning / afternoon) if Gemini fails

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

## `lib/gemini.js` API

```js
import { chatWithHistory, generateJSON } from '@/lib/gemini'

// Multi-turn chat with a system prompt and prior history
const reply = await chatWithHistory(systemPrompt, messages, userMessage)
// messages: [{ role: 'USER' | 'ASSISTANT', content: string }, ...]
// returns: string (Gemini's reply)

// Single structured JSON generation
const data = await generateJSON(prompt)
// returns: parsed JSON object — throws if Gemini returns invalid JSON
```

---

## File Map

```
lib/
└── gemini.js                              Gemini client + chatWithHistory + generateJSON

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
| `GEMINI_API_KEY` | Yes | Google AI Studio API key (get one at aistudio.google.com/apikey) |
| `NOSHOW_RISK_THRESHOLD` | No | Integer; no-show count that triggers High Risk (default: `2`) |

---

## Schema Migration

After pulling this feature, run:

```bash
npx prisma migrate dev --name add_ai_chat
```

This creates the `chat_sessions` and `chat_messages` tables and adds `AI_INTERACTION` to the `AuditAction` enum and `ChatRole` enum.

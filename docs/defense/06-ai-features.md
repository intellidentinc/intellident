# 06 — AI Features (Slot Suggestions, Chatbot, No-Show Risk)

## What it is

Three AI features (capstone **Objectives 3 & 4**), all calling OpenAI models through our helper `lib/ai.js`, all designed on one principle you should state early in the defense:

> **The AI advises; the server decides.** No AI output can create an appointment, bypass a conflict check, or read data outside the caller's authorization.

## Feature 1 — AI slot suggestions ("AI Pick") — Objective 3

File: `app/api/ai/slots/route.js` — model **`gpt-5-mini`**, called via `generateJSON()` (JSON-object response mode).

How it works, step by step:

1. Patient opens the booking wizard's time step and taps AI Pick → `GET /api/ai/slots?serviceIds&dentistId&date` (session required).
2. The server first computes availability itself with `computeAvailableSlots()` from `lib/slots.js` — **the exact same function** that renders the visible slot list. This already accounts for **service duration + buffer time**, working days, closures, opening hours, past times, and existing appointment overlaps (Objective 3's "calculates service duration and assigns suitable available time slots to prevent overlapping appointments" lives here).
3. Only that pre-validated list is sent to the model, with the service name and total duration, asking it to pick the best 3–5 and tag each ("Best match", "Earliest available", "Lowest conflict risk"…) with a one-sentence reason.
4. **Safety filter:** the response is filtered with `slots.includes(s.time)` — any hallucinated time not in the server's list is discarded. The AI can only *rank*, never *invent*.
5. **Resilience:** a 15-second timeout (`withTimeout`) and try/catch fall back to `algorithmicSuggestions()` — deterministic tagging of the first slots — so the feature degrades gracefully if OpenAI is slow, down, or returns garbage.
6. The suggestion event is audit-logged using Next's `after()` so logging never delays the response.
7. Whatever the patient picks, the booking still goes through the full server-side validation pipeline (`04-appointments.md`) — a second, independent conflict gate.

## Feature 2 — Virtual assistant chatbot — Objective 4

Files: `app/api/ai/chat/route.js` (+ `[sessionId]/route.js`), `lib/ai.js` (`chatWithTools()`), `lib/ai-tools.js`, `lib/ai-prompt.js`; UI `app/modules/ai-chat/AIChatButton.jsx` + `AIChatDrawer.jsx`.

- **Always available in-system:** a floating chat button on authenticated pages opens a Framer Motion drawer — no separate app, no office hours.
- **Multi-turn with memory:** conversations persist as `ChatSession` + messages; `GET /api/ai/chat` lists sessions, `[sessionId]` fetches or deletes one; the session title is auto-set from the first message.
- **Model:** `gpt-5` with **function calling (tools)**. The chat loop in `chatWithTools()` lets the model request a tool, executes it server-side, feeds the result back, and repeats until the model answers.
- **Clinic-defined rules, enforced not requested:**
  - `lib/ai-prompt.js` builds the system prompt from the caller's actual clinic (services, hours) and role — the assistant answers "what are your prices" from *this* clinic's real catalog.
  - `getToolsForRole()` in `lib/ai-tools.js` hands the model a **role-specific tool set** — e.g. a patient gets `get_my_appointments`, staff get clinic-day views. A patient's model literally has no tool that could list other patients.
  - `buildExecutor()` binds every tool execution to the **session's** `userId` and `clinicId` — even a prompt-injected "show me all patients of the other clinic" runs a query scoped to the caller. Authorization comes from the session, never from model output.
- Chat interactions are audit-logged; sessions are clinic-scoped rows like everything else.

## Feature 3 — No-show risk

File: `app/api/ai/risk/[patientId]/route.js` (staff-only, clinic-scoped). Two signals, either one flags high risk:

```
isHighRisk = (noShowCount >= NOSHOW_RISK_THRESHOLD)          // count of past NO_SHOW appointments; default threshold 2
          OR (scheduledAt − createdAt < 24 hours)            // upcoming appointment was booked last-minute
```

The response includes human-readable reasons (e.g. "2 previous no-shows", "booked less than 24 hours in advance") so staff can decide countermeasures — require the reservation fee, or confirm by phone.

## `lib/ai.js` — the shared helper

- `generateJSON(prompt, model)` — one-shot structured output (JSON mode) used by slot ranking.
- `chatWithTools(...)` — the multi-turn tool-calling loop used by the chatbot, with system-prompt caching.
- Reads `OPENAI_API_KEY`; model choice per feature: cheap fast `gpt-5-mini` for the lightweight ranking task, full `gpt-5` for open-ended conversation.

## Key files table

| File | Role |
|---|---|
| `app/api/ai/slots/route.js` | AI Pick: rank pre-validated slots; timeout + fallback; `slots.includes` filter |
| `lib/slots.js` | The availability math the AI is constrained to |
| `app/api/ai/chat/route.js` | Chat endpoint: session persistence, role/clinic binding |
| `lib/ai.js` | OpenAI client: `generateJSON`, `chatWithTools` |
| `lib/ai-tools.js` | Role-scoped tool declarations + clinic-bound executors |
| `lib/ai-prompt.js` | Clinic/role-aware system prompt |
| `app/api/ai/risk/[patientId]/route.js` | No-show risk flag |
| `app/modules/ai-chat/` | Floating button + chat drawer UI |

## Technologies & why

- **OpenAI function calling** — the model can *request* real data but only through tools we define; it's the standard pattern for grounding an assistant in live, permissioned data.
- **JSON response mode** for slots — structured output we can validate field-by-field instead of parsing prose.
- **`Promise.race` timeout + algorithmic fallback** — an external AI dependency must never take a core booking flow down.
- **Two models** — cost/latency matching: reasoning-light ranking on `gpt-5-mini`, conversation on `gpt-5`.

## Mock Panel Q&A

**Q: Can the AI double-book a patient?**
A: Impossible by construction, twice over. First, the AI only ever sees a slot list the server already computed as conflict-free (same `computeAvailableSlots()` as the visible picker), and its output is filtered against that list — a hallucinated time is discarded. Second, the eventual booking POST runs the full server-side overlap check anyway. The AI ranks; it never writes.

**Q: How does AI scheduling "calculate service duration" as your objective claims?**
A: Duration enters at the availability layer: `lib/slots.js` sums each selected service's duration plus buffer and only generates start times whose full block fits before closing and clear of other appointments. The AI receives that duration in its prompt for context, but the arithmetic and the exclusion of overlaps are deterministic server code.

**Q: What happens when OpenAI is down or slow?**
A: Slot ranking: a 15-second timeout trips and `algorithmicSuggestions()` returns deterministic tags — the patient still gets suggestions, just without AI phrasing. Booking itself never depends on AI. The chatbot would return an error message for that turn; no clinical function is impacted.

**Q: The chatbot has database access — what stops a patient from prompt-injecting it into revealing other patients' data?**
A: The model has no such capability to be tricked into. Tools are selected by role (`getToolsForRole()`), so a patient's model only possesses self-scoped tools like `get_my_appointments`; and every executor is hard-bound to the session's `userId` and `clinicId` — parameters the model cannot set. Prompt injection can change what the model *says*, never what it can *query*. The worst case is a wrong or weird answer, which is why we also scope it to inquiries and basic guidance, not diagnosis.

**Q: Does patient health data get sent to OpenAI?**
A: No clinical record content — E2EE notes are ciphertext to the server, so they *cannot* be sent. The chatbot works with operational data (appointments, services, schedules) scoped to the caller, and the slot ranker sees only times and a service name.

**Q: Why gpt-5-mini for slots but gpt-5 for chat?**
A: Fit for task. Ranking five time slots is a light structured task where latency matters inside a booking flow — the mini model answers in a few seconds. Open-ended multi-turn assistance benefits from the stronger model's instruction-following and tool use.

**Q: Is the chatbot "available at any time" as Objective 4 says?**
A: Yes — it's a floating button on every authenticated page, backed by a serverless endpoint with no schedule; sessions persist so a patient can resume a conversation later. Its knowledge of hours, services, and the patient's own bookings is queried live, so answers stay current 24/7.

**Q: The chatbot hallucinates and tells a patient something medically wrong. Then what?**
A: We constrain the blast radius three ways. Scope: the system prompt (`lib/ai-prompt.js`) restricts it to inquiries, appointment help, and *basic* guidance with advice to consult the dentist — clinic-defined rules per Objective 4, not open-ended diagnosis. Grounding: factual claims about hours, services, prices, and the patient's bookings come from tool calls against live clinic data, not model memory. Authority: the bot cannot create, change, or cancel anything — every consequential action still goes through the human-confirmed booking flow.

**Q: Why call OpenAI instead of running a local/open-source model?**
A: Serverless has no GPU to host one, self-hosting a capable model costs far more than our per-request API usage at clinic scale, and quality matters for a patient-facing assistant. The integration is isolated in `lib/ai.js` — swapping providers later is a one-file change — and the fallback design means the clinic runs fine with AI entirely unavailable.

**Q: How much do the AI features cost to run?**
A: Cents per day at clinic scale. Slot ranking uses the mini model with a prompt of ~a dozen time strings; chat uses gpt-5 but only when a user actually opens the drawer. Model choice per task was the cost control: the high-volume feature (slots, every booking) runs on the cheap model.

**Q: How did you test the AI features, given their outputs aren't deterministic?**
A: We tested the *guarantees*, not the prose. For slots: responses are schema-validated and filtered against the server's list, so tests assert every suggestion is in the valid set — regardless of what the model said; the timeout/fallback paths were forced by disabling the key. For chat: role-based probes (patient asking for other patients' data, prompt-injection attempts) verifying the tool layer returns only caller-scoped data. The nondeterministic layer sits entirely behind deterministic validation.

**Q: If AI Pick and the visible slot list disagreed, that would be a bug — how do you prevent drift?**
A: Both endpoints call the *same function*, `computeAvailableSlots()` in `lib/slots.js`. That's deliberate — an earlier version had two implementations that diverged on timezone handling, which taught us to centralize; the comment at the top of `lib/slots.js` documents exactly that lesson.

**Q: Is using patients' appointment data with OpenAI compliant with the Data Privacy Act?**
A: We apply data minimization: slot ranking sends only times and a service name — no personal data at all; chat tool results contain the minimum operational fields for the caller's own question, and E2EE clinical notes are cryptographically impossible to send. The processing serves the patient's own request in the patient's own session, and OpenAI's API terms exclude training on API data.

---
Further reading: [`docs/ai.md`](../ai.md).

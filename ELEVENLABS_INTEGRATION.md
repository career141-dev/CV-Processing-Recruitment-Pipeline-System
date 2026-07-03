# Career141 — ElevenLabs Follow-up Voice Agent Integration Reference
## v3.0 — Updated for Follow-up First Workflow

> **Status:** Reference document  integration pending carrier selection.
> **API Key:** Set (ELEVENLABS_API_KEY stored in .env and pushed to Convex environment)
> **Last reviewed:** 2026-06-30

---

## What Changed in v2.1 (Codebase Alignment Review)

| # | Finding  |  Action |
|---| ---------|--------|
| 1 | Crons already run retryAiCalls twice daily with a TODO comment for the actual ElevenLabs dial | Added triggerIntakeCall action reference |
| 2 | followUpHelper.ts already implements the 4-field gate (CV + currentSalary + expectedSalary + noticePeriodDays) | Confirmed � tool endpoints must write to candidates table fields directly |
| 3 | Stage is ai_call in the DB (not ai_call_intake) | Corrected throughout |
| 4 | aiCalls.ivrResponse enum is for Twilio DTMF; ElevenLabs uses tool calls instead | Clarified in architecture |
| 5 | applications.aiCallStatus exists; post-call webhook must call updateAiCallStatus mutation | Added to webhook handler |
| 6 | aiCalls table now has elevenlabsConversationId + elevenlabsAgentId fields | Already added to schema |
| 7 | doNotContact field does not exist on candidates table yet | Added to schema additions section |
| 8 | Retry cron rejects after 6 attempts over 3 days � plan calls for 7-day Day 2/4/7 window | Noted � cron needs update |
| 9 | File path should be convex/integrations/elevenlabs.ts not convex/calls/ | Path corrected |
| 10 | No shared-secret verification on any HTTP endpoint currently | Added implementation pattern |

---

## Architecture Overview

```
Career141 Convex backend
        |
        | "Call Now" button clicked by TA OR automatic cron trigger
        v
convex/integrations/elevenlabs.ts -> triggerIntakeCall action
  -> POST https://api.elevenlabs.io/v1/convai/outbound-call
  -> Sets aiCalls.elevenlabsConversationId
  -> Sets applications.aiCallStatus = "in_progress"
        |
        v
ElevenLabs Agent ("Career141 - Salary & Notice Intake")
  -> Calls candidate phone via SIP trunk number
        |
        |-- Mid-call tool call -> POST /api/elevenlabs/save-intake
        |     Writes: candidates.currentSalary, expectedSalary, noticePeriodDays
        |     Triggers: followUpHelper.checkAndAdvanceFollowUp()
        |
        +-- If declined -> POST /api/elevenlabs/mark-declined
              reason: bad_timing | not_interested | opt_out
        |
        v
Call ends -> ElevenLabs post-call webhook
-> POST /api/elevenlabs/post-call-webhook
  -> Stores transcript on aiCalls record
  -> Calls updateAiCallStatus mutation (completed/no_answer/failed)
  -> If completed -> followUpHelper re-runs 4-field gate check
  -> If no_answer/failed -> stays in ai_call stage, retry queued
  -> If opt_out -> candidates.doNotContact = true
        |
        v
Four-field gate (followUpHelper.ts):
  hasCV + hasCurrentSalary + hasExpectedSalary + hasNoticePeriod
  All four YES -> currentStage advances to "second_shortlist"
  Missing any -> stays in "follow_up" for WhatsApp/email follow-up
```

No Twilio in this flow. The ivrResponse enum on aiCalls is legacy from a previous design - ElevenLabs uses tool calls, not DTMF keypresses.

---

## Prerequisites

| Requirement | Status |
|---|---|
| ElevenLabs API key | SET - in .env + Convex env |
| ElevenLabs Conversational AI (paid plan) | Confirm plan tier |
| Agent created (ELEVENLABS_FOLLOWUP_AGENT_ID) | Pending - see Agent Setup section |
| Phone number imported (ELEVENLABS_PHONE_NUMBER_ID) | Pending carrier selection |
| SIP trunk carrier account | DECISION NEEDED |
| Webhook secret (ELEVENLABS_WEBHOOK_SECRET) | Pending |

---

## Choosing a SIP Trunk Carrier

DECISION NEEDED - this is the only hard blocker. Everything else can be built in parallel.

| Carrier | ElevenLabs Integration | Best for |
|---|---|---|
| Exotel | Dedicated native integration | Sri Lanka/India/APAC - best local numbers |
| Telnyx | Generic SIP trunk | Strong docs, global coverage |
| Plivo | Generic SIP trunk | Easy onboarding, good APAC |
| Other | Generic SIP trunk | Any provider with TLS + SRTP |

RECOMMENDATION: If candidates are primarily in Sri Lanka/India, Exotel is recommended.
It has a dedicated ElevenLabs connector (no manual SIP config) and best local number availability for higher answer rates.

---

## Step-by-Step: Create the ElevenLabs Agent

1. ElevenLabs Dashboard -> Conversational AI -> Agents -> Create Agent
2. Name: "Career141 - Follow-up Agent"
3. Language: English (single language for this phase)
4. Configure Voice tab (see Voice Configuration section)
5. Configure Prompt tab (paste system prompt below + set First Message)
6. Configure Tools tab (add both tools from Tools section)
7. Configure Webhooks tab (post-call webhook URL)
8. Leave in draft/test until number is imported
9. Copy agent ID -> store as ELEVENLABS_FOLLOWUP_AGENT_ID

---

## Step-by-Step: Import the Number into ElevenLabs

IF using Exotel:
1. ElevenLabs -> Phone Numbers -> Import -> From Exotel
2. Enter Exotel SID/API credentials + phone number
3. ElevenLabs auto-configures

IF using generic SIP trunk (Telnyx, Plivo, other):
1. ElevenLabs -> Phone Numbers -> Import -> From SIP Trunk
2. Enter:
   - Address: SIP hostname from carrier (no sip: prefix)
   - Transport: TLS
   - Authentication: Digest auth - username/password from carrier
3. Click Import
4. Assign imported number to "Career141 - Follow-up Agent"
5. Copy phone number ID -> store as ELEVENLABS_PHONE_NUMBER_ID

FINAL STEP (both paths):
- Place a test outbound call from ElevenLabs dashboard before connecting to production

---

## Voice Configuration

| Setting | Value |
|---|---|
| Voice | Calm, professional - matching regional accent |
| Stability | 0.45-0.55 |
| Similarity Boost | 0.75-0.85 |
| Speed | 1.0 |
| Streaming latency | Level 2-3 |
| Turn eagerness | patient |

---

## Agent System Prompt

```
# Personality
You are a professional recruitment follow-up specialist from Career141.
You are warm, respectful, and efficient - not a salesperson.

# Environment
You are making an outbound follow-up phone call to a job candidate whose profile
matched the {{job_title}} role. We previously reached out to them via {{last_contact_channel}}.
The call is short (target under 4 minutes).

# Goal
Collect the missing information we need to progress their application.
The missing fields are specifically: {{missing_fields_list}}.
Do NOT ask for information that is not in the missing fields list.

Then end the call cleanly, telling them the recruiter will follow up shortly.

# Call Structure
1. Greet the candidate by first name (already set as your first message).
2. Confirm it is a good time to talk.
   - If not: politely ask for a preferred callback time, note it, call
     mark_call_declined("bad_timing"), thank them, and end the call.
3. Explain why you are calling: you are following up on the {{last_contact_channel}} message regarding the {{job_title}} role, and just need a few quick details.
4. Ask for the items listed in {{missing_fields_list}} (e.g. current salary, expected salary, notice period).
5. Always call save_candidate_intake_data before ending, even if fields
   are empty. Pass whatever was collected.
6. Thank them. Tell them Career141 will be in touch with next steps. End the call.

# Rules
- Maximum 3 sentences per turn. Keep it short.
- Only ask for the specific items listed in {{missing_fields_list}}.
- Do not repeat the same question more than twice.
- If the candidate says they are not interested in the role:
  call mark_call_declined("not_interested") and end the call gracefully.
- If the candidate asks to be removed from contact:
  call mark_call_declined("opt_out") immediately, apologize for
  the interruption, and end the call.
- Always call save_candidate_intake_data before hanging up.
  This step is important.
- This step is important: do not exceed 5 minutes total.

# Tone
Friendly, concise, human-sounding. No corporate jargon.
```

First Message field (set separately in agent settings):
```
Hi {{candidate_name}}, this is calling from Career141 regarding the {{job_title}} role. We reached out recently and I'm just following up. Do you have a quick minute to chat?
```

---

## Conversation Flow

```
[Call connects]
        |
Agent greets + confirms timing
        |
        +-- Bad timing -> mark_call_declined("bad_timing") -> END
        |
        v
Ask: current salary [store or skip if declined]
        |
        v
Ask: expected salary [store or skip if declined]
        |
        v
Ask: notice period [store or skip if declined]
        |
        v
Close call -> "recruiter will follow up shortly"
        |
        v
Tool: save_candidate_intake_data(all collected fields)
        |
        v
[Call ends]
        |
        v
ElevenLabs post-call webhook -> /api/elevenlabs/post-call-webhook
        |
        +-- Stores transcript -> aiCalls.transcript
        +-- Calls updateAiCallStatus(completed/no_answer/failed)
        +-- checkAndAdvanceFollowUp() -> if all 4 fields set -> second_shortlist
```

---

## Dynamic Variables (Passed at Call Time)

| Variable | Example | Usage |
|---|---|---|
| candidate_name | "Sarah" | Spoken aloud - first name only |
| job_title | "Senior React Developer" | Spoken aloud |
| company_name | "Career141" | Spoken aloud |
| missing_fields_list | "current salary, notice period" | Spoken aloud to prompt candidate |
| last_contact_channel | "WhatsApp" or "Email" | Spoken aloud to reference previous outreach |
| attempt_number | "1" | Passed silently |
| candidate_id | Convex ID | Passed silently to tool calls |
| job_id | Convex ID | Passed silently to tool calls |
| application_id | Convex ID | Passed silently to tool calls |

---

## Tools - Backend Integration

### Tool 1: save_candidate_intake_data

```json
{
  "name": "save_candidate_intake_data",
  "description": "Saves salary and notice period collected during the call. Call once near the end of the conversation, even if some fields are missing or declined.",
  "url": "https://clever-spider-112.convex.site/api/elevenlabs/save-intake",
  "method": "POST",
  "headers": { "x-webhook-secret": "{{ELEVENLABS_WEBHOOK_SECRET}}" },
  "parameters": {
    "type": "object",
    "properties": {
      "candidate_id":       { "type": "string" },
      "job_id":             { "type": "string" },
      "application_id":     { "type": "string" },
      "current_salary":     { "type": "number", "description": "Numeric value only, omit if declined" },
      "expected_salary":    { "type": "number", "description": "Numeric value only, omit if declined" },
      "notice_period_days": { "type": "number", "description": "Number of days, omit if declined" },
      "fields_declined":    { "type": "array", "items": { "type": "string" } },
      "candidate_questions": { "type": "string", "description": "Any additional questions the candidate asked the recruiter" },
      "custom_question_answers": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
             "question": { "type": "string" },
             "answer": { "type": "string" }
          }
        },
        "description": "Answers to the custom questions the agent asked"
      }
    },
    "required": ["candidate_id", "job_id"]
  }
}
```

### Tool 2: mark_call_declined

```json
{
  "name": "mark_call_declined",
  "description": "Call when the candidate declines to continue the call for any reason.",
  "url": "https://clever-spider-112.convex.site/api/elevenlabs/mark-declined",
  "method": "POST",
  "headers": { "x-webhook-secret": "{{ELEVENLABS_WEBHOOK_SECRET}}" },
  "parameters": {
    "type": "object",
    "properties": {
      "candidate_id":   { "type": "string" },
      "job_id":         { "type": "string" },
      "application_id": { "type": "string" },
      "reason": {
        "type": "string",
        "enum": ["bad_timing", "not_interested", "opt_out"],
        "description": "bad_timing=reschedule; not_interested=no longer wants role; opt_out=remove from all contact"
      }
    },
    "required": ["candidate_id", "job_id", "reason"]
  }
}
```

IMPORTANT RULE: Declined does NOT mean Rejected.
- bad_timing + not_interested -> advance to follow_up stage (WhatsApp/email fallback runs)
- opt_out -> set doNotContact=true AND reject application
This is different from a TA manually rejecting a candidate.

---

## HTTP Endpoints to Add to convex/http.ts

Convex site URL: https://clever-spider-112.convex.site

Three endpoints needed:

1. POST /api/elevenlabs/save-intake
   -> Verify x-webhook-secret header
   -> Update candidates.currentSalary, expectedSalary, noticePeriodDays
   -> Run checkAndAdvanceFollowUp() gate check
   -> May auto-advance to second_shortlist if all 4 fields complete

2. POST /api/elevenlabs/mark-declined
   -> Verify x-webhook-secret header
   -> bad_timing/not_interested: setPipelineStage to follow_up
   -> opt_out: setDoNotContact=true + rejectApplication

3. POST /api/elevenlabs/post-call-webhook
   -> Verify x-webhook-secret header
   -> Store transcript on aiCalls record
   -> Call updateAiCallStatus(completed/no_answer/failed)
   -> If completed: re-run gate check
   -> If no_answer/failed: stays in ai_call, retry queued by cron

---

## Outbound Call Action

File: convex/integrations/elevenlabs.ts (use "use node" directive)

Key points:
- Call "https://api.elevenlabs.io/v1/convai/outbound-call" (NOT a Twilio-specific path)
- Pass ELEVENLABS_INTAKE_AGENT_ID + ELEVENLABS_PHONE_NUMBER_ID
- Pass all dynamic variables (candidate_name, job_title, company_name, candidate_id, job_id, application_id)
- Store returned conversation_id on aiCalls.elevenlabsConversationId
- Called AFTER triggerAiCall mutation creates the aiCalls DB record

The "Call Now" button should:
1. Call triggerAiCall mutation (creates aiCalls record, sets callStatus="scheduled")
2. Then call triggerIntakeCall action (dials ElevenLabs, stores conversation_id)

---

## Four-Field Gate (Already Implemented)

File: convex/pipeline/followUpHelper.ts

The gate checks the candidates record directly:
  hasCV = !!candidate.cvUploadId
  hasCurrentSalary = candidate.currentSalary !== undefined
  hasExpectedSalary = candidate.expectedSalary !== undefined
  hasNoticePeriod = candidate.noticePeriodDays !== undefined

All four true -> auto-advance to second_shortlist

CRITICAL: The save-intake endpoint must write to these exact fields on candidates table.
Do NOT create a parallel callIntake sub-object - the gate won't see it.

---

## Retry Logic - 7-Day Window

Day 0: First call triggered (manual or auto)
Day 2: Retry 1 (cron)
Day 4: Retry 2 (cron)
Day 7: Retry 3 - final (cron)
Day 8+: Still no answer -> move to follow_up (NOT reject)

Before each retry:
  -> Check if candidate data already filled (could be from WhatsApp reply)
  -> If yes -> cancel retries, run gate check instead
  -> If no -> trigger another ElevenLabs call

CURRENT CRON STATUS: convex/crons.ts has retryAiCalls with a TODO comment.
That TODO needs to call internal.integrations.elevenlabs.triggerIntakeCall.
Also update retry limit from 6 attempts/3 days to 3 attempts/7 days.

---

## Schema Additions Needed

Already added to schema (this session):
  aiCalls.elevenlabsConversationId: optional string
  aiCalls.elevenlabsAgentId: optional string

Still needed:
  candidates.doNotContact: optional boolean
  candidates.doNotContactReason: optional string
  candidates.doNotContactAt: optional number
  aiCalls.firstAttemptAt: optional number (for 7-day retry window tracking)

---

## Security

| Concern | Implementation |
|---|---|
| Webhook auth | x-webhook-secret header on all 3 ElevenLabs endpoints |
| API key | ELEVENLABS_API_KEY in Convex env secrets only |
| Call recording consent | Add verbal disclosure to system prompt if required (check Sri Lanka/India law) |
| Opt-out | doNotContact=true checked before any automated outreach |
| Confidential roles | is_confidential variable controls company name |

---

## Testing Checklist

Phase 1 - Agent only (no carrier needed yet):
[ ] Agent created in ElevenLabs dashboard
[ ] System prompt set + first message set
[ ] Both tools configured with correct URLs
[ ] Post-call webhook URL set
[ ] Simulator test: cooperative call - all 3 fields collected
[ ] Simulator test: bad_timing -> mark_call_declined fires
[ ] Simulator test: not_interested -> mark_call_declined fires
[ ] Simulator test: opt_out -> mark_call_declined fires
[ ] Simulator test: off-script question -> agent redirects

Phase 2 - After carrier + number import:
[ ] Number imported and assigned to agent
[ ] Test call from ElevenLabs dashboard: two-way audio confirmed
[ ] Full test call: save_candidate_intake_data fires correctly
[ ] candidates table updated with correct numeric values
[ ] followUpHelper gate fires and advances to second_shortlist
[ ] No-answer: aiCalls.callStatus = "no_answer", candidate stays in ai_call
[ ] Post-call webhook received and parsed by Convex

Phase 3 - Production readiness:
[ ] Crons updated to call ElevenLabs (not just console.log TODO)
[ ] Day 2/4/7 retry window verified
[ ] doNotContact flag blocks all future automated outreach
[ ] End-to-end test with internal team members
[ ] Go live

---

## Environment Variables

Already set:
  ELEVENLABS_API_KEY=sk_f24493c1a8145410473726e64ba466232c01779ad0c3b458

Set after agent creation:
  ELEVENLABS_FOLLOWUP_AGENT_ID=

Set after number import:
  ELEVENLABS_PHONE_NUMBER_ID=

Generate a random secret string:
  ELEVENLABS_WEBHOOK_SECRET=

SIP carrier credentials (depends on carrier choice):
  SIP_TRUNK_HOSTNAME=
  SIP_TRUNK_USERNAME=
  SIP_TRUNK_PASSWORD=

Push to Convex when ready:
  npx convex env set ELEVENLABS_FOLLOWUP_AGENT_ID <value>
  npx convex env set ELEVENLABS_PHONE_NUMBER_ID <value>
  npx convex env set ELEVENLABS_WEBHOOK_SECRET <value>

---

## Implementation Order

Week 1 (can start now - no carrier needed):
  1. Create ElevenLabs agent in dashboard
  2. Build convex/integrations/elevenlabs.ts (triggerIntakeCall action)
  3. Add 3 HTTP endpoints to convex/http.ts
  4. Add doNotContact fields to candidates schema
  5. Test all endpoints with curl

Week 2 (after carrier decision):
  6. Sign up with carrier, purchase number
  7. Import number into ElevenLabs + assign to agent
  8. Test full call flow

Week 3 (production readiness):
  9. Update crons.ts retry to call ElevenLabs
  10. End-to-end integration test with internal team
  11. Add disclosure line to prompt if required by law
  12. Go live
---

## Scope Boundaries (NOT in this phase)

- WhatsApp: Built separately using Meta Cloud API + Meta-managed number
- Email: Built separately using Microsoft Graph API
- Multiple agents/numbers: Future expansion only
- Multi-language: Future phase
- Twilio: Not used in this flow at all
---

Career141 - ElevenLabs Voice Agent Integration Reference
Stage: AI Call (Stage 3 of pipeline) - Salary & Notice Intake
No Twilio. Single agent. Single number. SIP trunk carrier TBD.

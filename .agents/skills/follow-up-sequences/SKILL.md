---
name: follow-up-sequences
description: Automated multi-channel follow-up sequences for Career141 (Agent 3). Use when implementing or debugging the follow-up scheduler, sequence stop conditions, TA credential-based sending, or the unresponsive rejection flow. Covers both email (MS Graph) and WhatsApp (Meta Cloud API) sending.
---

# Follow-up Sequences Skill (Agent 3)

Manages automated follow-up sequences to capture missing profiling data: **CV, Current Salary, Expected Salary, and Notice Period**. Triggered when an application enters the `follow_up` stage.

---

## 1. Sequence Schedule

| Stage Clock Time | Outreach Action | Notes |
|---|---|---|
| **Day 0** (Ingestion) | Day 0 WhatsApp + Email | Sends initial outreach listing the exact missing fields. |
| **Day 2** | Silent (Suspended) | AI intake screening calls are currently suspended due to number registration constraints. |
| **Day 4** | WhatsApp + Email Ping | Sends a follow-up listing the remaining missing fields. |
| **Day 6** | Final WhatsApp + Email Ping | Sends a final notice detailing the remaining missing fields. |
| **Day 7** | Move to Unresponsive | Automatically transitions the application to the `unresponsive` stage. |

---

## 2. Dynamic 4-Flag Status Tracking

The candidate's profile progress is tracked using four boolean flags in the `applications` record:
- `followUpCvReceived`
- `followUpCurrentSalary`
- `followUpExpectedSalary`
- `followUpNoticePeriod`

### Check and Advance:
- **`updateFollowUpFlags`**: Automatically sets flags to true if their values are populated in the candidate profile (populated via manual edits, TA inputs, or SMS extraction).
- **`checkAndAdvanceFollowUp`**: Sweeps candidate applications. If all 4 flags are `true`, it automatically advances the application to `second_shortlist` with the stage note: *"Auto-advanced from Follow-up: all 4 data points completed."*
- **Reopen Late Submissions**: If a candidate provides their details after being moved to `unresponsive`, the system reopens their application and advances them to `second_shortlist`.

---

## 3. Webhook Intake and NLP Extraction

When a candidate texts back a reply on WhatsApp, the bridge forwards it. If the application is in follow-up, the system triggers the following operations:
1. **Log Inbound**: Inserts an inbound message in the `communications` table, which stops further automated cron outreach.
2. **Details Extraction**: Schedules [extractDetailsFromText](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/communications/inboundExtraction.ts#L6) action.
3. **LLM Extraction**: Uses NVIDIA NIM Llama 3.1 70B to parse the text body for:
   - `currentSalary` (numeric)
   - `expectedSalary` (numeric)
   - `noticePeriodDays` (in days)
   - `noticePeriod` (verbatim)
4. **Update Profile**: Saves extracted numbers to the `candidates` profile and updates follow-up flags.

---

## 4. ElevenLabs Voice Webhooks

Intake call interactions update candidate status dynamically:
- **`/api/elevenlabs/save-intake`**: Triggered when the AI voice agent collects salary/notice details during a phone screening call. Updates candidate details and flags.
- **`/api/elevenlabs/post-call-webhook`**: Triggered when a call completes. If all 3 fields (current salary, expected salary, notice period) are successfully captured, the application advances directly to `second_shortlist` (bypassing Follow-Up). If any fields are missing, they enter the `follow_up` stage to start the 7-day clock.

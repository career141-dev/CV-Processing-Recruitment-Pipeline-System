---
name: ai-agents-overview
description: Overview of all 8 AI agents in Career141. Use when you need to understand which agent handles a specific function, how agents interact, trigger conditions, or the overall automation architecture. Good starting point before diving into a specific agent skill.
---

# AI Agents Overview — Career141

Career141 runs 8 AI agents that handle the operational recruitment and candidate screening workload.

## Agent Map

| Agent | Name | Skill File | Trigger | Runs |
|---|---|---|---|---|
| 1 | CV Parsing | `cv-parsing` | Immediate upon ingestion log creation | Asynchronous action |
| 2 | Candidate Matching | `candidate-matching` | Job publication or manual rescanning | On event |
| 3 | Follow-up Sequences | `follow-up-sequences` | Candidate enters `follow_up` stage | Hourly sweep cron |
| 4 | WhatsApp Monitor | `whatsapp-processing` | Inbound WhatsApp webhook (WhatChimp API) | Real-time |
| 5 | AI Phone Call | `pipeline-management` | Candidate enters `ai_call` stage or manual trigger | On event |
| 6 | Deduplication | `candidate-deduplication` | Candidate record creation in `createCandidate` | Inline mutation |
| 7 | Email Monitor | `email-monitoring` | MS Graph webhook inbox messages poll | On notification |
| 8 | Pipeline Health | `pipeline-management` | Visualized on recruiter dashboard via SLA tracking | Read-only |

## Agent Interaction Flow

```
Inbound CV File
    │
    ├── Agent 4 (WhatChimp WhatsApp Webhook) ──┐
    ├── Agent 7 (Email Subscriptions / Graph) ──┤
    └── Portal / Manual Upload ─────────────────┤
                                                ▼
                                    cvUploads record created
                                    status = "queued"
                                                │
                                                ▼
                                        Agent 1 (Parsing)
                                     Extract text & clean it
                                                │
                                                ▼
                                    Agent 6 (Deduplication)
                                  4-Factor Check (Candidates)
                                                │
                                                ▼
                                      NVIDIA NIM Embedding
                                  Saved to candidate profile
                                                │
                                      Create Application
                                       stage = "new_cvs"
                                                │
                                                ▼
                                     Agent 2 (Matching & Score)
                                      Blend Heuristic (60%) 
                                         & LLM (40%)
                                                │
                                       ┌────────┴────────┐
                                       ▼                 ▼
                                  Score < 60        Score >= 60
                                  Stay in Stage 1   Auto-advance to Stage 3
                                  (New CVs)         (TA Shortlist)
                                                         │
                                                Move to Follow-Up
                                                         │
                                                         ▼
                                               Agent 3 (Follow-up)
                                                Day 0 WhatsApp/Email
                                                         │
                                             Day 2 AI Call (Suspended)
                                                         │
                                                Day 4 WhatsApp/Email
                                                         │
                                                Day 6 WhatsApp/Email
                                                         │
                                            ┌────┴────────────────┐
                                            ▼                     ▼
                                      All 4 Present        7 Days Silenced
                                      (CV, salaries, np)   (No response)
                                            │                     │
                                            ▼                     ▼
                                     Stage 6: 2nd Shortlist    Unresponsive
```

## Convex Implementation Patterns

### Scheduled Functions (Convex Cron)
```ts
// convex/crons.ts
import { cronJobs } from "convex/server";
const crons = cronJobs();

// Agent 3 — Evaluate Follow-up Stage — hourly
crons.hourly("evaluate-follow-up", { minuteUTC: 0 }, internal.crons.evaluateFollowUpStage);

// Renew Graph Subscriptions — daily
crons.daily("renew-graph-subscriptions", { hourUTC: 3, minuteUTC: 0 }, internal.communications.graphSubscriptions.renewExpiringSubscriptions);

// Poll LinkedIn Inbox — every minute
crons.interval("poll-linkedin-inbox", { minutes: 1 }, api.communications.emailAgent.pollEmailInbox, { inboxEmail: "linkedin@career141.com" });

export default crons;
```

### Event-Triggered (Convex Mutations & Actions)
```ts
// Agent 1 (CV extraction) triggered after ingestion:
await ctx.scheduler.runAfter(0, api.cvs.cvExtraction.processCvExtraction, { cvUploadId, storageId, ... });

// Agent 2 (AI Matching) triggered after parsing:
await ctx.scheduler.runAfter(0, api.cvs.cvScoringActions.processCvScoring, { candidateId, jobId });
```

// Webhook handlers in convex/http.ts
http.route({ path: "/api/whatsapp-whatchimp", method: "POST", handler: handleWhatChimpWebhook });

## Tech Stack Per Agent

| Agent | Testing / Production Models | Description |
|---|---|---|
| 1 — Parsing | `meta/llama-3.1-70b-instruct` | NVIDIA NIM AI details extraction |
| 2 — Matching | `nvidia/nv-embedqa-e5-v5` / Heuristics / OpenAI | Cosine similarity & weighted scoring |
| 3 — Follow-ups | MS Graph API, Meta Cloud API, WhatChimp API | Outbound notifications & reply checks |
| 4 — WhatsApp | WhatChimp API | Inbound messages & attachments |
| 5 — Phone Call | Twilio / ElevenLabs ConvAI | Dynamic screening voice calls |
| 6 — Dedup | Convex inline queries | 4-Factor (hash, email, phone, linkedin) |
| 7 — Email | MS Graph API | Inbox monitoring & polling |
| 8 — Health | Convex DB queries | Health scores & SLA reporting |

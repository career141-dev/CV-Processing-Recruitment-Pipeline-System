---
name: whatsapp-processing
description: WhatsApp CV ingestion for Career141 (Agent 4). Use when implementing or debugging the WhatsApp webhook, three-number-mode architecture, forwarded message metadata extraction, TA attribution, or campaign number routing. Covers Meta Cloud API and the two-tap TA forward flow.
---

# WhatsApp Processing Skill (Agent 4)

Career141 uses WhatsApp webhooks to ingest candidate CVs, parse details, and chat with applicants.

---

## 1. WhatsApp Ingestion Modes

Incoming messages route to jobs using the following three modes (in order of priority):

1. **Active Session Mode**: Checks the `whatsappSessions` table for a record matching the candidate's phone number. If found, resolves the `jobId` and deletes the temporary session.
2. **Dedicated Campaign Numbers**: Checks if the `jobChannels` table contains an enabled channel matching the receiver number (`toNumber`). If found, assigns to that `jobId`.
3. **Common Company Number**: Falls back to the general company line (tagged as `"Common Number"`).

---

## 2. Inbound Webhook Handlers

WhatsApp messages are processed by http routing in [convex/http.ts](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/http.ts):

- **WhatChimp Webhook (`/api/whatsapp-whatchimp`)**: Processes incoming documents, messages, or text replies forwarded by WhatChimp.


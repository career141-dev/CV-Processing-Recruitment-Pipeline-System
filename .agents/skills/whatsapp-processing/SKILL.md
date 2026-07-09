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

- **Meta Cloud API Webhook (`/api/whatsapp`)**: Verified via App Secret signatures. Processes incoming text, documents, or images.
- **Local WhatsApp Bridge Webhook (`/api/local-whatsapp-inbound`)**: Forwards messages from [whatsapp-bridge.js](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/whatsapp-bridge.js).

---

## 3. Two-Tap Forward Extraction & Ingestion

When a TA receives a CV on their phone and forwards it to the company number, the webhook captures it:
1. **Extract Candidate Phone**: The TA is the message sender (`from`), but the candidate's original phone number is extracted from the message context metadata (`message.context?.from ?? message.from`).
2. **Download Media**: Downloads the PDF or image file.
3. **Store Blob**: Generates a SHA-256 file hash and uploads the file to Convex native storage.
4. **Create Records**: Registers the file in `cvUploads` and logs the event in `ingestionLog`.
5. **Parse CV**: Schedules parsing immediately using `api.cvs.cvExtraction.processCvExtraction`.

---

## 4. Local WhatsApp Bridge & Automated Chat Replies

[whatsapp-bridge.js](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/whatsapp-bridge.js) runs a local Express server on port 3001 and utilizes `@whiskeysockets/baileys`:
- Displays QR codes in the terminal for WhatsApp Web authentication.
- Downloads image/document attachments and forwards them as base64 strings to `/api/local-whatsapp-inbound`.
- **Automated NIM Chats**: Inbound messages trigger [handleLocalWhatsappWebhook](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/communications/localWhatsappAgent.ts#L5). It fetches the candidate's profile, job descriptions, and the last 5 messages for history context. It invokes NVIDIA NIM Llama 3.1 70B to generate a warm, human-like reply, which is returned to the bridge to message the user.

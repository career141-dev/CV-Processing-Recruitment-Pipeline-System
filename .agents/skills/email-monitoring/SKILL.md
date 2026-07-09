---
name: email-monitoring
description: Email CV ingestion for Career141 (Agent 7). Use when implementing or debugging the Microsoft 365 email inbox monitor, CV attachment detection, job board email routing, or MS Graph API integration. Covers distinguishing CV attachments from general correspondence and source tagging by sender domain.
---

# Email Monitoring Skill (Agent 7)

Agent 7 monitors the designated Microsoft 365 inbox for CV submissions via Microsoft Graph change notifications, extracts file attachments, tags sources, and routes them to the ingestion pipeline.

---

## 1. Microsoft Graph Subscription Webhooks

The system subscribes to new email events in the inbox. When a change occurs, Microsoft sends a notification to `/api/graph-webhook`:

- **Handshake (GET)**: Responds with `validationToken` in plain text.
- **Change Notifications (POST)**: Receives mailbox notifications, extracts `taEmail`, and schedules:
  ```ts
  await ctx.scheduler.runAfter(0, internal.communications.graphEmail.readInboxMessages, { taEmail, top: 10 });
  ```

---

## 2. Inbound Processing

`readInboxMessages` polls the recent messages:
1. **Filter Out Internal Mails**: Emails from company domains (e.g. `career141.com`) are ignored.
2. **Detect CV Attachments**: Identifies file attachments with:
   - MIME types: `application/pdf`, `.docx`, `.doc`, images.
   - Filenames containing: `cv`, `resume`, `curriculum`, or `profile`.
3. **Download Attachment**: Downloads file bytes from Microsoft Graph and hashes them (SHA-256).
4. **Duplicate Verification**: Checks for existing files in `cvUploads` by `fileHash`. If a duplicate is found, it skips the email.
5. **Source Tagging**:
   - Job boards forwarding candidates are identified by sender domain (e.g., `indeed.com`, `reed.co.uk`, `bayt.com`).
   - `sourceLevel1`: `"email"`
   - `sourceLevel2`: `"[Job Board Name] — Job Board"` or fallback to `"Direct Email — [sender_address]"`.

---

## 3. Ingestion Pipeline Handover

Successfully validated attachments are handoff to the ingestion mutation:
```ts
await ctx.runMutation(api.pipeline.ingestion.processCvIngestion, {
  jobId,
  sourceChannel: "email_campaign",
  storageId,
  fileHash,
  fileName,
  fileType,
  fileSizeBytes,
});
```
This inserts the file into `cvUploads` and schedules immediate AI extraction.

---
name: cv-ingestion
description: Handles multi-channel CV ingestion for Career141. Use when implementing or debugging CV collection from any source — WhatsApp, email, LinkedIn, job boards, bulk upload, portal, or Workable API. Covers two-level source tagging, Convex HTTP actions, file storage, and ingestion log.
---

# CV Ingestion Skill

Career141 collects CVs from multiple channels into a single Convex database. Every ingested CV is stored in Convex Native Storage, registered in `cvUploads`, logged, and processed immediately for details extraction.

---

## 1. Entry Points and Routing

1. **WhatsApp Webhooks (Agent 4)**:
   - Inbound WhatsApp messages are received via the WhatChimp webhook at `/api/whatsapp-whatchimp`.
   - Webhooks trigger [insertCvRecord](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/cvs/ingestion.ts#L58) to check SHA-256 duplicates, resolve the target jobId, and queue extraction.
2. **Microsoft Graph Webhook (Agent 7)**:
   - Change notifications hit `/api/graph-webhook` when emails arrive. Polling fetches the recent inbox messages, extracts CV attachments, and submits them.
3. **Portal & Bulk Uploads**:
   - Files are uploaded through the UI. Drag-and-drop triggers [processCvIngestion](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/pipeline/ingestion.ts#L6) for each file.

---

## 2. Ingestion Database Schema

### `cvUploads`
Represents an ingested CV file.
```ts
{
  storageId: v.optional(v.id("_storage")),
  fileName: v.string(),
  fileSize: v.float64(),
  fileType: v.string(),
  fileHash: v.optional(v.string()), // SHA-256
  source: v.optional(v.string()),    // whatsapp | email | workable | manual_upload
  campaignLabel: v.optional(v.string()),
  assignToJob: v.optional(v.string()), // jobId
  uploadedBy: v.string(),            // "system" or userId
  status: v.string(),                // "pending" | "processing" | "processed" | "failed"
  errorMessage: v.optional(v.string()),
  candidateId: v.optional(v.id("candidates")),
}
```

### `ingestionLog`
Maintains processing telemetry for all incoming CV uploads.
```ts
{
  jobId: v.optional(v.id("jobs")),
  channelType: v.union(v.literal("whatsapp"), v.literal("meta_campaign"), v.literal("email_campaign"), ...),
  rawSender: v.optional(v.string()),
  routingStatus: v.union(v.literal("routed"), v.literal("unrouted"), v.literal("duplicate_file"), ...),
  cvFileId: v.optional(v.id("cvUploads")),
  candidateId: v.optional(v.id("candidates")),
  errorMessage: v.optional(v.string()),
  receivedAt: v.number(),
  stage: v.optional(v.string()),     // "queued" | "parsing" | "indexing" | "completed" | "failed"
}
```

---

## 3. Implementation Rules

1. **SHA-256 Duplicate Check**: Before registering an upload, compute a SHA-256 hash on raw file bytes and check index `by_fileHash`. If a duplicate is found, log it as `duplicate_file` and halt ingestion.
2. **Immediate Extraction**: Hand off the file to `processCvExtraction` immediately after logging:
   ```ts
   await ctx.scheduler.runAfter(0, api.cvs.cvExtraction.processCvExtraction, { cvUploadId, ... });
   ```
3. **Robust Storage**: Never delete raw text or original storage references. If AI details extraction fails, the database must retain the raw extracted text in the `candidates` table.

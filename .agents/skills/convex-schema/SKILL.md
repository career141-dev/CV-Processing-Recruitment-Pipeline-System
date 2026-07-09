---
name: convex-schema
description: Convex database schema for Career141. Use when creating or modifying database tables, indexes, or understanding the data model — candidates, cvUploads, jobs, candidateJobs, messages, followUpSequences, ingestionLog, mergeLogs, campaignNumbers, and Hercules/Workable import tracking tables.
---

# Convex Schema — Career141

This document outlines the core tables and indices defined in [convex/schema.ts](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/schema.ts). Consistently consult this schema structure when performing database modifications or designing Convex functions.

---

## Core Tables and Schemas

### `candidates`
Stores parsed candidate profiles, derived variables, and vector embeddings.
- **Indices**:
  - `by_email` on `["email"]`
  - `by_phone` on `["phone"]`
  - `by_fullName` on `["fullName"]`
  - `by_fileHash` on `["fileHash"]`
  - `by_linkedinUrl` on `["linkedinUrl"]`
  - `by_overallStatus` on `["overallStatus"]`
  - `vector_index_candidates` (Vector index on `embedding`, 1024 dimensions)

### `cvUploads`
Stores file metadata for uploaded CV files.
- **Indices**:
  - `by_uploadedBy` on `["uploadedBy"]`
  - `by_status` on `["status"]`
  - `by_fileHash` on `["fileHash"]`

### `applications`
Join table tracking candidate applications for specific jobs. Replaces the legacy `candidateJobs` table.
- **Indices**:
  - `by_job_stage` on `["jobId", "currentStage"]`
  - `by_candidateId` on `["candidateId"]`
  - `by_job_source` on `["jobId", "sourceChannel"]`
  - `by_job_score` on `["jobId", "aiMatchScore"]`
  - `by_job_active` on `["jobId", "isActive"]`
  - `by_candidate_job` on `["candidateId", "jobId"]`

### `jobs`
Maintains job requirements, AI matching weights, follow-up messages, and reverse matching result caches.
- **Indices**:
  - `by_keyword` on `["keyword"]`
  - `by_status` on `["status"]`
  - `by_recruiter` on `["primaryRecruiterId"]`
  - `search_title` on `title` (filtering by status/recruiter)

### `communications`
Stores all inbound and outbound emails and text messages. Replaces the legacy `messages` table.
- **Indices**:
  - `by_candidate_time` on `["candidateId", "sentAt"]`
  - `by_applicationId` on `["applicationId"]`
  - `by_channel_time` on `["channel", "sentAt"]`
  - `by_app_sequence` on `["applicationId", "sequenceDay"]`

### `aiCalls`
LogsTwilio and ElevenLabs outbound phone screening details.
- **Indices**:
  - `by_candidate` on `["candidateId"]`
  - `by_application` on `["applicationId"]`
  - `by_job` on `["jobId"]`
  - `by_callStatus` on `["callStatus"]`

### `pipelineEvents`
Audit trail of pipeline stage changes.
- **Indices**:
  - `by_application` on `["applicationId"]`
  - `by_candidate` on `["candidateId"]`
  - `by_job_time` on `["jobId", "createdAt"]`
  - `by_event_type` on `["eventType"]`

---

## Supporting Tables

- **`users`**: Recruiter profiles, roles, and Clerk user IDs.
- **`teams` / `teamMembers`**: Organization structures.
- **`jobAssignments`**: Role-based access mapping for jobs.
- **`jobChannels`**: Connection parameters for WhatsApp campaign numbers, Workable IDs, and email inboxes.
- **`job_assets`**: Automatically generated poster assets, short application links, and intake details.
- **`match_scores`**: Historic score records for queries/rescoring.
- **`custom_filters` / `saved_filters`**: Skill and certification filters library.
- **`directorReviews` / `clientReviews`**: Approval status, SLAs, and decision logs.
- **`interviews` / `offers` / `placements`**: Late-stage pipeline coordination and placed billing details.
- **`ingestionBatches` / `ingestionLog`**: Ingestion tracking.
- **`whatsappSessions`**: Direct session caching mapped to numbers during forwarded CV routing.

---

## Key Schema Rules

1. **Timestamps**: All timestamps must be Unix milliseconds (`Date.now()`) or ISO strings as specified by schema field types.
2. **File Hashes**: Always calculate a SHA-256 file hash before inserting to check for duplicates in `cvUploads`.
3. **No Hard Deletes**: Candidates, cvUploads, applications, and communications should use soft deletes or status changes (e.g. `rejected` or `inactive`) rather than being removed.

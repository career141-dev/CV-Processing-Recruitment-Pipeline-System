# Career141: System Implementation Roadmap & Progress Tracker

This document provides a comprehensive progress checklist, mapping completed features against the system documentation, identifying remaining gaps (specifically mock UI feeds), defining production upgrade requirements, and outlining the verification test script to prepare Career141 for a 100% functional demo.

---

## 1. System Integration: Completed vs. Hercules
We analyzed and verified all structures comparing Career141 to Hercules, incorporating advanced elements where needed:
* **Deduplication Engine:** Integrated the 4-factor exact deduplication matching checks for `email`, `phone`, `fileHash`, and `linkedinUrl` using Convex DB queries during candidate profile resolution.
* **Database Folder Restructuring:** Reorganized the entire `convex/` database folder into clean domain-specific modules (`candidates`, `jobs`, `applications`, `users`, `matching`, `cvs`, `stats`, `admin`) to simplify scaling, and successfully verified zero compilation/Type errors.

---

## 2. Platform Feature Progress Checklist

### A. Done & 100% Functional (Backend + Connected UI)
- [x] **Convex Database Schema:** Schema tables (`jobs`, `candidates`, `cvUploads`, `applications`, `users`, `pipelineEvents`, `aiCalls`, `communications`, `directorReviews`, `clientReviews`, `interviews`, `offers`) are configured, indexed, and active.
- [x] **Clerk-User Role Sync:** Automatic Clerk-to-Convex user account creation, syncing, and role assignment.
- [x] **RBAC Matrix Access Control:** Active user permissions block (`src/hooks/usePermissions.ts`) restricting views/actions based on roles (`admin`, `ta_manager`, `senior_ta`, `recruiter`, `director`, `client`, `viewer`).
- [x] **Job Creation Wizard:** 4-step wizard creating real jobs in the database, setting channels, configuring AI call parameters, and saving them.
- [x] **Jobs Dashboard List:** Connected `src/app/dashboard/jobs/page.tsx` to `api.jobs.jobs.list`. Cards and lists render from database state.
- [x] **11-Stage Pipeline Kanban Board:** Job details page (`src/app/dashboard/jobs/[jobId]/page.tsx`) queries real applications by `jobId` and maps them dynamically to the correct Kanban stage columns.
- [x] **Pipeline Transitions & State Updates:** Clickable stage buttons ("Shortlist", "Reject", "Log Call", etc.) execute mutations that update `currentStage` in `applications` and write to the `pipelineEvents` audit log.
- [x] **Manual Bulk Ingestion & Progress Logging:** Ingestion monitor triggers mutations to create upload batches, tracks parsing queues, and reports progress logs in real-time.
- [x] **AI CV Parsing & Profile Resolution:** Lazy parsing triggers on the first candidate profile load, calling NVIDIA NIM (Llama 3.1 70B) to extract 16 distinct fields, compute experiences, format salaries/notice periods, and save details.
- [x] **Deduplication & Profiles:** Candidate creation processes check duplicate records and merge them without deleting previous data.
- [x] **Semantic Search & Reverse Match:** Vector embeddings generated via Voyage AI, with reverse-matching triggered on job publication to score and rank candidates with breakdown analytics (skills, experience, title, etc.).
- [x] **CRM Candidate Audit Trail:** Interactive timelines (`getCandidateTimeline`) and AI Call Outcome metrics are rendered dynamically on the candidate's detailed profile view.
- [x] **WhatChimp WhatsApp Integration:** Integrated both incoming webhook receiver (`/api/whatsapp-whatchimp`) and outbound API sender (`sendWhatsApp` via WhatChimp REST API).

### B. In Progress / Needs Connection (The Demo Gaps)
- [/] **Outbound Voice Integration (ElevenLabs & Twilio):** outbound webhook endpoint `/api/elevenlabs/save-intake` configured to bypass HMAC checks for the mock bridge, but needs end-to-end webhook validation with active test numbers.
- [ ] **Needs Attention Dashboard Feed (`src/components/dashboard/NeedsAttentionTable.tsx`):**
  * *Current State:* Uses a static `const data: any[] = [];` array, leaving the table empty or locked on "All caught up".
  * *Action Required:* Write a Convex query (e.g., `api.applications.applications.getNeedsAttention`) that queries active applications (`isActive === true`, not in `placed` or `rejected` stages) and calculates those exceeding stage SLAs.
- [ ] **Team Activity Dashboard Feed (`src/components/dashboard/TeamActivityFeed.tsx`):**
  * *Current State:* Contains a hardcoded list of static mock activities.
  * *Action Required:* Write a Convex query (e.g., `api.stats.stats.getRecentActivities`) to fetch the top 10-15 newest records from the `pipelineEvents` table, and map those into the feed.

---

## 3. Production Upgrade Requirements (Moving to Staging/Production)

To migrate from the free developer setup to a production-ready environment, the following three components must be upgraded to paid/dedicated plans:

| System Component | Current Free/Developer Tier | Production Paid Upgrade | Rationale for Upgrade |
|---|---|---|---|
| **Convex Backend** | Free Sandbox Tier | **Professional / Scale Plan** | Upgrades file storage limits for parsed PDF/DOCX CVs (past 5GB) and allows automated daily database backup cycles. |
| **AI Inference APIs** | Trial Credits (NVIDIA NIM & Voyage AI) | **Paid API accounts / custom VPC host** | Trial credentials expire and have strict rate limits (RPM/TPM) that will choke bulk CV parsing and embeddings. |
| **Voice AI & Messaging** | Twilio Trial & ElevenLabs developer tiers | **Upgraded, funded developer accounts** | Twilio trial numbers prepend messages and restrict outgoing numbers. ElevenLabs requires subscription plans to scale outbound caller capacity. |

---

## 4. End-to-End Demo Script & Verification Flow

Once the mock feeds in **Section 2B** are connected, use this script to demonstrate all system functionality during the demo:

### Step 1: Create a Job
1. Go to the "Create Job" form in the UI.
2. Fill out a job post with a unique code/keyword (e.g. `DEVOPS26`) and set required skills.
3. Verify that the job immediately appears on the Jobs list dashboard.

### Step 2: Multi-Channel Ingestion & Parsing
1. **Manual Ingestion:** Upload a sample resume PDF using the upload portal under the newly created job.
2. **WhatsApp Ingestion:** Send a WhatsApp message to the registered WhatChimp number containing the keyword `DEVOPS26` and an attached CV document.
3. **Verify:** Check the Ingestion Monitor page to ensure the batch progress logger reports "parsing" -> "indexing" -> "completed".

### Step 3: CRM Profile Creation & Deduplication
1. Open the Candidate database view. Ensure the uploaded candidate is listed.
2. Click on the candidate's name to trigger **Lazy CV Parsing**.
3. **Verify:** The profile must update with fully extracted skills, years of experience, job history timeline, notice period, and education details.
4. **Deduplication Check:** Upload the same resume file again or under a duplicate candidate email. Ensure the system runs deduplication checks and merges the data.

### Step 4: Semantic Matching
1. Go to Candidate Search.
2. Type a natural language query describing the requirements of the job (e.g., "Docker, Kubernetes, AWS specialist").
3. **Verify:** Ensure the candidate ranks high with a match score reflecting their matched/missing skills.

### Step 5: Recruitment Pipeline Transitions
1. Open the Job Details Pipeline view for `DEVOPS26`.
2. Locate the candidate in the "New CVs" column.
3. Click **Shortlist**. Verify that they transition to the "TA Shortlist" column, and that a corresponding record is added to the Team Activity Feed on the dashboard.
4. Click **Trigger Call** on the candidate. Ensure an outbound ElevenLabs interview call schedules or places a simulated call.

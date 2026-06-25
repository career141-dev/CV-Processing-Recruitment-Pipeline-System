# Career141 vs. Hercules: System Integration Analysis & Next Steps

This document provides a comprehensive analysis comparing your personal project (Career141) with the Hercules project (70% completed), alongside a detailed project state review and action plan for your development session tomorrow.

---

## 1. System Integration Analysis (Career141 vs Hercules)

After analyzing both codebases, Hercules contains several advanced structures and UI improvements that should be adapted into Career141 to achieve the "next level" upgrade:

### A. Code Structures & Data Models to Adapt
*   **Candidate Master Profile & CV Separation:** Hercules correctly separates the `candidates` table (the master profile) from the `cvs` table (individual historical uploads). Career141 currently has a simpler approach where `cvUploads` are loosely tied to candidates. Adopting Hercules' `resolveCandidate` flow is critical for deduplication.
*   **5-Factor Deduplication Engine:** Hercules uses a robust 5-factor check (File Hash, Email, Phone, LinkedIn, and **Fuzzy Name Matching**) to detect duplicates and near-matches. Career141 only uses a 4-factor exact match.
*   **Routing & Reverse Matching:** Hercules has dedicated `routing.ts` and `reverseMatch.ts` logic to automatically match incoming CVs to jobs based on keywords and scores.

### B. UI Improvements to Adapt
*   **Component Library:** Hercules uses Radix UI and Tailwind for highly accessible, modular components (e.g., Dialogs, Tabs, Selects). Career141 should adopt these modular components to replace static HTML/Tailwind blocks, especially for the complex Job Pipeline view.
*   **Data Fetching:** Hercules seamlessly integrates Convex queries with UI states. Career141's Job Pipeline is currently blocked by hardcoded `MOCK_DATA`.

---

## 2. Current Progress: What is Completed Now?

Based on the Career141 codebase and the active milestones:
*   **Database & Convex Schema:** Core schema (`jobs`, `candidates`, `cvUploads`, `applications`, `users`) is active.
*   **Manual CV Uploads:** Generating upload URLs and saving uploads via the UI works.
*   **CV Parsing & Extraction:** Backend logic to extract text via LLMs and create Candidate profiles is functional.
*   **Candidate Database UI:** The UI for listing candidates and Advanced Search is connected.
*   **Job Creation Workflow:** The 4-step wizard successfully creates jobs in the database.
*   **WhatsApp Processing (Hercules):** The logic for WhatsApp parsing is completed and ready to be integrated.

---

## 3. UI Parts to Implement Tomorrow

Your immediate priority is hooking up the backend to the frontend for the core recruitment flow.

*   **🔴 Jobs List Dashboard (`src/app/dashboard/jobs/page.tsx`):** 
    *   Currently uses a hardcoded `MOCK_JOBS` array.
    *   **Implement:** Replace with `useQuery(api.jobs.list)` to map real database jobs to the grid.
*   **🔴 Job Details & 11-Stage Pipeline (`src/app/dashboard/jobs/[jobId]/page.tsx`):**
    *   Currently uses `MOCK_DATA` for all pipeline tabs (New CVs, TA Shortlist, etc.).
    *   **Implement:** Create queries to fetch `applications` for the specific `jobId`, joined with `candidates` data, and render them in the correct tabs based on their `currentStage`.
*   **Pipeline Action Buttons:** Implement the `onClick` handlers for "Shortlist", "Reject", and "Trigger Call" to fire Convex mutations that update the candidate's stage.

---

## 4. Configured But Not Connected to the UI

*   **External CV Ingestion (WhatsApp/Email):** The logic to process a received CV is built, but the HTTP API routes (`convex/http.ts`) to receive the webhooks from Twilio/Meta and SendGrid are not fully exposed/connected to the UI for monitoring.
*   **Pipeline Stage Transitions:** The database has an `applications` table that tracks `currentStage`, but the UI buttons are dead and do not trigger the transition mutations.

---

## 5. Connected to the UI But Not Properly Working

*   **The Job Pipeline View:** The UI renders beautifully, but because it relies on mock data, moving a candidate between stages, seeing real match scores, and viewing actual CV sources does not reflect reality. 
*   **Reverse Match on Job Publish:** The logic exists in the backend, but the UI doesn't visually alert the TA with the generated shortlist when a job is published.

---

## 6. End-to-End Verification Plan (How to Check the Core Flow)

To ensure the entire ingestion-to-pipeline flow works perfectly before adding AI Automation (Calls/Emails), run this exact checklist:

### Step 1: Job Creation
1. Go to the "Create Job" wizard.
2. Create a test job with a specific Keyword (e.g., `TEST24`).
3. **Verify:** Check the Convex dashboard to ensure the job exists in the `jobs` table.

### Step 2: Multi-Source Ingestion & Parsing
1. Upload a sample CV via the Manual Upload UI for the test job.
2. Send a sample CV via WhatsApp (using the test job keyword).
3. **Verify in Convex Dashboard:**
    *   `cvUploads` / `cvs`: Check that the raw file is saved and `storageId` exists.
    *   `candidates`: Check that a profile was created with parsed skills, experience, and contact info.
    *   `applications`: Check that a record links the new Candidate ID to the Test Job ID, with `currentStage` set to "New CVs".

### Step 3: Search & Matching
1. Go to Candidate Search.
2. Search for a skill you know is in the uploaded CV.
3. **Verify:** Ensure the candidate appears with a high AI match score.

### Step 4: Pipeline Flow
1. Open the Test Job in the Jobs Dashboard.
2. **Verify:** The candidate should appear in the "New CVs" tab (pulled from real DB data, not mock data).
3. Click "Shortlist".
4. **Verify:** The candidate disappears from "New CVs" and appears in "TA Shortlist". Check the `applications` table in Convex to ensure `currentStage` updated.

---

**Next Steps for Tomorrow:**
Focus entirely on **Section 3** (replacing MOCK_DATA in the pipeline) and **Section 6** (running the End-to-End verification). Do not start Phase 5 (AI Agents/Automation) until a CV can organically flow from upload to the "TA Shortlist" tab in the UI.

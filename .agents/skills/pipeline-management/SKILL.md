---
name: pipeline-management
description: Recruitment pipeline management for Career141. Use when implementing or debugging the 11-stage Kanban pipeline, stage transitions, SLA tracking, cross-pipeline candidate updates, placement logic, or the pipeline health agent (Agent 8). Covers the candidateJobs join table and pipeline record fields.
---

# Pipeline Management Skill

Career141 manages candidates through a 13-stage recruitment pipeline per job. Pipeline records live in the `applications` table.

---

## 1. The 13 Pipeline Stages

| Stage | Code Key | Behavior |
|---|---|---|
| 1 | **New CVs** | `new_cvs` | Ingestion entry stage for raw uploads. |
| 2 | **Matched Candidates** | `matched_candidates` | Candidates matched by AI database searches. |
| 3 | **TA Shortlist** | `ta_shortlist` | TA confirms basic match. Auto-routes directly to `follow_up`. |
| 4 | **AI Call** | `ai_call` | Outbound ElevenLabs AI intake call stage. |
| 5 | **Follow-Up** | `follow_up` | Outreach sequence (WhatsApp + Email) captures missing details. |
| 6 | **2nd Shortlist** | `second_shortlist` | Profile completed stage. Requires all 4 follow-up data points. |
| 7 | **Director Shortlist** | `director_shortlist` | Undergoing senior director sign-off review. |
| 8 | **Client Review** | `client_review` | Presented to the client contacts for review. |
| 9 | **Interview** | `interview` | Undergoing client interview stages. |
| 10 | **Offer** | `offer` | Offer letter extended to candidate. |
| 11 | **Placed** | `placed` | Placement invoice generated and candidate hired. |
| 12 | **Rejected** | `rejected` | Application rejected at any stage (rejection reason recorded). |
| 13 | **Unresponsive** | `unresponsive` | Candidate failed to complete follow-up within 7 days. |

---

## 2. Stage Transition Rules & Validations

1. **2nd Shortlist Validation Gate**:
   - Transitioning an application to `second_shortlist` requires that all 4 follow-up data items (**CV, Current Salary, Expected Salary, and Notice Period**) are present in the candidate profile or application flags.
   - Forcing a transition without these details throws an error.
2. **Role-Based Guards**:
   - **Recruiter**: Assigned primary/supporting recruiters can shortlist, move stages, add notes, and log details.
   - **Director**: Only Admins or the assigned Director can trigger approvals ([directorApprove](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/pipeline/stages.ts#L65)), rejections ([directorReject](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/pipeline/stages.ts#L164)), or request changes ([directorRequestChanges](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/pipeline/stages.ts#L208)).
   - **Client**: Assigned Client contacts can select candidates for interviews, put them on hold, or reject them.

---

## 3. Global Candidate Status Synchronization

Whenever a stage changes on an application, the system triggers `syncCandidateOverallStatus`.
- Computes the highest prioritised application stage across all jobs the candidate applied to.
- Priorities: `placed` > `offer` > `interview` > `client_review` > `director_shortlist` > `second_shortlist` > `follow_up` > `unresponsive` > `ai_call` > `ta_shortlist` / `matched_candidates` > `new_cvs` > `rejected`.
- Saves this highest stage under the candidate's `overallStatus` field to update search and dashboards.

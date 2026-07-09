---
name: candidate-deduplication
description: Candidate deduplication engine for Career141 (Agent 6). Use when implementing or debugging dedup logic — exact match, fuzzy name matching, profile merging, CV version history, or the merge audit log. Runs after every CV parse.
---

# Candidate Deduplication Skill (Agent 6)

Candidate deduplication runs inline inside the [createCandidate](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/candidates/candidates.ts#L144) mutation. It determines whether an incoming candidate already exists in the database before storing the profile.

## 4-Factor Deduplication Check

The system checks for matches across the following four indices in the `candidates` table. It stops at the first matched record:

1. **`fileHash` Match**: Checks index `by_fileHash` for the SHA-256 hash of the CV file.
2. **`email` Match**: Checks index `by_email` or filters candidates by the exact email address.
3. **`phone` Match**: Checks index `by_phone` or filters candidates by the exact phone number.
4. **`linkedinUrl` Match**: Checks index `by_linkedinUrl` or filters candidates by the exact LinkedIn URL.

## Overwrite Rules & Active Application Guard

To prevent new CV uploads from contaminating or altering candidate details during active recruitment, the system enforces the following stage checks:

- **Candidate Exists & In Active Pipeline**: If a candidate is matched but their active applications are in stages *other than* `follow_up` or the 7-day auto-rejected window, **overwriting is skipped**. The existing candidate ID is returned, and the new profile upload is ignored.
- **Candidate Exists & In Follow-Up / Auto-Rejected**: If the candidate's application is actively in `follow_up` or was auto-rejected due to missing details, the profile fields are updated with the newly extracted parsing data. The application's follow-up flags (`followUpCvReceived`, `followUpCurrentSalary`, etc.) are updated and verified via `checkAndAdvanceFollowUp` to see if the candidate can advance to the `second_shortlist` stage.
- **No Match Found**: A new candidate record is created and inserted into the `candidates` database with the parsed CV data.

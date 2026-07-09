---
name: cv-parsing
description: AI-driven CV parsing for Career141. Use when implementing or debugging the CV parsing pipeline — prompt design, field extraction, lazy parsing trigger, two-pass storage, confidence scoring, or retry logic. Covers Claude API integration, the 16-field Tier 1 prompt, serial queue, and the isParsed flag.
---

# CV Parsing Skill (Agent 1)

The parsing engine reads raw CV text, extracts structured candidate details using the NVIDIA NIM API, runs data derivations, and schedules scoring.

---

## 1. Core Principles

1. **Immediate Parsing**: CV parsing runs asynchronously immediately upon file ingestion, not lazily on user view.
2. **Double-Pass Details Extraction**:
   - **First Pass (LLM-Extracted)**: Extracts fields verbatim from CV text using `meta/llama-3.1-70b-instruct`.
   - **Second Pass (Calculated Derivations)**: Derives structured parameters (notice period days, seniority, experience years, education fields, and current employer/title role) via deterministic code rules.
3. **No Placeholders**: Absent fields are set to `null` or `undefined`.
4. **4-Factor Deduplication**: The candidate creation mutation checks for duplicate files or contact details and merges details if the candidate is in follow-up.

---

## 2. Text Extraction Heuristics

The file text is extracted based on its MIME type/extension:
- **PDF**: Uses `pdfjs-dist` to read page contents. It implements a **layout position sort** (sorting text items by Y coordinate descending, then X coordinate ascending) to preserve column read order. It also attempts to extract and store the candidate's profile photo.
- **DOCX / DOC**: Extracted via `mammoth`.
- **Images (PNG, JPG, JPEG)**: Scanned files undergo OCR using `tesseract.js`.
- **RTF / TXT**: Decoded via string manipulation or UTF-8 decoders.

---

## 3. NVIDIA NIM Prompt Extraction

Extracts the fields using a structured system prompt and JSON schema format:
```ts
// convex/cvs/cvExtraction.ts -> callNvidiaLLM
```
It submits the cleaned text up to 15,000 characters to `meta/llama-3.1-70b-instruct` to extract:
`fullName`, `email`, `phone`, `location`, `linkedinUrl`, `currentTitle`, `currentEmployer`, `seniorityLevel`, `industries`, `sector`, `skills` (objects with value and confidence), `education` (degree, institution, year, field), `certifications`, `languages`, `summary`, and `jobHistory` (company, title, dates, description, confidence).

---

## 4. Calculated Derivations

The extracted fields are formatted via deterministic calculations in [convex/candidates/derivations.ts](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/candidates/derivations.ts):
- **Notice Period Days**: Matches regex patterns in string (e.g. "immediate" -> 0, "1 month" -> 30).
- **Total Experience Years**: Sums elapsed durations of all roles inside `jobHistory`.
- **Seniority Level**: Inferred from experience years and title keywords (e.g. CEO/CTO/VP -> executive).
- **Education Fields**: Extracts the highest degree, institution, and graduation year.
- **Current Role**: Extracts the current employer and current title from the most recent active job listing.

---

## 5. Post-Parsing Actions

1. **Candidate Storage & Dedup**: Mutates the DB via `createCandidate`. If a candidate exists and is in follow-up, it updates their profile and checks follow-up status. If they are in another active stage, it skips overwriting.
2. **Job Application Creation**: If the upload is assigned to a job, inserts a record into the `applications` table in the `new_cvs` stage.
3. **AI Match Scoring**: Asynchronously schedules scoring:
   ```ts
   await ctx.scheduler.runAfter(0, api.cvs.cvScoringActions.processCvScoring, { candidateId, jobId });
   ```

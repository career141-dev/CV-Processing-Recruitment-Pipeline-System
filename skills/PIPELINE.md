# Career141 — Pipeline Stages
**13-Stage CV Processing Pipeline**

Every CV that enters Career141 passes through the same 13 stages regardless of source channel. Stages 1–7 are fully automated. Human decision-making begins at Stage 11.

---

## Stage 1 — CV Sources (7 Ingestion Channels)

| Channel | How It Works | Source Tag |
|---|---|---|
| LinkedIn (Unified Email) | Easy Apply, External, Lead Gen Forms, Headhunting → all route to `linkedin@career141.com`; job keyword in subject line | `LinkedIn` |
| WhatsApp (Job-Specific) | Candidates send CV as file to a dedicated phone number per job | `WhatsApp` |
| Meta Campaign | Shared WhatsApp line driven by paid Facebook/Instagram ads; keyword detection identifies job | `Meta` |
| Email Campaign | Dedicated inbox per job (e.g. `fin2024@career141.com`) | `Email` |
| Workable ATS | Webhook sync when new application received in Workable | `Workable` |
| Manual / Bulk Upload | TA uploads 1 to 600+ CVs directly, selects target job | `Manual` |
| Headhunting | TA-sourced passive candidates added manually | `Headhunting` |

**Rule:** Candidates are only routed into a job pipeline if that job is **Active**. CVs are always stored even if job is On Hold / Filled / Cancelled.

---

## Stage 2 — Keyword / Job ID Routing Setup

Before a job can receive CVs:
- A unique job keyword is assigned at creation (e.g. `FIN2024`, `ENGSR`)
- A shared LinkedIn intake email is configured (`linkedin@career141.com`)
- Dedicated email inbox created per Email Campaign job
- Dedicated WhatsApp number assigned per job (where applicable)
- Routing rules map all identifiers to the correct job record in the database

**Why this matters:** Without routing setup, the system cannot distinguish which job a CV belongs to. The keyword is the address label on every incoming CV.

---

## Stage 3 — Channel Routing Agents

Automated bots watch each channel continuously. When a CV arrives, the routing agent extracts it, identifies the job keyword or inbox address, and pushes the CV — fully tagged — to the API Gateway.

| Agent | Channel Monitored | Routing Method |
|---|---|---|
| LinkedIn Email Monitor | LinkedIn shared inbox | Reads subject line for job keyword |
| Agent 4 (WhatsApp Bot) | Job WhatsApp numbers | Identifies job from phone number |
| Agent 7 (Email Monitor) | Job campaign inboxes | Routes by inbox address |
| Meta/WhatsApp Router | Campaign WhatsApp | Keyword detection in conversation |
| Workable Webhook Listener | Workable ATS | Maps Workable job ID to C141 job ID |
| Manual Upload Processor | Direct platform upload | Job ID selected by TA at upload time |

---

## Stage 4 — Central Ingestion via AWS API Gateway

All CVs from all channels converge at one point.

**Process:**
1. AWS API Gateway receives POST request with CV file and metadata
2. Request is authenticated (API key / token check)
3. Payload validated — CV file present, job ID attached, source tagged
4. Node.js Express receives validated request and applies routing logic
5. A unique record ID is generated for the submission

---

## Stage 5 — Storage Architecture (Two-Tier System)

On arrival, every CV is simultaneously stored and checked for duplicates.

**SHA-256 Hash Check:**
- Every CV file is fingerprinted on arrival
- Exact duplicates caught BEFORE any AI processing
- If duplicate: existing record updated with new source tag; no new record created
- If new: written to Convex DB (hot storage)

**Storage Tiers:**
| Tier | System | Duration | Access Speed |
|---|---|---|---|
| Hot | Convex DB | 30 days from last activity | Real-time |
| Cold | MinIO (S3-compatible) | Indefinite | Transparent (via `isArchivedLocally` flag) |

**Rule:** Recruiters never notice the storage tier — archived records are fetched from MinIO transparently.

---

## Stage 6 — Lazy CV Parsing & AI Extraction (Agent 1)

**Trigger:** First recruiter access to a candidate profile — NOT at ingestion.

**Why lazy?** For bulk uploads of 600+ CVs, only a fraction will actually be viewed. Parsing on-demand significantly reduces AI compute costs.

**What is extracted (13+ fields):**
- Full Name
- Email Address
- Phone Number
- Current Location
- Job Title
- Current Employer
- Years of Experience
- Skills (full list, normalised)
- Education (Degree / Institution / Year)
- Languages
- LinkedIn URL
- Expected Salary (if mentioned)
- Notice Period / Availability
- Certifications

**Confidence Scoring:**
- Every field receives a confidence score from 0.0 to 1.0
- Fields below threshold are flagged for human review
- Prevents silent errors in the candidate database

**Skill Normalisation Examples:**
- `JS` → `JavaScript`
- `ML` → `Machine Learning`
- `k8s` → `Kubernetes`

**Current Model:** OpenRouter Nemotron 30B at `temperature=0` (deterministic outputs)  
**Recommended Upgrade:** Claude Sonnet 4.6 or Claude Opus 4.7

---

## Stage 7 — Deduplication & Profile Creation (Agent 6)

**Trigger:** After AI extraction completes for a new CV.

**4-Factor Duplicate Detection:**
1. Exact email match
2. Exact phone match
3. LinkedIn URL match
4. Fuzzy name match

**If Duplicate Found:**
- Profiles are merged
- New application added as event on existing profile
- Both CVs retained in history
- Profile marked as "Updated" with new date
- Previous job applications and communication history preserved

**If New Candidate:**
- Complete profile created with all extracted and validated fields
- Vector embeddings generated from full profile text
- Candidate goes LIVE and becomes searchable across the 115,000+ database

---

## Stage 8 — Job Dashboard (Source-Categorised View)

Candidates appear in recruiter dashboards organised by job opening and source channel.

**Dashboard Features:**
- All active jobs listed
- Shortlisted candidates grouped into tabs by source channel
- AI match score (0–100) for every candidate against the role
- Candidates sorted by match score by default (highest first)
- Visual indicators for candidates with low-confidence parsed fields

**AI Match Score Factors:**
- Skills overlap
- Years of experience
- Job title relevance
- Industry background
- Location match

---

## Stage 9 — CV Search / Semantic Search (Agent 2)

Freeform semantic search across all 115,000+ candidate profiles.

**Search Modes:**
| Mode | How It Works |
|---|---|
| Semantic | Natural language query converted to vector embedding; matches by meaning |
| Keyword/Filter | Hard criteria filtering — location, experience, skills, languages, availability |
| Hybrid | Combines both for best precision + recall |

**Score Scale:**
| Score | Meaning |
|---|---|
| 100 | Perfect match |
| 75–99 | Strong match |
| 50–74 | Moderate match |
| 0–49 | Weak match |

---

## Stage 10 — AI Proactive Outreach (Agent 3 & Agent 5)

The system reaches out to both new applicants AND historical database candidates.

**Agent 3 — Email Follow-Up Sequence:**
- Day 2: Initial outreach email
- Day 4: Follow-up if no response
- Day 7: Final follow-up
- Sequence STOPS immediately on reply, opt-out, or pipeline progression

**Agent 5 — AI Phone Calls:**
- Calls both new applicants and matched database candidates
- IVR: Press 1 = Interested → flagged for TA follow-up, added to headhunting pipeline
- IVR: Press 2 = Not Interested → marked for this role; stays in DB for future roles
- No answer / voicemail → logged; Agent 3 email sequence may activate

All outreach events, responses, and outcomes logged to candidate profile.

---

## Stage 11 — Recruiter Shortlist & Multi-Level Review

Three sequential review levels. Each level has its own tab, with candidates sub-tabbed by source channel.

**Level 1 — TA Recruiter Tab:**
- Reviews all AI-ranked candidates
- Selects shortlist
- Adds personal notes
- Records rejection reasons

**Level 2 — Director Tab:**
- Reviews TA's approved shortlist
- Can approve (pass to client), request changes, or reject (with logged feedback)

**Level 3 — Client Tab:**
- Reviews director-approved shortlist
- Marks each candidate: **Selected** / **Hold** / **Rejected**

Only "Selected for Interview" candidates proceed to Stage 12.  
All decisions and timestamps recorded in full audit trail.

---

## Stage 12 — Interview → Offer → Placement

**Process:**
1. Client schedules interview; system logs date/time
2. Post-interview: client submits structured feedback (rating + comments)
3. Offer extended: salary, start date, terms recorded; status → "Offer Extended"
4. Accept: status → "Placed"; placement recorded for billing/reporting
5. Reject/Withdraw: status → "Available"; candidate remains searchable

---

## Stage 13 — Candidate Profile & Complete History

Every candidate has a permanent, comprehensive profile. Profiles are NEVER deleted.

**Profile Contains:**
- All CV versions ever submitted (with date and source channel)
- Every stage reached, with timestamps and decision-maker identity
- All communications: emails, WhatsApp, phone call outcomes, automated follow-ups
- Match scores for every job ever considered
- Interview feedback and placement history
- Low-confidence AI extraction flags for human-verified fields

**Why permanent?** A candidate rejected today may be the perfect fit 12 months later. The 115,000+ database grows in value with every passing month.

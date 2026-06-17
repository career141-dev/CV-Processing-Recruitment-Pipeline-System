# Career141 — AI Agents Reference
**8 Specialised AI Agents**

---

## Agent Overview Table

| # | Agent Name | Trigger | Key Function |
|---|---|---|---|
| 1 | CV Parsing Agent | On first profile view (lazy) | Extracts 13+ structured fields from raw CVs with confidence scoring |
| 2 | Matching Agent | On job open / search | Scans 115k+ candidates, ranks and scores 0–100 against job requirements |
| 3 | Follow-Up Agent | On outreach initiation | Day 2/4/7 email sequence to engage unresponsive candidates |
| 4 | WhatsApp Monitor | Continuous (24/7) | Watches job WhatsApp numbers, detects CV attachments, routes to pipeline |
| 5 | AI Phone Call Agent | On proactive outreach | Calls candidates; captures interest via IVR (Press 1/2), routes to TA |
| 6 | Deduplication Agent | On new CV submission | 4-factor dedup (email/phone/LinkedIn/fuzzy name), profile merge/creation |
| 7 | Email Monitor Agent | Continuous (live) | Watches LinkedIn inbox + job campaign inboxes; routes CVs |
| 8 | Pipeline Health Agent | Daily scheduled scan | Flags stalled jobs, nudges staff, generates health report |

---

## Agent 1 — CV Parsing Agent

**Trigger:** First recruiter access to a candidate profile (lazy trigger — fires on view, NOT on ingestion)

**Inputs:**
- Raw CV file (PDF or Word)
- Extracted plain text from file

**Process:**
1. Receives raw CV file and extracts plain text
2. Sends extracted text to AI language model with structured extraction prompt
3. Extracts 13+ fields (see below)
4. Assigns confidence score (0.0–1.0) to every extracted field
5. Flags fields below confidence threshold for human review
6. Applies skill normalisation

**Fields Extracted:**
| Field | Notes |
|---|---|
| Name | Full name |
| Email | Primary email address |
| Phone | Primary phone number |
| Location | Current city/country |
| Job Title | Current or most recent title |
| Employer | Current or most recent employer |
| Experience | Years of experience (calculated from job history) |
| Skills | Full list, normalised |
| Education — Degree | Highest degree obtained |
| Education — Institution | University/college name |
| Education — Year | Graduation year |
| Languages | All spoken languages |
| LinkedIn URL | If present in CV |

**Skill Normalisation Examples:**
- `JS` → `JavaScript`
- `ML` → `Machine Learning`
- `k8s` → `Kubernetes`
- `PM` → `Project Management`

**Configuration:**
- `temperature = 0` for deterministic, consistent extractions
- Current model: OpenRouter Nemotron 30B
- Recommended upgrade: Claude Sonnet 4.6 (best balance) or Claude Opus 4.7 (highest accuracy)

**Output:** Structured JSON candidate record with confidence scores per field

---

## Agent 2 — Matching Agent

**Trigger:** New job opened OR recruiter runs a search

**Inputs:**
- Job description text OR natural language search query
- 115,000+ candidate vector embeddings in database

**Process:**
1. Takes job description or search query as input
2. Converts query to vector embedding using configured embedding model
3. Performs semantic similarity search across all 115,000+ candidate embeddings
4. Retrieves top N candidates (e.g. top 200)
5. Calculates detailed match score (0–100) for each candidate
6. Delivers results to Job Dashboard (auto-scored) and CV Search (on-demand)

**Match Score Factors:**
| Factor | What It Evaluates |
|---|---|
| Skills overlap | Does candidate have required skills? |
| Experience relevance | Enough years? Right domains? |
| Job title similarity | Have they done similar work? |
| Industry background | Relevant sector experience? |
| Location fit | Willing to work in job location? |
| Seniority level | Is their level appropriate? |
| Semantic similarity | Conceptual match even without keyword overlap |

**Search Modes:**
- **Semantic:** Natural language query → vector comparison → concept-based results
- **Keyword/Filter:** Hard criteria — exact skills, location, experience years
- **Hybrid:** Combines both modes for best precision + recall

**Score Thresholds:**
| Score | Interpretation |
|---|---|
| 100 | Perfect match |
| 75–99 | Strong match |
| 50–74 | Moderate match |
| 0–49 | Weak match |

---

## Agent 3 — Follow-Up Agent

**Trigger:** Candidate identified for outreach OR manual trigger by TA

**Target Candidates:**
- New applicants who have not responded
- Database candidates matched to a role who have not responded

**Email Sequence:**
| Day | Action |
|---|---|
| Day 2 | Initial outreach email about the opportunity |
| Day 4 | Follow-up email if no response |
| Day 7 | Final follow-up email |
| Any day | STOP immediately if candidate replies, opts out, or progresses in pipeline |

**Personalisation:**
- Candidate name inserted into every message
- Role details personalised per email
- Company type / key role details included in Day 2 email

**Logging:**
- All send, delivery, and read events logged to candidate communication timeline
- Opt-out events permanently recorded

---

## Agent 4 — WhatsApp Monitor Agent

**Trigger:** Continuous — runs 24/7 in real time

**Monitors:** All active job-specific WhatsApp numbers simultaneously

**Process:**
1. Detects incoming messages
2. Scans for CV file attachments (PDF, Word)
3. Identifies the job from the WhatsApp number the message was sent to
4. Extracts CV file, attaches job ID and source tag `WhatsApp`, pushes to API Gateway
5. Captures candidate phone number and name from WhatsApp profile metadata

**Edge Case — Unknown Job:**
- If job cannot be determined: sends automated reply asking candidate to confirm the role

---

## Agent 5 — AI Phone Call Agent

**Trigger:** New applicants entering the pipeline AND existing database candidates matched to a role

**Two Target Groups:**
1. New applicants who have entered the pipeline via any ingestion channel
2. Existing database candidates identified as a strong match for a new role

**Call Flow:**
1. Initiates outbound call to candidate's phone number
2. Plays automated message: role name, company type, key role details
3. IVR prompt presented

**IVR Outcomes:**
| Response | Action |
|---|---|
| Press 1 (Interested) | Candidate flagged as "Interested — Awaiting TA Follow-Up"; added to headhunting pipeline; TA notified |
| Press 2 (Not Interested) | Marked "Not Interested — This Role"; sequence stops; candidate stays in DB for future roles |
| No answer / Voicemail | Logged as "No Answer"; Agent 3 email follow-up sequence may activate |

**Logging:** All call outcomes, timestamps, and recordings stored in candidate profile

---

## Agent 6 — Deduplication Agent

**Trigger:** Every new CV submission (runs AFTER initial SHA-256 hash check)

**Note:** SHA-256 catches identical files. Agent 6 catches near-duplicates — same person from two channels or slightly updated CV.

**4-Factor Duplicate Detection:**
1. Exact email match
2. Exact phone match
3. LinkedIn URL match
4. Fuzzy name match

**If Duplicate Confirmed:**
- Profiles merged
- New application added as event on existing profile
- Both CVs retained in history
- Previous job applications and communication history preserved

**If New Candidate:**
- Complete profile assembled from all extracted and validated fields
- Vector embeddings generated (enables semantic search)
- Profile written as live and searchable to database

---

## Agent 7 — Email Monitor Agent

**Trigger:** Continuous — runs live in real time

**Monitors Two Inbox Types Simultaneously:**

**1. LinkedIn Shared Inbox (`linkedin@career141.com`):**
- Reads email subject line for job keyword as routing signal
- Tags LinkedIn sub-channel from metadata (Easy Apply, External, Lead Gen, Headhunting)

**2. Job-Specific Campaign Inboxes (e.g. `fin2024@career141.com`):**
- Routes by inbox address; no keyword reading needed

**Process:**
1. Extracts CV attachment
2. Attaches job ID and source tag
3. Pushes to API Gateway
4. Captures candidate email address from sender field
5. Sends automated confirmation reply to candidate acknowledging receipt

**Edge Case Handling:**
- Multiple attachments in one email
- Forwarded emails
- Unusual email formats

---

## Agent 8 — Pipeline Health Agent

**Trigger:** Daily scheduled scan (e.g. 8:00 AM every morning)

**Scans:**
- All active jobs and current pipeline status
- SLA compliance across all pipeline stages

**What It Flags:**
| Flag | Condition |
|---|---|
| Stalled On Hold Jobs | Open longer than expected SLA without progression |
| Stuck Candidates | Candidate at a stage (e.g. Director Review) too long without decision |
| Low CV Activity | Jobs with no new CV activity in X days — possible sourcing issue |
| Parsing Failures | Sudden rise in AI extraction failure rates |
| CV Volume Drops | Sudden drop in incoming CVs across channels |

**Outputs:**
- Daily health report across all active roles
- Nudge notifications to responsible recruiter or director
- Pipeline metrics tracked over time: time-to-shortlist, time-to-client, time-to-placement

**Recommended Models:** GPT-5.5, Claude Opus 4.7, or Gemini 3.5 Flash

---

## Agent Model Recommendations Summary

| Agent | Recommended Model | Reason |
|---|---|---|
| Agent 1 — CV Parsing | Claude Sonnet 4.6 or Nemotron 30B | Balance of cost/quality; temperature=0 required |
| Agent 2 — Matching | Claude Sonnet 4.6 + Voyage-3-large embeddings | Best semantic search quality |
| Agent 3 — Follow-Up | Claude Haiku 4.5 or template-based | Simple personalisation; cost matters at volume |
| Agent 4 — WhatsApp Monitor | Rule-based / lightweight model | Routing logic; no heavy AI needed |
| Agent 5 — Phone Calls | Dedicated IVR system | Voice, not LLM |
| Agent 6 — Deduplication | BGE-M3 embeddings + Claude Sonnet 4.6 | Vector similarity + LLM edge case validation |
| Agent 7 — Email Monitor | Rule-based / lightweight model | Routing logic; keyword detection |
| Agent 8 — Pipeline Health | Claude Opus 4.7 or GPT-5.5 | Anomaly detection; complex reasoning |

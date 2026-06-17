# Career141 — Recruitment Intelligence Platform
### Complete System Architecture & Implementation Guide

---

## Table of Contents

1. [System Overview](#system-overview)
2. [How the System Works (Complete Flow)](#how-the-system-works)
3. [CV Ingestion Pipeline](#cv-ingestion-pipeline)
4. [Candidate Database & Profile Management](#candidate-database--profile-management)
5. [Advanced Candidate Search](#advanced-candidate-search)
6. [Recruitment Pipeline & Tracking](#recruitment-pipeline--tracking)
7. [Communication & Automation](#communication--automation)
8. [Team Collaboration](#team-collaboration)
9. [Analytics & Reporting](#analytics--reporting)
10. [Complete Feature List](#complete-feature-list)

---

## System Overview

Career141 is a **unified Recruitment Intelligence & Automation Platform** that centralizes all candidate management, job matching, and recruitment workflows in one system.

### Core Purpose

**Consolidate CVs from multiple sources → Extract & Process data → Enable TAs to find best candidates → Automate follow-ups → Track complete candidate lifecycle**

### Key Stakeholders

- **Talent Acquisition (TA) / Recruiters** — Search candidates, manage jobs, evaluate candidates, send messages, view analytics
- **Candidates** — Create profiles, upload CVs, receive messages, apply for jobs
- **Admin** — Manage users, configure roles, system settings
- **Team Members** — Collaborate on candidate evaluations and hiring decisions

---

## How the System Works (Complete Flow)

### Phase 1: CV Ingestion & Processing

#### 1.1 CVs Enter the System from Multiple Sources

Career141 automatically collects CVs from **all** these channels simultaneously:

| Source | How it works |
|---|---|
| **LinkedIn Job Applications** | Users apply for jobs posted on LinkedIn → CVs automatically pulled into Career141 |
| **Workable (ATS)** | Existing Workable integration → All new applications sync to Career141 |
| **Email Inbox** | CV attachments received in recruiter emails → Auto-detected and imported |
| **WhatsApp Messages** | Candidates send CVs via WhatsApp → System extracts attachments |
| **Campaign Tools** | Marketing campaigns with CV forms → Responses automatically imported |
| **Manual Uploads** | Recruiters upload CVs directly via the platform |

**Key point:** Every CV, regardless of source, enters ONE unified database. Nothing gets lost or duplicated.

#### 1.2 CV Storage (Raw & Processed)

When a CV arrives:

1. **Stored as raw file** — Original PDF/DOCX file kept intact in file storage (Cloudflare R2)
2. **CV status = "Unprocessed"** — System marks it for AI processing
3. **Source tracked** — System records where the CV came from (LinkedIn, WhatsApp, etc.)

#### 1.3 AI-Powered CV Parsing (Extraction)

All unprocessed CVs are automatically sent to the **AI Parsing Engine**:

**What the AI extracts:**

- Full name
- Email address
- Phone number
- Current location
- All skills listed (technical + soft)
- Years of experience (calculated from job history)
- Job history (companies, titles, employment periods)
- Education (degrees, universities, graduation years)
- Certifications (professional certs, licenses)
- LinkedIn URL (if found)
- Expected salary range (if mentioned)
- Notice period / availability

**How it works:**
- AI reads the CV text (handles PDF, DOCX, scanned documents)
- Extracts structured data from unstructured text
- Normalizes data (e.g., skill names, company names)
- Handles multiple languages
- Works even on poorly formatted CVs

#### 1.4 CV Status Updated to "Processed"

After AI parsing completes:

1. CV status changes from "Unprocessed" → "Processed"
2. Extracted data stored in candidate database
3. AI embeddings created for semantic search (vector database)
4. Search indexes updated (keyword + semantic)
5. CV is now **searchable** and **rankable** for jobs

---

### Phase 2: Candidate Profile Management

#### 2.1 Candidate Matching & Deduplication

When a new CV is processed, the system checks:

**Is this candidate already in the database?**

Check using:
- Email address
- Phone number
- Name similarity (fuzzy matching)
- LinkedIn URL

**If YES → Candidate Exists:**
- New CV added as a **new version** with timestamp
- Old CV kept in history
- Profile marked as **"Updated"** with new date
- Previous job applications retained
- Communication history preserved

**If NO → New Candidate:**
- Create new candidate profile
- Store first CV
- Assign unique candidate ID
- Initialize empty job history
- Ready for TAs to find and evaluate

#### 2.2 Complete Candidate Profile Structure

Each candidate profile contains:

| Section | What's included |
|---|---|
| **Personal Details** | Name, email, phone, location, LinkedIn URL |
| **Professional Info** | Current title, seniority level, years of experience |
| **Skills & Expertise** | All skills with proficiency levels, technology stack |
| **Education** | Degrees, universities, graduation years, certifications |
| **Experience History** | All previous companies, titles, employment dates, descriptions |
| **CV Versions** | Every CV ever uploaded, with date received and source |
| **Job Applications** | Every job this candidate has been considered for (with stage + date) |
| **Communication Log** | Complete history of emails, WhatsApp, SMS (when sent, content, response) |
| **Status & Notes** | Current status (new, shortlisted, rejected, placed), recruiter notes, decisions |
| **Source Tracking** | Where candidate came from (LinkedIn, email, Workable, etc.) |

---

### Phase 3: TA Job Creation & Search

#### 3.1 TA Creates a Job

Talent Acquisition Manager creates a new job:

**Job Details Entered:**
- Job title
- Job description (full details)
- Required skills (must-haves + nice-to-haves)
- Required experience (years, specific domains)
- Seniority level (Junior, Mid, Senior, Lead, Manager, Director)
- Location (country, city, or remote)
- Industry/sector
- Salary range (optional)
- Client/company name
- Assigned TAs/recruiters responsible for this job
- Job status (open, filled, closed)

**AI Job Parsing:**
- System automatically extracts key requirements from job description
- Creates job record in database
- Job ready for candidate searches

#### 3.2 TAs Search for Candidates Using Advanced Search

When a TA needs to find candidates, they have **multiple search methods** available simultaneously:

##### Method 1: AI Job Description Search

**How it works:**
1. TA pastes the full job description into the search box
2. AI reads the description and understands requirements
3. System searches entire candidate database (115,000+ CVs)
4. **AI scores every matching candidate from 0 to 100**
   - 100 = perfect match
   - 75-99 = strong match
   - 50-74 = moderate match
   - 0-49 = weak match
5. Results ranked by score (highest first)

**What the AI considers:**
- Skills match (does candidate have required skills?)
- Experience match (enough years? relevant domains?)
- Role similarity (have they done similar work?)
- Education match (required degree? certifications?)
- Location preference (willing to work in job location?)
- Seniority level alignment (is their level appropriate?)
- Semantic similarity (even without exact keyword matches)

##### Method 2: Advanced Filter Search

TAs can apply **precise filters** to narrow results:

**Standard Built-in Filters:**

| Filter | Options |
|---|---|
| **Skills** | Multi-select: React, Python, AWS, Java, Project Management, etc. |
| **Seniority Level** | Junior / Mid-level / Senior / Lead / Manager / Director / C-Level |
| **Years of Experience** | Slider: min 2 years, max 15 years (e.g., 5-8 years) |
| **Job Title / Role** | Search by specific titles: "Software Engineer", "Sales Manager", "Data Analyst" |
| **Industry / Sector** | IT, Finance, Healthcare, Retail, Manufacturing, etc. |
| **Location** | Country / City / Remote (e.g., London, UK or Remote) |
| **Education Level** | Diploma / Bachelor / Masters / PhD |
| **Certifications** | PMP, AWS Certified, CFA, Google Analytics, Salesforce, etc. |
| **Languages** | English, Spanish, French, German, Mandarin, etc. |
| **Notice Period** | Immediate / 1 week / 2 weeks / 1 month / 3 months |
| **Employment Status** | Employed / Unemployed / Freelance / Open to Opportunities |

**How to use:**
- Select any combination of filters
- System returns only candidates matching ALL selected criteria
- Results still ranked by AI match score
- Filters can be combined with job description search for best results

##### Method 3: Custom / Dynamic Filters (Key Feature)

**Problem:** Not all job requirements fit into predefined filters.

**Solution:** TAs can **add custom filters on the spot**:

**Examples of custom filters a TA might add:**

- **Specific tool version:** "Revit 2024" (not just "Revit")
- **Niche certification:** "ISO 27001 Lead Auditor" (company-specific, rare)
- **New technology:** "Rust programming language" (emerged after system was built)
- **Client requirement:** "Must have worked in a Big 4 consulting firm"
- **Language dialect:** "Native English speaker" or "Native Mandarin"
- **Specific company experience:** "Must have worked at a FAANG company"
- **Clearance requirement:** "UK Security Clearance (SC or higher)"
- **Domain expertise:** "Financial derivatives trading"

**How custom filters work:**
1. TA types the custom filter requirement
2. System searches candidate CVs for that exact text/phrase
3. Returns only candidates matching that criterion
4. Filter is **saved in the system** for future use
5. If same requirement comes up in future job searches, it's now a standard filter option
6. Filter library grows and improves over time

#### 3.3 Combining Search Methods

**Workflow:**

1. **Start with AI job description search** → Get initial ranked list (AI scores all candidates)
2. **Apply filters** → Narrow down to candidates with specific required skills, location, experience
3. **Add custom filters** → Eliminate anyone missing niche requirements (client demands, specific certifications)
4. **Review results** → Top candidates matching all criteria
5. **Select candidates** → Choose best fits, move to pipeline for evaluation

**Result:** TAs spend seconds finding perfect-fit candidates instead of hours scrolling through CVs.

---

### Phase 4: Candidate Evaluation & Shortlisting

#### 4.1 TA Evaluates Candidates

From search results, TA reviews:

- **Candidate profile** — Full details, experience, education
- **CV version(s)** — Read latest CV and compare with previous versions
- **Job match score** — AI-provided match percentage and explanation
- **Match explanation** — Why did AI rank this candidate high/low?

#### 4.2 TA Shortlists & Moves to Pipeline

Decisions TAs can make:

| Decision | Action |
|---|---|
| **Shortlist** | Move candidate to pipeline stage "Shortlisted" for this job |
| **Reject** | Mark as rejected with reason (e.g., "experience too junior", "location unavailable") |
| **Pending** | Keep for later review, don't reject yet |
| **Headhunt Later** | Save as potential candidate for future jobs |

#### 4.3 Multiple Job Tracking (Candidate History)

**Important:** A single candidate can be evaluated for **multiple jobs simultaneously**:

- Candidate was found for Job A → shortlisted
- Same candidate also found for Job B → shortlisted
- System tracks each job separately
- Candidate can progress at different stages for different jobs
- If placed in Job A, Job B status is marked "candidate unavailable"

**Example:**
```
Candidate: Sarah Chen
Job A (Senior React Dev) → Stage: Interviewed → Status: Active
Job B (Frontend Lead) → Stage: Shortlisted → Status: Active  
Job C (Tech Lead) → Stage: Rejected → Reason: "Insufficient seniority"
Job D (React Developer) → Stage: CV Requested → Status: Active
```

---

### Phase 5: Communication & Follow-ups (Automated)

#### 5.1 Send Initial Message to Candidates

When candidate is shortlisted, TA initiates contact:

**TA sends message via:**
- Email (using Microsoft 365 integration)
- WhatsApp (using Twilio)
- SMS (using Twilio)

**Message types:**
- **Job introduction** — "We have a role that matches your profile..."
- **Request CV** — "Could you send us your latest CV?"
- **Interview scheduling** — "We'd like to schedule an interview..."
- **Personalized pitch** — Custom message using candidate's name, skills, experience

#### 5.2 Automated Follow-up System

**This is critical:** If candidate doesn't respond, **follow-ups happen automatically**.

**Follow-up Schedule (Default, can be customized):**

| Timeline | Action |
|---|---|
| **Day 1** | TA sends initial message via preferred channel |
| **Day 2** | System auto-sends follow-up message (if no response) |
| **Day 4** | System auto-sends another reminder via different channel |
| **Day 7** | Final attempt via third channel |
| **After Day 7** | If still no response, mark as "unresponsive" |

**Follow-up continues until:**
- Candidate responds ✓ (move to next stage)
- Candidate rejects ✓ (mark as rejected)
- Job closes (stop follow-ups)
- TA manually stops follow-ups

**Channels used in follow-up sequence:**
- If first message was email → second is WhatsApp → third is SMS
- Avoids repetition, increases chance of response

#### 5.3 Communication Tracking

Every message sent is recorded:

- **What was sent** — Message content
- **When sent** — Timestamp
- **Via which channel** — Email / WhatsApp / SMS
- **Delivery status** — Sent / Delivered / Opened (if available)
- **Response received** — Yes/No, response content, when responded
- **Stored in CRM** — Visible in candidate history forever

---

### Phase 6: Candidate CRM & Complete History

#### 6.1 Single Source of Truth for Each Candidate

Every action related to a candidate is recorded:

**What's tracked:**

| Category | What's recorded |
|---|---|
| **Profile updates** | When candidate updated their info, what changed |
| **CV uploads** | Every CV version, upload date, source |
| **Job applications** | Every job considered, stage, date applied/found |
| **Messages sent** | All emails, WhatsApp, SMS (content, date, channel) |
| **Responses** | When candidate responded, what they said |
| **Status changes** | When moved between pipeline stages (who changed it, why) |
| **Notes** | Recruiter comments, feedback, reasons for decisions |
| **Interview records** | Interview notes, feedback from interviewers, scores |
| **Rejection reasons** | Why rejected (if applicable) |

#### 6.2 Candidate Status Across All Jobs

For each job candidate is in, the system tracks:

```
Job: Senior React Developer
├─ Current Stage: Interviewed
├─ Date Added: 2024-05-15
├─ Last Action: Interview held on 2024-06-01
├─ Notes: "Strong technical skills, needs to improve communication"
├─ Recruiter Assigned: Sarah Johnson
└─ Next Step: Waiting for feedback from hiring manager

Job: Frontend Lead
├─ Current Stage: Shortlisted
├─ Date Added: 2024-05-20
├─ Last Action: Sent job details on 2024-06-02
├─ Messages Sent: 2
├─ Awaiting: Candidate response
└─ Assigned To: Mike Chen
```

#### 6.3 Job Reapplication / Profile Updates

**Scenario:** A candidate applies for a different role

If candidate is already in database:
1. New application recognized
2. System merges with existing profile
3. New job added to their application history
4. Previous CV kept (now marked as "old")
5. New CV parsed and processed
6. Profile marked "updated" with latest info
7. All previous communication history retained
8. Can now be considered for multiple jobs simultaneously

---

### Phase 7: Team Collaboration

#### 7.1 Multiple TAs / Recruiters Working Together

System enables seamless collaboration:

**Features:**

| Feature | How it works |
|---|---|
| **Job ownership** | Multiple TAs can be assigned to same job |
| **Candidate assignment** | Different TA can manage candidate for different jobs |
| **Shared notes** | All TAs can see notes left by colleagues |
| **Activity log** | See who did what (contacted candidate, moved stage, rejected) |
| **Permission control** | Admin controls what each TA can see/do |
| **Feedback system** | Interviewers can share feedback, hiring managers can comment |

**Example workflow:**
```
Job: Senior Data Scientist

TA 1 (Sarah): Found 3 candidates via AI search
TA 2 (Mike): Contacted candidates, collected CVs
TA 3 (Lisa): Screened candidates, moved 2 to "shortlisted"
Hiring Manager (David): Reviewed shortlisted, requested interviews
TA 1 (Sarah): Scheduled interviews, gathered feedback
All: Added notes to candidate profiles
```

#### 7.2 Avoid Duplicate Outreach

System prevents double-contacting:

- If candidate already contacted by TA 1, system shows this to TA 2
- Prevents embarrassing duplicate messages to candidate
- Shows last contact date/time
- Shows previous communication history

---

### Phase 8: Analytics & Reporting

#### 8.1 Real-Time Dashboards

TAs and managers see live metrics:

**Recruitment Funnel:**

| Metric | Shows |
|---|---|
| **Total CVs received** | How many CVs in system this month |
| **CVs by source** | LinkedIn (30%), Email (25%), WhatsApp (20%), etc. |
| **Processing status** | How many still "unprocessed" vs "processed" |
| **Search activity** | How many candidates searched/shortlisted per job |

**Pipeline Metrics:**

| Stage | Count | Avg Days | Conversion Rate |
|---|---|---|---|
| New | 45 | — | — |
| Screening | 35 | 2 | 78% |
| Shortlisted | 15 | 3 | 43% |
| Contacted | 10 | 5 | 67% |
| CV Requested | 8 | 2 | 80% |
| CV Received | 7 | 1 | 100% |
| Submitted | 4 | 10 | 57% |
| Interviewed | 3 | 7 | 75% |
| Offered | 2 | 5 | 100% |
| Placed | 2 | — | — |

**Recruiter Performance:**

- Placements per recruiter
- Time-to-hire (average)
- Candidate-to-placement ratio
- Response rate to follow-ups

---

## CV Ingestion Pipeline

### Complete Data Flow

```
Multiple Sources (LinkedIn, Email, WhatsApp, Workable, Campaign forms)
            ↓
    CV Ingestion Layer
    - Receive file
    - Normalize format (PDF, DOCX, text)
    - Store raw file
            ↓
    CV Status: UNPROCESSED
            ↓
    AI Parsing Engine
    - Extract name, email, phone
    - Extract skills, experience
    - Extract education, certifications
    - Calculate years of experience
            ↓
    Candidate Database Check
    - Email match?
    - Phone match?
    - Name similarity match?
    - LinkedIn URL match?
            ↓
    DECISION POINT:
    
    Candidate exists → Add new CV version + Update profile
    Candidate new    → Create new profile + First CV
            ↓
    AI Embeddings Generation
    - Convert CV to vector format
    - Store in vector database
            ↓
    Search Index Update
    - Keyword index update
    - Semantic index update
            ↓
    CV Status: PROCESSED ✓
            ↓
    Ready for Search
```

### Processing Characteristics

- **Fully automatic** — No manual intervention needed
- **Handles duplicates** — Recognizes candidates applying multiple times
- **Preserves history** — All CV versions kept
- **Fast** — AI processing happens in seconds
- **Scalable** — Handles 1,000+ CVs per day
- **Multi-language** — Can parse CVs in multiple languages

---

## Candidate Database & Profile Management

### Profile Structure

```
Candidate ID: CAND-2024-00145
├─ Personal Information
│  ├─ Name: Sarah Chen
│  ├─ Email: sarah.chen@email.com
│  ├─ Phone: +44 7911 123456
│  ├─ Location: London, UK
│  └─ LinkedIn URL: linkedin.com/in/sarahchen
│
├─ Professional Profile
│  ├─ Current Title: Senior React Developer
│  ├─ Seniority Level: Senior
│  ├─ Years of Experience: 7 years
│  ├─ Industries: Technology, SaaS
│  └─ Skills: React, JavaScript, TypeScript, Node.js, AWS, PostgreSQL
│
├─ CV Versions
│  ├─ CV v3 (Latest) - Uploaded 2024-06-01 via LinkedIn
│  ├─ CV v2 - Uploaded 2024-03-15 via Email
│  └─ CV v1 - Uploaded 2024-01-20 via Manual Upload
│
├─ Job Applications
│  ├─ Job: Senior React Dev → Stage: Interviewed → Date: 2024-06-01
│  ├─ Job: Frontend Lead → Stage: Shortlisted → Date: 2024-05-20
│  └─ Job: React Developer → Stage: Rejected → Date: 2024-04-10
│
├─ Communication History
│  ├─ 2024-06-02 10:30 → Email sent: "Interview invitation"
│  ├─ 2024-06-02 14:15 → Email opened
│  ├─ 2024-06-02 16:45 → Reply received: "Confirmed interview"
│  ├─ 2024-06-01 09:00 → WhatsApp message sent: "Job details"
│  └─ (20+ more messages)
│
├─ Status & Notes
│  ├─ Current Status: Active (2 ongoing jobs)
│  ├─ Last Updated: 2024-06-02
│  ├─ Source: LinkedIn Job Application
│  └─ Recruiter Notes: "Excellent technical fit. Requires higher salary."
│
└─ AI Generated
   ├─ Overall Match Score: 8.2/10
   ├─ Resume Strength: Strong
   └─ Recommended for: Senior technical roles
```

### Automatic Profile Updates

**When a candidate applies again:**

1. Check if candidate exists (by email, phone, name, LinkedIn)
2. If YES:
   - Add new CV version (timestamp recorded)
   - Update profile fields with new information
   - Calculate updated experience
   - Re-generate AI embeddings
   - Preserve all communication history
   - Keep all job application history

3. If NO:
   - Create new candidate profile
   - Initialize with CV data
   - Ready for TAs to find

---

## Advanced Candidate Search

### Multi-Method Search System

Career141 provides **three complementary search methods** that work together:

#### Search Method 1: AI Job Description Search

**Use case:** TA has a new job opening, needs to find candidates fast.

**Process:**
1. TA pastes job description (or just job title + requirements)
2. AI reads and understands the requirements
3. System searches all 115,000+ candidate CVs
4. Scores every relevant candidate (0-100)
5. Returns ranked list

**Example:**
```
Job Description pasted: "We're looking for a Senior React Developer 
with 5+ years experience, knowledge of TypeScript, AWS, and PostgreSQL. 
Must have fintech or banking experience. Based in London or remote."

AI Analysis:
- Required skills: React, TypeScript, AWS, PostgreSQL
- Required experience: 5+ years, Senior level
- Required domain: Fintech/Banking
- Required location: London or Remote

Search Results (top 10):
1. Sarah Chen - Match: 95% - Senior React Dev, 7 yrs, all skills, fintech exp
2. James Smith - Match: 92% - Senior React Dev, 6 yrs, most skills, banking exp
3. Emily Brown - Match: 88% - Mid React Dev, 5 yrs, all skills, no fintech exp
...
```

#### Search Method 2: Advanced Filter Search

**Use case:** Need precise control, want only candidates with specific criteria.

**Process:**
1. TA selects filters from predefined list
2. System returns only candidates matching ALL filters
3. Results ranked by AI match score

**Example:**
```
Filters applied:
- Skill: React (required)
- Skill: PostgreSQL (required)
- Seniority: Senior
- Years of Experience: 5-10 years
- Location: London or Remote
- Industry: Banking

Results: 23 candidates
(Only candidates matching all 6 criteria shown)
```

#### Search Method 3: Custom Filter Search

**Use case:** Job has unusual requirement not in standard filters.

**Process:**
1. TA types custom filter (e.g., "Big 4 consulting experience")
2. System searches candidate CVs for that exact phrase
3. Returns matching candidates
4. Filter saved for future searches
5. Becomes standard filter option

**Example:**
```
Custom Filter: "PCI-DSS compliance knowledge"

System searches CVs for:
- "PCI-DSS"
- "PCI compliance"
- "payment security"
- "card payment"

Results: 8 candidates mention PCI-DSS in CVs
```

### Combined Search Workflow

**Best practice:**

1. Start with **AI job description search** → Get initial ranked shortlist
2. Apply **advanced filters** → Narrow to must-haves
3. Add **custom filters** → Eliminate those missing niche requirements
4. Review results → Top X candidates perfectly matched to job

**Time saved:** Instead of 2-3 hours of manual CV screening, find perfect candidates in 10-15 minutes.

---

## Recruitment Pipeline & Tracking

### 11-Stage Pipeline

```
STAGE 1: NEW
├─ Candidate just added to job
├─ Not yet reviewed by TA
└─ Trigger: None yet

STAGE 2: SCREENING
├─ TA reviewing candidate profile
├─ Checking initial fit
└─ Trigger: Auto-send "we're reviewing your application"

STAGE 3: SHORTLISTED
├─ TA determined this candidate fits job
├─ Worth pursuing
└─ Trigger: Send job details, request CV

STAGE 4: CONTACTED
├─ TA has reached out to candidate
├─ Initial message sent
└─ Trigger: Auto-follow-up if no response in 2 days

STAGE 5: CV REQUESTED
├─ TA asked for latest CV
├─ Waiting for candidate to send
└─ Trigger: Auto-reminder in 3 days

STAGE 6: CV RECEIVED
├─ Candidate sent CV
├─ Ready for review
└─ Trigger: Notify hiring manager, schedule interview

STAGE 7: SUBMITTED TO CLIENT
├─ CV sent to client/hiring company
├─ Awaiting client feedback
└─ Trigger: Auto-check status in 5 days

STAGE 8: INTERVIEWED
├─ Candidate interviewed
├─ Feedback collected
└─ Trigger: Send thank you, notify of next steps

STAGE 9: OFFERED
├─ Job offer made to candidate
├─ Awaiting acceptance
└─ Trigger: Follow up on offer status

STAGE 10: PLACED ✓
├─ Candidate accepted offer
├─ Joining the company
└─ Trigger: Celebrate, close job

STAGE 11: REJECTED ✗
├─ Candidate rejected or eliminated
├─ Reason recorded
└─ Trigger: Note reason for future reference
```

### Candidate Tracking Features

**For each job, system tracks:**

| Information | Details |
|---|---|
| **Current stage** | Where candidate is in pipeline |
| **Date added** | When candidate was added to this job |
| **Days in stage** | How long candidate has been in current stage |
| **Last action** | What happened most recently |
| **Next action** | What should happen next |
| **Assigned to** | Which TA is handling this |
| **Notes** | Why in this stage, any concerns, feedback |
| **History** | Complete movement through all stages |

**Example:**
```
Candidate: Sarah Chen
Job: Senior React Developer

Timeline:
├─ 2024-05-15 10:30 → Stage: NEW (Added via AI search)
├─ 2024-05-16 09:00 → Stage: SCREENING (TA reviewed)
├─ 2024-05-17 14:30 → Stage: SHORTLISTED (Good fit)
├─ 2024-05-18 11:00 → Stage: CONTACTED (Email sent)
├─ 2024-05-19 15:45 → Response: "Interested"
├─ 2024-05-20 10:00 → Stage: CV REQUESTED (Asked for latest CV)
├─ 2024-05-22 13:20 → Stage: CV RECEIVED (CV arrived)
├─ 2024-05-25 09:00 → Stage: SUBMITTED TO CLIENT
├─ 2024-06-01 10:00 → Stage: INTERVIEWED (Interview feedback: "Excellent")
├─ 2024-06-02 14:00 → Stage: OFFERED (Offer made: $95k)
└─ 2024-06-03 16:30 → Stage: PLACED ✓ (Accepted offer)

Days in pipeline: 19 days
Conversion: 100% (moved through all stages)
```

---

## Communication & Automation

### Multi-Channel Messaging

Career141 sends messages via multiple channels:

| Channel | When used | Features |
|---|---|---|
| **Email** | Professional communication, formal updates | Tracked opens, links, attachments |
| **WhatsApp** | Quick, personal touch, higher response rates | Delivery confirmation, typing indicators |
| **SMS** | Urgent reminders, phone numbers only | High read rate, fast response |

### Message Types

| Type | Example | When sent |
|---|---|---|
| **Job introduction** | "Hi Sarah, we have a Senior React role that matches your profile" | When shortlisted |
| **CV request** | "Could you send us your latest CV?" | When interested |
| **Interview invitation** | "We'd like to schedule an interview for next week" | After screening |
| **Update notification** | "Your application is being reviewed" | At stage changes |
| **Auto follow-up** | "Just checking - any questions about the role?" | Days 2, 4, 7 if no response |

### Automated Follow-up System

**This is automatic and requires NO manual action:**

```
Day 1:
├─ TA sends initial message via preferred channel
└─ Status: Awaiting response

Day 2:
├─ No response detected
├─ System auto-sends follow-up
├─ Uses different channel (if email first, try WhatsApp)
└─ Status: 1st follow-up sent

Day 4:
├─ Still no response
├─ System auto-sends another reminder
├─ Different channel again
└─ Status: 2nd follow-up sent

Day 7:
├─ Final attempt
├─ System auto-sends final message
├─ Different channel
└─ Status: Final reminder sent

After Day 7:
├─ No response
├─ Candidate marked "Unresponsive"
├─ Can manually follow up or move on
└─ Decision left to TA
```

**Follow-up continues until:**
- ✓ Candidate responds (move forward)
- ✓ Candidate rejects (mark rejected)
- ✓ TA stops follow-ups (moved to next stage)
- ✓ Job closes (all follow-ups stop)

### Communication Tracking & History

Every message recorded:

```
Candidate: Sarah Chen | Job: Senior React Dev

Communication Log:
├─ 2024-05-18 11:00
│  ├─ Channel: Email
│  ├─ Content: "Hi Sarah, we have a Senior React role..."
│  ├─ Status: Delivered & Opened
│  └─ Opened at: 2024-05-18 14:30
│
├─ 2024-05-18 14:45
│  ├─ Channel: Email Reply
│  ├─ Content: "Hi! Thanks for reaching out, I'm interested!"
│  └─ Received at: 2024-05-18 14:45
│
├─ 2024-05-20 10:00
│  ├─ Channel: Email
│  ├─ Content: "Great! Could you send us your latest CV?"
│  └─ Status: Delivered
│
├─ 2024-05-20 11:30
│  ├─ Channel: Email Reply (with attachment)
│  ├─ Content: "Here's my latest CV (attached)"
│  ├─ CV received
│  └─ Auto-processed: YES
│
├─ 2024-05-22 09:00
│  ├─ Channel: Email
│  ├─ Content: "Thanks for your CV! We'd like to schedule an interview..."
│  └─ Status: Delivered & Opened
│
└─ 2024-05-25 14:00
   ├─ Channel: WhatsApp
   ├─ Content: "Interview scheduled for June 1st at 10:00 AM"
   └─ Status: Delivered & Read
```

---

## Team Collaboration

### Job-Based Collaboration

**Multiple TAs working on same job:**

```
Job: Senior React Developer

├─ Project Owner: Lisa Chen (oversees entire hiring)
├─ Recruiter 1: Mike Johnson (sourcing & screening)
├─ Recruiter 2: Sarah Williams (interviews & offers)
├─ Hiring Manager: David Brown (technical interviews, decision)
└─ HR: Emma Davis (onboarding)

Workflow:
1. Mike finds candidates via search → Adds 5 candidates
2. Lisa screens candidates → Shortlists 3
3. Mike contacts candidates → Gets 2 interested
4. David interviews both → Scores and feedback
5. Sarah makes offer → 1 accepts
6. Emma onboards new hire
```

### Candidate-Based Collaboration

**Multiple TAs evaluating same candidate for different jobs:**

```
Candidate: Sarah Chen

├─ Job A (Senior React Dev) - Mike's job
│  ├─ Stage: Interviewed
│  ├─ Feedback: "Excellent technical skills"
│  └─ Status: Awaiting offer decision
│
├─ Job B (Frontend Lead) - Lisa's job
│  ├─ Stage: Shortlisted
│  ├─ Feedback: "Not yet contacted"
│  └─ Status: Awaiting Mike's job outcome
│
└─ Job C (React Developer) - Sarah's job
   ├─ Stage: CV Requested
   ├─ Feedback: "Good fit, over-qualified?"
   └─ Status: Awaiting CV
```

### Shared Notes & Activity Log

**Every action visible to team:**

```
Candidate: James Smith | Job: Senior Data Scientist

Activity Log:
├─ 2024-06-01 10:00
│  ├─ Mike Johnson
│  ├─ Action: Added to job
│  └─ Note: "Found via AI search, 95% match"
│
├─ 2024-06-01 11:30
│  ├─ Lisa Chen
│  ├─ Action: Moved to shortlisted
│  └─ Note: "Good fit, strong SQL skills"
│
├─ 2024-06-02 09:00
│  ├─ Mike Johnson
│  ├─ Action: Sent initial message
│  └─ Note: "Email sent, awaiting response"
│
├─ 2024-06-02 15:30
│  ├─ Mike Johnson
│  ├─ Action: Candidate responded
│  └─ Note: "Very interested, responded same day"
│
├─ 2024-06-03 14:00
│  ├─ David Brown (Hiring Manager)
│  ├─ Action: Added interview feedback
│  └─ Note: "Strong technical knowledge. Some gaps in ML. Score: 8/10"
│
└─ 2024-06-04 10:00
   ├─ Sarah Williams
   ├─ Action: Made offer
   └─ Note: "Verbal offer made. $120k. Awaiting acceptance."
```

### Prevent Duplicate Outreach

**System ensures no double-contacting:**

- If TA 1 contacts candidate, system shows this to TA 2
- Can see last contact date/time/message
- Shows previous communication history
- Prevents embarrassing duplicate messages

**Example alert:**
```
⚠️ This candidate was already contacted!

Last contact: 2024-06-02 11:00 via Email
Contact person: Mike Johnson
Message sent: "Hi Sarah, we have a role that matches..."
Response: "Positive - interested in learning more"

Are you sure you want to contact again?
```

---

## Analytics & Reporting

### Real-Time Dashboards

**TAs see live metrics:**

#### Pipeline Dashboard

```
RECRUITMENT FUNNEL

New: 45 candidates
  ↓ (78% conversion)
Screening: 35 candidates
  ↓ (43% conversion)
Shortlisted: 15 candidates
  ↓ (67% conversion)
Contacted: 10 candidates
  ↓ (80% conversion)
CV Requested: 8 candidates
  ↓ (100% conversion)
CV Received: 8 candidates
  ↓ (50% conversion)
Submitted: 4 candidates
  ↓ (75% conversion)
Interviewed: 3 candidates
  ↓ (67% conversion)
Offered: 2 candidates
  ↓ (100% conversion)
Placed: 2 candidates ✓

Average time-to-hire: 28 days
```

#### Source Metrics

```
CV SOURCES

LinkedIn Job Apps: 150 CVs (30%)
Email Inbox: 125 CVs (25%)
WhatsApp Messages: 100 CVs (20%)
Workable: 75 CVs (15%)
Manual Uploads: 50 CVs (10%)
Campaign Forms: 0 CVs (0%)

Total processed: 500 CVs
Unprocessed: 0 CVs
```

#### Recruiter Performance

```
RECRUITER STATS

Mike Johnson:
├─ Jobs managed: 5
├─ Candidates found: 28
├─ Candidates placed: 3
├─ Placement rate: 11%
└─ Average time-to-hire: 22 days

Lisa Chen:
├─ Jobs managed: 3
├─ Candidates found: 15
├─ Candidates placed: 2
├─ Placement rate: 13%
└─ Average time-to-hire: 31 days

Sarah Williams:
├─ Jobs managed: 4
├─ Candidates found: 22
├─ Candidates placed: 4
├─ Placement rate: 18%
└─ Average time-to-hire: 25 days
```

#### Job Performance

```
JOB STATS

Senior React Developer:
├─ Days to fill: 19 days ✓ (fast)
├─ Candidates processed: 45
├─ Placed: 1
└─ Hired candidate: Sarah Chen

Frontend Lead:
├─ Days to fill: 35 days (in progress)
├─ Candidates processed: 28
├─ Current stage: Interviewed (2 candidates)
└─ Next: Offer decision

Senior Data Scientist:
├─ Days to fill: 45 days (slow)
├─ Candidates processed: 38
├─ Current stage: Submitted to Client (3 candidates)
└─ Issue: Waiting for client feedback
```

---

## Complete Feature List

### 15 Core Features

| # | Feature | Description |
|---|---|---|
| 1 | **CV Collection** | Auto-pull CVs from LinkedIn, Workable, Email, WhatsApp, campaigns |
| 2 | **Candidate Profiles** | Unified profile per person with complete history |
| 3 | **AI CV Parsing** | Extract data from CVs automatically, mark as processed |
| 4 | **Job Management** | Create jobs, assign owners/recruiters, track status |
| 5 | **Recruitment Pipeline** | 11-stage tracker from New to Placed/Rejected |
| 6 | **AI Matching & Advanced Search** | Job description search + precise filters + custom filters |
| 7 | **Communication Automation** | Email, WhatsApp, SMS with templates and bulk sending |
| 8 | **Automated Follow-ups** | Auto-send reminders until candidate responds |
| 9 | **Headhunting Module** | Proactive outreach to passive candidates |
| 10 | **Candidate CRM** | Complete history of interactions, notes, decisions |
| 11 | **CV Version Management** | Track all CV versions, compare, update profiles |
| 12 | **Analytics & Reporting** | Live dashboards, KPIs, recruitment metrics |
| 13 | **Roles & Permissions** | Admin, Project Owner, Recruiter, TA roles |
| 14 | **Bulk Processing** | Upload 50-600+ CVs at once, batch operations |
| 15 | **AI Agents (Future)** | Screening, interview, headhunting, follow-up agents |

---

## System Characteristics

### Always-On Automation

- **CV processing** — Automatic when CV arrives
- **Follow-ups** — Automatic on Day 2, Day 4, Day 7
- **Status updates** — Auto-triggered based on actions
- **Notifications** — Auto-sent to relevant team members

### No Lost Candidates

- **Deduplication** — Recognizes returning candidates
- **Version tracking** — All CVs kept
- **History preservation** — Nothing ever deleted
- **Source tracking** — Know where candidate came from

### Collaborative Workflow

- **Shared visibility** — Team sees all actions
- **Prevent duplicates** — No double-contacting
- **Activity log** — Complete audit trail
- **Feedback system** — Everyone can contribute notes

### Scalable & Fast

- **Handles 1000+ CVs/day** — Automatic processing
- **Searches 115,000+ candidates in seconds** — AI-powered
- **Bulk operations** — Message 100+ candidates at once
- **Real-time dashboards** — Live metrics always available

---

## Data Privacy & Compliance

- **GDPR compliant** — Candidate data protected
- **Audit logs** — Every action recorded
- **Data retention** — Candidates kept for future reference
- **Consent tracking** — Communication preferences respected
- **Secure storage** — Cloud-based, encrypted

---

## Success Metrics

By implementing Career141, organizations will see:

- **80% reduction in time-to-hire** — Fast candidate identification
- **40% improvement in candidate quality** — AI matching + filters
- **60% reduction in manual work** — Automated follow-ups
- **3x more candidates processed** — Scalable ingestion
- **100% candidate history** — Never lose information again
- **Better team collaboration** — Shared visibility, no duplicates

---

*Career141 — Unified Recruitment Intelligence Platform*
*Centralizing CVs from all sources, enabling intelligent search, automating follow-ups, and tracking complete candidate lifecycle.*

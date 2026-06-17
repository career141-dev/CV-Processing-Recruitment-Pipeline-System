# Career141 — Analytics & Reporting

---

## Real-Time Dashboards

All dashboards display live data. Metrics update automatically as candidates move through the pipeline.

---

## Pipeline Dashboard (Recruitment Funnel)

Shows conversion rates at every stage of the pipeline for a specific job.

**Example Output:**
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

---

## Source Channel Metrics

Tracks CV volume and placement effectiveness per ingestion channel.

**Example Output:**
```
CV SOURCES

LinkedIn Job Apps:  150 CVs (30%)
Email Inbox:        125 CVs (25%)
WhatsApp Messages:  100 CVs (20%)
Workable:            75 CVs (15%)
Manual Uploads:      50 CVs (10%)
Meta Campaign:        0 CVs  (0%)

Total processed:    500 CVs
Unprocessed:          0 CVs
```

**Channel Effectiveness Reporting:**
- Volume per channel (CVs received)
- Conversion rate per channel (CVs → shortlisted → placed)
- Example insight: "LinkedIn generates 40% of placements but only 20% of applications"
- Attribution tracked permanently on every candidate profile

---

## Recruiter Performance Dashboard

Tracks individual TA performance.

**Metrics per recruiter:**
| Metric | Description |
|---|---|
| Jobs Managed | Active and completed jobs assigned |
| Candidates Found | Total candidates added to jobs |
| Candidates Placed | Total placements |
| Placement Rate | Placed / Found × 100% |
| Average Time-to-Hire | Days from job open to placement |

**Example Output:**
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
```

---

## Job Performance Dashboard

Tracks how each job opening is progressing.

**Metrics per job:**
| Metric | Description |
|---|---|
| Days to Fill | Days from job creation to placement |
| Candidates Processed | Total CVs received |
| Placed | 1 (when filled) or 0 |
| Current Stage | Where the leading candidates are now |

**Status Flags:**
- ✓ Fast — filled under target SLA
- In progress — still open
- Slow — taking longer than expected (Agent 8 flags this)

---

## Agent 8 — Daily Pipeline Health Report

Runs at a scheduled time each morning (e.g. 8:00 AM).

**Report Contents:**
1. All active jobs and current status
2. Jobs flagged for SLA breach or stall
3. Candidates stuck at a stage too long without decision
4. Jobs with no new CV activity in X days (sourcing issue)
5. Parsing failure rate alerts
6. CV volume anomaly alerts (sudden drops)
7. Time-to-stage metrics across all roles

**Notifications Sent To:**
- Responsible recruiter (when their candidates/jobs are flagged)
- Director (when Director Review stage is stalled)
- Admin (for system-level anomalies)

---

## Candidate Activity Log

Full audit trail per candidate. Every action is visible to the whole team.

**Log Entry Structure:**
```
Candidate: James Smith | Job: Senior Data Scientist

Activity Log:
├─ 2024-06-01 10:00
│  ├─ Actor: Mike Johnson (TA)
│  ├─ Action: Added to job
│  └─ Note: "Found via AI search, 95% match"
│
├─ 2024-06-01 11:30
│  ├─ Actor: Lisa Chen (TA)
│  ├─ Action: Moved to shortlisted
│  └─ Note: "Good fit, strong SQL skills"
│
├─ 2024-06-02 09:00
│  ├─ Actor: Agent 3 (Automated)
│  ├─ Action: Sent initial outreach email
│  └─ Note: "Day 2 follow-up sequence started"
│
├─ 2024-06-02 15:30
│  ├─ Actor: System
│  ├─ Action: Candidate responded
│  └─ Note: "Very interested, responded same day"
│
├─ 2024-06-03 14:00
│  ├─ Actor: David Brown (Hiring Manager / Client)
│  ├─ Action: Added interview feedback
│  └─ Note: "Strong technical knowledge. Some gaps in ML. Score: 8/10"
│
└─ 2024-06-04 10:00
   ├─ Actor: Sarah Williams (TA)
   ├─ Action: Made offer
   └─ Note: "Verbal offer made. $120k. Awaiting acceptance."
```

---

## Key Performance Indicators (KPIs)

| KPI | Description | Target |
|---|---|---|
| Time-to-Shortlist | Days from CV receipt to TA shortlist | < 2 days |
| Time-to-Client | Days from TA shortlist to client submission | < 5 days |
| Time-to-Hire | Days from job open to placement | < 30 days |
| CV Processing Rate | % of CVs parsed successfully | > 95% |
| Candidate Response Rate | % responding to outreach | Track per channel |
| Placement Rate | Placed / Candidates submitted to client | Track per TA |
| Channel Placement Rate | Placements per source channel | Track per channel |
| Parsing Confidence Rate | % fields extracted above confidence threshold | > 90% |

---

## Success Metrics (Platform Level)

By implementing Career141 fully:
- **80% reduction** in time-to-hire
- **40% improvement** in candidate quality (AI matching + filters)
- **60% reduction** in manual work (automated follow-ups)
- **3× more candidates** processed (scalable ingestion)
- **100% candidate history** — no information ever lost
- Better team collaboration — shared visibility, no duplicate outreach

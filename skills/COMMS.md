# Career141 — Communications & Outreach

---

## Communication Channels

| Channel | Used For | Agent |
|---|---|---|
| Email | Follow-up sequences; campaign responses; confirmation receipts | Agent 3, Agent 7 |
| WhatsApp | CV receipt from candidates; job-specific inbound | Agent 4 |
| Phone (IVR) | Proactive outreach; interest capture | Agent 5 |
| SMS | Optional follow-up channel | Manual / configurable |

---

## Agent 3 — Automated Email Follow-Up Sequence

### Trigger
- Candidate identified for outreach (new applicant or database match)
- Manual trigger by TA for specific candidates

### Sequence

| Day | Email | Purpose |
|---|---|---|
| Day 2 | Initial Outreach | Introduce the opportunity; role name, company type, key details |
| Day 4 | Follow-Up | Gentle reminder if no response |
| Day 7 | Final Follow-Up | Last attempt before sequence closes |

### Stop Conditions (Immediate)
- Candidate replies to any email
- Candidate opts out / unsubscribes
- Candidate progresses in the pipeline (any stage change)
- TA manually stops the sequence

### Personalisation
- Candidate full name inserted
- Role title and company type included
- Tailored key role details per job

### Logging (All Events)
- Message sent timestamp
- Delivery confirmation
- Read/open event
- Reply received
- Opt-out recorded

---

## Agent 5 — AI Phone Call Outreach

### Trigger
- New applicants who entered the pipeline via any channel
- Existing database candidates identified as strong match for a new role

### Call Script Structure
1. Introduction: "Hello, this is Career141 calling about an exciting opportunity..."
2. Brief role summary: title, company type, key highlights
3. IVR prompt presented

### IVR Response Handling

| Press | Status | Next Action |
|---|---|---|
| 1 (Interested) | `Interested — Awaiting TA Follow-Up` | Added to headhunting pipeline; TA notified immediately |
| 2 (Not Interested) | `Not Interested — This Role` | Sequence stops; candidate remains searchable for future roles |
| No Answer | `No Answer` | Logged; Agent 3 email sequence may activate |
| Voicemail | `Voicemail Left` | Logged; Agent 3 email sequence may activate |

### Logging
- Call timestamp and duration
- Candidate phone number called
- IVR response recorded
- Call recording stored on candidate profile
- All outcomes written to candidate communication timeline

---

## Agent 7 — Email Monitor (Inbound)

### What It Monitors

**LinkedIn Shared Inbox (`linkedin@career141.com`):**
- Reads subject line for job keyword (e.g. `FIN2024`)
- Tags LinkedIn sub-channel from email metadata
- Extracts CV attachment
- Routes to API Gateway with job ID and source tag

**Job-Specific Campaign Inboxes (e.g. `fin2024@career141.com`):**
- Routes by inbox address — no keyword parsing needed
- Extracts CV attachment
- Routes to API Gateway with job ID and source tag

### Auto-Confirmation Reply
After every successfully processed CV:
- Automated confirmation reply sent to candidate
- Acknowledges CV receipt
- May include estimated next steps

### Edge Cases Handled
- Multiple CV attachments in one email → processes each
- Forwarded emails → extracts original sender and attachment
- Unusual formats → fallback handling with logging

---

## Agent 4 — WhatsApp Inbound Monitor

### Monitored Numbers
- All active job-specific WhatsApp numbers simultaneously
- Meta Campaign shared WhatsApp line

### CV Detection
- Scans incoming messages for PDF or Word file attachments
- If attachment found → extract file → push to pipeline
- If no attachment but message received → can send auto-reply with instructions

### Job Identification
- Job identified from the WhatsApp number the message was sent to
- If job cannot be determined → auto-reply: "Please confirm which role you are applying for"

### Data Captured
- CV file
- Candidate phone number (from WhatsApp profile)
- Candidate display name (from WhatsApp profile)
- Timestamp

---

## Duplicate Outreach Prevention

The system prevents embarrassing situations where two TAs contact the same candidate.

**System checks:**
- If TA 1 has contacted candidate, TA 2 sees a warning before sending
- Warning shows: last contact date/time/channel, person who sent it, message sent, candidate response
- TA must confirm to proceed with additional outreach

**Alert Example:**
```
⚠️ This candidate was already contacted!

Last contact: 2024-06-02 11:00 via Email
Contact person: Mike Johnson
Message sent: "Hi Sarah, we have a role that matches..."
Response: "Positive - interested in learning more"

Are you sure you want to contact again?
```

---

## Communication Templates

### Template Variables Available
| Variable | Value |
|---|---|
| `{{candidate_name}}` | Candidate full name |
| `{{role_title}}` | Job title |
| `{{company_type}}` | Client company type/sector |
| `{{ta_name}}` | Recruiter's name |
| `{{ta_email}}` | Recruiter's email |
| `{{opt_out_link}}` | Unsubscribe URL |

### Template Types
- Initial outreach (Day 2)
- Follow-up (Day 4)
- Final follow-up (Day 7)
- CV received confirmation
- Interview invitation
- Offer letter
- Rejection notice
- Role no longer available

---

## Opt-Out Handling

- Any opt-out is immediately and permanently recorded on candidate profile
- All future automated sequences to that candidate for that role are stopped
- Opt-out for one role does NOT opt the candidate out for future roles (configurable)
- Opt-out events logged with timestamp in communication history
- GDPR-compliant opt-out handling

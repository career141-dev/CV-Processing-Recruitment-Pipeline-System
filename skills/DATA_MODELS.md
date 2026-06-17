# Career141 — Data Models & Schemas

---

## Candidate Profile

The central data object in Career141. Every candidate has exactly one permanent profile.

### Core Profile Fields

```json
{
  "candidateId": "unique-uuid",
  "status": "new | screening | shortlisted | contacted | placed | rejected | available",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "isArchivedLocally": false,

  "personal": {
    "fullName": "string",
    "email": "string",
    "phone": "string",
    "location": {
      "city": "string",
      "country": "string",
      "remote": true | false
    },
    "linkedinUrl": "string | null"
  },

  "professional": {
    "currentTitle": "string",
    "currentEmployer": "string",
    "seniorityLevel": "Junior | Mid | Senior | Lead | Manager | Director | C-Level",
    "yearsOfExperience": "number",
    "industries": ["string"],
    "expectedSalary": "string | null",
    "noticePeriod": "Immediate | 1 week | 2 weeks | 1 month | 3 months | null",
    "employmentStatus": "Employed | Unemployed | Freelance | Open to Opportunities"
  },

  "skills": [
    {
      "name": "string (normalised)",
      "rawName": "string (as found in CV)",
      "proficiencyLevel": "string | null"
    }
  ],

  "education": [
    {
      "degree": "string",
      "institution": "string",
      "year": "number | null",
      "field": "string | null"
    }
  ],

  "certifications": ["string"],

  "languages": [
    {
      "language": "string",
      "level": "Native | Fluent | Conversational | Basic | null"
    }
  ],

  "experienceHistory": [
    {
      "company": "string",
      "title": "string",
      "startDate": "string",
      "endDate": "string | null",
      "description": "string | null"
    }
  ]
}
```

### CV Versions (Attached to Profile)

```json
{
  "cvVersions": [
    {
      "cvId": "uuid",
      "uploadedAt": "ISO timestamp",
      "sourceChannel": "LinkedIn | WhatsApp | Meta | Email | Workable | Manual | Headhunting",
      "fileHash": "sha256-hex-string",
      "fileType": "pdf | docx",
      "storageLocation": "convex | minio",
      "parsedAt": "ISO timestamp | null",
      "parseStatus": "unprocessed | processing | processed | failed"
    }
  ]
}
```

### AI Extraction Metadata (Per CV)

```json
{
  "extractionMetadata": {
    "model": "string (e.g. nemotron-30b, claude-sonnet-4-6)",
    "extractedAt": "ISO timestamp",
    "confidenceScores": {
      "name": 0.98,
      "email": 0.99,
      "phone": 0.95,
      "location": 0.87,
      "jobTitle": 0.91,
      "employer": 0.88,
      "experience": 0.82,
      "skills": 0.79,
      "education": 0.85,
      "languages": 0.90,
      "linkedinUrl": 0.99
    },
    "flaggedForReview": ["skills", "experience"]
  }
}
```

### Vector Embeddings

```json
{
  "vectorEmbedding": {
    "model": "string (e.g. voyage-3-large, bge-m3)",
    "dimensions": 1024,
    "generatedAt": "ISO timestamp",
    "vector": "[float array stored in vector DB]"
  }
}
```

### Job Applications (On Candidate Profile)

```json
{
  "jobApplications": [
    {
      "jobId": "string",
      "jobTitle": "string",
      "appliedAt": "ISO timestamp",
      "sourceChannel": "LinkedIn | WhatsApp | Meta | Email | Workable | Manual | Headhunting",
      "currentStage": "string (pipeline stage)",
      "matchScore": 85,
      "stageHistory": [
        {
          "stage": "string",
          "enteredAt": "ISO timestamp",
          "actorId": "string (user ID)",
          "notes": "string | null"
        }
      ]
    }
  ]
}
```

### Communication History (On Candidate Profile)

```json
{
  "communicationLog": [
    {
      "eventId": "uuid",
      "timestamp": "ISO timestamp",
      "channel": "email | whatsapp | sms | phone",
      "direction": "outbound | inbound",
      "agentId": "Agent3 | Agent5 | manual",
      "actorId": "string (TA user ID) | null",
      "subject": "string | null",
      "body": "string",
      "status": "sent | delivered | read | replied | failed | opted-out",
      "response": "string | null"
    }
  ]
}
```

---

## Job Record

```json
{
  "jobId": "unique-uuid",
  "keyword": "FIN2024",
  "title": "Finance Manager",
  "description": "string (full job description)",
  "status": "Active | On Hold | Filled | Cancelled",
  "createdAt": "ISO timestamp",
  "clientName": "string",
  
  "requirements": {
    "requiredSkills": ["string"],
    "niceToHaveSkills": ["string"],
    "minExperienceYears": 5,
    "seniorityLevel": "Senior",
    "location": { "city": "string", "country": "string", "remote": false },
    "industry": "Finance",
    "educationLevel": "Bachelor | Masters | PhD | null",
    "languages": ["English"]
  },

  "compensation": {
    "salaryMin": 0,
    "salaryMax": 0,
    "currency": "USD"
  },

  "routing": {
    "linkedinInbox": "linkedin@career141.com",
    "emailInbox": "fin2024@career141.com",
    "whatsappNumber": "+XX XXXX XXXX | null",
    "workableJobId": "string | null"
  },

  "assignedTAs": ["userId"],
  "assignedDirector": "userId",
  "clientContactId": "userId",

  "pipeline": {
    "taShortlist": ["candidateId"],
    "directorApproved": ["candidateId"],
    "clientSelected": ["candidateId"],
    "clientHold": ["candidateId"],
    "clientRejected": ["candidateId"]
  },

  "metrics": {
    "totalCVsReceived": 0,
    "byChannel": {
      "LinkedIn": 0,
      "WhatsApp": 0,
      "Email": 0,
      "Workable": 0,
      "Manual": 0,
      "Headhunting": 0
    },
    "daysOpen": 0,
    "placedCandidateId": "string | null",
    "filledAt": "ISO timestamp | null"
  }
}
```

---

## Audit Event

Every action in the system creates an immutable audit event.

```json
{
  "eventId": "uuid",
  "timestamp": "ISO timestamp",
  "actorType": "agent | user | system",
  "actorId": "string (agent name or user ID)",
  "entityType": "candidate | job | communication",
  "entityId": "string",
  "action": "string (e.g. stage_changed, profile_created, cv_parsed, message_sent)",
  "details": {
    "from": "any",
    "to": "any",
    "notes": "string | null"
  }
}
```

---

## Pipeline Stage Definitions

| Stage Key | Display Name | Who Controls |
|---|---|---|
| `new` | New | System (auto on ingestion) |
| `screening` | Screening | System (auto after parsing) |
| `ta_review` | TA Review | Talent Acquisition |
| `ta_shortlisted` | TA Shortlisted | Talent Acquisition |
| `director_review` | Director Review | Director |
| `director_approved` | Director Approved | Director |
| `client_review` | Client Review | Client |
| `selected_for_interview` | Selected for Interview | Client |
| `interview_scheduled` | Interview Scheduled | System/TA |
| `offer_extended` | Offer Extended | TA |
| `placed` | Placed | System (on acceptance) |
| `rejected` | Rejected | Any level |
| `available` | Available (Returned to DB) | System |

---

## Source Channel Tags

Always use these exact values for `sourceChannel` fields:

| Tag | Source |
|---|---|
| `LinkedIn` | LinkedIn Easy Apply, External, Lead Gen, or Headhunting via LinkedIn inbox |
| `WhatsApp` | Job-specific WhatsApp number |
| `Meta` | Meta/Facebook/Instagram campaign WhatsApp |
| `Email` | Job-specific email campaign inbox |
| `Workable` | Workable ATS webhook |
| `Manual` | TA direct upload |
| `Headhunting` | TA-sourced passive candidate |

---

## Deduplication Decision Logic

```
STEP 1: SHA-256 hash check
  → If hash match found → update existing record with new source tag → STOP
  → If no hash match → proceed to Step 2

STEP 2: Agent 6 multi-factor check
  → Check: exact email match
  → Check: exact phone match
  → Check: LinkedIn URL match
  → Check: fuzzy name match (threshold: configurable, e.g. Jaro-Winkler > 0.92)

  → If ANY factor matches → DUPLICATE
    → Merge profiles
    → Add new application as event on existing profile
    → Retain both CV files in history
    → Update profile "updatedAt" timestamp
    → STOP

  → If NO factors match → NEW CANDIDATE
    → Create full profile
    → Generate vector embeddings
    → Write to database as searchable
```

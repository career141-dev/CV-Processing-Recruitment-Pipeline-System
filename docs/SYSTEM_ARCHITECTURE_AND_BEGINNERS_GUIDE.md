# Career141 — System Architecture & Beginner's Guide

Welcome to **Career141**! This document serves as the comprehensive architectural reference and onboarding guide for the Career141 CV Processing & Recruitment Pipeline System. Whether you are a newly onboarded software engineer, a DevOps specialist, or a technical recruiter, this guide will walk you through what the system does, how all pieces fit together, the complete technology stack, and how to develop and run the platform locally.

---

## 📋 Table of Contents

1. [Executive Overview: What is Career141?](#1-executive-overview-what-is-career141)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Production Microservices Topology](#3-production-microservices-topology)
4. [Complete Technology Stack & Tools Used](#4-complete-technology-stack--tools-used)
5. [The 8 Autonomous AI Agents](#5-the-8-autonomous-ai-agents)
6. [The 11-Stage Recruitment Kanban Pipeline](#6-the-11-stage-recruitment-kanban-pipeline)
7. [Database Schema & Data Model](#7-database-schema--data-model)
8. [Real-Time AI Voice Screening Architecture (Aura Voice)](#8-real-time-ai-voice-screening-architecture-aura-voice)
9. [Project Directory Structure](#9-project-directory-structure)
10. [Local Development & Beginner Onboarding Guide](#10-local-development--beginner-onboarding-guide)
11. [Engineering Rules, Security & Best Practices](#11-engineering-rules-security--best-practices)
12. [Glossary of Terms](#12-glossary-of-terms)

---

## 1. Executive Overview: What is Career141?

**Career141** is an enterprise-grade, AI-powered candidate recruitment pipeline and automation platform. In traditional recruitment agencies, Talent Acquisition (TA) teams spend hours downloading CVs from disparate channels (WhatsApp, email inboxes, job boards, LinkedIn), manually extracting candidate details, deduplicating records, evaluating skills against job specs, following up via messages for missing details (salary expectations, notice periods), and performing initial screening calls.

Career141 completely automates this operational workload using **8 specialized AI agents**, a **self-hosted reactive database (Convex)**, **vector semantic search (Qdrant & Voyage AI)**, and a **real-time AI voice calling engine (LiveKit + Deepgram + Cartesia)**.

### Core Capabilities:
- **Omnichannel Ingestion:** Automatically ingests CVs from WhatsApp (Meta Cloud / WhatChimp API), Microsoft 365 Email (MS Graph API), bulk uploads, and Workable ATS.
- **Deep CV Parsing:** Accurately extracts 16+ structured fields (personal details, work history, tech skills, education, languages, notice period, salary) using advanced LLMs (DeepSeek R1/V3 & Claude 3.5 Sonnet).
- **Automated Deduplication:** 4-factor matching engine preventing duplicate candidate profiles across different CV formats, phone numbers, and emails.
- **AI Matching & Semantic Search:** Blends 60% deterministic heuristic scoring with 40% Voyage AI vector embedding semantic similarity to rank candidates against active job descriptions in milliseconds.
- **Multi-Channel Follow-up Sequences:** Automates intelligent, cadenced outreach (Day 0, Day 2, Day 4, Day 6) over WhatsApp and Email to collect candidate notice periods, current salaries, and expected salaries.
- **Autonomous AI Voice Screening:** Conducts low-latency, real-time WebRTC and telephony (SIP trunk) screening calls with candidates to verify requirements before TA review.
- **11-Stage Kanban Pipeline:** Full end-to-end recruitment tracking with strict SLA management and role-based access control.

---

## 2. High-Level System Architecture

The following diagram illustrates how candidate data flows from external channels through our ingestion and AI processing pipeline, into the database, and onto the recruiter dashboard:

```
                               ┌──────────────────────────────────────────────────────────┐
                               │                    INBOUND CHANNELS                      │
                               │  • WhatsApp Messages & Attachments (Meta / WhatChimp)   │
                               │  • Microsoft 365 Recruiter Inboxes (MS Graph API)        │
                               │  • Recruiter Bulk PDF/DOCX Uploads                       │
                               │  • External ATS Sync (Workable API)                      │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                                                            ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │                 MULTI-CHANNEL INGESTION                  │
                               │  • Cloudflare R2 / S3 Object Storage (Raw Files)         │
                               │  • Ingestion Log & Audit Tracking                        │
                               │  • File Integrity & Checksum Hashing                     │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                                                            ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │                  CV EXTRACTION & PARSING                 │
                               │  • Agent 1: DeepSeek R1/V3 & Claude 3.5 Sonnet           │
                               │  • 16-Field Normalized Extraction (JSON)                 │
                               │  • Work Experience, Education, Skills, Salaries          │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                                                            ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │                 CANDIDATE DEDUPLICATION                  │
                               │  • Agent 6: 4-Factor Identity Lock Engine                │
                               │  • Match on: Email, Normalized Phone, LinkedIn, Hash     │
                               │  • Merge Profile History & Retain Prior Applications     │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                                                            ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │            EMBEDDINGS & AI SEMANTIC MATCHING             │
                               │  • Voyage AI (voyage-multilingual-2, 1024-dim)           │
                               │  • Qdrant Vector Database Engine                         │
                               │  • Agent 2: Hybrid Score (60% Heuristic + 40% Vector)    │
                               │  • Auto-Advance to Shortlist if Match Score >= 60%       │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                                                            ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │            RECRUITMENT PIPELINE & ENGAGEMENT             │
                               │  • 11-Stage Kanban Pipeline with Real-Time Reactive Sync │
                               │  • Agent 3: Automated Multi-Channel Follow-ups           │
                               │  • Agent 5: LiveKit Real-Time AI Voice Screening Calls   │
                               │  • Agent 8: Pipeline Health & SLA Compliance Radar       │
                               └──────────────────────────────────────────────────────────┘
```

---

## 3. Production Microservices Topology

Career141 runs as a resilient, self-hosted Docker microservices cluster deployed on a high-performance Contabo Linux VPS, fronted by Caddy reverse proxy for automated HTTPS/WSS termination.

```
                                 ┌───────────────────────────┐
                                 │    Caddy Reverse Proxy    │
                                 │ (HTTPS / WSS Termination) │
                                 └─────────────┬─────────────┘
                                               │
             ┌─────────────────────────────────┼─────────────────────────────────┐
             │                                 │                                 │
             ▼                                 ▼                                 ▼
 ┌───────────────────────┐         ┌───────────────────────┐         ┌───────────────────────┐
 │     career141-web     │         │   career141-backend   │         │  career141-dashboard  │
 │ (Next.js 16 App & UI) │         │ (Convex DB & V8 Node) │         │ (Convex Admin Studio) │
 │       Port 3000       │         │    Ports 3210/3211    │         │       Port 6791       │
 └───────────┬───────────┘         └───────────┬───────────┘         └───────────────────────┘
             │                                 │
             ├─────────────────────────────────┴─────────────────────────────────┐
             │                                                                   │
             ▼                                                                   ▼
 ┌───────────────────────┐                                           ┌───────────────────────┐
 │   career141-qdrant    │                                           │   career141-livekit   │
 │  (Qdrant Vector DB)   │                                           │ (WebRTC Media Server) │
 │    Ports 6333/6334    │                                           │    Ports 7880/7881    │
 └───────────────────────┘                                           └───────────┬───────────┘
                                                                                 │
                                               ┌─────────────────────────────────┴─────────────────────────────────┐
                                               │                                                                   │
                                               ▼                                                                   ▼
                                   ┌───────────────────────┐                                           ┌───────────────────────┐
                                   │ career141-livekit-sip │                                           │ career141-voice-agent │
                                   │ (Dialog SIP Gateway)  │                                           │ (AI Voice Worker Node)│
                                   │       Port 5060       │                                           │       Port 8081       │
                                   └───────────┬───────────┘                                           └───────────────────────┘
                                               │
                                               ▼
                                   ┌───────────────────────┐
                                   │ career141-voice-redis │
                                   │ (Shared Session Store)│
                                   │       Port 6379       │
                                   └───────────────────────┘
```

### Microservices Breakdown:

| Service Container | Image / Technology | Purpose |
| :--- | :--- | :--- |
| **`career141-web`** | `Next.js 16 (React 19, TypeScript)` | Recruiter web application, dashboard, live Kanban board, candidate management, and real-time client UI. |
| **`career141-backend`** | `ghcr.io/get-convex/convex-backend` | Self-hosted reactive document database executing mutations, queries, and background asynchronous actions. |
| **`career141-dashboard`** | `ghcr.io/get-convex/convex-dashboard` | Web-based database management interface for viewing database tables, logs, and scheduled cron jobs. |
| **`career141-qdrant`** | `qdrant/qdrant` | High-performance Rust-based vector search engine storing candidate & job profile embeddings. |
| **`career141-livekit`** | `livekit/livekit-server` | Real-time WebRTC audio server facilitating low-latency streaming between candidates and AI agents. |
| **`career141-livekit-sip`**| `livekit/sip` | Telephony bridge connecting WebRTC audio rooms to Dialog Axiata E1/SIP trunks for outbound telephone calls. |
| **`career141-voice-agent`**| `Node.js + LiveKit Agent SDK` | Standalone voice worker orchestrating Deepgram Nova-2 (STT), DeepSeek/GPT-4o (LLM), and Cartesia (TTS). |
| **`career141-voice-redis`**| `redis:7.4-alpine` | Low-latency in-memory cache synchronizing telephony session states and call tokens. |
| **`caddy`** | `caddy:alpine` | Production reverse proxy providing automatic SSL certificate issuance and routing. |

---

## 4. Complete Technology Stack & Tools Used

### Frontend & UI
- **Next.js 16 (App Router):** High-speed React framework with Server Components and Turbopack compiler.
- **React 19 & TypeScript:** Strict type-safe UI components and reactive state.
- **Tailwind CSS & Lucide Icons:** Modern, clean, and responsive recruiter interface.
- **Sonner:** Toast notification system for async updates.
- **Clerk Authentication (`@clerk/nextjs`):** Role-Based Access Control (Admin, TA Manager, Senior TA, Recruiter, Director, Client, Viewer).

### Backend & Reactive Database
- **Convex (Self-Hosted):** A reactive document database that pushes updates instantly over WebSockets. Everything in Convex is strictly typed using TypeScript schemas (`convex/schema.ts`).
- **Convex Scheduled Crons & Actions:** Background V8/Node worker tasks for polling email, executing deduplication, running AI extraction, and scheduling follow-ups.

### Storage & Cloud Assets
- **Cloudflare R2:** High-speed, zero-egress-fee S3-compatible cloud storage for storing raw candidate CVs (PDF, DOCX) and recorded voice call audio.
- **AWS S3 SDK (`@aws-sdk/client-s3`):** Standard client library used to upload, fetch, and sign secure URLs for candidate CV files.

### Artificial Intelligence & Machine Learning
- **OpenRouter API:** Unified AI gateway providing access to:
  - `deepseek/deepseek-chat` (DeepSeek V3 / R1) for high-accuracy, cost-effective CV extraction and candidate Q&A.
  - `anthropic/claude-3.5-sonnet` for complex multi-page parsing and reasoning.
  - `openai/gpt-4o-mini` for conversational voice agents.
- **Voyage AI (`voyage-multilingual-2`):** State-of-the-art 1024-dimensional dense vector embeddings optimized for multilingual text search.
- **Qdrant Vector DB:** Vector index providing sub-10ms similarity search across 100,000+ candidate profiles.

### Voice & Telephony Engine
- **LiveKit Agents SDK:** Orchestrates real-time audio rooms.
- **Deepgram Nova-2:** Ultra-fast Speech-to-Text (STT) with domain adaptation for recruitment terms.
- **Silero VAD (Voice Activity Detection):** Millisecond-level speech detection to enable smooth natural human interruption during voice calls.
- **Cartesia Sonic / ElevenLabs:** High-fidelity, ultra-low-latency Text-to-Speech (TTS) delivering natural human voice synthesis.
- **Dialog Axiata SIP Trunks:** Telecommunications provider routing outbound and inbound telephone calls across standard mobile networks.

### Messaging & Communications
- **Meta Cloud API / WhatChimp:** Direct WhatsApp Business integration for inbound CV reception and template outreach messages.
- **Microsoft Graph API:** Direct OAuth2 integration with corporate Microsoft 365 Exchange mailboxes for automated inbox scanning and candidate correspondence.

---

## 5. The 8 Autonomous AI Agents

Career141 is organized around **8 specialized AI agents**, each with dedicated responsibilities:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CAREER141 AI AGENT SUITE                             │
├─────────┬──────────────────────┬────────────────────────────────────────────────┤
│ Agent # │ Name                 │ Primary Function & Trigger                     │
├─────────┼──────────────────────┼────────────────────────────────────────────────┤
│ Agent 1 │ CV Parsing Agent     │ Extracts 16+ structured fields from CV uploads │
│ Agent 2 │ Candidate Matching   │ Blends heuristic & vector semantic match score │
│ Agent 3 │ Follow-Up Sequences  │ Multi-channel cadenced outreach (WA / Email)   │
│ Agent 4 │ WhatsApp Ingestion   │ Ingests incoming WhatsApp CV files & forwards  │
│ Agent 5 │ AI Voice Screening   │ Outbound conversational candidate phone calls  │
│ Agent 6 │ Deduplication Engine │ 4-factor exact/fuzzy profile merging & locking │
│ Agent 7 │ Email Inbox Monitor  │ Scans M365 mailboxes for attached resumes      │
│ Agent 8 │ Pipeline Health & SLA│ Monitors candidate stages, bottlenecks & SLAs  │
└─────────┴──────────────────────┴────────────────────────────────────────────────┘
```

### Deep Dive into Each Agent:

#### 🔹 Agent 1: CV Parsing Agent
- **Trigger:** Fired immediately when a new file is uploaded to `cvUploads`.
- **Function:** Reads PDF/DOCX text or applies OCR; sends text to DeepSeek/Claude via OpenRouter; validates and extracts 16 standardized fields into structured JSON (Name, Email, Phone, Skills, Experience, Education, Current Salary, Expected Salary, Notice Period, etc.).
- **Output:** Writes structured candidate record and flags `isParsed: true`.

#### 🔹 Agent 2: Candidate Matching & Scoring Agent
- **Trigger:** Triggered when a new job is created, when a new candidate is parsed, or via manual "Rescan" in the UI.
- **Scoring Engine:**
  $$\text{Total Score} = (0.60 \times \text{Deterministic Heuristics}) + (0.40 \times \text{Voyage Vector Cosine Similarity})$$
- **Deterministic Heuristics (60%):** Evaluates exact skill overlap, years of experience, industry match, and salary compatibility.
- **Semantic Vector Match (40%):** Compares dense Voyage AI embeddings of candidate experience vs job specification.
- **Automation Rule:** If $\text{Total Score} \ge 60\%$, candidate is automatically graduated to `ta_shortlist` (Stage 3).

#### 🔹 Agent 3: Follow-Up Sequences Agent
- **Trigger:** Hourly cron sweep inspecting candidates in the `follow_up` stage.
- **Cadence:**
  - **Day 0:** Welcome & request for missing details via WhatsApp / Email.
  - **Day 2:** AI Voice Screening Call (or reminder).
  - **Day 4:** Mid-point follow-up prompt.
  - **Day 6:** Final reminder notice.
- **Stop Condition:** Automatically terminates the sequence as soon as all 4 core parameters are verified: (1) Valid CV, (2) Current Salary, (3) Expected Salary, and (4) Notice Period.
- **Unresponsive Rule:** If silent after 7 days, candidate is moved to `unresponsive`.

#### 🔹 Agent 4: WhatsApp Ingestion Agent
- **Trigger:** Webhook from Meta Cloud API or WhatChimp.
- **Function:** Downloads inbound CV media files, normalizes sender phone numbers, extracts metadata, identifies the Talent Acquisition recruiter who forwarded the CV (two-tap forward flow), and queues the file for Agent 1.

#### 🔹 Agent 5: AI Voice Screening Agent (Aura Voice)
- **Trigger:** Triggered when candidate enters `ai_call` stage or when TA clicks "Start Screening Call".
- **Function:** Initiates a WebRTC or SIP phone call, asks dynamic technical and behavioral screening questions, validates candidate availability and salary, captures a transcript, generates an AI summary score, and records the audio in Cloudflare R2.

#### 🔹 Agent 6: Candidate Deduplication Agent
- **Trigger:** Runs synchronously inside candidate creation.
- **4-Factor Matching:**
  1. Exact CV file hash (SHA-256)
  2. Email address match
  3. Normalized E.164 phone number match
  4. LinkedIn profile URL identifier
- **Race Condition Prevention:** Implements Convex `candidateLocks` to prevent race conditions during high-volume concurrent CV ingestion.
- **Merge Behavior:** Updates candidate profile with newer CV versions while preserving historical applications and interview notes.

#### 🔹 Agent 7: Email Inbox Monitor Agent
- **Trigger:** Scheduled cron (every 1 minute) / MS Graph webhook notification.
- **Function:** Scans configured Microsoft 365 recruiter mailboxes (`recruitment@career141.com`), identifies genuine CV attachments, attributes the candidate to the correct job opening based on subject line tags, and passes the file to the ingestion queue.

#### 🔹 Agent 8: Pipeline Health & SLA Agent
- **Trigger:** Continuous background evaluations.
- **Function:** Calculates SLA time-in-stage metrics, flags candidates stuck in a stage for >48 hours, detects recruiter bottlenecks, and presents live health radar metrics on the Executive Dashboard.

---

## 6. The 11-Stage Recruitment Kanban Pipeline

Candidates move through an 11-stage recruitment pipeline designed to mirror enterprise executive search workflows:

```
[ Stage 1: New CVs ]
       │
       ▼
[ Stage 2: Screened (Parsed & Deduplicated) ]
       │
       ▼
[ Stage 3: TA Shortlist (Score >= 60% or Recruiter Selected) ]
       │
       ▼
[ Stage 4: Follow-up (Automated Outreach for Missing Info) ]
       │
       ▼
[ Stage 5: AI Voice Call (Automated Telephony Screening) ]
       │
       ▼
[ Stage 6: 2nd Shortlist (All 4 Core Criteria Confirmed) ]
       │
       ▼
[ Stage 7: Director Review (Internal Approval Gate) ]
       │
       ▼
[ Stage 8: Client Review (Submitted to Client Contact) ]
       │
       ▼
[ Stage 9: Interviewing (1st, 2nd, Final Client Interviews) ]
       │
       ▼
[ Stage 10: Offer Extended (Negotiation & Contract Signing) ]
       │
       ▼
[ Stage 11: Placed (Successful Hire) ]  ──OR──  [ Rejected / Withdrawn ]
```

---

## 7. Database Schema & Data Model

Career141 uses Convex tables defined in [`convex/schema.ts`](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/schema.ts). Below are the primary entities:

| Table Name | Description | Key Indexes |
| :--- | :--- | :--- |
| **`users`** | Recruiter, Manager, Director, and Client accounts. | `by_clerkUserId`, `by_email`, `by_role` |
| **`candidates`** | Master candidate records (name, contact, skills, salary, parsed JSON). | `by_email`, `by_phone`, `by_status` |
| **`cvUploads`** | Raw CV files, parsing status (`queued`, `processing`, `completed`, `failed`). | `by_status`, `by_storageId`, `by_candidateId` |
| **`jobs`** | Active job specifications, client details, required skills, salary ranges. | `by_status`, `by_clientName`, `by_createdBy` |
| **`applications`** | Connects candidate to a specific job; tracks current pipeline stage and SLA. | `by_candidateId`, `by_jobId`, `by_stage` |
| **`communications`**| Full log of all WhatsApp, Email, and Voice messages exchanged. | `by_candidateId`, `by_channel`, `by_status` |
| **`candidateInquiries`** | Unanswered questions from candidates categorized by AI. | `by_candidateId`, `by_status`, `by_importance` |
| **`candidateLocks`** | Identity locks to prevent race conditions during deduplication. | `by_lockKey`, `by_cvUploadId` |
| **`campaignNumbers`** | Assigned WhatsApp/Telephony numbers for source tracking. | `by_phoneNumber`, `by_assignedRecruiter` |

---

## 8. Real-Time AI Voice Screening Architecture (Aura Voice)

The voice screening system (`agent/` and [`src/app/dashboard/aura-voice-agent/page.tsx`](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/src/app/dashboard/aura-voice-agent/page.tsx)) provides real-time, interactive candidate interviews with ultra-low latency (<600ms speech-to-speech round-trip).

```
Candidate (Browser / Mobile Phone)
       │ (WebRTC Audio Stream / SIP Trunk)
       ▼
[ LiveKit WebRTC Media Server ] (Port 7880)
       │
       ▼
[ LiveKit Node.js Agent Worker ] (agent/src/index.ts)
       │
       ├─► 1. Silero VAD: Detects speech & enables natural user interruptions
       ├─► 2. Deepgram Nova-2: Real-time audio streaming Speech-to-Text (STT)
       ├─► 3. DeepSeek / GPT-4o-mini: Context-aware interview prompt & reasoning
       ├─► 4. Cartesia Sonic / ElevenLabs: Ultra-realistic low-latency Text-to-Speech (TTS)
       │
       ▼
Output Audio Stream ──► Returned to candidate with sub-second latency
       │
       ▼
Call Wrap-up ──► Full Transcript & AI Evaluation Score stored in Convex
```

---

## 9. Project Directory Structure

```
cv-processing-recruitment-pipeline-system/
├── .agents/                    # Specialized AI agent skills and guidance rules
│   └── skills/                 # Skills for CV ingestion, parsing, matching, dedup, etc.
├── .github/                    # GitHub Actions CI/CD workflows (deploy.yml)
├── agent/                      # Standalone LiveKit Real-Time AI Voice Agent daemon
│   ├── src/index.ts            # Entrypoint for STT, LLM, TTS voice pipeline
│   ├── Dockerfile              # Container definition for voice agent
│   └── package.json            # Dependencies for LiveKit Agents SDK
├── convex/                     # Convex Backend (Database, Serverless Functions, Crons)
│   ├── schema.ts               # Core database schema definitions
│   ├── crons.ts                # Scheduled cron jobs (email polling, follow-ups)
│   ├── http.ts                 # Webhook endpoints (WhatsApp, MS Graph)
│   ├── candidates.ts           # Candidate queries, mutations, and deduplication logic
│   ├── cvExtraction.ts         # Agent 1 CV parsing and OpenRouter LLM actions
│   ├── cvScoringActions.ts     # Agent 2 Candidate matching & Voyage embedding logic
│   └── communications/         # Email, WhatsApp, and SMS communication handlers
├── docs/                       # Architectural documentation & technical reports
├── lib/                        # Shared utility libraries, vector clients, S3 clients
│   ├── agent-config.ts         # Configuration for AI agents
│   └── vectorDb.ts             # Qdrant client & Voyage AI integration
├── public/                     # Static assets, logos, icons
├── src/                        # Next.js 16 Frontend Web Application
│   ├── app/                    # Next.js App Router pages
│   │   ├── dashboard/          # Recruiter dashboard, candidate views, jobs, settings
│   │   │   ├── aura-voice-agent/ # Real-time Aura Voice Agent interface
│   │   │   ├── candidates/     # Candidate table and profile details
│   │   │   ├── jobs/           # Job management & candidate matching
│   │   │   └── pipeline/       # 11-Stage Kanban pipeline board
│   │   ├── api/                # API routes for webhooks and auth
│   │   └── layout.tsx          # Root UI layout and Clerk Auth Provider
│   └── components/             # Reusable UI components (Kanban columns, badges, modals)
├── docker-compose.yml          # Local microservices docker-compose setup
├── docker-compose.prod.yml     # Production VPS microservices docker-compose setup
├── start-local-dev.bat         # 1-Click local development starter script for Windows
├── README.md                   # Project overview & quickstart
└── AGENTS.md                   # Strict engineering protocol & rules for AI assistants
```

---

## 10. Local Development & Beginner Onboarding Guide

### Step 1: Prerequisites
Ensure your local development machine has:
- **Node.js**: `v22.x` or higher
- **npm**: `v10.x` or higher
- **Docker Desktop**: Running and configured for Linux containers
- **Git**: Installed and authenticated

### Step 2: Clone and Install Dependencies
```bash
# Clone the repository
git clone https://github.com/career141/cv-processing-recruitment-pipeline-system.git
cd cv-processing-recruitment-pipeline-system

# Install root dependencies
npm install

# Install voice agent dependencies
cd agent
npm install
cd ..
```

### Step 3: Environment Setup
Copy the example environment files:
```bash
cp .env.example .env.local
```
Fill in the required credentials in `.env.local`:
- `NEXT_PUBLIC_CONVEX_URL`: Local or cloud Convex instance URL.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`: Clerk authentication keys.
- `OPENROUTER_API_KEY`: OpenRouter API key for LLM queries.
- `VOYAGE_API_KEY`: Voyage AI embedding key.
- `CLOUDFLARE_R2_*` or `AWS_*`: Object storage credentials.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: LiveKit credentials.
- `DEEPGRAM_API_KEY`: Deepgram speech-to-text API key.

### Step 4: Running the Local Development Stack
You can start the entire stack using our automated starter script or manually:

#### Option A: 1-Click Windows Starter
Double-click [`start-local-dev.bat`](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/start-local-dev.bat) or run in PowerShell:
```powershell
.\start-local-dev.bat
```

#### Option B: Manual Startup
1. **Start Convex Database & Background Actions:**
   ```bash
   npx convex dev
   ```
2. **Start Next.js Web Frontend (in a second terminal):**
   ```bash
   npm run dev
   ```
3. **Start LiveKit Voice Agent (in a third terminal):**
   ```bash
   cd agent
   npm run dev
   ```

Open your browser and navigate to:
- **Recruiter Web UI:** `http://localhost:3000`
- **Convex Admin Dashboard:** Provided in terminal output (or `http://localhost:6791` if local container)

---

## 11. Engineering Rules, Security & Best Practices

All developers and AI pair programmers working on this repository must adhere to the engineering standards codified in [`AGENTS.md`](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/AGENTS.md):

1. **Explain First, Then Implement:** Always formulate the root cause and proposed diff before making non-trivial modifications.
2. **Strict Model/Vendor Adherence:** Never swap LLM models or telephony providers without explicit written approval.
3. **Soft Weighted Scoring (No Hard Filters):** Never introduce binary hard AND-filters in candidate search that risk returning 0 matching candidates.
4. **Candidate Data Integrity & Identity Locks:** Ingestion and deduplication must strictly use `candidateLocks` to prevent race conditions during high-volume intake.
5. **Zero-Downtime Deployment Discipline:** Production deployments follow a staged rollout: Pre-deploy health check $\rightarrow$ Convex schema push $\rightarrow$ Background Docker image build $\rightarrow$ 1-second atomic container swap.

---

## 12. Glossary of Terms

- **Convex:** A reactive backend-as-a-service database that synchronizes state to clients via WebSocket subscriptions without manual REST polling.
- **Voyage AI:** An AI embedding provider generating dense numerical representations of candidate experience for semantic similarity search.
- **Qdrant:** A dedicated vector database for high-speed nearest-neighbor cosine similarity queries.
- **LiveKit:** An open-source WebRTC media server powering real-time low-latency voice and video communications.
- **VAD (Voice Activity Detection):** Machine learning module (Silero) that detects when a human starts and stops speaking in real time.
- **STT (Speech-to-Text):** Transcribes candidate spoken audio into text (Deepgram Nova-2).
- **TTS (Text-to-Speech):** Converts generated text responses into ultra-realistic spoken audio (Cartesia / ElevenLabs).
- **SIP Trunk:** A standard telecommunications protocol bridging cloud voice servers with mobile phone networks (Dialog Axiata).
- **Cloudflare R2:** High-performance, S3-compatible cloud object storage without bandwidth egress fees.

---
*Maintained by the Career141 Engineering Team. For questions or architecture reviews, consult `AGENTS.md` and repository leads.*

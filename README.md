# Career141 — CV Processing & Recruitment Pipeline System

An enterprise AI-driven recruitment automation platform, multi-channel candidate ingestion pipeline, AI matching engine, and automated candidate outreach system built on **Next.js 16**, **Self-Hosted Convex**, **Cloudflare R2**, and **Clerk**.

---

## 📋 Table of Contents

1. [System Architecture & Technology Stack](#-system-architecture--technology-stack)
2. [Self-Hosted Production Microservices Architecture](#-self-hosted-production-microservices-architecture)
3. [Prerequisites](#-prerequisites)
4. [Environment Setup & Configuration](#-environment-setup--configuration)
5. [Local vs Hosted Development Workflows](#-local-vs-hosted-development-workflows)
6. [Database Operations & 1-Click Sync](#-database-operations--1-click-sync)
7. [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
8. [Testing, QA Suite & Verification](#-testing-qa-suite--verification)
9. [Engineering Rules & Deployment Discipline](#-engineering-rules--deployment-discipline)

---

## 🏗️ System Architecture & Technology Stack

Career141 automates recruitment across 8 AI agents:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                Multi-Channel Ingestion                 │
                  │  (WhatsApp Meta Cloud API / M365 MS Graph / Workable) │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                 CV Parsing & Extraction                │
                  │        (DeepSeek R1/V3 & Claude 3.5 via OpenRouter)    │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                 Candidate Deduplication                │
                  │       (Exact Email/Phone & Fuzzy Name Matcher)         │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │           AI Semantic Search & Reverse Match           │
                  │       (Voyage AI Multilingual + Qdrant Vector DB)      │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │             11-Stage Kanban Pipeline System            │
                  │   (SLA Tracking, Automated Multi-Channel Follow-ups)   │
                  └────────────────────────────────────────────────────────┘
```

### Core Technologies

- **Frontend Framework**: Next.js 16 (Turbopack, App Router, React 19, TypeScript)
- **Styling & UI**: TailwindCSS, Lucide React SVG Icons, Sonner Notifications
- **Authentication**: Clerk (`@clerk/nextjs`)
- **Backend & Database**: Self-hosted Convex running on Contabo VPS inside Docker (`docker-compose.yml`)
- **File Storage**: Cloudflare R2 via AWS S3 SDK (`@aws-sdk/client-s3`)
- **AI & Extraction Engine**: OpenRouter API (DeepSeek R1/V3, Claude 3.5 Sonnet)
- **Embeddings & Vector Database**: Voyage AI (`voyage-multilingual-2`, 1024-dim vectors) & Qdrant
- **Communications**: Meta Cloud API (WhatsApp Business), Microsoft 365 MS Graph API (Email inbox monitor)

---

## 🐳 Self-Hosted Production Microservices Architecture

Career141 runs as an enterprise, self-hosted containerized microservices stack on Contabo VPS (`docker-compose.prod.yml` & `docker-compose.yml`):

```
                                ┌───────────────────────────┐
                                │   Caddy Reverse Proxy     │
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
│   career141-qdrant    │                                           │  career141-livekit    │
│  (Qdrant Vector DB)   │                                           │ (WebRTC Voice Server) │
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

### Production Microservices Breakdown

| Service Name | Container / Image | Internal Port | Description & Responsibilities |
| :--- | :--- | :--- | :--- |
| **`career141-web`** | `career141-prod:latest` (Next.js 16) | `3000` | Recruiter Dashboard, Candidate Management, Kanban Pipelines, CV Scanner UI, Real-time Voice Screenings. |
| **`career141-backend`** | `ghcr.io/get-convex/convex-backend` | `3210` (Cloud), `3211` (Site) | Self-hosted reactive document database, ACID transactional mutations, V8/Node.js background actions, and webhooks. |
| **`career141-dashboard`** | `ghcr.io/get-convex/convex-dashboard` | `6791` | Convex self-hosted administrative web studio for real-time document inspection and data browsing. |
| **`career141-qdrant`** | `qdrant/qdrant:latest` | `6333` (HTTP), `6334` (gRPC) | High-performance vector database storing 1024-dimension Voyage AI candidate embeddings for sub-millisecond semantic search. |
| **`career141-livekit`** | `livekit/livekit-server:v1.13.4` | `7880` (HTTP), `7881` (TCP) | Real-time WebRTC media server powering low-latency bi-directional voice streaming for AI candidate screening. |
| **`career141-livekit-sip`**| `livekit/sip:v1.8.0` | `5060` (SIP), `18080` (Health) | SIP telephony gateway bridging LiveKit audio rooms to Dialog Axiata E1/SIP trunks for outbound phone calls. |
| **`career141-voice-agent`**| `career141-voice-agent:latest` | `8081` (Health) | Standalone Node.js worker daemon executing Deepgram Nova-2 STT, DeepSeek LLM reasoning, and Cartesia TTS. |
| **`career141-voice-redis`**| `redis:7.4-alpine` | `6379` | In-memory cache and session state synchronization across LiveKit WebRTC and SIP telephony workers. |

### Enterprise Zero-Downtime Deployment Lifecycle

Career141 uses a production CI/CD pipeline ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) that guarantees high availability and zero downtime:

1. **Pre-Deploy Safety Verification**: Verifies database health, memory availability, and disk usage (auto-pruning old cache if disk > 85%).
2. **Atomic Schema & Function Push**: Bundles and pushes Convex functions and database schemas to `api.career141.com` with automated admin key resolution.
3. **Background Image Compilation**: Compiles the new Next.js production build in the background while the previous container continues serving live recruiter traffic.
4. **1-Second Atomic Swap**: Recreates and swaps `career141-web` in 1 second (`--no-deps --force-recreate web`), preventing any user downtime.
5. **Automated Post-Deploy Maintenance**: Recalculates dashboard counters and synchronizes candidate embeddings to Qdrant vector storage immediately following container swap.

---

## ⚡ Prerequisites

Before setting up your local workspace, ensure your development machine has the following tools installed:

- **Node.js**: `v22.x` or higher (`node -v`)
- **npm**: `v10.x` or higher (`npm -v`)
- **Docker Desktop / Docker Engine**: `v24.x` or higher (required for running the local Convex database container)
- **Git**: `v2.40` or higher (`git --version`)

---

## 🛠️ Environment Setup & Configuration

### 1. Repository Setup

```bash
# Clone the repository
git clone https://github.com/career141-dev/CV-Processing-Recruitment-Pipeline-System.git
cd CV-Processing-Recruitment-Pipeline-System

# Install project dependencies
npm ci
```

### 2. Environment Variables

Create `.env.local` in the project root:

```env
# Convex Backend Configuration (Hosted Production VPS)
NEXT_PUBLIC_CONVEX_URL="https://api.career141.com"
CONVEX_SELF_HOSTED_ADMIN_KEY="convex-self-hosted|01c7a32b0d2deae44e0fdcd9108f8b62c6c1af651cac34d644be0f3912d0ba099aa6f4369b"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"

# Cloudflare R2 Storage
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="career141-cv-vault"
R2_PUBLIC_URL="https://vault.career141.com"

# AI Provider Keys
OPENROUTER_API_KEY="sk-or-v1-..."
VOYAGE_API_KEY="pa-..."

# WhatsApp / Meta Cloud API
META_WHATSAPP_TOKEN="EAAG..."
META_PHONE_NUMBER_ID="..."
META_VERIFY_TOKEN="..."
```

---

## 🚀 Local vs Hosted Development Workflows

Developers can choose between two development environments depending on their task:

### Mode A: Hosted VPS Backend (`https://api.career141.com`)
*Recommended for feature development, testing webhooks (WhatsApp/Email), or working with real data snapshots.*

```bash
# Terminal 1: Start Next.js Development Server
npm run dev

# Terminal 2: Switch & watch Hosted VPS Convex Backend
npm run dev:hosted
```

### Mode B: Isolated Local Machine (`http://127.0.0.1:3210`)
*Recommended for local schema experiments or offline development without impacting shared environments.*

```bash
# 1. Start your local Docker Convex container
docker start convex-local-test-backend-1

# 2. Terminal 1: Start Next.js Development Server
npm run dev

# 3. Terminal 2: Connect Convex CLI to local Docker
npm run dev:local
```

### Environment Mode Switcher

| Command | Target Environment | Description |
| :--- | :--- | :--- |
| `npm run dev` | Next.js Frontend | Launches Next.js dev server on `http://localhost:3000`. |
| `npm run dev:hosted` | Hosted VPS (`api.career141.com`) | Connects Convex CLI to hosted production backend. |
| `npm run dev:local` | Local Docker (`127.0.0.1:3210`) | Connects Convex CLI to local container database. |
| `npm run switch:hosted` | Hosted VPS Config | Switches `.env.local` pointers to Hosted VPS. |
| `npm run switch:local` | Local Docker Config | Switches `.env.local` pointers to Local Machine. |
| `npm run db:sync-from-hosted` | Database Clone | Downloads Hosted VPS data snapshot into your local Docker database. |

---

## 💾 Database Operations & 1-Click Sync

### 1-Click Database Cloning (Hosted → Local Machine)

To populate your local Docker database with a real-time copy of jobs, candidate profiles, application stages, and CV records:

```bash
npm run db:sync-from-hosted
```

### Running Convex Functions via CLI

To execute Convex queries or mutations against the hosted backend directly from Node:

```bash
# Run a query
node scripts/convex-env-run.js hosted run users/users:getTeamMembers

# Run a mutation with arguments
node scripts/convex-env-run.js hosted run users/users:setUserRoleByEmail '{"email":"dev@career141.com","role":"test_ta"}'
```

---

## 🔐 Role-Based Access Control (RBAC)

Career141 enforces role-based navigation and security via `useRole` hook (`src/hooks/useRole.ts`) and `RouteGuard` (`src/components/RouteGuard.tsx`):

### System Roles & Permission Matrix

| Role | Description | Access Summary |
| :--- | :--- | :--- |
| `admin` | System Administrator | Full access to all pages, user settings, ingestion monitors, token logs, and candidate management. |
| `ta_manager` | TA Manager | Pipeline management, job creation, candidate search, outreach, analytics, and ingestion monitor. |
| `senior_ta` | Senior TA | Pipeline management, candidate search, outreach, and analytics. |
| `recruiter` | Recruiter | Assigned job pipelines, candidate search, and follow-ups. |
| `test_ta` | Test TA (Limited Access) | **Dashboard, Jobs, Candidates Dropdown (Management, Search, CV Scan), Outreach, Analytics, Candidate Inquiries**. *(Ingestion Monitor, Token Monitor & Settings are HIDDEN).* |
| `director` | Director / Reviewer | Candidate review stages and shortlist approvals. |
| `client` | Client Contact | Client candidate portal review. |
| `viewer` | Read-Only Viewer | Read-only pipeline view. |

---

## 🧪 Testing, QA Suite & Verification

Before submitting pull requests or merging changes into `main`, developers **must** execute TypeScript verification, production build checks, and the internal QA test suite:

### 1. Static Type Checking & Build Verification

```bash
# 1. Verify TypeScript types (0 errors expected)
npx tsc --noEmit

# 2. Verify Next.js production build (29/29 routes expected)
npm run build
```

### 2. Executing Internal QA Test Suite

Career141 includes an internal test suite in `convex/admin/qaTests.ts`:

```bash
# Run the full QA test suite
node scripts/convex-env-run.js hosted run admin/qaTests:runFullQaSuite

# Run candidate deduplication test
node scripts/convex-env-run.js hosted run admin/qaTests:runDeduplicationTest

# Run core pipeline stage transitions test
node scripts/convex-env-run.js hosted run admin/qaTests:runCorePipelineTest

# Run WhatsApp message routing test
node scripts/convex-env-run.js hosted run admin/qaTests:runWhatsAppRoutingTest
```

---

## 📜 Engineering Rules & Deployment Discipline

All developers contributing to this codebase must adhere strictly to the engineering rules defined in [`AGENTS.md`](file:///c:/Users/user/Downloads/WORK/CV-Processing-Recruitment-Pipeline-System/AGENTS.md):

1. **Explain First, Then Implement**:
   - Produce a clear explanation (Symptom, Root Cause, Proposed Fix/Diff) before making changes or applying workarounds.
2. **Strict Adherence to Approved Configuration**:
   - Never introduce secondary fallbacks or unapproved AI models without written sign-off.
3. **Evidence Standard**:
   - Bug fixes and migrations must ship with empirical log output and before/after metrics.
4. **Rollout & Deployment Discipline**:
   - Concurrency or throughput adjustments must scale gradually with clear abort thresholds.
5. **No Hard AND Filters**:
   - Candidate search and matching logic must use soft weighted scoring to avoid zero-result outcomes.
6. **Data Integrity**:
   - Candidate updates and reverse matches must **merge, never overwrite**, preserving historical TA actions and reject statuses.

---

## 👥 Core Contacts & Documentation References

- **Architecture Guides**: See `docs/` for vector scaling, voice calling architecture, and brochure specifications.
- **Convex Database Schema**: [`convex/schema.ts`](file:///c:/Users/user/Downloads/WORK/CV-Processing-Recruitment-Pipeline-System/convex/schema.ts)
- **Role Permissions Hook**: [`src/hooks/useRole.ts`](file:///c:/Users/user/Downloads/WORK/CV-Processing-Recruitment-Pipeline-System/src/hooks/useRole.ts)
- **Deployment Workflow**: [`.github/workflows/deploy.yml`](file:///c:/Users/user/Downloads/WORK/CV-Processing-Recruitment-Pipeline-System/.github/workflows/deploy.yml)

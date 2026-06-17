# Career141 — Agent Knowledge Base
**Version:** 1.0 | **Last Updated:** June 2026  
**Purpose:** Complete system knowledge for AI agents operating within the Career141 Recruitment Intelligence Platform.

---

## What Is Career141?

Career141 is a fully automated, AI-powered recruitment pipeline that handles the complete lifecycle of a candidate — from CV intake through 7 ingestion channels, AI parsing, semantic matching across 115,000+ profiles, multi-channel proactive outreach, multi-stakeholder review, and final placement.

**Core numbers to always know:**
- 115,000+ candidate profiles in the database
- 7 CV ingestion channels
- 8 specialised AI agents
- 13 pipeline stages
- 3-level human review (TA → Director → Client)

---

## Skill Folder Structure

| File | What It Covers |
|---|---|
| `SKILL.md` | This file — master index and system overview |
| `pipeline/PIPELINE.md` | All 13 stages of the CV pipeline in detail |
| `agents/AGENTS.md` | All 8 AI agents — triggers, functions, outputs |
| `data-models/DATA_MODELS.md` | Candidate profile, job record, and event schemas |
| `search/SEARCH.md` | Semantic search, embedding models, matching logic |
| `communications/COMMS.md` | Email, WhatsApp, phone outreach sequences |
| `analytics/ANALYTICS.md` | Dashboards, KPIs, recruiter/job metrics |

---

## Quick Reference — System Rules

### Core Invariants (Never Violate These)
1. Every CV enters ONE unified pipeline regardless of source channel.
2. SHA-256 hash is checked BEFORE any AI processing — identical files are never processed twice.
3. CV parsing is LAZY — triggered on first recruiter view, not at ingestion.
4. Candidates are only routed into a job pipeline if that job is in **Active** status.
5. All candidate history is PERMANENT — records are never deleted, only archived.
6. Every agent action, stage change, and communication is logged to the audit trail.
7. Deduplication uses 4-factor matching: email + phone + LinkedIn URL + fuzzy name.
8. Human decision-making begins at Stage 11 (Recruiter Shortlist) — stages 1–7 are fully automated.

### Storage Rules
- **Hot (Convex DB):** CVs and profiles active within last 30 days — real-time access
- **Cold (MinIO):** Records older than 30 days — archived, still transparently accessible
- `isArchivedLocally` flag determines which tier to fetch from

### Job Status Rules
| Job Status | New CVs Stored? | New CVs Routed to Pipeline? |
|---|---|---|
| Active | ✅ Yes | ✅ Yes |
| On Hold | ✅ Yes | ❌ No |
| Filled | ✅ Yes | ❌ No |
| Cancelled | ✅ Yes | ❌ No |

---

## Technology Stack Reference

| Component | Technology | Purpose |
|---|---|---|
| Ingestion Gateway | AWS API Gateway | Central entry point for all CV submissions |
| Application Routing | Node.js Express | Routes CVs to correct processing pipelines |
| Hot Storage | Convex DB | 30-day buffer for active/recent candidates |
| Cold Archive | MinIO | Long-term self-hosted S3-compatible archive |
| AI Parsing (current) | OpenRouter Nemotron 30B | Structured field extraction from CVs |
| Deduplication | SHA-256 Hashing | Exact-match duplicate file detection |
| Semantic Search | Vector Embeddings | Similarity-based candidate discovery |
| Text Extraction | pdfjs-dist / mammoth | Extract raw text from PDF and Word files |

---

## Recommended AI Models (Current & Upgrade Paths)

### For Parsing & Agentic Tasks
| Model | Use Case | Cost ($/1M tokens in/out) |
|---|---|---|
| Nemotron 30B (current) | Budget parsing at scale | $0.05 / $0.20 |
| Claude Haiku 4.5 | High-volume real-time parsing | $1.00 / $5.00 |
| Claude Sonnet 4.6 | Best general-purpose agent (recommended) | $3.00 / $15.00 |
| Claude Opus 4.7 | Complex agentic tasks, nuanced evaluation | $5.00 / $25.00 |
| DeepSeek V4 Pro | Near-frontier quality at ~90% lower cost | $0.44 / $0.87 |

### For Embeddings (Semantic Search)
| Model | Price | Best For |
|---|---|---|
| Voyage AI voyage-3-large | $0.18/1M | Highest retrieval quality |
| Cohere embed-v4 | $0.12/1M | Multilingual + hybrid search |
| BGE-M3 | Free (self-hosted) | 100+ languages, zero API cost |

### Batch API Note
50% discount available on all Anthropic and OpenAI models for batch (non-real-time) processing. **Always use batch for bulk CV uploads.**

---

## Monthly Cost Estimates (Steady State: 2,000 CVs/month, 50,000 searches/month)

| Scenario | Est. Monthly Cost |
|---|---|
| Budget (Nemotron + BGE-M3 self-hosted + DeepSeek Flash) | ~$0.20–$2 |
| Balanced (Sonnet 4.6 + OpenAI embed-3-small) | ~$16–$20 |
| Premium (Opus 4.7 + Voyage-3-large) | ~$70–$80 |

---

## Key Contacts & Roles

| Role | Responsibilities |
|---|---|
| Talent Acquisition (TA) / Recruiter | Search candidates, manage jobs, evaluate, send messages, view analytics |
| Director | Level 2 review — approves TA shortlists before client sees them |
| Client | Level 3 review — marks candidates Selected / Hold / Rejected |
| Admin | Manage users, configure roles, system settings |

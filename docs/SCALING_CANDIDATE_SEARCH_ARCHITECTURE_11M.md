# Scaling Candidate Search Architecture (11M CV Scale)

## Executive Summary
This document outlines the complete architectural design and phased implementation roadmap to scale Career141's search engine to **11 Million CVs**. The architecture guarantees sub-30ms vector search across millions of profiles while delivering **top 20, 30, or 50 high-precision, accurately scored candidate matches** directly to the recruiter's dashboard.

---

## 1. Problem Statement: Why Search Failed at Scale

At 10,000 CVs, the initial search system functioned, but when scaling towards 11 Million CVs, four architectural bottlenecks restricted results to only 5–10 candidates:

1. **Convex Vector Search Hard Cap (100–256)**:
   * Convex ANN vector search scanned only the top 100–256 vectors out of 11 Million (0.0009% of the database).
   * Over 99.99% of relevant candidates were never evaluated.
2. **Artificial Pre-Scoring Slice (`slice(0, 30)`)**:
   * Before running multi-dimensional scoring, the search engine sliced the candidate pool to 30 items.
   * High-quality matches that survived filtering but sat outside the first 30 positions were discarded.
3. **JD Parser Truncation (7,000 Characters)**:
   * Long job descriptions (10,000–25,000 chars) had responsibilities and qualifications cut off, leading to incomplete skill vectors and weak search terms.
4. **Hard Score Dropouts (< 60%)**:
   * Candidates missing a single non-critical requirement or having an alternate job title were completely dropped instead of receiving a weighted soft penalty.

---

## 2. The 2-Stage High-Recall Search Architecture

To ensure high recall across 11 Million candidates without overwhelming the recruiter, the system utilizes a **Two-Stage Search Pipeline**:

```
                         11 MILLION CANDIDATES DATABASE
                                       │
                                       ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │ STAGE 1: High-Throughput Vector Scanning (Qdrant)                   │
    │ - Scans top 1,000 to 5,000 candidate vectors in <30ms               │
    │ - Applies hard metadata filters (Location, Seniority, Min Exp)      │
    │ - Surviving pool: ~150 qualified candidates                         │
    └──────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │ STAGE 2: Multi-Dimensional Precision Ranking (Convex + LLM)         │
    │ - Scores surviving 150 candidates across 5 weighted dimensions      │
    │ - Evaluates Domain Gating (Programming, Trade, Business, etc.)      │
    │ - Fast LLM Re-ranker produces human-like TA Match Rationale         │
    │ - Selects the ABSOLUTE TOP 20, 30, or 50 BEST MATCHES               │
    └──────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │ RECRUITER UI DASHBOARD                                              │
    │ - Displays clean list of Top 20 / 30 / 50 Pre-Scored Matches        │
    │ - 1-Click "Add to Pipeline" in 'new_cvs' or 'matched_candidates'    │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 5 Core Guarantees

1. **Recruiter Output Volume**:
   * The UI displays **top 20, 30, or 50 candidates max** with clean match breakdowns and rationale.
2. **True 11M Scale Capacity**:
   * Qdrant performs sub-30ms HNSW vector searches with payload filtering across 11M 1024-dimensional vectors.
3. **Zero CV Ingestion Interruption**:
   * Convex database writes remain 100% primary and authoritative.
   * Qdrant vector synchronization runs asynchronously in background `try/catch` handlers. Ingestion and CV processing never block or fail due to external vector service latency.
4. **Local-First Testing**:
   * The full stack is developed and tested locally on Docker (`localhost:6333`) before deployment to production VPS.
5. **Automatic Fail-Open Search Fallback**:
   * If the Qdrant service is unreachable, `aiSearch` automatically falls back to Convex native `vectorSearch` without crashing or interrupting the recruiter experience.

---

## 4. Phased Implementation Roadmap

### Phase 1: Local Docker Setup & Qdrant Client Utility
* Add Qdrant container service to [docker-compose.yml](file:///c:/Users/user/Downloads/WORK/CV-Processing-Recruitment-Pipeline-System/docker-compose.yml) (`localhost:6333`).
* Install `@qdrant/js-client-rest`.
* Create [convex/lib/qdrant.ts](file:///c:/Users/user/Downloads/WORK/CV-Processing-Recruitment-Pipeline-System/convex/lib/qdrant.ts) with `candidate_vectors` collection setup (1024 dimensions, Cosine distance).

### Phase 2: Asynchronous Non-Blocking Vector Sync
* Update `generateAndStoreEmbedding` in [convex/matching/agent2.ts](file:///c:/Users/user/Downloads/WORK/CV-Processing-Recruitment-Pipeline-System/convex/matching/agent2.ts) to push embeddings to Qdrant with candidate metadata payloads (skills, seniority, experience, location, education).
* Ensure Convex DB writes are primary; Qdrant sync errors log non-blocking warnings.

### Phase 3: High-Recall Search Engine Refactoring
* Update `aiSearch` in [convex/matching/search.ts](file:///c:/Users/user/Downloads/WORK/CV-Processing-Recruitment-Pipeline-System/convex/matching/search.ts) to query Qdrant (top 1,000 candidates), apply metadata filters, and pass surviving ~150 candidates to scoring.
* Remove the pre-scoring `slice(0, 30)` cap.
* Replace hard score dropouts with weighted soft penalties.
* Deliver top 20–50 scored candidates to the recruiter UI.

### Phase 4: Schema & Full-Text Search Expansion
* Expand the JD parser input buffer to 30,000 characters in [convex/lib/jdParser.ts](file:///c:/Users/user/Downloads/WORK/CV-Processing-Recruitment-Pipeline-System/convex/lib/jdParser.ts).
* Add search indexes in [convex/schema.ts](file:///c:/Users/user/Downloads/WORK/CV-Processing-Recruitment-Pipeline-System/convex/schema.ts) for `search_certifications`, `search_education`, and `search_past_titles`.

### Phase 5: Local Testing & Contabo VPS Deployment
* Verify end-to-end flow locally with test queries and CV uploads.
* Deploy Qdrant service to Contabo VPS via `docker-compose.prod.yml`.
* Run background backfill action to populate all candidate vectors into Qdrant.

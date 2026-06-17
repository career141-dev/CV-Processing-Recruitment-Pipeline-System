# Career141 — Search & Semantic Matching

---

## Overview

Career141 uses a multi-mode search system to find the best candidates from 115,000+ profiles. All candidates are indexed with vector embeddings at profile creation time, enabling semantic search that understands meaning — not just keywords.

---

## Search Modes

### Mode 1: AI Job Description Search (Semantic)
- TA pastes the full job description into the search box
- AI reads the description and understands all requirements
- Query is converted to a vector embedding
- Vector compared against all 115,000+ candidate embeddings
- Top matches retrieved and re-ranked with detailed 0–100 score
- Results ranked by score (highest first)

**Example:** Searching "Senior finance professional with banking experience" finds candidates whose CVs say "VP Treasury & Capital Markets" — because the system understands meaning, not just words.

### Mode 2: Advanced Filter Search (Keyword)
Hard-criteria filtering. Returns only candidates matching ALL selected filters.

**Built-in Filters:**

| Filter | Options/Range |
|---|---|
| Skills | Multi-select: React, Python, AWS, Java, etc. |
| Seniority Level | Junior / Mid / Senior / Lead / Manager / Director / C-Level |
| Years of Experience | Slider: min to max (e.g., 5–8 years) |
| Job Title / Role | Exact title search |
| Industry / Sector | IT, Finance, Healthcare, Retail, Manufacturing, etc. |
| Location | Country / City / Remote |
| Education Level | Diploma / Bachelor / Masters / PhD |
| Certifications | PMP, AWS Certified, CFA, etc. |
| Languages | English, Spanish, French, etc. |
| Notice Period | Immediate / 1 week / 2 weeks / 1 month / 3 months |
| Employment Status | Employed / Unemployed / Freelance / Open to Opportunities |

### Mode 3: Custom / Dynamic Filters
TAs can add custom filter requirements on the spot that go beyond built-in options.

**Examples:**
- `"Revit 2024"` (specific tool version)
- `"ISO 27001 Lead Auditor"` (niche certification)
- `"Must have worked at a Big 4 consulting firm"`
- `"UK Security Clearance (SC or higher)"`
- `"Financial derivatives trading"` (domain expertise)

**How it works:** System searches candidate CV text for the exact phrase/concept and returns only matching candidates.

### Mode 4: Hybrid Search
Combines semantic (vector) and keyword/filter modes.
- Semantic: finds conceptually similar candidates
- Filter: narrows by hard criteria
- Best precision + recall for complex requirements

---

## Embedding Architecture

### How Embeddings Are Created
1. Agent 6 (Deduplication) triggers embedding generation after profile creation
2. Full profile text is assembled (name, skills, experience, education, etc.)
3. Text sent to configured embedding model
4. Output vector stored in vector database alongside candidate profile
5. Index updated — candidate becomes searchable immediately

### Embedding Models Available

| Model | Provider | Dimensions | Context | Multilingual | Cost |
|---|---|---|---|---|---|
| voyage-3-large | Voyage AI | 1024–2048 | 32K | Yes | $0.18/1M tokens |
| embed-v4 | Cohere | 1536 | 128K | Strong (100+) | $0.12/1M |
| text-embedding-3-large | OpenAI | 3072 | 8K | Moderate | $0.13/1M |
| text-embedding-3-small | OpenAI | 1536 | 8K | Moderate | $0.02/1M |
| BGE-M3 | BAAI | 1024 | 8K | 100+ languages | Free (self-hosted) |
| NV-Embed-v2 | NVIDIA | 4096 | 32K | Moderate | Free (self-hosted) |
| Nomic Embed v2 | Nomic | 768 | 8K | Strong | Free (self-hosted) |
| EmbeddingGemma-300M | Google | 768 | 8K | Yes | Free (self-hosted, <200MB RAM) |
| Qwen3-Embedding | Alibaba | Variable | 32K | 100+ languages | Free (self-hosted) |

**Recommended for Career141:** Voyage AI voyage-3-large (highest retrieval quality) or BGE-M3 (free, self-hosted, 100+ languages)

**Cost note:** Indexing the full 115,000-candidate database with Voyage AI voyage-3-large costs approximately $4–$10 as a one-time build (assuming ~500 tokens per candidate profile).

---

## Reranking

After initial vector retrieval, a reranker can improve result quality by doing a deeper comparison between the query and each retrieved candidate.

### Reranking Models

| Model | Provider | Cost | Best For |
|---|---|---|---|
| Rerank-3.5 | Cohere | $1.00 per 1,000 searches | Production; integrates with Cohere pipelines |
| BGE-reranker-v2 | BAAI | Free (self-hosted) | Open-source; lifts recall by 10–25% |
| Voyage AI rerankers | Voyage AI | Free (first 200M tokens) | Pairs natively with Voyage embeddings |

**Recommended pattern:** Vector search → retrieve top 200 → reranker → return top 20

---

## Match Score Calculation (0–100)

Agent 2 calculates a detailed match score for every candidate against a job. This score is used to sort candidates in the Job Dashboard.

**Score Factors:**
| Factor | What It Measures |
|---|---|
| Skills Overlap | Percentage of required skills the candidate has |
| Experience Relevance | Years + domain relevance vs requirements |
| Job Title Similarity | Semantic similarity between candidate title and target role |
| Industry Background | Relevant sector experience |
| Location Fit | Geographic match or remote preference alignment |
| Seniority Level | Candidate level vs required seniority |

**Score Interpretation:**
| Score | Meaning |
|---|---|
| 100 | Perfect match on all factors |
| 75–99 | Strong match — recommend for TA review |
| 50–74 | Moderate match — review with context |
| 0–49 | Weak match |

---

## Headhunting Flow (Database Search for Existing Roles)

1. TA opens a job or searches the full database
2. Agent 2 runs semantic search across all 115,000+ profiles (not just new applicants)
3. Historical candidates (even those who applied 18+ months ago) are surfaced
4. Agent 5 calls matched database candidates
5. Agent 3 sends email follow-ups to unresponsive matches
6. Interested candidates are flagged for TA follow-up and added to the headhunting pipeline

---

## Search Result Display

Every candidate in search results shows:
- Name and current title
- Match score (0–100)
- Source channel and application date
- Top matching skills
- Location
- Seniority level
- Visual flag if any parsed fields have low confidence scores
- Last communication event (if any)

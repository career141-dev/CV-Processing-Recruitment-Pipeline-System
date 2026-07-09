---
name: candidate-matching
description: AI candidate matching and search for Career141 (Agent 2). Use when implementing or debugging reverse match on job creation, semantic search, natural language search, vector embeddings with Voyage AI, combined AI+filter search, match score display, or source-grouped shortlist delivery.
---

# Candidate Matching Skill (Agent 2)

Candidate matching supports two primary functionalities:
1. **Reverse Match**: Triggered automatically on job publication or manually via the "rescan" button in the job dashboard. Scores candidates using vector and keyword search and saves a ranked shortlist.
2. **AI Search**: Natural language search, semantic search, and structured filters on the candidate database.

## Vector Embeddings

Embeddings are generated via the **NVIDIA NIM API** using the `nvidia/nv-embedqa-e5-v5` model (1024-dimensional vector).
- passage text is embedded using the `passage` input type.
- query text is embedded using the `query` input type.

---

## 1. Reverse Matching Engine

The matching engine is implemented in [runReverseMatch](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/matching/agent2.ts#L105):

### Step-by-Step Flow:
1. **Initialize**: Sets the job's `reverseMatchStatus` to `"running"`.
2. **Generate Job Embedding**: If the job has no embedding, constructs a structured requirements string (Title, description, required/preferred skills, industry, seniority) and generates the job embedding.
3. **Parallel Keyword Search**: Extracts the job title and the first four required skills as search terms. Runs full-text searches (via `searchCandidates`) in parallel to fetch up to 40 candidates per term, then dedupes them.
4. **Vector Search Scan**: Performs a vector search on the `candidates` table using `vector_index_candidates` with the job embedding to fetch the top 150 candidates.
5. **On-the-fly Embedding Generation**: Identifies candidates from the keyword search results that are missing embeddings. Generates and stores their embeddings on the fly (limited to 15 per run) to ensure accuracy.
6. **Enrich and Cosine Similarity**: Merges vector search and keyword search candidates. If a keyword candidate was not retrieved in the vector search, it manually calculates the cosine similarity between the job embedding and the candidate's embedding.
7. **Job-Weighted Heuristic Scoring**: Scores each candidate against the requirements, applying the weights configured on the job (Title, Skills, Experience, Industry, Location):
   $$\text{MatchScore} = \text{TitleScore} \times W_{\text{title}} + \text{SkillScore} \times W_{\text{skills}} + \text{ExperienceScore} \times W_{\text{exp}} + \text{IndustryScore} \times W_{\text{industry}} + \text{LocationScore} \times W_{\text{location}}$$
8. **STRICT Filter Gate**: Filters out candidates who have **any missing required skills** (`missingSkills.length > 0`) or whose overall score is below `minMatchScoreToShow` (default 60).
9. **Save Shortlist**: Saves the top 30 sorted candidates to the job's `reverseMatchResults` record and sets the status to `"done"`.

---

## 2. AI Combined Search (`aiSearch` action)

The search functionality parses a natural language query, performs dual vector and keyword search, calculates heuristics, and performs LLM re-ranking.

```ts
// convex/matching/search.ts -> aiSearch
```

### Steps:
1. **Query Parsing**: Parses natural language using `extractSearchRequirements` to build structured `SearchRequirements`.
2. **Query Embedding**: Embeds the query using the NVIDIA NIM API.
3. **Vector Search Scan**: Performs vector search using `vector_index_candidates` (top 100).
4. **Keyword Search Scan**: Runs keyword searches on the main query, alternative titles, and keywords in parallel.
5. **Merge & Heuristic Ranking**: Merges vector and keyword search results, dedupes them, scores them heuristically (Title, Seniority, Experience, Skills, Industry, Location), and sorts them.
6. **LLM Re-Scoring**: Takes the top 15-20 candidates and calls the NIM Llama-3.1 model to calculate a refined score (`scoreWithLLM`).
7. **Blend and Sort**: Sorts the pool by the LLM score, falling back to vector score, heuristics, and location match. Filters out candidates with overallScore < 20 and titleScore < 40.
8. **Pipeline Action**: Recruiter can select multiple candidates and trigger [bulkAddToPipeline](file:///c:/Users/hdbin/Documents/Projects/cv-processing-recruitment-pipeline-system/convex/matching/search.ts#L276) to add them to a job pipeline under the `applications` table in the `"new_cvs"` stage.

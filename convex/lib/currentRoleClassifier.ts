"use node";

import { getModelForTask, getOpenAI } from "./llm";

export interface CandidateForRoleClassification {
  _id: string;
  currentJobTitle?: string | null;
  currentEmployer?: string | null;
  sector?: string | null;
  totalExperienceYears?: number | null;
  pastJobTitles?: string[] | null;
}

export interface CandidateRoleClassificationResult {
  candidateId: string;
  rank: number | null; // 0 to 9, or null if fail-open/skipped
  rankLabel: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  usedFallbackTitle: boolean;
  roleFamily: string; // e.g. software_engineering, fmcg_sales, other
  roleFamilyMatch: "exact" | "synonym" | "adjacent" | "unrelated";
  exclusionReason: string | null;
  errorReason?: string;
}

const BATCH_SIZE = 20;

/**
 * Classify a job's function into a normalized role family slug.
 */
export async function classifyJobRoleFamily(
  jobTitle: string,
  jobDescription?: string,
  seniorityLevel?: string
): Promise<{ roleFamily: string; reasoning: string }> {
  try {
    const model = getModelForTask("jd_matching");
    const openai = getOpenAI("jd_matching");

    const prompt = `Analyze this job posting and assign a normalized role family slug (snake_case).
Examples: software_engineering, qa_testing, devops_cloud, data_ai, product_management, design_uiux, fmcg_sales, B2B_sales, finance_accounting, hr_recruitment, marketing, operations_logistics, civil_engineering, textile_merchandising, tea_trading, medical_nursing, legal, executive_management, other.
If the job function is specialized or non-standard, assign a descriptive snake_case tag or "other".

Job Title: ${jobTitle}
Seniority: ${seniorityLevel || "Not specified"}
Description snippet: ${(jobDescription || "").slice(0, 300)}

Return ONLY valid JSON matching:
{
  "roleFamily": "snake_case_string",
  "reasoning": "short explanation"
}`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Job role family 8s hard timeout")), 8000)
    );

    const response = await Promise.race([
      openai.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: 500,
        messages: [
          { role: "system", content: "You are an expert talent acquisition classifier." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
      timeoutPromise,
    ]);

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    const roleFamily = typeof parsed.roleFamily === "string" && parsed.roleFamily.trim()
      ? parsed.roleFamily.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")
      : "other";

    return {
      roleFamily: roleFamily || "other",
      reasoning: parsed.reasoning || "Derived job role family",
    };
  } catch (err) {
    console.error("Failed to classify job role family:", err);
    return {
      roleFamily: "other",
      reasoning: "Fallback role family due to classification error",
    };
  }
}

/**
 * Classify a batch of candidate profiles for 10-level Corporate Rank and Role-Family Equivalence.
 * Max batch size = 20. Fail-open error isolation applied per candidate.
 */
export async function classifyCurrentRolesBatch(
  candidates: CandidateForRoleClassification[],
  jobTitle: string,
  jobRoleFamily: string
): Promise<Map<string, CandidateRoleClassificationResult>> {
  const resultMap = new Map<string, CandidateRoleClassificationResult>();

  if (candidates.length === 0) return resultMap;

  // Cap un-cached candidate classifications to top 20 candidates (1 chunk max per reverse match run)
  const cappedCandidates = candidates.slice(0, 20);

  const chunks: CandidateForRoleClassification[][] = [];
  for (let i = 0; i < cappedCandidates.length; i += BATCH_SIZE) {
    chunks.push(cappedCandidates.slice(i, i + BATCH_SIZE));
  }

  // Execute chunk classification with 12s hard timeout protection
  const chunkResultMaps = await Promise.all(
    chunks.map((chunk) => processSingleChunk(chunk, jobTitle, jobRoleFamily))
  );

  chunkResultMaps.forEach((chunkMap) => {
    chunkMap.forEach((val, key) => resultMap.set(key, val));
  });

  return resultMap;
}

async function processSingleChunk(
  chunk: CandidateForRoleClassification[],
  jobTitle: string,
  jobRoleFamily: string
): Promise<Map<string, CandidateRoleClassificationResult>> {
  const resultMap = new Map<string, CandidateRoleClassificationResult>();

  // Build candidate input payload
  const candidateInputs = chunk.map((c) => {
    let titleToUse = c.currentJobTitle && c.currentJobTitle.trim() ? c.currentJobTitle.trim() : null;
    let usedFallback = false;

    if (!titleToUse && Array.isArray(c.pastJobTitles) && c.pastJobTitles.length > 0) {
      titleToUse = c.pastJobTitles[0];
      usedFallback = true;
    }

    return {
      candidateId: c._id,
      title: titleToUse || "Unspecified Role",
      employer: c.currentEmployer || null,
      sector: c.sector || null,
      totalExpYears: c.totalExperienceYears ?? null,
      usedFallback,
    };
  });

  const prompt = `You are a Senior Talent Acquisition Specialist classifying current corporate role levels and role family equivalences.

TARGET JOB DETAILS:
- Job Title: "${jobTitle}"
- Job Role Family: "${jobRoleFamily}"

CANONICAL 10-LEVEL RANK TAXONOMY (Corporate Ladder):
0  entry_level      (Intern, Graduate Trainee, Junior Developer, Assistant, Entry-Level)
1  mid_level        (Software Engineer, Executive, Specialist, Designer, Analyst, Developer)
2  executive        (Senior Engineer, Executive, Lead Designer, Senior Specialist)
3  senior_executive (Senior Executive, Assistant Manager, Specialist Lead)
4  manager          (Manager, Product Manager, QA Manager, Sales Manager, Team Lead)
5  senior_manager   (Senior Manager, Head of Department, Lead Specialist)
6  agm              (Assistant General Manager, Associate Director)
7  gm               (General Manager, Country Manager)
8  director         (Director, Senior Director, Head of Function)
9  c_suite          (VP, C-Suite, CEO, CTO, Founder, President)

ROLE-FAMILY MATCH TIERS against Target Job ("${jobTitle}", "${jobRoleFamily}"):
- "exact": Identical function & title scope (e.g. Software Engineer -> Software Engineer).
- "synonym": Recognized equivalent function (e.g. Software Developer <-> Software Engineer, Full Stack Developer <-> Full Stack Engineer).
- "adjacent": Related but distinct function (e.g. Backend Developer applying to Full Stack, or QA Engineer / DevOps applying to Software Engineer).
- "unrelated": Different function entirely (e.g. Sales Executive or HR Officer applying to Software Engineer).

CANDIDATES TO CLASSIFY:
${JSON.stringify(candidateInputs, null, 2)}

Return ONLY valid JSON with keys matching candidateId exactly:
{
  "<candidateId>": {
    "rank": 0-9 (integer),
    "rankLabel": "Entry-Level" | "Mid-Level" | "Executive" | "Senior Executive" | "Manager" | "Senior Manager" | "AGM" | "GM" | "Director" | "C-Suite",
    "confidence": "high" | "medium" | "low",
    "reasoning": "short 1-sentence explanation",
    "roleFamily": "snake_case_string (or 'other')",
    "roleFamilyMatch": "exact" | "synonym" | "adjacent" | "unrelated",
    "exclusionReason": string or null (if candidate's current role rank exceeds target job level, describe specifically why overqualified, e.g. "Candidate's current level (Senior Manager) exceeds target job level")
  }
}`;

  try {
    const model = getModelForTask("jd_matching");
    const openai = getOpenAI("jd_matching");

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("LLM candidate classification 12s hard timeout reached")), 12000)
    );

    const response = await Promise.race([
      openai.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: 1800,
        messages: [
          { role: "system", content: "You are an expert talent acquisition classifier. Output valid JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
      timeoutPromise,
    ]);

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsedObj = JSON.parse(content);

    for (const item of candidateInputs) {
      const cid = item.candidateId;
      const parsed = parsedObj[cid] || parsedObj;

      if (parsed && typeof parsed === "object" && typeof parsed.rank === "number") {
        const rank = Math.max(0, Math.min(9, Math.round(parsed.rank)));
        const confidence = parsed.usedFallback ? "medium" : (parsed.confidence || "high");
        const roleFamilyMatch = ["exact", "synonym", "adjacent", "unrelated"].includes(parsed.roleFamilyMatch)
          ? parsed.roleFamilyMatch
          : "synonym";

        resultMap.set(cid, {
          candidateId: cid,
          rank,
          rankLabel: parsed.rankLabel || `Rank ${rank}`,
          confidence: (confidence === "high" || confidence === "medium" || confidence === "low") ? confidence : "medium",
          reasoning: parsed.reasoning || "Classified current corporate role level",
          usedFallbackTitle: item.usedFallback,
          roleFamily: (typeof parsed.roleFamily === "string" && parsed.roleFamily.trim()) ? parsed.roleFamily.trim().toLowerCase() : "other",
          roleFamilyMatch,
          exclusionReason: typeof parsed.exclusionReason === "string" ? parsed.exclusionReason : null,
        });
      } else {
        // Fail-open for single candidate schema failure
        resultMap.set(cid, createFailOpenResult(cid, item.usedFallback, "item_schema_mismatch"));
      }
    }
  } catch (err) {
    console.error("Batch classification failed (applying fail-open policy to chunk):", err);
    // Fail-open policy for whole batch
    for (const item of candidateInputs) {
      resultMap.set(item.candidateId, createFailOpenResult(item.candidateId, item.usedFallback, "classification_failed"));
    }
  }

  return resultMap;
}

function createFailOpenResult(
  candidateId: string,
  usedFallbackTitle: boolean,
  errorReason: string
): CandidateRoleClassificationResult {
  return {
    candidateId,
    rank: null,
    rankLabel: "Unclassified",
    confidence: "low",
    reasoning: "Classification failed-open due to infrastructure/timeout error",
    usedFallbackTitle,
    roleFamily: "unknown",
    roleFamilyMatch: "synonym", // Neutral 1.0x multiplier on fail-open
    exclusionReason: null,
    errorReason,
  };
}

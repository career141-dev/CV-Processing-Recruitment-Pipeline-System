// @ts-nocheck
import { getOpenAI, getModelForTask } from "../lib/llm";
import type { SearchRequirements } from "../lib/jdParser";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2);
}

export function distinct(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function titleTokens(value: string): string[] {
  const stopwords = new Set([
    "junior", "jr", "mid", "midlevel", "mid level",
    "senior", "sr", "lead", "principal", "assistant",
    "associate", "staff", "experienced", "seasoned",
    "entry", "entry level", "level",
  ]);
  return tokenize(value).filter((token) => !stopwords.has(token));
}

function skillTokens(value: string): string[] {
  return tokenize(value).filter((token) => token.length > 1);
}

function inferSeniorityFromText(text: string): string | null {
  const t = normalizeText(text);
  if (/\bintern\b/.test(t)) return "intern";
  if (/\bjunior\b|\bjr\b|\bentry level\b/.test(t)) return "junior";
  if (/\bmid level\b|\bmidlevel\b|\bmid\b/.test(t)) return "mid";
  if (/\bsenior\b|\bsr\b|\blead\b|\bprincipal\b|\bstaff\b/.test(t)) return "senior";
  if (/\bhead\b|\bdirector\b|\bvp\b|\bvice president\b|\bchief\b|\bcto\b|\bceo\b|\bcfo\b/.test(t)) return "executive";
  return null;
}

function seniorityRank(value?: string | null): number {
  switch ((value ?? "").toLowerCase()) {
    case "intern": return 0;
    case "junior": return 1;
    case "mid": return 2;
    case "senior": return 3;
    case "lead": return 4;
    case "executive": return 5;
    default: return -1;
  }
}

function yearsScore(candidateYears: number | null | undefined, minimumYears: number | null): number {
  if (minimumYears == null) return candidateYears == null ? 75 : 92;
  if (candidateYears == null) return 65;
  if (candidateYears >= minimumYears) return 100;
  const gap = minimumYears - candidateYears;
  if (gap <= 1) return 88;
  if (gap <= 2) return 76;
  if (gap <= 3) return 64;
  if (gap <= 5) return 50;
  return 35;
}

function textContainsEither(a: string, b: string): boolean {
  return normalizeText(a).includes(normalizeText(b)) || normalizeText(b).includes(normalizeText(a));
}

export function stripSeniorityWords(text: string): string {
  let result = text;
  const phrases = ["head of", "director of", "vp of", "manager of"];
  for (const phrase of phrases) {
    result = result.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
  }
  const words = ["senior", "junior", "lead", "principal", "associate", "assistant", "chief", "staff"];
  for (const word of words) {
    result = result.replace(new RegExp(`\\b${word}\\b`, "gi"), "");
  }
  return result.replace(/\s+/g, " ").trim();
}

function scoreTitleMatchImpl(jobTitles: string[], candidateTitleText: string): number {
  const cleanedCandidate = stripSeniorityWords(candidateTitleText);
  const candidateNorm = normalizeText(cleanedCandidate);
  if (!candidateNorm) return 55;

  let best = 0;
  for (const jobTitle of jobTitles) {
    const cleanedJob = stripSeniorityWords(jobTitle);
    const jobNorm = normalizeText(cleanedJob);
    if (!jobNorm) continue;

    if (candidateNorm === jobNorm) {
      return 100;
    }

    if (textContainsEither(candidateNorm, jobNorm)) {
      best = Math.max(best, 92);
    }

    const jobTokens = titleTokens(cleanedJob);
    const candidateTokens = titleTokens(cleanedCandidate);
    if (jobTokens.length === 0 || candidateTokens.length === 0) continue;

    const jobTokenSet = new Set(jobTokens);
    const candidateTokenSet = new Set(candidateTokens);
    const overlap = [...jobTokenSet].filter((token) => candidateTokenSet.has(token)).length;
    const coverage = overlap / jobTokenSet.size;
    const reciprocal = overlap / candidateTokenSet.size;
    const blended = (coverage * 0.7) + (reciprocal * 0.3);
    const score = 55 + Math.round(blended * 40);
    best = Math.max(best, score);
  }

  return Math.max(45, Math.min(100, Math.round(best || 55)));
}

function normalizeSkillForComparison(value: string): string {
  return normalizeText(value)
    .replace(/\bnode js\b/g, "nodejs")
    .replace(/\breact js\b/g, "reactjs")
    .replace(/\bvue js\b/g, "vuejs")
    .replace(/\bnext js\b/g, "nextjs")
    .replace(/\bpower bi\b/g, "powerbi")
    .replace(/\bms excel\b/g, "excel")
    .replace(/\bmicrosoft excel\b/g, "excel")
    .replace(/\bsql server\b/g, "sql")
    .replace(/\bdata analysis\b/g, "analytics")
    .trim();
}

function skillMatches(requiredSkill: string, candidateSkills: string[]): string | null {
  const requiredNorm = normalizeSkillForComparison(requiredSkill);
  if (!requiredNorm) return null;

  for (const candidateSkill of candidateSkills) {
    const candidateNorm = normalizeSkillForComparison(candidateSkill);
    if (!candidateNorm) continue;
    if (candidateNorm === requiredNorm) return candidateSkill;
    if (candidateNorm.includes(requiredNorm) || requiredNorm.includes(candidateNorm)) return candidateSkill;

    const requiredTokens = skillTokens(requiredNorm);
    const candidateTokens = skillTokens(candidateNorm);
    if (requiredTokens.length === 0 || candidateTokens.length === 0) continue;

    const requiredSet = new Set(requiredTokens);
    const candidateSet = new Set(candidateTokens);
    const overlap = [...requiredSet].filter((token) => candidateSet.has(token)).length;
    const score = overlap / Math.max(requiredSet.size, candidateSet.size);
    // Loosened threshold from 0.75 to 0.6 to capture more true multi-word skill matches, subject to validation
    if (score >= 0.6) return candidateSkill;
  }

  return null;
}

export function scoreSkills(requiredSkills: string[], preferredSkills: string[], candidateSkills: string[]) {
  const matchedRequired: string[] = [];
  const missingRequired: string[] = [];
  const matchedPreferred: string[] = [];

  for (const skill of distinct(requiredSkills)) {
    const match = skillMatches(skill, candidateSkills);
    if (match) matchedRequired.push(match);
    else missingRequired.push(skill);
  }

  for (const skill of distinct(preferredSkills)) {
    const match = skillMatches(skill, candidateSkills);
    if (match) matchedPreferred.push(match);
  }

  const requiredCount = distinct(requiredSkills).length;
  const preferredCount = distinct(preferredSkills).length;
  if (requiredCount === 0 && preferredCount === 0) {
    return {
      score: 75,
      matchedRequired,
      missingRequired,
      matchedPreferred,
    };
  }
  const requiredCoverage = requiredCount === 0 ? 1 : matchedRequired.length / requiredCount;
  const preferredCoverage = preferredCount === 0 ? 0 : matchedPreferred.length / preferredCount;

  const score = Math.round(
    Math.min(
      100,
      (requiredCoverage * 70) + (preferredCoverage * 30)
    )
  );

  return {
    score,
    matchedRequired,
    missingRequired,
    matchedPreferred,
  };
}

function scoreIndustry(jobIndustry: string | null, candidateIndustries?: string[] | null): number {
  if (!jobIndustry) return 100;
  if (!candidateIndustries || candidateIndustries.length === 0) return 60;
  const jobNorm = normalizeText(jobIndustry);
  const matched = candidateIndustries.some(
    (ind) => normalizeText(ind) === jobNorm || normalizeText(ind).includes(jobNorm) || jobNorm.includes(normalizeText(ind))
  );
  return matched ? 100 : 45;
}

function scoreLocation(jobLocation: string | null, candidateLocation?: string | null): number {
  if (!jobLocation) return 100;
  if (!candidateLocation) return 65;
  const jobNorm = normalizeText(jobLocation);
  const candidateNorm = normalizeText(candidateLocation);
  if (!jobNorm || !candidateNorm) return 65;
  if (candidateNorm === jobNorm || candidateNorm.includes(jobNorm) || jobNorm.includes(candidateNorm)) return 100;
  const jobTokens = new Set(tokenize(jobNorm));
  const candidateTokens = new Set(tokenize(candidateNorm));
  const overlap = [...jobTokens].filter((token) => candidateTokens.has(token)).length;
  return overlap > 0 ? 78 : 55;
}

function buildCandidateTitleText(cv: {
  currentTitle?: string;
  summary?: string;
  fullName?: string;
  rawText?: string;
}): string {
  return [
    cv.currentTitle,
    cv.summary?.slice(0, 160),
    cv.fullName,
    cv.rawText?.slice(0, 240),
  ].filter(Boolean).join(" ");
}

export type ScoredCandidate = {
  index: number;
  cv: {
    _id: string;
    fullName?: string;
    currentTitle?: string;
    currentEmployer?: string;
    industries?: string[];
    seniorityLevel?: string;
    yearsOfExperience?: number;
    location?: string;
    skills?: string[];
    rawText?: string;
    summary?: string;
    vectorScore?: number;
  };
  titleScore: number;
  seniorityScore: number;
  experienceScore: number;
  skillScore: number;
  industryScore: number;
  locationScore: number;
  overallScore: number;
  locationStatus: "match" | "different" | "not specified";
  matchedRequired: string[];
  missingRequired: string[];
  matchedPreferred: string[];
  reason: string;
};

const skillSynonyms: Record<string, string[]> = {
  JavaScript: ["js", "javascript", "node.js", "node", "nodejs"],
  React: ["reactjs", "react.js", "react native"],
  Python: ["python3", "python2", "py"],
  SQL: ["mysql", "postgresql", "postgres", "mssql", "sql server"],
  Excel: ["ms excel", "microsoft excel", "spreadsheets"],
  "Power BI": ["powerbi", "power-bi", "microsoft power bi"],
  "C#": ["c sharp", "csharp"],
  AWS: ["amazon web services", "amazon aws"],
  Azure: ["microsoft azure", "ms azure"],
  "UI/UX": ["ux design", "ui design", "user experience", "user interface"],
  TypeScript: ["ts", "typescript", "type script"],
  Java: ["java", "j2ee", "jee"],
  Vue: ["vue", "vuejs", "vue.js"],
  Angular: ["angular", "angularjs", "angular.js"],
  DevOps: ["devops", "ci/cd", "cicd", "pipelines"],
  Docker: ["docker", "container", "containers", "containerization"],
  Kubernetes: ["k8s", "kubernetes"],
  Git: ["git", "github", "gitlab"],
  HTML: ["html", "html5"],
  CSS: ["css", "css3", "sass", "scss"],
  NoSQL: ["mongodb", "mongo", "nosql", "redis", "elasticsearch"],
  "Project Management": ["project manager", "project management", "pmp", "agile", "scrum"],
  Go: ["go", "golang"],
  "C++": ["c++", "cpp"],
  PHP: ["php", "laravel", "symfony"],
  Ruby: ["ruby", "rails", "ror"],
  Figma: ["figma", "figma design"],
  QA: ["qa", "quality assurance", "testing", "manual testing", "automation testing", "selenium"],
  HR: ["hr", "human resources", "recruitment", "talent acquisition"],
};

export function normaliseSkill(skill: string): string {
  const lower = skill.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(skillSynonyms)) {
    if (lower === canonical.toLowerCase()) return canonical;
    for (const alias of aliases) {
      if (lower === alias.toLowerCase()) return canonical;
    }
  }
  return skill;
}

export function scoreCandidateAgainstRequirements(
  cv: ScoredCandidate["cv"],
  req: SearchRequirements,
  index: number
): ScoredCandidate {
  const candidateTitleText = buildCandidateTitleText(cv);
  const candidateSkills = distinct((cv.skills ?? []).map(normaliseSkill));
  const requiredSkills = (req.requiredSkills ?? []).map(normaliseSkill);
  const preferredSkills = (req.preferredSkills ?? req.niceToHaveSkills ?? []).map(normaliseSkill);
  const jobTitleVariants = distinct([req.title, ...(req.alternativeTitles ?? [])]);
  const candidateSeniority = cv.seniorityLevel ?? inferSeniorityFromText(candidateTitleText);
  const jobSeniority = req.seniority ?? inferSeniorityFromText(`${req.title} ${req.summary}`);

  const titleScore = scoreTitleMatchImpl(jobTitleVariants, candidateTitleText);
  const seniorityScore = jobSeniority
    ? (candidateSeniority
      ? Math.max(58, 100 - Math.abs(seniorityRank(jobSeniority) - seniorityRank(candidateSeniority)) * 12)
      : 72)
    : (candidateSeniority ? 80 : 72);
  const experienceScore = yearsScore(cv.yearsOfExperience ?? null, req.minYearsExperience);
  const skillScores = scoreSkills(requiredSkills, preferredSkills, candidateSkills);
  const hasMissingRequired = requiredSkills.length > 0 && skillScores.missingRequired.length > 0;
  // Loosen skill score: do not penalise to 0 if a required skill is missing, just use computed coverage score
  const skillScore = skillScores.score;
  const industryScore = scoreIndustry(req.industry, cv.industries ?? null);
  const locationScore = scoreLocation(req.location, cv.location ?? null);
  const locationStatus: ScoredCandidate["locationStatus"] =
    !req.location ? "match"
      : !cv.location ? "not specified"
      : normalizeText(req.location).includes(normalizeText(cv.location ?? ""))
        || normalizeText(cv.location ?? "").includes(normalizeText(req.location))
        ? "match"
        : "different";

  // Prioritise Experience and Title/Seniority/Skills if experience is mentioned
  let overallScore: number;
  if (req.minYearsExperience != null) {
    overallScore = Math.round(
      (experienceScore * 0.30) +
      (titleScore * 0.30) +
      (seniorityScore * 0.20) +
      (skillScore * 0.20)
    );
  } else {
    overallScore = Math.round(
      (titleScore * 0.32) +
      (skillScore * 0.28) +
      (experienceScore * 0.16) +
      (seniorityScore * 0.12) +
      (industryScore * 0.06)
    );
  }

  // Incorporate vectorScore if present
  if ((cv as any).vectorScore !== undefined) {
    const semanticScore = Math.round((cv as any).vectorScore * 100);
    overallScore = Math.round(overallScore * 0.60 + semanticScore * 0.40);
  }

  const titleReason =
    titleScore >= 90 ? "The title is a near-direct match."
      : titleScore >= 75 ? "The title is a good variation of the target role."
      : titleScore >= 60 ? "The title is related to the target role."
      : "The title is only loosely related, but still worth considering.";

  const experienceReason =
    req.minYearsExperience == null
      ? candidateSeniority
        ? `Seniority appears to be ${candidateSeniority}.`
        : "Seniority is not clearly stated."
      : cv.yearsOfExperience != null
        ? `${cv.yearsOfExperience} years of experience versus the ${req.minYearsExperience}+ year target.`
        : "Years of experience could not be clearly confirmed.";

  const skillReason =
    hasMissingRequired
      ? `Missing required skills: ${skillScores.missingRequired.slice(0, 4).join(", ")}${skillScores.missingRequired.length > 4 ? ", and more" : ""}.`
      : skillScores.matchedRequired.length > 0
        ? `Matches ${skillScores.matchedRequired.slice(0, 4).join(", ")}${skillScores.matchedRequired.length > 4 ? ", and more" : ""}.`
        : req.requiredSkills.length > 0
          ? "Shows a partial skill fit rather than a complete one."
          : "No explicit skill filter was provided.";

  return {
    index,
    cv,
    titleScore,
    seniorityScore,
    experienceScore,
    skillScore,
    industryScore,
    locationScore,
    overallScore,
    locationStatus,
    matchedRequired: skillScores.matchedRequired,
    missingRequired: skillScores.missingRequired,
    matchedPreferred: skillScores.matchedPreferred,
    reason: `${titleReason} ${experienceReason} ${skillReason}`.trim(),
  };
}

export async function scoreWithLLM(
  cv: any,
  req: SearchRequirements
): Promise<{
  result: { score: number; reason: string };
  usage: { promptTokens: number; completionTokens: number; model: string };
}> {
  const model = getModelForTask("jd_matching");
  const openai = getOpenAI("jd_matching");

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are an expert Talent Acquisition (TA) specialist. Evaluate the candidate's CV against the job description on a scale of 0-100. Return ONLY a JSON object: {"score": number, "reason": "A concise, professional explanation (max 2-3 sentences) from a recruiter's perspective detailing the candidate's fit based on skills, experience, and title match against the JD requirements."}`
        },
        {
          role: "user",
          content: `Job Title: ${req.title}\n\nJob Description:\n${JSON.stringify(req)}\n\nCV:\n${JSON.stringify(cv)}`
        }
      ]
    });

    const content = response.choices[0]?.message?.content ?? '{"score":0}';
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    try {
      const parsed = JSON.parse(content) as { score?: number, reason?: string };
      return {
        result: {
          score: Math.min(100, Math.max(0, parsed.score ?? 0)),
          reason: parsed.reason || "The candidate's profile was evaluated against the job requirements."
        },
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          model,
        },
      };
    } catch (parseError) {
      throw new Error(`Error parsing AI evaluation: ${String(parseError)}`);
    }
  } catch (error) {
    throw error;
  }
}

export function selectLlmPool(candidates: ScoredCandidate[]): ScoredCandidate[] {
  const topByOverall = candidates.slice(0, 15);
  const topBySkills = [...candidates]
    .sort((a, b) => b.skillScore - a.skillScore)
    .slice(0, 5);
  const seenIds = new Set(topByOverall.map((c) => c.cv._id));
  return [
    ...topByOverall,
    ...topBySkills.filter((c) => !seenIds.has(c.cv._id)),
  ];
}

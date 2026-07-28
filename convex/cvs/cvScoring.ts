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

function extractTitleSeniorityToken(title: string): string | null {
  const norm = normalizeText(title);
  if (/\bintern\b/.test(norm)) return "intern";
  if (/\bjunior\b|\bjr\b|\bentry level\b/.test(norm)) return "junior";
  if (/\bsenior\b|\bsr\b/.test(norm)) return "senior";
  if (/\blead\b|\bprincipal\b|\bstaff\b|\bmanager\b/.test(norm)) return "lead";
  if (/\bdirector\b|\bhead\b|\bvp\b|\bchief\b|\bcto\b|\bceo\b/.test(norm)) return "executive";
  return null;
}

export function seniorityRank(value?: string | null): number {
  const s = (value ?? "").toLowerCase().trim();
  if (s === "intern") return 0;
  if (s === "junior" || s === "jr" || s === "entry_level" || s === "entry") return 1;
  if (s === "mid" || s === "mid_level") return 2;
  if (s === "senior" || s === "sr" || s === "senior_executive") return 3;
  if (s === "lead" || s === "principal" || s === "staff" || s === "manager" || s === "senior_manager" || s === "agm") return 4;
  if (s === "executive" || s === "director" || s === "c_suite" || s === "vp" || s === "gm") return 5;
  return -1;
}

export function calculateAsymmetricSeniorityScore(jobSeniority?: string | null, candidateSeniority?: string | null): number {
  if (!jobSeniority) return candidateSeniority ? 80 : 72;
  if (!candidateSeniority) return 70;

  const jRank = seniorityRank(jobSeniority);
  const cRank = seniorityRank(candidateSeniority);

  if (jRank < 0 || cRank < 0) return 70;

  const d = cRank - jRank;
  if (d === 0) return 100;

  if (d > 0) {
    // Over-qualification penalty (exponential continuous decay with floor at 5)
    return Math.max(5, Math.round(100 * Math.exp(-0.45 * Math.pow(d, 1.4))));
  } else {
    // Under-qualification penalty (linear decay with floor at 10)
    return Math.max(10, Math.round(100 - 22 * Math.abs(d)));
  }
}

function yearsScore(
  candidateYears: number | null | undefined,
  minimumYears: number | null,
  maximumYears?: number | null
): number {
  if (candidateYears == null) {
    if (minimumYears == null) return 75;
    return 65;
  }

  // Under-qualification check (below minimum required years)
  if (minimumYears != null && candidateYears < minimumYears) {
    const gap = minimumYears - candidateYears;
    if (gap <= 1) return 88;
    if (gap <= 2) return 76;
    if (gap <= 3) return 64;
    if (gap <= 5) return 50;
    return 35;
  }

  // Over-qualification check (exceeds maximum threshold)
  if (maximumYears != null && candidateYears > maximumYears) {
    const excess = candidateYears - maximumYears;
    if (excess <= 1) return 90;
    // Continuous exponential decay for excess experience above maximum threshold
    return Math.max(15, Math.round(100 * Math.exp(-0.30 * excess)));
  }

  return 100;
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

export function mapJobSeniorityTo10LevelRank(seniorityLevel?: string | null): number | null {
  if (!seniorityLevel) return null;
  const s = seniorityLevel.toLowerCase().trim().replace(/[\s-]/g, "_");
  if (s.includes("entry") || s.includes("intern")) return 0;
  if (s === "mid_level" || s === "mid") return 1;
  if (s === "executive") return 2;
  if (s === "senior_executive") return 3;
  if (s === "manager") return 4;
  if (s === "senior_manager") return 5;
  if (s === "agm" || s.includes("assistant_general")) return 6;
  if (s === "gm" || s.includes("general_manager")) return 7;
  if (s === "director") return 8;
  if (s === "c_suite" || s.includes("vp") || s.includes("chief")) return 9;
  return null; // "other", custom, or unmapped -> skip gate
}

export function checkSeniorityConflict(
  currentRoleRank: number | null,
  candidateSeniority6?: string | null
): boolean {
  if (currentRoleRank === null || !candidateSeniority6) return false;
  const s = candidateSeniority6.toLowerCase().trim();

  let minRank = 0;
  let maxRank = 9;

  if (s === "intern") { minRank = 0; maxRank = 0; }
  else if (s === "junior") { minRank = 0; maxRank = 1; }
  else if (s === "mid") { minRank = 1; maxRank = 2; }
  else if (s === "senior") { minRank = 3; maxRank = 4; }
  else if (s === "lead") { minRank = 4; maxRank = 5; }
  else if (s === "executive") { minRank = 6; maxRank = 9; }
  else { return false; }

  if (currentRoleRank < minRank - 1 || currentRoleRank > maxRank + 1) {
    return true;
  }
  return false;
}

function scoreTitleMatchImpl(jobTitles: string[], candidateTitleText: string): number {
  const cleanedCandidate = stripSeniorityWords(candidateTitleText);
  const candidateNorm = normalizeText(cleanedCandidate);
  if (!candidateNorm) return 55;

  const candSeniorityToken = extractTitleSeniorityToken(candidateTitleText);

  let best = 0;
  for (const jobTitle of jobTitles) {
    const jobSeniorityToken = extractTitleSeniorityToken(jobTitle);
    const cleanedJob = stripSeniorityWords(jobTitle);
    const jobNorm = normalizeText(cleanedJob);
    if (!jobNorm) continue;

    let baseScore = 55;
    if (candidateNorm === jobNorm) {
      baseScore = 100;
    } else if (textContainsEither(candidateNorm, jobNorm)) {
      baseScore = 92;
    } else {
      const jobTokens = titleTokens(cleanedJob);
      const candidateTokens = titleTokens(cleanedCandidate);
      if (jobTokens.length > 0 && candidateTokens.length > 0) {
        const jobTokenSet = new Set(jobTokens);
        const candidateTokenSet = new Set(candidateTokens);
        const overlap = [...jobTokenSet].filter((token) => candidateTokenSet.has(token)).length;
        const coverage = overlap / jobTokenSet.size;
        const reciprocal = overlap / candidateTokenSet.size;
        const blended = (coverage * 0.7) + (reciprocal * 0.3);
        baseScore = 55 + Math.round(blended * 40);
      }
    }

    // Fix title-stripping overlap bug: if candidate and job titles explicitly specify conflicting seniority levels, apply adjustment factor
    if (jobSeniorityToken && candSeniorityToken && jobSeniorityToken !== candSeniorityToken) {
      const jRank = seniorityRank(jobSeniorityToken);
      const cRank = seniorityRank(candSeniorityToken);
      if (jRank >= 0 && cRank >= 0 && cRank > jRank) {
        baseScore = Math.round(baseScore * 0.70);
      }
    }

    best = Math.max(best, baseScore);
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

// Canonical City to Country & Region Mapping
const GEOGRAPHIC_CITY_TO_COUNTRY_MAP: Record<string, string> = {
  // Sri Lanka
  colombo: "sri lanka",
  kandy: "sri lanka",
  galle: "sri lanka",
  jaffna: "sri lanka",
  negombo: "sri lanka",
  kurunegala: "sri lanka",
  dehiwala: "sri lanka",
  moratuwa: "sri lanka",
  gampaha: "sri lanka",
  katunayake: "sri lanka",
  batticaloa: "sri lanka",
  trincomalee: "sri lanka",
  matara: "sri lanka",
  anuradhapura: "sri lanka",
  ratnapura: "sri lanka",
  badulla: "sri lanka",
  "nuwara eliya": "sri lanka",
  hambantota: "sri lanka",
  kalutara: "sri lanka",
  kotte: "sri lanka",
  "mount lavinia": "sri lanka",
  "sri lanka": "sri lanka",
  lanka: "sri lanka",
  "western province": "sri lanka",
  "central province": "sri lanka",
  "southern province": "sri lanka",

  // United Arab Emirates (UAE)
  dubai: "united arab emirates",
  "abu dhabi": "united arab emirates",
  sharjah: "united arab emirates",
  ajman: "united arab emirates",
  "ras al khaimah": "united arab emirates",
  fujairah: "united arab emirates",
  "al ain": "united arab emirates",
  uae: "united arab emirates",
  "united arab emirates": "united arab emirates",

  // Saudi Arabia (KSA)
  riyadh: "saudi arabia",
  jeddah: "saudi arabia",
  dammam: "saudi arabia",
  khobar: "saudi arabia",
  mecca: "saudi arabia",
  medina: "saudi arabia",
  jubail: "saudi arabia",
  ksa: "saudi arabia",
  "saudi arabia": "saudi arabia",

  // Qatar
  doha: "qatar",
  "al rayyan": "qatar",
  "al wakrah": "qatar",
  qatar: "qatar",

  // Singapore
  singapore: "singapore",

  // Malaysia
  "kuala lumpur": "malaysia",
  penang: "malaysia",
  "johor bahru": "malaysia",
  malaysia: "malaysia",

  // Australia
  sydney: "australia",
  melbourne: "australia",
  brisbane: "australia",
  perth: "australia",
  adelaide: "australia",
  australia: "australia",

  // United Kingdom / UK
  london: "united kingdom",
  manchester: "united kingdom",
  birmingham: "united kingdom",
  uk: "united kingdom",
  "united kingdom": "united kingdom",
  england: "united kingdom",
  scotland: "united kingdom",

  // Canada
  toronto: "canada",
  vancouver: "canada",
  montreal: "canada",
  canada: "canada",

  // USA
  "new york": "united states",
  "san francisco": "united states",
  chicago: "united states",
  austin: "united states",
  usa: "united states",
  "united states": "united states",
};

export interface LocationEvaluationResult {
  score: number;
  status: "match" | "region_match" | "different" | "not specified";
  gate: "pass" | "region_pass" | "unspecified_pass" | "remote_pass" | "excluded_mismatch";
  penalty: number;
}

export function evaluateLocationMatch(
  jobLocationStr: string | null | undefined,
  candLocationStr?: string | null
): LocationEvaluationResult {
  const normJob = normalizeText(jobLocationStr || "");
  const normCand = normalizeText(candLocationStr || "");

  // 1. Remote / Unspecified Job Location
  if (!normJob || normJob.includes("remote") || normJob.includes("anywhere") || normJob.includes("work from home")) {
    return { score: 100, status: "match", gate: "remote_pass", penalty: 0 };
  }

  // 2. Unspecified Candidate Location
  if (!normCand) {
    return { score: 60, status: "not specified", gate: "unspecified_pass", penalty: 0 };
  }

  // 3. Direct String Identity / Substring Match
  if (normCand === normJob || normCand.includes(normJob) || normJob.includes(normCand)) {
    return { score: 100, status: "match", gate: "pass", penalty: 0 };
  }

  // 4. Token & Geographic Knowledge Resolution
  const jobTokens = tokenize(normJob);
  const candTokens = tokenize(normCand);

  let jobCountry: string | null = null;
  let candCountry: string | null = null;

  for (const token of jobTokens) {
    if (GEOGRAPHIC_CITY_TO_COUNTRY_MAP[token]) {
      jobCountry = GEOGRAPHIC_CITY_TO_COUNTRY_MAP[token];
      break;
    }
  }
  if (!jobCountry) {
    for (const [key, country] of Object.entries(GEOGRAPHIC_CITY_TO_COUNTRY_MAP)) {
      if (normJob.includes(key)) {
        jobCountry = country;
        break;
      }
    }
  }

  for (const token of candTokens) {
    if (GEOGRAPHIC_CITY_TO_COUNTRY_MAP[token]) {
      candCountry = GEOGRAPHIC_CITY_TO_COUNTRY_MAP[token];
      break;
    }
  }
  if (!candCountry) {
    for (const [key, country] of Object.entries(GEOGRAPHIC_CITY_TO_COUNTRY_MAP)) {
      if (normCand.includes(key)) {
        candCountry = country;
        break;
      }
    }
  }

  // Bi-Directional Country Match (e.g. Cand "Colombo" -> Sri Lanka vs Job "Sri Lanka" -> Sri Lanka)
  if (jobCountry && candCountry && jobCountry === candCountry) {
    const isJobCountryOnly = normJob === jobCountry || normJob === "lanka";
    const isCandCountryOnly = normCand === candCountry || normCand === "lanka";

    if (isJobCountryOnly || isCandCountryOnly) {
      return { score: 100, status: "match", gate: "pass", penalty: 0 };
    }

    // Both specified different cities in the same country (e.g. "Colombo" vs "Kandy")
    return { score: 85, status: "region_match", gate: "region_pass", penalty: 0 };
  }

  // Token Overlap check for sub-regions/districts
  const jobSet = new Set(jobTokens);
  const candSet = new Set(candTokens);
  const overlap = [...jobSet].filter((t) => candSet.has(t)).length;
  if (overlap > 0) {
    return { score: 85, status: "region_match", gate: "region_pass", penalty: 0 };
  }

  // If both countries are identified and explicitly different (e.g. Sri Lanka vs UAE)
  if (jobCountry && candCountry && jobCountry !== candCountry) {
    return { score: 0, status: "different", gate: "excluded_mismatch", penalty: -30 };
  }

  // Fallback explicit mismatch
  return { score: 0, status: "different", gate: "excluded_mismatch", penalty: -30 };
}

function scoreLocation(jobLocation: string | null, candidateLocation?: string | null): number {
  return evaluateLocationMatch(jobLocation, candidateLocation).score;
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
  locationStatus: "match" | "region_match" | "different" | "not specified";
  locationGate?: string;
  locationPenalty?: number;
  matchedRequired: string[];
  missingRequired: string[];
  matchedPreferred: string[];
  reason: string;
  llmScore?: { score: number; reason: string };
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
  req: SearchRequirements & {
    maxYearsExperience?: number | null;
    negativeKeywords?: string[];
    overrideSeniority?: string | null;
    currentRolePenalty?: number;
    roleFamilyMatch?: "exact" | "synonym" | "adjacent" | "unrelated";
  },
  index: number
): ScoredCandidate {
  const candidateTitleText = buildCandidateTitleText(cv);
  const candidateSkills = distinct((cv.skills ?? []).map(normaliseSkill));
  const requiredSkills = (req.requiredSkills ?? []).map(normaliseSkill);
  const preferredSkills = (req.preferredSkills ?? req.niceToHaveSkills ?? []).map(normaliseSkill);
  const jobTitleVariants = distinct([req.title, ...(req.alternativeTitles ?? [])]);
  const candidateSeniority = cv.seniorityLevel ?? inferSeniorityFromText(candidateTitleText);
  const jobSeniority = req.overrideSeniority ?? req.seniority ?? inferSeniorityFromText(`${req.title} ${req.summary}`);

  // Auto-infer maxYearsExperience for intern / entry-level roles if not specified
  let effectiveMaxYears = req.maxYearsExperience ?? null;
  const normalizedJobSeniority = (jobSeniority ?? "").toLowerCase();
  if (
    effectiveMaxYears == null &&
    (normalizedJobSeniority === "intern" || normalizedJobSeniority === "entry_level" || req.title?.toLowerCase().includes("intern"))
  ) {
    effectiveMaxYears = 1.5;
  }

  // Title Match Dimension incorporating Role-Family Equivalence multiplier
  const baseTitleScore = scoreTitleMatchImpl(jobTitleVariants, candidateTitleText);
  let roleFamilyMultiplier = 1.0;
  if (req.roleFamilyMatch === "adjacent") roleFamilyMultiplier = 0.65;
  else if (req.roleFamilyMatch === "unrelated") roleFamilyMultiplier = 0.15;

  const titleScore = Math.round(roleFamilyMultiplier * Math.max(baseTitleScore, 70));

  const seniorityScore = calculateAsymmetricSeniorityScore(jobSeniority, candidateSeniority);
  const experienceScore = yearsScore(cv.yearsOfExperience ?? null, req.minYearsExperience, effectiveMaxYears);
  const skillScores = scoreSkills(requiredSkills, preferredSkills, candidateSkills);
  const hasMissingRequired = requiredSkills.length > 0 && skillScores.missingRequired.length > 0;
  const skillScore = skillScores.score;
  const industryScore = scoreIndustry(req.industry, cv.industries ?? null);
  const locEval = evaluateLocationMatch(req.location, cv.location);
  const locationScore = locEval.score;
  const locationStatus = locEval.status;
  const locationGate = locEval.gate;
  const locationPenalty = locEval.penalty;

  let overallScore: number;
  if (normalizedJobSeniority === "intern" || normalizedJobSeniority === "entry_level" || req.title?.toLowerCase().includes("intern")) {
    // For Intern / Entry Level roles, give higher weight to Seniority & Experience alignment
    overallScore = Math.round(
      (seniorityScore * 0.35) +
      (experienceScore * 0.25) +
      (titleScore * 0.20) +
      (skillScore * 0.20)
    );
  } else if (req.minYearsExperience != null) {
    overallScore = Math.round(
      (experienceScore * 0.30) +
      (titleScore * 0.30) +
      (seniorityScore * 0.20) +
      (skillScore * 0.20)
    );
  } else {
    overallScore = Math.round(
      (titleScore * 0.30) +
      (skillScore * 0.26) +
      (seniorityScore * 0.22) +
      (experienceScore * 0.16) +
      (industryScore * 0.06)
    );
  }

  // Apply negative keywords penalty if TA feedback extracted negative keywords
  if (req.negativeKeywords && req.negativeKeywords.length > 0) {
    const candidateTextNorm = normalizeText(`${candidateTitleText} ${(cv.skills || []).join(" ")}`);
    for (const negWord of req.negativeKeywords) {
      if (candidateTextNorm.includes(normalizeText(negWord))) {
        overallScore = Math.max(5, overallScore - 30);
        break;
      }
    }
  }

  // Apply Current-Role Level Gate soft penalty if candidate is 2+ levels below job target rank
  if (typeof req.currentRolePenalty === "number" && req.currentRolePenalty < 0) {
    overallScore = Math.max(0, overallScore + req.currentRolePenalty);
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
    locationGate,
    locationPenalty,
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
    const candidateObj = cv.cv || cv;

    const candName = candidateObj.fullName || "Candidate";
    const candTitle = candidateObj.currentTitle || candidateObj.currentJobTitle || "Not specified";
    const candEmployer = candidateObj.currentEmployer || "Not specified";
    const candYears = candidateObj.totalYearsExperience ?? candidateObj.yearsOfExperience ?? "Not specified";
    const candSkills = Array.isArray(candidateObj.skills)
      ? candidateObj.skills.map((s: any) => (typeof s === "object" ? s.value : String(s))).slice(0, 20).join(", ")
      : "Not specified";

    const recentJobs = Array.isArray(candidateObj.jobHistory)
      ? candidateObj.jobHistory.slice(0, 3).map((j: any) => `- ${j.title || "Role"} at ${j.company || "Company"} (${j.startDate || ""} - ${j.endDate || "Present"})`).join("\n")
      : "";

    const reqSkills = Array.isArray(req.requiredSkills) ? req.requiredSkills.join(", ") : "Not specified";
    const prefSkills = Array.isArray(req.preferredSkills) ? req.preferredSkills.join(", ") : "None";
    const jdSnippet = req.summary ? String(req.summary).slice(0, 500) : "";

    const userPrompt = [
      `JOB REQUIREMENTS:`,
      `Title: ${req.title || "Not specified"}`,
      `Required Skills: ${reqSkills}`,
      `Preferred Skills: ${prefSkills}`,
      `Min Experience: ${req.minYearsExperience ?? "Not specified"} years`,
      `Seniority: ${req.seniority || "Not specified"}`,
      `Industry: ${req.industry || "Not specified"}`,
      jdSnippet ? `Summary: ${jdSnippet}` : "",
      ``,
      `CANDIDATE PROFILE:`,
      `Name: ${candName}`,
      `Current Title: ${candTitle}`,
      `Current Employer: ${candEmployer}`,
      `Total Experience: ${candYears} years`,
      `Skills: ${candSkills}`,
      recentJobs ? `Recent Roles:\n${recentJobs}` : "",
    ].filter(Boolean).join("\n");

    const response = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `You are a Senior Talent Acquisition (TA) Recruiter. Evaluate how well the candidate's CV aligns with the job requirements. Return ONLY a JSON object: {"score": number, "reason": "A 2-3 sentence professional TA evaluation explaining why this candidate is a match, highlighting key matching skills, relevant experience, and overall role fit."}`
        },
        {
          role: "user",
          content: userPrompt,
        }
      ],
      response_format: { type: "json_object" },
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

export function buildDeterministicTaReason(candidate: ScoredCandidate, req: SearchRequirements): string {
  const name = candidate.cv.fullName || "Candidate";
  const title = candidate.cv.currentTitle || "Professional";
  const exp = candidate.cv.yearsOfExperience ?? (candidate.cv as any).totalExperienceYears;
  const matched = (candidate.matchedRequired || []).slice(0, 4);
  const missing = (candidate.missingRequired || []).slice(0, 3);

  let parts: string[] = [];
  if (candidate.overallScore >= 85) {
    parts.push(`Strong TA match for ${req.title || "the role"}. ${name} shows high domain alignment as a ${title}.`);
  } else if (candidate.overallScore >= 60) {
    parts.push(`Suitable candidate with relevant background as a ${title}.`);
  } else {
    parts.push(`Partial alignment match for ${req.title || "the role"} based on background as a ${title}.`);
  }

  if (matched.length > 0) parts.push(`Key matching skills: ${matched.join(", ")}.`);
  if (exp != null) parts.push(`Brings ${exp} years of total professional experience.`);
  if (missing.length > 0) parts.push(`Skill gaps to note: ${missing.join(", ")}.`);

  return parts.join(" ");
}

export type BatchScoreResult = {
  evaluations: Map<number, { score: number; reason: string }>;
  usage: { promptTokens: number; completionTokens: number; model: string };
};

export async function scoreBatchWithLLM(
  candidates: ScoredCandidate[],
  req: SearchRequirements
): Promise<BatchScoreResult> {
  if (candidates.length === 0) {
    return {
      evaluations: new Map(),
      usage: { promptTokens: 0, completionTokens: 0, model: getModelForTask("jd_matching") },
    };
  }

  const model = getModelForTask("jd_matching");
  const openai = getOpenAI("jd_matching");

  const reqSkills = Array.isArray(req.requiredSkills) ? req.requiredSkills.join(", ") : "Not specified";
  const prefSkills = Array.isArray(req.preferredSkills) ? req.preferredSkills.join(", ") : "None";
  const jdSnippet = req.summary ? String(req.summary).slice(0, 350) : "";

  const candidateSerializedList = candidates.map((c) => {
    const cvObj = c.cv || {};
    const name = cvObj.fullName || `Candidate #${c.index}`;
    const title = cvObj.currentTitle || (cvObj as any).currentJobTitle || "Not specified";
    const employer = cvObj.currentEmployer ? `@ ${cvObj.currentEmployer}` : "";
    const exp = cvObj.yearsOfExperience ?? (cvObj as any).totalExperienceYears ?? "N/A";
    const skills = Array.isArray(cvObj.skills)
      ? cvObj.skills.map((s: any) => (typeof s === "object" ? s.value : String(s))).slice(0, 10).join(", ")
      : "Not specified";

    return `[ID: ${c.index}] ${name} | ${title} ${employer} | ${exp} yrs exp | Skills: ${skills}`;
  });

  const promptText = [
    `JOB REQUIREMENTS:`,
    `Title: ${req.title || "Not specified"}`,
    `Required Skills: ${reqSkills}`,
    `Preferred Skills: ${prefSkills}`,
    `Min Experience: ${req.minYearsExperience ?? "Not specified"} years`,
    `Seniority: ${req.seniority || "Not specified"}`,
    `Industry: ${req.industry || "Not specified"}`,
    jdSnippet ? `Summary: ${jdSnippet}` : "",
    ``,
    `CANDIDATE POOL TO EVALUATE:`,
    ...candidateSerializedList,
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are a Senior Talent Acquisition (TA) Recruiter. Evaluate how well EACH candidate in the candidate pool aligns with the job requirements. Return ONLY a JSON object mapping candidate IDs to evaluation result objects:
{
  "evaluations": [
    {
      "id": number,
      "score": number (0-100),
      "reason": "1-2 sentence TA evaluation highlighting key matching skills, experience, and role fit."
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: promptText },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? '{"evaluations":[]}';
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    const resultMap = new Map<number, { score: number; reason: string }>();

    try {
      const parsed = JSON.parse(content) as { evaluations?: { id?: number; score?: number; reason?: string }[] };
      const evals = parsed.evaluations || [];
      for (const item of evals) {
        if (typeof item.id === "number") {
          resultMap.set(item.id, {
            score: Math.min(100, Math.max(0, item.score ?? 50)),
            reason: item.reason || "Evaluated by AI matching engine against job requirements.",
          });
        }
      }
    } catch (parseError) {
      console.error("[scoreBatchWithLLM] Error parsing JSON output:", parseError);
    }

    return {
      evaluations: resultMap,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        model,
      },
    };
  } catch (err) {
    console.error("[scoreBatchWithLLM] LLM call error:", err);
    return {
      evaluations: new Map(),
      usage: { promptTokens: 0, completionTokens: 0, model },
    };
  }
}


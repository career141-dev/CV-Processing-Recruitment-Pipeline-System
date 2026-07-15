// @ts-nocheck
import { getOpenAI, getModelForTask, logLLMUsage } from "./llm";

function distinct(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export type SearchRequirements = {
  title: string;
  alternativeTitles: string[];
  occupationSynonyms: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  minYearsExperience: number | null;
  industry: string | null;
  seniority: string | null;
  location: string | null;
  education: string | null;
  summary: string;
  keywords: string[];
  languages: string[];
  clientCompany: string | null;
  clientContactEmail: string | null;
  salaryRange: string | null;
};

function normalizeRequirements(req: SearchRequirements): SearchRequirements {
  return {
    ...req,
    title: req.title || "Position",
    alternativeTitles: distinct(req.alternativeTitles),
    occupationSynonyms: distinct(req.occupationSynonyms),
    requiredSkills: distinct(req.requiredSkills),
    preferredSkills: distinct(req.preferredSkills),
    keywords: distinct(req.keywords),
  };
}

export async function extractSearchRequirements(
  text: string,
  kind: "job_description" | "natural_language"
): Promise<SearchRequirements> {
  const prompt =
    kind === "job_description"
      ? `You are a recruitment analyst. Extract the main hiring requirements from this job description.
Focus on the signals that matter most for candidate matching. Be inclusive, not overly strict.
Return ONLY valid JSON with these fields:
{
  "title": "best matching role title",
  "alternativeTitles": ["closely related role title 1", "closely related role title 2"],
  "occupationSynonyms": ["truly equivalent role titles that someone in this occupation might use on their CV — not seniority variations, but fundamentally the same job under a different name"],
  "requiredSkills": ["core skills that strongly matter for the role"],
  "preferredSkills": ["nice-to-have or supporting skills"],
  "minYearsExperience": number or null,
  "industry": "industry or null",
  "seniority": "junior, mid, senior, lead, executive, or null",
  "location": "location or null",
  "education": "education requirement or null",
  "summary": "one sentence summary of the role",
  "keywords": ["important keywords, tools, frameworks, company names, brands, certifications, acronyms"],
  "languages": ["required languages e.g. English, Arabic"],
  "clientCompany": "company name if mentioned, or null",
  "clientContactEmail": "email address if mentioned, or null",
  "salaryRange": "salary range if mentioned e.g. 200k - 300k LKR, or null"
}
If a skill is implied by the role and clearly important, include it in requiredSkills even if not explicitly written. Do not over-prune skills.
For occupationSynonyms, include alternative job titles that represent the same occupation as the primary title — not seniority variations, but genuinely equivalent role names a candidate might use on their CV. For example for "Accountant" include ["Finance Officer", "Accounts Executive"].`
      : `You are a talent search assistant. Extract the main candidate-match requirements from this search query.
Interpret the query generously and keep useful context rather than stripping it away.
Return ONLY valid JSON with these fields:
{
  "title": "best matching role title or target profile",
  "alternativeTitles": ["related role title 1", "related role title 2"],
  "occupationSynonyms": ["truly equivalent role titles that someone in this occupation might use on their CV — not seniority variations, but fundamentally the same job under a different name"],
  "requiredSkills": ["core skills explicitly or implicitly requested"],
  "preferredSkills": ["supporting skills or nice-to-have signals"],
  "minYearsExperience": number or null,
  "industry": "industry or null",
  "seniority": "junior, mid, senior, lead, executive, or null",
  "location": "location or null",
  "education": "education requirement or null",
  "summary": "one sentence summary of the search intent",
  "keywords": ["important keywords, tools, frameworks, company names, brands, certifications, acronyms"],
  "languages": ["required languages"],
  "clientCompany": "company name if mentioned, or null",
  "clientContactEmail": "email address if mentioned, or null",
  "salaryRange": "salary range if mentioned, or null"
}
If the query is vague, infer the most likely role and include likely related skills so the search remains broad enough.
For occupationSynonyms, include alternative job titles that represent the same occupation as the primary title — not seniority variations, but genuinely equivalent role names a candidate might use on their CV.`;

  const model = getModelForTask("jd_extraction");
  const openai = getOpenAI("jd_extraction");

  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 1400,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: text.slice(0, 7000) },
      ],
    });

    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const content = response.choices[0]?.message?.content ?? "{}";
    const success = !!content && content !== "{}";

    try {
      const parsed = JSON.parse(content) as Partial<SearchRequirements>;
      await logLLMUsage(
        {} as any,
        "jd_extraction",
        model,
        inputTokens,
        outputTokens,
        success,
        !success ? "JSON parsing failed" : undefined
      );
      return normalizeRequirements({
        title: parsed.title ?? "Position",
        alternativeTitles: parsed.alternativeTitles ?? [],
        requiredSkills: parsed.requiredSkills ?? [],
        preferredSkills: parsed.preferredSkills ?? [],
        minYearsExperience: parsed.minYearsExperience ?? null,
        industry: parsed.industry ?? null,
        seniority: parsed.seniority ?? null,
        location: parsed.location ?? null,
        education: parsed.education ?? null,
        summary: parsed.summary ?? "Searching for a qualified candidate",
        occupationSynonyms: parsed.occupationSynonyms ?? [],
        keywords: parsed.keywords ?? [],
        languages: parsed.languages ?? [],
        clientCompany: parsed.clientCompany ?? null,
        clientContactEmail: parsed.clientContactEmail ?? null,
        salaryRange: parsed.salaryRange ?? null,
      });
    } catch {
      await logLLMUsage(
        {} as any,
        "jd_extraction",
        model,
        inputTokens,
        outputTokens,
        false,
        "JSON parsing failed"
      );
      return normalizeRequirements({
        title: "Position",
        alternativeTitles: [],
        requiredSkills: [],
        preferredSkills: [],
        minYearsExperience: null,
        industry: null,
        seniority: null,
        location: null,
        education: null,
        summary: "Searching for a qualified candidate",
        occupationSynonyms: [],
        keywords: [],
        languages: [],
        clientCompany: null,
        clientContactEmail: null,
        salaryRange: null,
      });
    }
  } catch (error) {
    // Log the error and return default requirements to fall back to deterministic search
    await logLLMUsage(
      {} as any,
      "jd_extraction",
      model,
      0,
      0,
      false,
      error instanceof Error ? error.message : "API call failed"
    );
    return normalizeRequirements({
      title: "Position",
      alternativeTitles: [],
      requiredSkills: [],
      preferredSkills: [],
      minYearsExperience: null,
      industry: null,
      seniority: null,
      location: null,
      education: null,
      summary: "Searching for a qualified candidate",
      occupationSynonyms: [],
      keywords: [],
      languages: [],
      clientCompany: null,
      clientContactEmail: null,
      salaryRange: null,
    });
  }
}

export function buildSearchTerms(req: SearchRequirements, sourceText: string): string[] {
  return distinct([
    req.title,
    ...req.alternativeTitles.slice(0, 4),
    ...req.occupationSynonyms.slice(0, 4),
    ...req.requiredSkills.slice(0, 6),
    ...req.preferredSkills.slice(0, 3),
    ...req.keywords.slice(0, 6),
    ...sourceText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 3 && line.length < 140),
  ]).slice(0, 12);
}

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { extractSearchRequirements } from "../lib/jdParser";
import { getOpenAI, getNvidiaOpenAI, OPENROUTER_PRIMARY_MODEL } from "../lib/llm";

function mapSeniority(val?: string | null): "entry_level" | "mid_level" | "senior_executive" | "executive" | "manager" | "senior_manager" | "agm" | "gm" | "director" | "c_suite" | "other" {
  if (!val) return "senior_executive";
  const s = val.toLowerCase();
  if (s.includes("entry") || s.includes("junior")) return "entry_level";
  if (s.includes("c-suite") || s.includes("chief") || s.includes("vp")) return "c_suite";
  if (s.includes("director")) return "director";
  if (s.includes("senior manager")) return "senior_manager";
  if (s.includes("manager") || s.includes("lead")) return "manager";
  if (s.includes("senior exec") || s.includes("senior-executive")) return "senior_executive";
  if (s.includes("executive")) return "executive";
  if (s.includes("senior")) return "senior_executive";
  return "mid_level";
}

function buildStructuredJdFallback(title: string, client: string, leadNotes: string, taNotes: string): string {
  const extractBullets = (text: string) =>
    text
      .split(/[\n;]+/)
      .map((s) => s.replace(/^[-•*]\s*/, "").trim())
      .filter((s) => s.length > 2);

  const leadDirectives = leadNotes ? extractBullets(leadNotes) : [];
  const taDirectives = taNotes ? extractBullets(taNotes) : [];

  const responsibilities = [
    `Manage day-to-day ${title} and operational workflows, ensuring deliverables are handled efficiently and within agreed timelines.`,
    `Coordinate workflows, schedules, space/resource allocation, and execution planning with relevant stakeholders.`,
    `Prepare, verify, and process all required documentation, operational instructions, compliance records, and reports.`,
    `Coordinate with clients, partners, overseas agents, and internal teams regarding requirements and operational matters.`,
    `Monitor operational progress and proactively follow up on schedules, documentation, milestones, and status movements.`,
    `Ensure accurate and timely submission of operational documentation and reporting to relevant parties.`,
    `Resolve operational issues, documentation discrepancies, and project queries in a timely and professional manner.`,
    `Maintain accurate records of operations, bookings, documentation, and transactions.`,
    `Liaise with internal commercial, customer service, finance, and operations teams to ensure smooth end-to-end execution.`,
    `Ensure compliance with company procedures, statutory requirements, and industry standards.`,
    `Support the team in improving operational efficiency, service quality, and stakeholder satisfaction.`,
    ...leadDirectives.map((d) => `Execute lead directive: ${d}`),
    ...taDirectives.map((d) => `Focus priority: ${d}`),
  ];

  const preRequisites = [
    `Bachelor’s Degree in a related field or equivalent practical experience.`,
    `3–6 years of relevant hands-on experience in ${title} or related operational capacity.`,
    `Strong operational expertise, domain processes, and documentation handling.`,
    `Experience coordinating with clients, vendors, external partners, and cross-functional teams.`,
    `Strong understanding of core operational workflows and quality standards.`,
    `Excellent communication, coordination, negotiation, and problem-solving skills.`,
    `Ability to work independently while managing multiple deliverables and deadlines.`,
    `Proficiency in enterprise productivity systems and relevant domain platforms.`,
    `Relevant professional certifications or qualifications will be an added advantage.`,
  ];

  return [
    `Roles & Responsibilities`,
    ``,
    `OVERVIEW`,
    ``,
    `We are seeking a ${title} at ${client} to manage and coordinate core operations, ensuring the smooth execution of workflows from initiation through final delivery. The role will involve close coordination with clients, partners, and internal teams while ensuring accuracy and timely completion of all operational activities.`,
    ``,
    `Key Responsibilities`,
    ``,
    responsibilities.map((r) => `• ${r}`).join("\n"),
    ``,
    `PRE-REQUISITES`,
    ``,
    preRequisites.map((p) => `• ${p}`).join("\n"),
  ].join("\n");
}

// Fallback heuristic parser in case LLM service is temporarily unreachable
function parseJdHeuristic(jdText: string, title: string) {
  const lines = jdText.split("\n").map((l) => l.trim()).filter(Boolean);
  const skills: string[] = [];
  let minExp = 3;
  let maxExp: number | undefined = undefined;

  const expMatch = jdText.match(/(\d+)\s*[–-]\s*(\d+)\s*(?:years?|yrs?)/i);
  if (expMatch) {
    minExp = parseInt(expMatch[1]);
    maxExp = parseInt(expMatch[2]);
  } else {
    const singleExp = jdText.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
    if (singleExp) {
      minExp = parseInt(singleExp[1]);
    }
  }

  for (const line of lines) {
    if (line.startsWith("•") || line.startsWith("-")) {
      const cleaned = line.replace(/^[-•*]\s*/, "").trim();
      if (cleaned.length > 5 && cleaned.length < 50 && !cleaned.toLowerCase().includes("bachelor")) {
        skills.push(cleaned);
      }
    }
  }

  return {
    title,
    requiredSkills: skills.length > 0 ? skills.slice(0, 8) : [title, "Operations Coordination", "Process Documentation"],
    preferredSkills: skills.slice(8, 12),
    minYearsExperience: minExp,
    maxYearsExperience: maxExp,
    seniority: mapSeniority(title),
    education: "Bachelor’s Degree in related field or equivalent practical experience",
    location: "Hybrid / Full-Time",
    industry: "General Industry",
    languages: ["English"],
  };
}

export const generateJdFromNotesAction = action({
  args: {
    openingName: v.string(),
    clientName: v.string(),
    taLeadNotes: v.optional(v.string()),
    taNotes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const title = args.openingName.trim() || "Senior Executive";
    const client = args.clientName.trim() || "Client Organization";
    const leadNotes = args.taLeadNotes?.trim() || "";
    const taNotes = args.taNotes?.trim() || "";

    const systemPrompt = `You are a Principal Talent Acquisition Consultant and Executive Recruiter for Global Enterprises.
Your task is to write an exhaustive, highly professional, corporate Job Description for the role of "${title}" at "${client}".

CRITICAL INTAKE INSTRUCTIONS:
1. You have been provided with two sources of recruitment notes:
   - "TA Lead Notes": Strategic briefing, requisition scope, compliance boundaries, volume metrics, or leadership directives.
   - "TA Recruiter Notes": Sourcing criteria, competitor background preferences, specific tool/ERP proficiency, languages, certifications, or qualification filters.
2. ZERO OMISSION RULE: Every single metric, specific responsibility, domain software/ERP, certification, competency, and requirement mentioned in EITHER the TA Lead Notes or TA Recruiter Notes MUST be explicitly woven into the Job Description. Do not summarize away or drop specific details.
3. Tone & Structure: High-caliber corporate language, outcome-oriented, detailed, and thorough.

MANDATORY OUTPUT FORMAT:
You must output strictly in this exact format (preserve headers and structure):

Roles & Responsibilities

OVERVIEW
[Write a comprehensive 2-3 paragraph overview explaining the role's mission, operational scope, cross-functional and client-facing collaboration, and organizational impact at ${client}. Weave in context from the notes.]

Key Responsibilities
• [Provide 10-15 detailed, actionable, outcome-driven responsibilities. Explicitly integrate every operational task, workflow duty, and specific directive mentioned in the notes.]

PRE-REQUISITES
• [Provide an exhaustive list of qualifications: exact degree requirements, exact range of years of experience, mandatory domain knowledge, specific enterprise tools/software/ERP mentioned in the notes, certifications, and communication/leadership skills.]

Do NOT include any conversational intro or markdown commentary. Return ONLY the formatted Job Description.`;

    const userPrompt = `Role: ${title}
Client Organization: ${client}

TA Lead Notes (Directives from Leadership):
${leadNotes || "Standard industry best-practice requisition parameters."}

TA Recruiter Notes (Operational & Sourcing Criteria):
${taNotes || "Standard recruitment sourcing focus."}

Please synthesize all provided notes into the exhaustive Job Description matching the required format.`;

    // 1. Try OpenRouter Deepseek (Primary Approved LLM)
    try {
      const openRouter = getOpenAI("jd_generation");
      const response = await openRouter.chat.completions.create({
        model: OPENROUTER_PRIMARY_MODEL,
        temperature: 0.2,
        max_tokens: 2400,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      let content = response.choices[0]?.message?.content?.trim();
      if (content && content.length > 200) {
        content = content.replace(/^```(?:markdown|text)?\s*/i, "").replace(/\s*```$/i, "").trim();
        return content;
      }
    } catch (err) {
      console.warn("OpenRouter provider unavailable or failed for JD generation:", err);
    }

    // 2. Try Nvidia NIM (Secondary Approved LLM)
    try {
      const nvidia = getNvidiaOpenAI();
      const response = await nvidia.chat.completions.create({
        model: "meta/llama-3.3-70b-instruct",
        temperature: 0.2,
        max_tokens: 2400,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      let content = response.choices[0]?.message?.content?.trim();
      if (content && content.length > 200) {
        content = content.replace(/^```(?:markdown|text)?\s*/i, "").replace(/\s*```$/i, "").trim();
        return content;
      }
    } catch (err) {
      console.warn("Nvidia NIM provider unavailable or failed for JD generation:", err);
    }

    // 3. Guaranteed Structured Corporate Fallback Engine
    return buildStructuredJdFallback(title, client, leadNotes, taNotes);
  },
});

export const launchOpeningAction = action({
  args: {
    openingName: v.string(),
    clientName: v.string(),
    clientId: v.optional(v.id("clients")),
    jobDescription: v.string(),
    assignedTaUserIds: v.optional(v.array(v.string())),
    taLeadNotes: v.optional(v.string()),
    taNotes: v.optional(v.string()),
    scoreWeights: v.object({
      skills: v.number(),
      experience: v.number(),
      jobTitle: v.number(),
      industry: v.number(),
      location: v.number(),
    }),
    minMatchScore: v.number(),
    reverseMatchOnPublish: v.boolean(),
    followUpConfig: v.optional(
      v.object({
        enableWhatsAppFollowUp: v.boolean(),
        enableEmailFollowUp: v.boolean(),
        maxFollowUpAttempts: v.number(),
        maxFollowUpDays: v.number(),
        customQuestions: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args): Promise<any> => {
    let extracted: any = null;

    // 1. Attempt AI extraction via LLM
    try {
      const result = await extractSearchRequirements(args.jobDescription, "job_description");
      if (result && result.requirements) {
        extracted = {
          title: result.requirements.title || args.openingName,
          requiredSkills: result.requirements.requiredSkills || [],
          preferredSkills: result.requirements.preferredSkills || [],
          minYearsExperience: typeof result.requirements.minYearsExperience === "number"
            ? result.requirements.minYearsExperience
            : 3,
          maxYearsExperience: typeof result.requirements.maxYearsExperience === "number"
            ? result.requirements.maxYearsExperience
            : undefined,
          seniority: mapSeniority(result.requirements.seniority || args.openingName),
          education: result.requirements.education || "Bachelor’s Degree or Equivalent",
          location: result.requirements.location || "Hybrid / Full-Time",
          industry: result.requirements.industry || "General Industry",
          languages: result.requirements.languages?.length ? result.requirements.languages : ["English"],
        };

        const apiAny: any = internal;
        if (apiAny.stats?.stats?.logNvidiaCallsBatchMutation && result.usage) {
          await ctx.runMutation(apiAny.stats.stats.logNvidiaCallsBatchMutation, {
            logs: [
              {
                taskType: "jd_extraction",
                model: result.usage.model,
                promptTokens: result.usage.promptTokens,
                completionTokens: result.usage.completionTokens,
                success: true,
              },
            ],
          });
        }
      }
    } catch (err) {
      console.warn("AI extraction from JD fell back to heuristic parser:", err);
    }

    // 2. Fallback to heuristic structured parser if LLM had no skills or failed
    if (!extracted || !extracted.requiredSkills || extracted.requiredSkills.length === 0) {
      extracted = parseJdHeuristic(args.jobDescription, args.openingName);
    }

    // 3. Atomically publish Opening and Job Pipeline
    const publishResult: any = await ctx.runMutation(api.openings.openings.publishOpeningWithJob, {
      openingName: args.openingName,
      clientName: args.clientName,
      clientId: args.clientId,
      jobDescription: args.jobDescription,
      extractedSkills: extracted.requiredSkills,
      preferredSkills: extracted.preferredSkills,
      minYearsExperience: extracted.minYearsExperience,
      maxYearsExperience: extracted.maxYearsExperience,
      seniorityLevel: extracted.seniority,
      educationLevel: extracted.education,
      location: extracted.location,
      industry: extracted.industry,
      languagesRequired: extracted.languages,
      assignedTaUserIds: args.assignedTaUserIds,
      taLeadNotes: args.taLeadNotes,
      taNotes: args.taNotes,
      scoreWeights: args.scoreWeights,
      minMatchScore: args.minMatchScore,
      reverseMatchOnPublish: args.reverseMatchOnPublish,
      followUpConfig: args.followUpConfig,
    });

    return {
      ...publishResult,
      extractedSkills: extracted.requiredSkills,
      seniorityLevel: extracted.seniority,
      experienceMinYears: extracted.minYearsExperience,
    };
  },
});

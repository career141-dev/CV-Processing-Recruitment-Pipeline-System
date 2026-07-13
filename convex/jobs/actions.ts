import { action } from "../_generated/server";
import { v } from "convex/values";
import { extractSearchRequirements } from "../lib/jdParser";

export const extractRequirementsAction = action({
  args: { description: v.string() },
  handler: async (ctx, args) => {
    const parsed = await extractSearchRequirements(args.description, "job_description");
    return {
      requiredSkills: parsed.requiredSkills || [],
      niceToHaveSkills: parsed.preferredSkills || [],
      location: parsed.location || "",
      title: parsed.title || "",
      minYearsExperience: parsed.minYearsExperience || 0,
      industry: parsed.industry || "",
      education: parsed.education || "",
      seniority: parsed.seniority || "",
      languages: parsed.languages || [],
      clientCompany: parsed.clientCompany || "",
      clientContactEmail: parsed.clientContactEmail || "",
      salaryRange: parsed.salaryRange || "",
    };
  },
});

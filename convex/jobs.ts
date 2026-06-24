import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

// convex/jobs.ts — generateKeyword helper function
function generateKeyword(title: string): string {
  // Extract first word, uppercase, append random 4-digit number
  const word = title.split(" ")[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}${num}`; // e.g. BRAND2024 -> BRAND7412
}

// Check uniqueness and regenerate if collision
export const createJobKeyword = mutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    let keyword: string = "";
    let attempts = 0;
    do {
      keyword = generateKeyword(title);
      const existing = await ctx.db.query("jobs")
        .withIndex("by_keyword", (q) => q.eq("keyword", keyword))
        .unique();
      if (!existing) break;
      attempts++;
    } while (attempts < 10);
    return keyword;
  },
});

// createJob Mutation — Step 1 Fields
export const createJob = mutation({
  args: {
    title: v.string(),
    clientName: v.string(),
    clientIndustry: v.string(),
    recruitmentType: v.string(),
    isConfidential: v.boolean(),
    jobDescription: v.string(),
    requiredSkills: v.array(v.string()),
    niceToHaveSkills: v.optional(v.array(v.string())),
    seniorityLevel: v.string(),
    experienceMinYears: v.number(),
    experienceMaxYears: v.optional(v.number()),
    location: v.string(),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    salaryCurrency: v.optional(v.string()),
    primaryRecruiterId: v.id("users"),
    directorId: v.optional(v.id("users")),
    clientContactName: v.optional(v.string()),
    clientContactEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Auto-generate keyword
    let keyword = generateKeyword(args.title);
    const existing = await ctx.db.query("jobs")
      .withIndex("by_keyword", (q) => q.eq("keyword", keyword))
      .unique();
    if (existing) keyword = generateKeyword(args.title); // retry once

    const jobId = await ctx.db.insert("jobs", {
      ...args,
      keyword,
      status: "draft",
      // Agent config defaults
      scoreWeightSkills: 35,
      scoreWeightExperience: 25,
      scoreWeightJobTitle: 20,
      scoreWeightIndustry: 15,
      scoreWeightLocation: 5,
      minMatchScoreToShow: 60,
      reverseMatchOnPublish: true,
      agent3Enabled: true,
      agent3AfterDay7: "mark_unresponsive",
      agent5Enabled: true,
      agent5Trigger: "all_new_applicants",
      agent5CallScript: "default",
      agent5NoAnswerAction: "trigger_agent3",
      agent5HideCompany: args.isConfidential,
      directorReviewEnabled: false,
      clientReviewEnabled: false,
      esaCheckEnabled: false,
      rejectionLoopAction: "restart_from_new_cvs",
      headhuntingEnabled: false,
      slaNoNewCvsDays: 5,
      slaTaReviewDays: 2,
      slaAiCallDays: 1,
      slaSecondShortlistDays: 2,
      slaDirectorReviewDays: 3,
      slaEsaDays: 3,
      slaClientReviewDays: 5,
      slaInterviewDays: 3,
      slaOfferDays: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recruitmentType: args.recruitmentType as any,
      seniorityLevel: args.seniorityLevel as any,
    });
    return { jobId, keyword };
  },
});

// updateJobChannels Mutation — Step 2
export const updateJobChannels = mutation({
  args: {
    jobId: v.id("jobs"),
    channels: v.array(v.object({
      channelType: v.string(),
      isEnabled: v.boolean(),
      whatsappNumber: v.optional(v.string()),
      metaCampaignId: v.optional(v.string()),
      emailInbox: v.optional(v.string()),
      workableJobId: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { jobId, channels }) => {
    for (const ch of channels) {
      const existing = await ctx.db.query("jobChannels")
        .withIndex("by_job", (q) => q.eq("jobId", jobId))
        .filter((q) => q.eq(q.field("channelType"), ch.channelType as any))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...ch,
          channelType: ch.channelType as any,
          agentStatus: ch.isEnabled ? "active" : "paused"
        });
      } else {
        await ctx.db.insert("jobChannels", {
          jobId,
          ...ch,
          channelType: ch.channelType as any,
          cvCountToday: 0,
          cvCountTotal: 0,
          agentStatus: ch.isEnabled ? "active" : "not_configured",
          createdAt: new Date().toISOString()
        });
      }
    }
    return { success: true };
  },
});

// updateJobAiConfig Mutation — Step 3
export const updateJobAiConfig = mutation({
  args: {
    jobId: v.id("jobs"),
    // Agent 2
    minMatchScoreToShow: v.number(),
    reverseMatchOnPublish: v.boolean(),
    scoreWeightSkills: v.number(),
    scoreWeightExperience: v.number(),
    scoreWeightJobTitle: v.number(),
    scoreWeightIndustry: v.number(),
    scoreWeightLocation: v.number(),
    // Agent 3
    agent3Enabled: v.boolean(),
    agent3Day2Channel: v.optional(v.string()),
    agent3Day4Channel: v.optional(v.string()),
    agent3Day7Channel: v.optional(v.string()),
    agent3AfterDay7: v.string(),
    // Agent 5
    agent5Enabled: v.boolean(),
    agent5Trigger: v.string(),
    agent5CallScript: v.string(),
    agent5CustomQuestions: v.optional(v.array(v.string())),
    agent5NoAnswerAction: v.string(),
    agent5HideCompany: v.boolean(),
    // Pipeline gates
    directorReviewEnabled: v.boolean(),
    directorId: v.optional(v.id("users")),
    clientReviewEnabled: v.boolean(),
    clientContactName: v.optional(v.string()),
    clientContactEmail: v.optional(v.string()),
    clientAccessLevel: v.optional(v.string()),
    esaCheckEnabled: v.boolean(),
    rejectionLoopAction: v.string(),
    // SLA
    slaNoNewCvsDays: v.number(),
    slaTaReviewDays: v.number(),
    slaAiCallDays: v.number(),
    slaSecondShortlistDays: v.number(),
    slaDirectorReviewDays: v.number(),
    slaEsaDays: v.number(),
    slaClientReviewDays: v.number(),
    slaInterviewDays: v.number(),
    slaOfferDays: v.number(),
  },
  handler: async (ctx, { jobId, ...config }) => {
    // Validate weights sum to 100
    const total = config.scoreWeightSkills + config.scoreWeightExperience + config.scoreWeightJobTitle + config.scoreWeightIndustry + config.scoreWeightLocation;
    if (total !== 100) throw new Error(`Score weights must total 100. Got ${total}.`);

    await ctx.db.patch(jobId, { 
      ...config, 
      clientAccessLevel: config.clientAccessLevel as any,
      agent3Day2Channel: config.agent3Day2Channel as any,
      agent3Day4Channel: config.agent3Day4Channel as any,
      agent3Day7Channel: config.agent3Day7Channel as any,
      agent3AfterDay7: config.agent3AfterDay7 as any,
      agent5Trigger: config.agent5Trigger as any,
      agent5CallScript: config.agent5CallScript as any,
      agent5NoAnswerAction: config.agent5NoAnswerAction as any,
      rejectionLoopAction: config.rejectionLoopAction as any,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  },
});

// publishJob Mutation — Step 4
export const publishJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Job not found");

    // Validation: title, required skills
    if (!job.title || !job.requiredSkills?.length) {
      throw new Error("Missing required fields: title, required skills");
    }

    await ctx.db.patch(jobId, { 
      status: "active", 
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // TODO: Trigger Agent 2 reverse match if enabled
    // if (job.reverseMatchOnPublish) {
    //   await ctx.scheduler.runAfter(0, "matchingAgent:reverseMatchJob", { jobId });
    // }

    return { success: true, keyword: job.keyword };
  },
});

// Helpful query to get jobs
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobs").order("desc").take(100);
  },
});

export const getByKeyword = query({
  args: { keyword: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query('jobs')
      .withIndex('by_keyword', (q) => q.eq('keyword', args.keyword))
      .unique();
  }
});


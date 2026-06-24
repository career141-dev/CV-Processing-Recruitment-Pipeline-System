import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireRole, requireUser } from "./lib/permissions";

// convex/jobs.ts — generateKeyword helper function
function generateKeyword(title: string): string {
  const word = title.split(" ")[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}${num}`; 
}

export const createJobKeyword = mutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    const user = await requireRole(ctx, ["admin", "ta_manager", "senior_ta"]);
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
    // These are needed by schema but will be formally assigned in assignTeamToJob
    primaryRecruiterId: v.id("users"),
    supportingRecruiterIds: v.optional(v.array(v.id("users"))),
    directorId: v.optional(v.id("users")),
    clientContactName: v.optional(v.string()),
    clientContactEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ROLE GUARD: Only ADMIN, TA_MANAGER, SENIOR_TA can create jobs
    const user = await requireRole(ctx, ["admin", "ta_manager", "senior_ta"]);

    let keyword = generateKeyword(args.title);
    const existing = await ctx.db.query("jobs")
      .withIndex("by_keyword", (q) => q.eq("keyword", keyword))
      .unique();
    if (existing) keyword = generateKeyword(args.title); 

    const jobId = await ctx.db.insert("jobs", {
      ...args,
      keyword,
      status: "draft",
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

    // Write activity log (Standardizing per Section 8 & 12)
    await ctx.db.insert("activityLog", {
      actorId: user._id,
      actorName: user.fullName || "Unknown",
      action: "create",
      entityType: "job",
      entityId: jobId,
      occurredAt: new Date().toISOString(),
    });
    
    return { jobId, keyword };
  },
});

export const assignTeamToJob = mutation({
  args: {
    jobId: v.id("jobs"),
    primaryRecruiterId: v.id("users"),
    supportingRecruiterIds: v.optional(v.array(v.id("users"))),
    directorId: v.optional(v.id("users")),
    clientContactId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "ta_manager", "senior_ta"]);

    // Validate that primaryRecruiterId is SENIOR_TA or RECRUITER
    const primary = await ctx.db.get(args.primaryRecruiterId);
    if (!primary || !["senior_ta", "recruiter"].includes(primary.role)) {
      throw new Error("Primary Recruiter must be SENIOR_TA or RECRUITER role");
    }

    const now = new Date().toISOString();

    // Create primary recruiter assignment
    await ctx.db.insert("jobAssignments", {
      jobId: args.jobId,
      userId: args.primaryRecruiterId,
      assignmentRole: "primary_recruiter",
      assignedBy: user._id,
      assignedAt: now,
      isActive: true,
    });

    // Create supporting recruiter assignments
    for (const uid of args.supportingRecruiterIds ?? []) {
      await ctx.db.insert("jobAssignments", {
        jobId: args.jobId,
        userId: uid,
        assignmentRole: "supporting_recruiter",
        assignedBy: user._id,
        assignedAt: now,
        isActive: true,
      });
    }

    // Create director assignment if provided
    if (args.directorId) {
      const director = await ctx.db.get(args.directorId);
      if (!director || director.role !== "director") {
        throw new Error("Director must have DIRECTOR role");
      }
      await ctx.db.insert("jobAssignments", {
        jobId: args.jobId,
        userId: args.directorId,
        assignmentRole: "director",
        assignedBy: user._id,
        assignedAt: now,
        isActive: true,
      });
    }
    
    // We update the jobs table cache fields
    await ctx.db.patch(args.jobId, {
      primaryRecruiterId: args.primaryRecruiterId,
      supportingRecruiterIds: args.supportingRecruiterIds,
      directorId: args.directorId,
    });

    return { success: true };
  },
});

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
    const user = await requireRole(ctx, ["admin", "ta_manager", "senior_ta"]);

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

export const updateJobAiConfig = mutation({
  args: {
    jobId: v.id("jobs"),
    minMatchScoreToShow: v.number(),
    reverseMatchOnPublish: v.boolean(),
    scoreWeightSkills: v.number(),
    scoreWeightExperience: v.number(),
    scoreWeightJobTitle: v.number(),
    scoreWeightIndustry: v.number(),
    scoreWeightLocation: v.number(),
    agent3Enabled: v.boolean(),
    agent3Day2Channel: v.optional(v.string()),
    agent3Day4Channel: v.optional(v.string()),
    agent3Day7Channel: v.optional(v.string()),
    agent3AfterDay7: v.string(),
    agent5Enabled: v.boolean(),
    agent5Trigger: v.string(),
    agent5CallScript: v.string(),
    agent5CustomQuestions: v.optional(v.array(v.string())),
    agent5NoAnswerAction: v.string(),
    agent5HideCompany: v.boolean(),
    directorReviewEnabled: v.boolean(),
    directorId: v.optional(v.id("users")),
    clientReviewEnabled: v.boolean(),
    clientContactName: v.optional(v.string()),
    clientContactEmail: v.optional(v.string()),
    clientAccessLevel: v.optional(v.string()),
    esaCheckEnabled: v.boolean(),
    rejectionLoopAction: v.string(),
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
    const user = await requireRole(ctx, ["admin", "ta_manager", "senior_ta"]);

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

export const publishJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const user = await requireRole(ctx, ["admin", "ta_manager", "senior_ta"]);
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Job not found");

    if (!job.title || !job.requiredSkills?.length) {
      throw new Error("Missing required fields: title, required skills");
    }

    await ctx.db.patch(jobId, { 
      status: "active", 
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await ctx.db.insert("activityLog", {
      actorId: user._id,
      actorName: user.fullName || "Unknown",
      action: "publish",
      entityType: "job",
      entityId: jobId,
      occurredAt: new Date().toISOString(),
    });

    return { success: true, keyword: job.keyword };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobs").order("desc").take(100);
  },
});

export const getMyAssignment = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    return await ctx.db.query("jobAssignments")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
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

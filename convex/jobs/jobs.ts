import { mutation, query, internalMutation } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { requireRole, requireUser } from "../lib/permissions";
import { internal, api } from "../_generated/api";
import { adjustGlobalStat } from "../stats/statsHelper";

// convex/jobs.ts — generateKeyword helper function
function generateKeyword(title: string): string {
  const prefix = title.replace(/\s+/g, "").toUpperCase().slice(0, 5);
  const year = new Date().getFullYear().toString().slice(-2);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 4);
  return `${prefix}${year}${rand}`;
}

export const createJobKeyword = mutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    const user = await requireRole(ctx, ["admin", "ta_manager", "senior_ta", "test_ta"]);
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
    educationLevel: v.optional(v.string()),
    languagesRequired: v.optional(v.array(v.string())),
    primaryRecruiterId: v.id("users"),
    isAssignedTAExplicit: v.optional(v.boolean()),
    supportingRecruiterIds: v.optional(v.array(v.id("users"))),
    directorId: v.optional(v.id("users")),
    clientContactName: v.optional(v.string()),
    clientContactEmail: v.optional(v.string()),
    keyword: v.optional(v.string()),
    muteDefaultWhatsappReply: v.optional(v.boolean()),
    followUpInitialTemplate: v.optional(v.string()),
    followUpSampleTemplate: v.optional(v.string()),
    enableEmailFollowUpTemplate: v.optional(v.boolean()),
    followUpEmailSubjectTemplate: v.optional(v.string()),
    followUpEmailBodyTemplate: v.optional(v.string()),
    customFollowUpQuestions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "ta_manager", "senior_ta", "test_ta"]);

    let keyword = args.keyword || generateKeyword(args.title);
    const existing = await ctx.db.query("jobs")
      .withIndex("by_keyword", (q) => q.eq("keyword", keyword))
      .unique();
    if (existing) {
      if (args.keyword) {
        throw new Error(`The keyword "${args.keyword}" is already in use. Please choose another one.`);
      }
      keyword = generateKeyword(args.title); 
    }

    const jobId = await ctx.db.insert("jobs", {
      ...args,
      keyword,
      status: "draft",
      scoreWeightSkills: 35,
      scoreWeightExperience: 15,
      scoreWeightJobTitle: 30,
      scoreWeightIndustry: 15,
      scoreWeightLocation: 5,
      minMatchScoreToShow: 60,
      reverseMatchOnPublish: true,
      agent3Enabled: true,
      agent3AfterDay7: "mark_unresponsive",
      agent5Enabled: false,
      agent5Trigger: "manual_only",
      agent5CallScript: "default",
      agent5NoAnswerAction: "notify_ta",
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
      educationLevel: args.educationLevel as any,
      languagesRequired: args.languagesRequired,
    });

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

export const createDraftJob = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    clientName: v.optional(v.string()),
    clientIndustry: v.optional(v.string()),
    recruitmentType: v.optional(v.union(
      v.literal("headhunting"),
      v.literal("job_posting"),
      v.literal("both")
    )),
    isConfidential: v.optional(v.boolean()),
    location: v.optional(v.string()),
    requiredSkills: v.optional(v.array(v.string())),
    niceToHaveSkills: v.optional(v.array(v.string())),
    seniorityLevel: v.optional(v.string()),
    experienceMinYears: v.optional(v.number()),
    experienceMaxYears: v.optional(v.number()),
    salaryRangeMin: v.optional(v.number()),
    salaryRangeMax: v.optional(v.number()),
    salaryCurrency: v.optional(v.string()),
    educationLevel: v.optional(v.string()),
    languagesRequired: v.optional(v.array(v.string())),
    directorId: v.optional(v.id("users")),
    clientContactName: v.optional(v.string()),
    clientContactEmail: v.optional(v.string()),
    primaryRecruiterId: v.optional(v.id("users")),
    isAssignedTAExplicit: v.optional(v.boolean()),
    supportingRecruiterIds: v.optional(v.array(v.id("users"))),
    muteDefaultWhatsappReply: v.optional(v.boolean()),
    pausedChannels: v.optional(v.array(v.string())),
    outreachWhatsAppNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "ta_manager", "senior_ta", "test_ta"]);

    let keyword = generateKeyword(args.title);
    let attempts = 0;
    while (attempts < 10) {
      const existing = await ctx.db
        .query("jobs")
        .withIndex("by_keyword", (q) => q.eq("keyword", keyword))
        .first();
      if (!existing) break;
      keyword = generateKeyword(args.title);
      attempts++;
    }

    const jobId = await ctx.db.insert("jobs", {
      title: args.title,
      jobDescription: args.description,
      primaryRecruiterId: args.primaryRecruiterId ?? user._id,
      isAssignedTAExplicit: args.isAssignedTAExplicit ?? (args.primaryRecruiterId !== undefined),
      status: "draft",
      keyword,
      clientName: args.clientName ?? "",
      clientIndustry: args.clientIndustry ?? "",
      recruitmentType: (args.recruitmentType as any) ?? "job_posting",
      isConfidential: args.isConfidential ?? false,
      location: args.location ?? "",
      requiredSkills: args.requiredSkills ?? [],
      niceToHaveSkills: args.niceToHaveSkills,
      seniorityLevel: (args.seniorityLevel as any) ?? "mid_level",
      experienceMinYears: args.experienceMinYears ?? 0,
      experienceMaxYears: args.experienceMaxYears,
      salaryMin: args.salaryRangeMin,
      salaryMax: args.salaryRangeMax,
      salaryCurrency: args.salaryCurrency,
      educationLevel: args.educationLevel as any,
      languagesRequired: args.languagesRequired,
      directorId: args.directorId,
      clientContactName: args.clientContactName,
      clientContactEmail: args.clientContactEmail,
      supportingRecruiterIds: args.supportingRecruiterIds,
      muteDefaultWhatsappReply: false,
      outreachWhatsAppNumber: args.outreachWhatsAppNumber,
      
      scoreWeightSkills: 35,
      scoreWeightExperience: 15,
      scoreWeightJobTitle: 30,
      scoreWeightIndustry: 15,
      scoreWeightLocation: 5,
      minMatchScoreToShow: 60,
      reverseMatchOnPublish: false,
      agent3Enabled: true,
      agent3AfterDay7: "mark_unresponsive",
      agent5Enabled: false,
      agent5Trigger: "manual_only",
      agent5CallScript: "default",
      agent5HideCompany: false,
      agent5NoAnswerAction: "notify_ta",
      directorReviewEnabled: false,
      clientReviewEnabled: false,
      esaCheckEnabled: false,
      rejectionLoopAction: "ask_ta_each_time",
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
    });

    await ctx.db.insert("activityLog", {
      actorId: user._id,
      actorName: user.fullName || "Unknown",
      action: "create_draft",
      entityType: "job",
      entityId: jobId,
      occurredAt: new Date().toISOString(),
    });

    return { jobId, keyword };
  },
});

export const updateJobDetails = mutation({
  args: {
    jobId: v.id("jobs"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    clientName: v.optional(v.string()),
    clientIndustry: v.optional(v.string()),
    recruitmentType: v.optional(v.union(
      v.literal("headhunting"),
      v.literal("job_posting"),
      v.literal("both")
    )),
    isConfidential: v.optional(v.boolean()),
    location: v.optional(v.string()),
    requiredSkills: v.optional(v.array(v.string())),
    niceToHaveSkills: v.optional(v.array(v.string())),
    seniorityLevel: v.optional(v.string()),
    experienceMinYears: v.optional(v.number()),
    experienceMaxYears: v.optional(v.number()),
    salaryRangeMin: v.optional(v.number()),
    salaryRangeMax: v.optional(v.number()),
    salaryCurrency: v.optional(v.string()),
    educationLevel: v.optional(v.string()),
    languagesRequired: v.optional(v.array(v.string())),
    directorId: v.optional(v.id("users")),
    clientContactName: v.optional(v.string()),
    clientContactEmail: v.optional(v.string()),
    primaryRecruiterId: v.optional(v.id("users")),
    supportingRecruiterIds: v.optional(v.array(v.id("users"))),
    muteDefaultWhatsappReply: v.optional(v.boolean()),
    enableEmailFollowUpTemplate: v.optional(v.boolean()),
    followUpEmailSubjectTemplate: v.optional(v.string()),
    followUpEmailBodyTemplate: v.optional(v.string()),
    pausedChannels: v.optional(v.array(v.string())),
    outreachWhatsAppNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "ta_manager", "senior_ta", "recruiter", "test_ta"]);
    const { jobId, description, salaryRangeMin, salaryRangeMax, ...fields } = args;
    
    const updates: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates[key] = val;
      }
    }
    
    if (description !== undefined) updates.jobDescription = description;
    if (salaryRangeMin !== undefined) updates.salaryMin = salaryRangeMin;
    if (salaryRangeMax !== undefined) updates.salaryMax = salaryRangeMax;
    
    updates.updatedAt = new Date().toISOString();

    await ctx.db.patch(jobId, updates);

    if (args.title !== undefined) {
      await syncJobTitleToCandidates(ctx, jobId, args.title);
    }
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
    const user = await requireRole(ctx, ["admin", "ta_manager", "senior_ta", "test_ta"]);

    const primary = await ctx.db.get(args.primaryRecruiterId);
    if (!primary || !["admin", "ta_manager", "senior_ta", "recruiter"].includes(primary.role)) {
      throw new Error("Primary Recruiter must have a valid recruiter or admin role");
    }

    const now = new Date().toISOString();

    await ctx.db.insert("jobAssignments", {
      jobId: args.jobId,
      userId: args.primaryRecruiterId,
      assignmentRole: "primary_recruiter",
      assignedBy: user._id,
      assignedAt: now,
      isActive: true,
    });

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

    if (args.directorId) {
      const director = await ctx.db.get(args.directorId);
      if (!director || !["director", "admin", "ta_manager"].includes(director.role)) {
        throw new Error("Director must have DIRECTOR, ADMIN, or TA_MANAGER role");
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
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "ta_manager", "senior_ta", "test_ta"]);

    const existing = await ctx.db
      .query("jobChannels")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    for (const ch of existing) {
      await ctx.db.delete(ch._id);
    }

    const job = await ctx.db.get(args.jobId);
    const jobTitle = job?.title ?? "Unknown";
    const monthYear = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

    for (const ch of args.channels) {
      const configuredSourceLevel2 =
        (ch.channelType === "whatsapp_campaign" || ch.channelType === "whatsapp") && ch.whatsappNumber
          ? `WhatsApp Campaign — ${jobTitle} — ${monthYear}`
          : undefined;

      await ctx.db.insert("jobChannels", {
        jobId: args.jobId,
        channelType: ch.channelType,
        isEnabled: ch.isEnabled,
        whatsappNumber: ch.whatsappNumber,
        metaCampaignId: ch.metaCampaignId,
        emailInbox: ch.emailInbox,
        workableJobId: ch.workableJobId,
        configuredSourceLevel2,
        agentStatus: ch.isEnabled ? "active" : "not_configured",
        cvCountToday: 0,
        cvCountTotal: 0,
        createdAt: new Date().toISOString(),
      });
    }

    if (!job) return { success: true };

    const enabledIds = args.channels
      .filter((ch) => ch.isEnabled)
      .map((ch) => ch.channelType);

    const paused: string[] = [];
    if (!enabledIds.includes("whatsapp")) paused.push("whatsapp");
    if (!enabledIds.includes("email_campaign")) paused.push("email");
    if (!enabledIds.includes("linkedin")) paused.push("linkedin");
    if (!enabledIds.includes("workable")) paused.push("portal");
      
    await ctx.db.patch(args.jobId, {
      pausedChannels: paused,
    });

    const waChannel = args.channels.find((c) => (c.channelType === "whatsapp" || c.channelType === "whatsapp_campaign") && c.isEnabled);
    const emailChannel = args.channels.find((c) => c.channelType === "email_campaign" && c.isEnabled);

    const whatsappDeepLink = waChannel?.whatsappNumber
      ? `https://wa.me/${waChannel.whatsappNumber.replace(/[^0-9]/g, "")}?text=${job.keyword}`
      : undefined;
    const shortApplyLink = `career141.com/apply/${job.keyword}`;
    const metaAdLink = whatsappDeepLink;
    const emailApplyAddress = emailChannel?.emailInbox;
    const linkedinJobTitle = `${job.title} — ${job.keyword}`;
    const channelConfigHash = JSON.stringify({
      wa: waChannel?.whatsappNumber,
      email: emailChannel?.emailInbox,
      keyword: job.keyword,
    });

    const existingAssets = await ctx.db
      .query("job_assets")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();

    const assetData = {
      jobId: args.jobId,
      whatsappDeepLink,
      shortApplyLink,
      metaAdLink,
      emailApplyAddress,
      linkedinJobTitle,
      linkedinIntakeEmail: "linkedin@career141.com",
      generatedAt: new Date().toISOString(),
      channelConfigHash,
      generatedFromChannelHash: channelConfigHash,
    };

    if (existingAssets) {
      await ctx.db.patch(existingAssets._id, assetData);
    } else {
      await ctx.db.insert("job_assets", assetData);
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
    agent3TimeWindowStart: v.optional(v.string()),
    agent3TimeWindowEnd: v.optional(v.string()),
    agent3AllowedDays: v.optional(v.array(v.string())),
    agent3TimeZone: v.optional(v.string()),
    agent3CustomSteps: v.optional(v.array(v.object({
      id: v.string(),
      day: v.number(),
      channel: v.string(),
      emailSubject: v.string(),
      emailBody: v.string(),
      whatsappBody: v.string(),
    }))),
    agent3TriggerStages: v.optional(v.array(v.string())),
    followUpInitialTemplate: v.optional(v.string()),
    followUpSampleTemplate: v.optional(v.string()),
    enableEmailFollowUpTemplate: v.optional(v.boolean()),
    followUpEmailSubjectTemplate: v.optional(v.string()),
    followUpEmailBodyTemplate: v.optional(v.string()),
    maxFollowUpDays: v.optional(v.number()),
    maxFollowUpAttempts: v.optional(v.number()),
    customFollowUpQuestions: v.optional(v.array(v.string())),
    agent3InitialChannel: v.optional(v.string()),
    agent3InitialMessage: v.optional(v.string()),
    agent3Day2Channel: v.optional(v.string()),
    agent3Day2Message: v.optional(v.string()),
    agent3Day4Channel: v.optional(v.string()),
    agent3Day4Message: v.optional(v.string()),
    agent3Day7Channel: v.optional(v.string()),
    agent3Day7Message: v.optional(v.string()),
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
    await requireRole(ctx, ["admin", "ta_manager", "senior_ta", "test_ta"]);

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
    const user = await requireRole(ctx, ["admin", "ta_manager", "senior_ta", "test_ta"]);
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Job not found");

    const errors: string[] = [];
    if (!job.title || !job.requiredSkills?.length) {
      throw new Error("Missing required fields: title, required skills");
    }

    const weightSum = (job.scoreWeightSkills ?? 35) +
      (job.scoreWeightExperience ?? 15) +
      (job.scoreWeightJobTitle ?? 30) +
      (job.scoreWeightIndustry ?? 15) +
      (job.scoreWeightLocation ?? 5);
    if (weightSum !== 100) errors.push(`AI match weights must sum to 100 (currently ${weightSum})`);

    const channels = await ctx.db
      .query("jobChannels")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .collect();
    for (const ch of channels) {
      if (!ch.isEnabled) continue;
      if (ch.channelType === "whatsapp" && !ch.whatsappNumber) {
        errors.push("WhatsApp channel enabled but no number configured");
      }
      if (ch.channelType === "email_campaign" && !ch.emailInbox) {
        errors.push("Email channel enabled but no inbox configured");
      }
    }

    if (job.directorReviewEnabled && !job.directorId) {
      errors.push("Director review enabled but no director assigned");
    }
    if (job.clientReviewEnabled && !job.clientContactEmail) {
      errors.push("Client review enabled but no client contact email provided");
    }

    if (errors.length > 0) {
      throw new Error(errors.join("; "));
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

    // Always generate the embedding for AI semantic search
    await ctx.scheduler.runAfter(0, api.matching.agent2.generateJobEmbedding, { jobId });
    if (job.reverseMatchOnPublish) {
       await ctx.db.patch(jobId, { reverseMatchStatus: "running" });
       await ctx.scheduler.runAfter(0, api.matching.agent2.runReverseMatch, { jobId });
    }
    
    await adjustGlobalStat(ctx, "new_job");

    return { success: true, keyword: job.keyword };
  },
});

export const updateJobStatus = mutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("on_hold"),
      v.literal("filled"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin", "ta_manager", "senior_ta", "test_ta"]);
    const oldJob = await ctx.db.get(args.jobId);
    
    const updates: any = { status: args.status, updatedAt: new Date().toISOString() };
    if (args.status === "filled") updates.filledAt = new Date().toISOString();
    
    await ctx.db.patch(args.jobId, updates);
    
    if (oldJob && oldJob.status === "active" && (args.status === "filled" || args.status === "cancelled" || args.status === "on_hold")) {
      await adjustGlobalStat(ctx, "closed_job");
    } else if (oldJob && oldJob.status !== "active" && args.status === "active") {
      await adjustGlobalStat(ctx, "new_job");
    }
    
    await ctx.db.insert("activityLog", {
      actorId: user._id,
      actorName: user.fullName || "Unknown",
      action: `status_changed_${args.status}`,
      entityType: "job",
      entityId: args.jobId,
      occurredAt: new Date().toISOString(),
    });
  },
});

export const deleteJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, ["admin"]);

    const channels = await ctx.db
      .query("jobChannels")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    for (const ch of channels) {
      await ctx.db.delete(ch._id);
    }
    const assets = await ctx.db
      .query("job_assets")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();
    if (assets) await ctx.db.delete(assets._id);

    await ctx.db.delete(args.jobId);
    
    await ctx.db.insert("activityLog", {
      actorId: user._id,
      actorName: user.fullName || "Unknown",
      action: "delete",
      entityType: "job",
      entityId: args.jobId,
      occurredAt: new Date().toISOString(),
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").order("desc").take(100);

    const jobsWithStats = jobs.map((job) => {
      const stageCounts: Record<string, number> = job.stageCounts || {};
      const newCvsCount = stageCounts["new_cvs"] || 0;
      const totalApplications = job.totalApplications || 0;

      // Determine dominant stage (highest priority non-new stage, or new_cvs)
      const STAGE_PRIORITY = [
        "placed", "offer", "client_review", "director_shortlist",
        "second_shortlist", "interview", "ai_call", "ta_shortlist", "new_cvs"
      ];
      let dominantStage = "new_cvs";
      for (const stage of STAGE_PRIORITY) {
        if (stageCounts[stage] && stageCounts[stage] > 0) {
          dominantStage = stage;
          break;
        }
      }

      return {
        ...job,
        newCvsCount,
        totalApplications,
        dominantStage,
        stageCounts,
      };
    });

    return jobsWithStats;
  },
});

export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("jobs").order("desc");

    if (args.status && args.status !== "All Jobs" && args.status !== "all") {
      let mappedStatus = args.status.toLowerCase();
      if (args.status === "On Hold") mappedStatus = "on_hold";
      if (args.status === "Fins") mappedStatus = "filled";
      if (args.status === "Lost") mappedStatus = "cancelled";
      if (args.status === "Active") mappedStatus = "active";
      if (args.status === "Draft") mappedStatus = "draft";

      q = ctx.db.query("jobs")
        .withIndex("by_status", (q) => q.eq("status", mappedStatus as any))
        .order("desc");
    }

    const page = await q.paginate(args.paginationOpts);

    const STAGE_PRIORITY = [
      "placed", "offer", "client_review", "director_shortlist",
      "second_shortlist", "interview", "ai_call", "ta_shortlist", "new_cvs"
    ];

    const jobsWithStats = page.page.map((job) => {
      const stageCounts: Record<string, number> = job.stageCounts || {};
      const newCvsCount = stageCounts["new_cvs"] || 0;
      const totalApplications = job.totalApplications || 0;

      let dominantStage = "new_cvs";
      for (const stage of STAGE_PRIORITY) {
        if (stageCounts[stage] && stageCounts[stage] > 0) {
          dominantStage = stage;
          break;
        }
      }

      return {
        ...job,
        newCvsCount,
        totalApplications,
        dominantStage,
        stageCounts,
      };
    });

    return {
      ...page,
      page: jobsWithStats,
    };
  },
});

export const getJobCounts = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    let all = jobs.length;
    let active = 0;
    let onHold = 0;
    let closed = 0;
    let lost = 0;
    let draft = 0;

    for (const j of jobs) {
      if (j.status === "active") active++;
      else if (j.status === "on_hold") onHold++;
      else if (j.status === "filled") closed++;
      else if (j.status === "cancelled") lost++;
      else if (j.status === "draft") draft++;
    }

    return { all, active, onHold, closed, lost, draft };
  },
});



export const getJob = query({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    const normalizedId = ctx.db.normalizeId("jobs", args.jobId);
    if (normalizedId) {
      return await ctx.db.get(normalizedId);
    }
    return await ctx.db.query("jobs").withIndex("by_keyword", q => q.eq("keyword", args.jobId)).first();
  },
});

export const getJobChannels = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobChannels")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});

export const getJobAssets = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("job_assets")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();
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
      .withIndex("by_jobId_userId", (q) => q.eq("jobId", args.jobId).eq("userId", user._id))
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
export const saveReverseMatchResults = internalMutation({
  args: {
    jobId: v.id("jobs"),
    roleFamily: v.optional(v.string()),
    roleFamilyCacheFingerprint: v.optional(v.string()),
    results: v.array(
      v.object({
        cvId: v.string(),
        overallScore: v.number(),
        breakdown: v.object({
          skills: v.number(),
          experience: v.number(),
          seniority: v.number(),
          industry: v.number(),
          location: v.number(),
        }),
        matchedSkills: v.array(v.string()),
        missingSkills: v.array(v.string()),
        reason: v.string(),
        sourceLevel1: v.optional(v.string()),
        sourceLevel2: v.optional(v.string()),
        candidateName: v.optional(v.string()),
        candidateRole: v.optional(v.string()),
        candidateExp: v.optional(v.number()),

        // Agent 2 — Current-Role Level & Role-Family Gate Fields
        currentRoleRank: v.optional(v.number()),
        currentRoleRankLabel: v.optional(v.string()),
        currentRoleConfidence: v.optional(v.string()),
        usedFallbackTitle: v.optional(v.boolean()),
        currentRoleGate: v.optional(v.string()),
        currentRolePenalty: v.optional(v.number()),
        seniorityConflict: v.optional(v.boolean()),
        exclusionReason: v.optional(v.union(v.string(), v.null())),
        roleFamily: v.optional(v.string()),
        roleFamilyMatch: v.optional(v.string()),
        locationGate: v.optional(v.string()),
        locationPenalty: v.optional(v.number()),
        locationStatus: v.optional(v.string()),
      })
    ),
    status: v.union(v.literal("done"), v.literal("error"), v.literal("running")),
  },
  handler: async (ctx, args) => {
    const patchObj: any = {
      reverseMatchStatus: args.status,
      reverseMatchedAt: new Date().toISOString(),
      reverseMatchResults: args.results.map((r) => ({
        cvId: r.cvId,
        overallScore: r.overallScore,
        breakdown: r.breakdown,
        matchedSkills: r.matchedSkills,
        missingSkills: r.missingSkills,
        reason: r.reason,
        sourceLevel1: r.sourceLevel1,
        sourceLevel2: r.sourceLevel2,
        candidateName: r.candidateName,
        candidateRole: r.candidateRole,
        candidateExp: r.candidateExp,

        currentRoleRank: r.currentRoleRank,
        currentRoleRankLabel: r.currentRoleRankLabel,
        currentRoleConfidence: r.currentRoleConfidence,
        usedFallbackTitle: r.usedFallbackTitle,
        currentRoleGate: r.currentRoleGate,
        currentRolePenalty: r.currentRolePenalty,
        seniorityConflict: r.seniorityConflict,
        exclusionReason: r.exclusionReason,
        roleFamily: r.roleFamily,
        roleFamilyMatch: r.roleFamilyMatch,
        locationGate: r.locationGate,
        locationPenalty: r.locationPenalty,
        locationStatus: r.locationStatus,
      })),
    };

    if (args.roleFamily !== undefined) patchObj.roleFamily = args.roleFamily;
    if (args.roleFamilyCacheFingerprint !== undefined) patchObj.roleFamilyCacheFingerprint = args.roleFamilyCacheFingerprint;

    await ctx.db.patch(args.jobId, patchObj);
  },
});

export const updateTaPreferences = mutation({
  args: {
    jobId: v.id("jobs"),
    taPreferences: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      taPreferences: args.taPreferences,
    });
  },
});

export const updateTaPreferencesInternal = internalMutation({
  args: {
    jobId: v.id("jobs"),
    taPreferences: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      taPreferences: args.taPreferences,
    });
  },
});

export const getActiveJobsBasicInfo = query({
  args: {},
  handler: async (ctx) => {
    const activeJobs = await ctx.db.query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
      
    const pausedJobs = await ctx.db.query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "on_hold"))
      .collect();
      
    const jobs = [...activeJobs, ...pausedJobs];
      
    return jobs.map(job => ({
      _id: job._id,
      title: job.title,
      keyword: job.keyword,
      clientName: job.clientName,
      location: job.location,
      pausedChannels: job.pausedChannels || []
    }));
  }
});

export async function syncJobTitleToCandidates(ctx: any, jobId: Id<"jobs">, newTitle: string) {
  const apps = await ctx.db
    .query("applications")
    .withIndex("by_job_active", (q: any) => q.eq("jobId", jobId).eq("isActive", true))
    .collect();

  for (const app of apps) {
    const candidate = await ctx.db.get(app.candidateId);
    if (candidate && candidate.activeApplicationsSummary) {
      const updatedSummary = candidate.activeApplicationsSummary.map((item: any) => {
        if (item.jobId === jobId) {
          return { ...item, jobTitle: newTitle };
        }
        return item;
      });
      await ctx.db.patch(candidate._id, { activeApplicationsSummary: updatedSummary });
    }
  }
}


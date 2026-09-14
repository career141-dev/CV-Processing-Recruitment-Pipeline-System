import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireRole } from "../lib/permissions";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("openings")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
  },
});

export const listByClient = query({
  args: {
    clientName: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
  },
  handler: async (ctx, args) => {
    if (args.clientId) {
      return await ctx.db
        .query("openings")
        .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
        .order("desc")
        .collect();
    }
    if (args.clientName) {
      const trimmed = args.clientName.trim();
      return await ctx.db
        .query("openings")
        .withIndex("by_clientName", (q) => q.eq("clientName", trimmed))
        .order("desc")
        .collect();
    }
    return [];
  },
});

export const getById = query({
  args: { id: v.id("openings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getOpeningWithJobs = query({
  args: { id: v.id("openings") },
  handler: async (ctx, args) => {
    const opening = await ctx.db.get(args.id);
    if (!opening) return null;

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_openingId", (q) => q.eq("openingId", args.id))
      .collect();

    return {
      ...opening,
      jobs,
    };
  },
});

export const createOpening = mutation({
  args: {
    title: v.string(),
    clientName: v.string(),
    clientId: v.optional(v.id("clients")),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("on_hold"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("draft")
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity ? await requireRole(ctx, ["admin", "ta_manager", "senior_ta", "recruiter", "test_ta"]) : null;
    const trimmedTitle = args.title.trim();
    const trimmedClientName = args.clientName.trim();

    if (!trimmedTitle) {
      throw new Error("Opening title cannot be empty");
    }
    if (!trimmedClientName) {
      throw new Error("Client name cannot be empty for an Opening");
    }

    // Lookup client if clientId not provided
    let finalClientId = args.clientId;
    if (!finalClientId) {
      const client = await ctx.db
        .query("clients")
        .withIndex("by_name", (q) => q.eq("name", trimmedClientName))
        .first();
      if (client) {
        finalClientId = client._id;
      }
    }

    const openingId = await ctx.db.insert("openings", {
      title: trimmedTitle,
      clientName: trimmedClientName,
      clientId: finalClientId,
      description: args.description?.trim(),
      status: args.status || "active",
      createdAt: Date.now(),
      createdBy: user?._id,
      updatedAt: Date.now(),
    });

    return openingId;
  },
});

export const updateOpening = mutation({
  args: {
    id: v.id("openings"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("on_hold"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("draft")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "ta_manager", "senior_ta", "recruiter", "test_ta"]);
    const { id, ...updates } = args;

    const patchObj: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (updates.title !== undefined) patchObj.title = updates.title.trim();
    if (updates.description !== undefined) patchObj.description = updates.description.trim();
    if (updates.status !== undefined) patchObj.status = updates.status;

    await ctx.db.patch(id, patchObj);
    return true;
  },
});

function generateKeyword(title: string): string {
  const prefix = title.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 5) || "ROLE";
  const year = new Date().getFullYear().toString().slice(-2);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 4);
  return `${prefix}${year}${rand}`;
}

export const publishOpeningWithJob = mutation({
  args: {
    openingName: v.string(),
    clientName: v.string(),
    clientId: v.optional(v.id("clients")),
    jobDescription: v.string(),
    extractedSkills: v.array(v.string()),
    preferredSkills: v.optional(v.array(v.string())),
    minYearsExperience: v.number(),
    maxYearsExperience: v.optional(v.number()),
    seniorityLevel: v.string(),
    educationLevel: v.optional(v.string()),
    location: v.string(),
    industry: v.string(),
    languagesRequired: v.optional(v.array(v.string())),
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
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity
      ? await ctx.db
          .query("users")
          .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
          .unique()
      : null;

    const trimmedTitle = args.openingName.trim();
    const trimmedClient = args.clientName.trim();

    if (!trimmedTitle) throw new Error("Opening title is required");
    if (!trimmedClient) throw new Error("Client name is required");

    // 1. Resolve or create client
    let finalClientId = args.clientId;
    if (!finalClientId) {
      const existingClient = await ctx.db
        .query("clients")
        .withIndex("by_name", (q) => q.eq("name", trimmedClient))
        .first();
      if (existingClient) {
        finalClientId = existingClient._id;
      }
    }

    // 2. Insert into openings table
    const openingId = await ctx.db.insert("openings", {
      title: trimmedTitle,
      clientName: trimmedClient,
      clientId: finalClientId,
      description: args.jobDescription.trim(),
      status: "active",
      createdAt: Date.now(),
      createdBy: user?._id,
      updatedAt: Date.now(),
    });

    // 3. Resolve Primary Recruiter and Supporting Recruiters
    let primaryRecruiterId: Id<"users"> | undefined = user?._id;
    const supportingRecruiterIds: Id<"users">[] = [];

    if (args.assignedTaUserIds && args.assignedTaUserIds.length > 0) {
      for (const taIdStr of args.assignedTaUserIds) {
        try {
          const u = await ctx.db.get(taIdStr as any);
          if (u && (u as any).role) {
            const uid = u._id as Id<"users">;
            if (!primaryRecruiterId) {
              primaryRecruiterId = uid;
            } else if (uid !== primaryRecruiterId) {
              supportingRecruiterIds.push(uid);
            }
          }
        } catch {
          // Ignored if non-convex ID
        }
      }
    }

    if (!primaryRecruiterId) {
      const defaultUser = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (defaultUser) {
        primaryRecruiterId = defaultUser._id;
      } else {
        const anyUser = await ctx.db.query("users").first();
        if (anyUser) {
          primaryRecruiterId = anyUser._id;
        } else {
          throw new Error("No active recruiter found in database to assign to this opening.");
        }
      }
    }

    // 4. Generate unique keyword
    let keyword = generateKeyword(trimmedTitle);
    let attempts = 0;
    while (attempts < 10) {
      const existing = await ctx.db
        .query("jobs")
        .withIndex("by_keyword", (q) => q.eq("keyword", keyword))
        .first();
      if (!existing) break;
      keyword = generateKeyword(trimmedTitle);
      attempts++;
    }

    // 5. Ensure non-empty required skills
    const requiredSkills = args.extractedSkills.length > 0
      ? args.extractedSkills
      : [trimmedTitle, "Core Operations", "Execution Excellence"];

    // 6. Insert into jobs table
    const jobId = await ctx.db.insert("jobs", {
      title: trimmedTitle,
      openingId,
      clientName: trimmedClient,
      clientIndustry: args.industry || "General Industry",
      recruitmentType: "both",
      isConfidential: false,
      jobDescription: args.jobDescription.trim(),
      requiredSkills,
      niceToHaveSkills: args.preferredSkills || [],
      seniorityLevel: args.seniorityLevel as any,
      experienceMinYears: args.minYearsExperience,
      experienceMaxYears: args.maxYearsExperience,
      location: args.location || "Hybrid / Full-Time",
      educationLevel: args.educationLevel || "Bachelor's Degree or Equivalent",
      languagesRequired: args.languagesRequired || ["English"],
      keyword,
      status: "active",
      primaryRecruiterId,
      isAssignedTAExplicit: true,
      supportingRecruiterIds: supportingRecruiterIds.length > 0 ? supportingRecruiterIds : undefined,
      directorReviewEnabled: false,
      clientReviewEnabled: false,
      esaCheckEnabled: false,
      rejectionLoopAction: "restart_from_new_cvs",
      scoreWeightSkills: args.scoreWeights.skills,
      scoreWeightExperience: args.scoreWeights.experience,
      scoreWeightJobTitle: args.scoreWeights.jobTitle,
      scoreWeightIndustry: args.scoreWeights.industry,
      scoreWeightLocation: args.scoreWeights.location,
      minMatchScoreToShow: args.minMatchScore,
      reverseMatchOnPublish: args.reverseMatchOnPublish,
      enableWhatsAppFollowUp: args.followUpConfig?.enableWhatsAppFollowUp ?? true,
      enableEmailFollowUp: args.followUpConfig?.enableEmailFollowUp ?? true,
      agent3Enabled: (args.followUpConfig?.enableWhatsAppFollowUp || args.followUpConfig?.enableEmailFollowUp) ?? true,
      agent3AfterDay7: "mark_unresponsive",
      agent5Enabled: false,
      agent5Trigger: "manual_only",
      agent5CallScript: "default",
      agent5NoAnswerAction: "notify_ta",
      agent5HideCompany: false,
      headhuntingEnabled: false,
      maxFollowUpAttempts: args.followUpConfig?.maxFollowUpAttempts ?? 3,
      maxFollowUpDays: args.followUpConfig?.maxFollowUpDays ?? 7,
      customFollowUpQuestions: args.followUpConfig?.customQuestions,
      slaNoNewCvsDays: 1,
      slaTaReviewDays: 1,
      slaAiCallDays: 1,
      slaSecondShortlistDays: 1,
      slaDirectorReviewDays: 1,
      slaEsaDays: 1,
      slaClientReviewDays: 1,
      slaInterviewDays: 1,
      slaOfferDays: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    });

    // 7. Insert jobAssignments for team pipeline access
    await ctx.db.insert("jobAssignments", {
      jobId,
      userId: primaryRecruiterId,
      assignmentRole: "primary_recruiter",
      assignedBy: user?._id ?? primaryRecruiterId,
      assignedAt: new Date().toISOString(),
      isActive: true,
    });

    for (const supId of supportingRecruiterIds) {
      await ctx.db.insert("jobAssignments", {
        jobId,
        userId: supId,
        assignmentRole: "supporting_recruiter",
        assignedBy: user?._id ?? primaryRecruiterId,
        assignedAt: new Date().toISOString(),
        isActive: true,
      });
    }

    // 8. Initialize default jobChannels (WhatsApp, Email Campaign, LinkedIn, Manual Upload)
    const channelsToInit = [
      { channelType: "whatsapp", isEnabled: args.followUpConfig?.enableWhatsAppFollowUp ?? true },
      { channelType: "email_campaign", isEnabled: args.followUpConfig?.enableEmailFollowUp ?? true },
      { channelType: "linkedin", isEnabled: true },
      { channelType: "manual_upload", isEnabled: true },
    ];

    for (const ch of channelsToInit) {
      await ctx.db.insert("jobChannels", {
        jobId,
        channelType: ch.channelType,
        isEnabled: ch.isEnabled,
        agentStatus: ch.isEnabled ? "active" : "not_configured",
        cvCountToday: 0,
        cvCountTotal: 0,
        createdAt: new Date().toISOString(),
      });
    }

    // 9. Schedule Voyage AI Embedding Generation and Agent 2 Reverse Match
    const apiAny: any = api;
    if (apiAny.matching?.agent2?.generateJobEmbedding) {
      await ctx.scheduler.runAfter(0, apiAny.matching.agent2.generateJobEmbedding, { jobId });
    }
    if (args.reverseMatchOnPublish && apiAny.matching?.agent2?.runReverseMatch) {
      await ctx.db.patch(jobId, { reverseMatchStatus: "running" });
      await ctx.scheduler.runAfter(0, apiAny.matching.agent2.runReverseMatch, { jobId });
    }

    // 9. Activity Log
    await ctx.db.insert("activityLog", {
      actorId: user?._id ?? primaryRecruiterId,
      actorName: user?.fullName || "Recruiter",
      action: "publish_opening",
      entityType: "job",
      entityId: jobId,
      occurredAt: new Date().toISOString(),
    });

    return {
      openingId,
      jobId,
      keyword,
      extractedSkillsCount: requiredSkills.length,
    };
  },
});


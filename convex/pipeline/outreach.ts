import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { initiateFollowUpOutreach } from "./followUpHelper";

// Get AI Calls for Outreach dashboard
export const getAiCalls = query({
  args: {
    jobId: v.optional(v.id("jobs")),
    outcome: v.optional(v.string()),
    dateRange: v.optional(v.string()), // 'today', '7days'
  },
  handler: async (ctx, args) => {
    let calls = await ctx.db.query("aiCalls").order("desc").take(100);

    // Join with candidates and jobs
    const enrichedCalls = await Promise.all(
      calls.map(async (call) => {
        const candidate = await ctx.db.get(call.candidateId);
        const job = await ctx.db.get(call.jobId);
        
        return {
          ...call,
          candidateName: candidate?.fullName || "Unknown",
          candidateCurrentTitle: candidate?.currentTitle || candidate?.currentJobTitle || "",
          candidateNoticePeriod: candidate?.noticePeriodDays || candidate?.noticePeriod || "",
          candidateExpectedSalary: candidate?.expectedSalary || "",
          candidateCurrentSalary: candidate?.currentSalary || "",
          jobTitle: job?.title || "Unknown Job",
          clientName: job?.clientName || "",
        };
      })
    );

    let filtered = enrichedCalls;

    if (args.jobId) {
      filtered = filtered.filter(c => c.jobId === args.jobId);
    }

    if (args.outcome && args.outcome !== "All Outcomes") {
      filtered = filtered.filter(c => {
        if (args.outcome === "Interested") return c.ivrResponse === "pressed_1_interested";
        if (args.outcome === "Declined") return c.ivrResponse === "pressed_2_declined";
        if (args.outcome === "No Answer") return c.callStatus === "no_answer";
        return true;
      });
    }

    if (args.dateRange === "Today") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      filtered = filtered.filter(c => c.calledAt >= startOfToday.getTime());
    } else if (args.dateRange === "Last 7 Days") {
      const startOf7Days = new Date();
      startOf7Days.setDate(startOf7Days.getDate() - 7);
      startOf7Days.setHours(0, 0, 0, 0);
      filtered = filtered.filter(c => c.calledAt >= startOf7Days.getTime());
    }

    return filtered;
  },
});

// Trigger a new AI call
export const triggerAiCall = mutation({
  args: {
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    callScriptUsed: v.union(
      v.literal("default"),
      v.literal("initial_screening"),
      v.literal("technical_prescreen")
    ),
    companyHidden: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    // Assuming we have a user, but we'll mock if not
    let userId;
    if (identity) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email!))
        .first();
      userId = user?._id;
    }

    const newCallId = await ctx.db.insert("aiCalls", {
      candidateId: args.candidateId,
      jobId: args.jobId,
      triggeredBy: userId,
      triggerType: "manual_ta_trigger",
      callStatus: "scheduled",
      callScriptUsed: args.callScriptUsed,
      companyHidden: args.companyHidden,
      calledAt: Date.now(),
      firstAttemptAt: Date.now(),
      attemptNumber: 1,
      followUpTriggered: false,
    });

    const app = await ctx.db.query("applications")
      .withIndex("by_candidate_job", q => q.eq("candidateId", args.candidateId).eq("jobId", args.jobId))
      .first();

    if (app) {
      await ctx.db.patch(newCallId, { applicationId: app._id });
      await ctx.scheduler.runAfter(0, internal.integrations.elevenlabs.triggerIntakeCall, {
        applicationId: app._id,
        candidateId: args.candidateId,
        jobId: args.jobId,
      });
    }

    return newCallId;
  },
});

// Get communications
export const getCommunications = query({
  args: {
    jobId: v.optional(v.id("jobs")),
  },
  handler: async (ctx, args) => {
    let comms = await ctx.db.query("communications").order("desc").take(100);
    
    if (args.jobId) {
      comms = comms.filter(c => c.jobId === args.jobId);
    }
    
    return Promise.all(
      comms.map(async (c) => {
        const candidate = await ctx.db.get(c.candidateId);
        let jobTitle = "Unknown";
        if (c.jobId) {
          const job = await ctx.db.get(c.jobId);
          if (job) jobTitle = job.title;
        }
        return {
          ...c,
          candidateName: candidate?.fullName || "Unknown",
          jobTitle,
        };
      })
    );
  }
});

// Send message
export const sendMessage = mutation({
  args: {
    candidateId: v.id("candidates"),
    jobId: v.optional(v.id("jobs")),
    channel: v.union(v.literal("email"), v.literal("whatsapp"), v.literal("sms")),
    subject: v.optional(v.string()),
    body: v.string(),
    setupFollowUps: v.boolean(),
  },
  handler: async (ctx, args) => {
    const commId = await ctx.db.insert("communications", {
      candidateId: args.candidateId,
      jobId: args.jobId,
      direction: "outbound",
      channel: args.channel,
      subject: args.subject,
      body: args.body,
      deliveryStatus: "sent",
      sentAt: Date.now(),
      stoppedSequence: !args.setupFollowUps,
      senderAgent: "system", // Or Agent3
    });
    return commId;
  }
});

// Trigger manual follow-up WhatsApp message
export const triggerWhatsAppFollowUp = mutation({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    const commId = await initiateFollowUpOutreach(ctx, args.applicationId);
    return { success: true, communicationId: commId };
  },
});

// Trigger bulk manual follow-up outreach for multiple applications
export const triggerBulkFollowUp = mutation({
  args: {
    applicationIds: v.array(v.id("applications")),
  },
  handler: async (ctx, args) => {
    for (const appId of args.applicationIds) {
      await initiateFollowUpOutreach(ctx, appId);
    }
    return { success: true };
  },
});

// Get communication status by ID for frontend polling
export const getCommunicationStatus = query({
  args: {
    communicationId: v.id("communications"),
  },
  handler: async (ctx, args) => {
    const comm = await ctx.db.get(args.communicationId);
    return comm ? { deliveryStatus: comm.deliveryStatus, errorMessage: comm.errorMessage } : null;
  },
});

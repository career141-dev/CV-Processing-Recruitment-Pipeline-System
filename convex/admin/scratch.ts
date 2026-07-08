import { query, mutation } from "../_generated/server";
import { v } from "convex/values";

export const getFirst = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("communications")
      .order("desc")
      .take(10);
  },
});

export const inspectWhatsApp = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("communications")
      .filter((q: any) => q.eq(q.field("channel"), "whatsapp"))
      .order("desc")
      .take(20);
  }
});

export const inspectEnv = query({
  args: {},
  handler: async (ctx) => {
    return {
      WHATSAPP_TEST_MODE: process.env.WHATSAPP_TEST_MODE,
      WHATSAPP_TEST_RECIPIENT: process.env.WHATSAPP_TEST_RECIPIENT,
      WHATCHIMP_API_TOKEN: process.env.WHATCHIMP_API_TOKEN ? "configured (starts with " + process.env.WHATCHIMP_API_TOKEN.substring(0, 5) + "...)" : "not configured",
      WHATCHIMP_PHONE_NUMBER_ID: process.env.WHATCHIMP_PHONE_NUMBER_ID,
    };
  }
});

export const inspectApplications = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("applications").collect();
  }
});

export const inspectLatestWhatsApp = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("communications")
      .filter((q: any) => q.eq(q.field("channel"), "whatsapp"))
      .order("desc")
      .take(3);
  }
});

export const resetWasifToFollowUp = mutation({
  args: {},
  handler: async (ctx: any) => {
    const candidate = await ctx.db
      .query("candidates")
      .filter((q: any) => q.eq(q.field("email"), "wasifchy7@gmail.com"))
      .first();

    if (!candidate) throw new Error("Candidate wasifchy7@gmail.com not found");

    await ctx.db.patch(candidate._id, {
      currentSalary: undefined,
      expectedSalary: undefined,
      noticePeriodDays: undefined,
      noticePeriod: undefined,
    });

    const app = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidate._id))
      .first();

    if (app) {
      await ctx.db.patch(app._id, {
        currentStage: "follow_up",
        followUpCurrentSalary: false,
        followUpExpectedSalary: false,
        followUpNoticePeriod: false,
        followUpCvReceived: true,
      });
    }

    return { success: true, candidateId: candidate._id, applicationId: app?._id };
  }
});

export const inspectCandidateState = query({
  args: {},
  handler: async (ctx) => {
    const candidates = await ctx.db.query("candidates").collect();
    const candidateList = candidates.map(c => ({
      id: c._id,
      name: c.fullName,
      email: c.email,
    }));

    const applications = await ctx.db.query("applications").collect();
    const applicationList = [];
    for (const app of applications) {
      const cand = candidates.find(c => c._id === app.candidateId);
      applicationList.push({
        id: app._id,
        candidateName: cand?.fullName || "Unknown",
        candidateEmail: cand?.email || "Unknown",
        stage: app.currentStage,
      });
    }

    const communications = await ctx.db.query("communications").order("desc").take(10);

    return {
      candidates: candidateList,
      applications: applicationList,
      recentCommunications: communications,
    };
  }
});

export const setupTestCandidate = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const existingCandidates = await ctx.db
      .query("candidates")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect();

    for (const c of existingCandidates) {
      const apps = await ctx.db
        .query("applications")
        .withIndex("by_candidateId", (q: any) => q.eq("candidateId", c._id))
        .collect();
      for (const a of apps) {
        await ctx.db.delete(a._id);
      }
      await ctx.db.delete(c._id);
    }

    const activeJob = await ctx.db.query("jobs").filter((q: any) => q.eq(q.field("status"), "active")).first();
    if (!activeJob) {
      throw new Error("No active jobs found in the database. Please create a job first.");
    }

    const candidateId = await ctx.db.insert("candidates", {
      fullName: "Test Candidate",
      email: args.email,
      phone: "+94777065657",
      status: "active",
    });

    const applicationId = await ctx.db.insert("applications", {
      candidateId,
      jobId: activeJob._id,
      sourceChannel: "email_campaign",
      currentStage: "follow_up",
      followUpEnteredAt: Date.now(),
    });

    return {
      success: true,
      candidateId,
      applicationId,
      jobId: activeJob._id,
      message: `Test candidate and application created in follow_up stage successfully! Associated with active job: ${activeJob.title}`,
    };
  }
});

import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedTestCandidate = mutation({
  args: {
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetEmail = args.email || "hdbinath@gmail.com";
    const targetPhone = args.phone || "0742625552";
    const formattedPhone = targetPhone.startsWith("+") ? targetPhone : `+94${targetPhone.replace(/^0/, "")}`;

    // 1. Find Development Test Job
    let job = await ctx.db
      .query("jobs")
      .withIndex("by_keyword", (q) => q.eq("keyword", "DEV-TEST"))
      .first();

    if (!job) {
      const allJobs = await ctx.db.query("jobs").collect();
      job = allJobs.find(j => j.title.toLowerCase().includes("development test")) || null;
    }

    if (!job) {
      throw new Error("Development Test Job not found in database");
    }

    // 2. Find or Create Candidate
    let candidate = await ctx.db
      .query("candidates")
      .withIndex("by_email", (q) => q.eq("email", targetEmail))
      .first();

    let candidateId;
    const now = Date.now();

    if (candidate) {
      candidateId = candidate._id;
      await ctx.db.patch(candidateId, {
        fullName: "Binath Test Candidate",
        phone: formattedPhone,
      });
    } else {
      candidateId = await ctx.db.insert("candidates", {
        fullName: "Binath Test Candidate",
        email: targetEmail,
        phone: formattedPhone,
        currentJobTitle: "Software Developer",
        totalExperienceYears: 3,
        status: "active",
        overallStatus: "new_cvs",
      });
    }

    // 3. Find or Create Application in "new_cvs" stage
    let app = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", candidateId))
      .filter((q) => q.eq(q.field("jobId"), job._id))
      .first();

    let applicationId;
    if (app) {
      applicationId = app._id;
      await ctx.db.patch(app._id, {
        currentStage: "new_cvs",
        isActive: true,
        candidateName: "Binath Test Candidate",
        candidateEmail: targetEmail,
        candidatePhone: formattedPhone,
        lastStageChangedAt: now,
      });
    } else {
      applicationId = await ctx.db.insert("applications", {
        candidateId,
        jobId: job._id,
        sourceChannel: "email",
        candidateName: "Binath Test Candidate",
        candidateEmail: targetEmail,
        candidatePhone: formattedPhone,
        currentStage: "new_cvs",
        loopIteration: 1,
        isActive: true,
        lastStageChangedAt: now,
        createdAt: now,
      });
    }

    return {
      success: true,
      jobId: job._id,
      jobTitle: job.title,
      candidateId,
      applicationId,
      email: targetEmail,
      phone: formattedPhone,
      stage: "new_cvs",
    };
  },
});

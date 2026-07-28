import { query, action, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import OpenAI from "openai";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";

export const ping = query({
  args: {},
  handler: async () => {
    return "ok";
  },
});

export const getRecentUploads = query({
  args: {},
  handler: async (ctx) => {
    const recentCvUploads = await ctx.db
      .query("cvUploads")
      .order("desc")
      .take(20);
    return recentCvUploads;
  },
});



export const getCvUploadsForIT = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("cvUploads").collect();
    return all.filter((u) => u.assignToJob === "m17abwpzg8ekcqq34e4kw5y6jx8b1p7r");
  },
});

export const getJobChannelsForIT = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("jobChannels")
      .withIndex("by_job", (q) => q.eq("jobId", "m17abwpzg8ekcqq34e4kw5y6jx8b1p7r" as any))
      .collect();
  },
});

export const getItJobDetails = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_keyword", (q) => q.eq("keyword", "HOIT652"))
      .first();
  },
});



export const getApplicationsForIT = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("applications").collect();
    return all.filter((a) => a.jobId === "m17abwpzg8ekcqq34e4kw5y6jx8b1p7r");
  },
});

export const getCandidateApplications = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("applications").collect();
    return all.filter((a) => a.candidateId === "j978zd52crzdy6fmb3skxqpkn58b0e69");
  },
});

export const getRecentApplications = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("applications")
      .order("desc")
      .take(10);
  },
});

export const getCandidateById = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.get("j978zd52crzdy6fmb3skxqpkn58b0e69" as any);
  },
});

export const testInternet = action({
  args: {},
  handler: async () => {
    try {
      const res = await fetch("https://google.com");
      return { success: true, status: res.status, statusText: res.statusText };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
});

export const testNvidia = action({
  args: {},
  handler: async () => {
    try {
      const { getOpenAI, OPENROUTER_PRIMARY_MODEL } = await import("./lib/llm");
      const openai = getOpenAI("jd_matching");
      const response = await openai.chat.completions.create({
        model: OPENROUTER_PRIMARY_MODEL,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 10,
      });
      return { success: true, response: response.choices[0]?.message?.content };
    } catch (e: any) {
      return { success: false, error: e.message, name: e.name };
    }
  },
});

export const triggerTestCV = action({
  args: {},
  handler: async (ctx) => {
    const testHash = "e6ab5333bdce41b47020c775aa17f63cb39bedba6a59ae09577aba88ccb240e6";
    const testKey = "cvs/2026-07/1784723522530-JAYANDHARAN_P_.pdf";
    
    await ctx.runMutation(api.pipeline.ingestion.processCvIngestion, {
      jobId: "m17abwpzg8ekcqq34e4kw5y6jx8b1p7r" as any,
      sourceChannel: "linkedin",
      rawSender: "test-linkedin-app@career141.com",
      s3Key: testKey,
      storageProvider: "r2",
      fileHash: testHash,
      fileName: "TEST_LINKEDIN_IT_APPLICANT.pdf",
      fileType: "application/pdf",
      fileSizeBytes: 48404,
      extractionDelayMs: 0,
    });
    
    return { success: true, message: "Ingestion triggered successfully! Watch the dashboard." };
  },
});

export const deleteItDummy = mutation({
  args: {},
  handler: async (ctx) => {
    const candidateId = "j978zd52crzdy6fmb3skxqpkn58b0e69" as Id<"candidates">;
    
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", candidateId))
      .collect();
    for (const a of apps) {
      await ctx.db.delete(a._id);
    }
    
    const resumes = await ctx.db
      .query("candidateResumes")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", candidateId))
      .collect();
    for (const r of resumes) {
      await ctx.db.delete(r._id);
    }
    
    const exists = await ctx.db.get(candidateId);
    if (exists) {
      await ctx.db.delete(candidateId);
    }

    // Recalculate and update job stats for Head of IT job
    const jobId = "m17abwpzg8ekcqq34e4kw5y6jx8b1p7r" as Id<"jobs">;
    const remainingApps = await ctx.db
      .query("applications")
      .withIndex("by_job_active", (q) => q.eq("jobId", jobId))
      .collect();
      
    const newStageCounts: Record<string, number> = {};
    for (const app of remainingApps) {
      if (app.isActive) {
        newStageCounts[app.currentStage] = (newStageCounts[app.currentStage] || 0) + 1;
      }
    }
    
    await ctx.db.patch(jobId, {
      totalApplications: remainingApps.length,
      stageCounts: newStageCounts,
    });
    
    return { success: true };
  },
});

export const reprocessFailedITUploads = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("cvUploads").collect();
    const failedIT = all.filter(
      (u) =>
        u.assignToJob === "m17abwpzg8ekcqq34e4kw5y6jx8b1p7r" &&
        (u.status === "failed" || u.status === "failed_retry")
    );
    
    let count = 0;
    for (const upload of failedIT) {
      await ctx.db.patch(upload._id, { status: "pending", errorMessage: undefined });
      
      const delayOffset = count * 4000;
      await ctx.scheduler.runAfter(delayOffset, api.cvs.cvExtraction.processCvExtraction, {
        storageId: upload.storageId,
        s3Key: upload.s3Key,
        storageProvider: upload.storageProvider,
        fileType: upload.fileType,
        sourceChannel: upload.source ?? "email",
        uploadedBy: "system",
        cvUploadId: upload._id,
      });
      count++;
    }
    return { success: true, count };
  },
});

export const getUploadById = query({
  args: { cvUploadId: v.id("cvUploads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.cvUploadId);
  },
});

export const getIngestionLogForFile = query({
  args: { cvFileId: v.id("cvUploads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ingestionLog")
      .withIndex("by_cvFileId", (q: any) => q.eq("cvFileId", args.cvFileId))
      .first();
  },
});

export const getIngestionLogShabeen = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("ingestionLog")
      .withIndex("by_cvFileId", (q: any) => q.eq("cvFileId", "jd7acvpnxa2ya50btd5v1xdbk58b0h3h"))
      .first();
  },
});

export const getUploadStatusDetails = query({
  args: {},
  handler: async (ctx) => {
    const ids = [
      "jd7b72zqn5np6d786pype144fh8b01ma", // Wasantha
      "jd7ce95dkrvabgxfj7zdwh8vn98b1pxh", // Deepal
      "jd7acvpnxa2ya50btd5v1xdbk58b0h3h", // Shabeen
      "jd72jyv919w931y5tm7zza6pm58b0kvn", // Aruna
    ];
    const results = [];
    for (const id of ids) {
      const doc = (await ctx.db.get(id as any)) as any;
      results.push({ id, fileName: doc?.fileName, status: doc?.status, errorMessage: doc?.errorMessage });
    }
    return results;
  },
});

export const setUploadPending = mutation({
  args: { cvUploadId: v.id("cvUploads") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.cvUploadId, { status: "pending", errorMessage: undefined });
  },
});

export const reprocessSingleUpload = action({
  args: { cvUploadId: v.id("cvUploads") },
  handler: async (ctx, args) => {
    const upload = await ctx.runQuery(api.health.getUploadById, { cvUploadId: args.cvUploadId });
    if (!upload) return { success: false, reason: "not_found" };
    
    await ctx.runMutation(api.health.setUploadPending, { cvUploadId: args.cvUploadId });
    
    await ctx.runAction(api.cvs.cvExtraction.processCvExtraction, {
      storageId: upload.storageId,
      s3Key: upload.s3Key,
      storageProvider: upload.storageProvider,
      fileType: upload.fileType,
      sourceChannel: upload.source ?? "email",
      uploadedBy: "system",
      cvUploadId: upload._id,
    });
    
    return { success: true };
  },
});




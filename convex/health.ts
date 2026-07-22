import { query, action } from "./_generated/server";
import { api } from "./_generated/api";
import OpenAI from "openai";

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
      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) return { success: false, error: "NVIDIA_API_KEY missing" };
      const openai = new OpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey,
        timeout: 10000,
      });
      const response = await openai.chat.completions.create({
        model: "meta/llama-3.1-70b-instruct",
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

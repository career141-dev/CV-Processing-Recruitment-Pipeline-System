import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const listCandidates = query({
  handler: async (ctx) => {
    return await ctx.db.query("candidates").order("desc").collect();
  },
});

export const listCandidatesPaginated = query({
  args: { paginationOpts: v.any() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("candidates")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getCandidate = query({
  args: { id: v.id("candidates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createCandidate = mutation({
  args: {
    fullName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    currentTitle: v.optional(v.string()),
    currentEmployer: v.optional(v.string()),
    seniorityLevel: v.optional(v.string()),
    yearsOfExperience: v.optional(v.float64()),
    industries: v.optional(v.array(v.string())),
    expectedSalary: v.optional(v.string()),
    noticePeriod: v.optional(v.string()),
    employmentStatus: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    education: v.optional(
      v.array(
        v.object({
          degree: v.optional(v.string()),
          institution: v.optional(v.string()),
          year: v.optional(v.float64()),
          field: v.optional(v.string()),
        })
      )
    ),
    certifications: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    sourceChannel: v.optional(v.string()),
    fileHash: v.optional(v.string()),
    workableCandidateId: v.optional(v.string()),
    summary: v.optional(v.string()),
    cvUploadId: v.optional(v.id("cvUploads")),
    rawText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 4-Factor Deduplication (Agent 6)
    let existingCandidateId: Id<"candidates"> | null = null;

    // Factor 1: fileHash
    if (args.fileHash && !existingCandidateId) {
      const existing = await ctx.db
        .query("candidates")
        .withIndex("by_fileHash", (q) => q.eq("fileHash", args.fileHash!))
        .first();
      if (existing) existingCandidateId = existing._id;
    }

    // Factor 2: email
    if (args.email && !existingCandidateId) {
      const existing = await ctx.db
        .query("candidates")
        .filter((q) => q.eq(q.field("email"), args.email!))
        .first();
      if (existing) existingCandidateId = existing._id;
    }

    // Factor 3: phone
    if (args.phone && !existingCandidateId) {
      const existing = await ctx.db
        .query("candidates")
        .filter((q) => q.eq(q.field("phone"), args.phone!))
        .first();
      if (existing) existingCandidateId = existing._id;
    }

    // Factor 4: linkedinUrl
    if (args.linkedinUrl && !existingCandidateId) {
      const existing = await ctx.db
        .query("candidates")
        .filter((q) => q.eq(q.field("linkedinUrl"), args.linkedinUrl!))
        .first();
      if (existing) existingCandidateId = existing._id;
    }

    if (existingCandidateId) {
      await ctx.db.patch(existingCandidateId, {
        ...args,
        status: "new",
      });
      return existingCandidateId;
    }

    return await ctx.db.insert("candidates", {
      ...args,
      status: "new",
    });
  },
});

export const clearAll = mutation({
  handler: async (ctx) => {
    const all = await ctx.db.query("candidates").collect();
    for (const doc of all) {
      await ctx.db.delete(doc._id);
    }
    return all.length;
  },
});

export const clearDocuments = mutation({
  handler: async (ctx) => {
    const all = await ctx.db.query("documents").collect();
    for (const doc of all) {
      await ctx.db.delete(doc._id);
    }
    return all.length;
  },
});

export const updateCvUpload = mutation({
  args: {
    cvUploadId: v.id("cvUploads"),
    status: v.string(),
    fileHash: v.optional(v.string()),
    candidateId: v.optional(v.id("candidates")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.fileHash !== undefined) updates.fileHash = args.fileHash;
    if (args.candidateId !== undefined) updates.candidateId = args.candidateId;
    if (args.errorMessage !== undefined) updates.errorMessage = args.errorMessage;
    await ctx.db.patch(args.cvUploadId, updates);
    const upload = await ctx.db.get(args.cvUploadId);
    return upload?.assignToJob;
  },
});

// Paginated query used by resumeBatch to retry paused/failed uploads
export const listFailedUploads = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const q = ctx.db
      .query("cvUploads")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "failed"),
          q.eq(q.field("status"), "paused"),
        ),
      );
    const result = await q.paginate({ cursor: args.cursor ?? null, numItems: limit });
    return {
      page: result.page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const getCvUploadUrl = query({
  args: { cvUploadId: v.id("cvUploads") },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.cvUploadId);
    if (!upload || !upload.storageId) return null;
    const url = await ctx.storage.getUrl(upload.storageId);
    if (!url) return null;
    return {
      url,
      fileName: upload.fileName,
      fileType: upload.fileType,
      fileSize: upload.fileSize,
    };
  },
});

export const clearEverything = mutation({
  handler: async (ctx) => {
    // 1. Collect all storage IDs and delete files
    const uploads = await ctx.db.query("cvUploads").collect();
    const storageIds = uploads
      .map((u) => u.storageId)
      .filter((id): id is Id<"_storage"> => !!id);
    for (const sid of storageIds) {
      try { await ctx.storage.delete(sid); } catch { }
    }
    // 2. Delete all documents
    const docs = await ctx.db.query("documents").collect();
    for (const d of docs) await ctx.db.delete(d._id);
    // 3. Delete all candidates
    const cands = await ctx.db.query("candidates").collect();
    for (const c of cands) await ctx.db.delete(c._id);
    // 4. Delete all cvUploads
    for (const u of uploads) await ctx.db.delete(u._id);
    return { storageDeleted: storageIds.length, documentsDeleted: docs.length, candidatesDeleted: cands.length, uploadsDeleted: uploads.length };
  },
});

export const seedDummyAdmin = mutation({
  handler: async (ctx) => {
    return await ctx.db.insert("users", {
      tokenIdentifier: "dummy_clerk_id",
      email: "admin@career141.com",
      fullName: "Admin Recruiter",
      role: "admin",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  },
});

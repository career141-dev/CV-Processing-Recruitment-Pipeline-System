import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { checkAndAdvanceFollowUp, updateFollowUpFlags } from "../pipeline/followUpHelper";




export const listCandidatesByIds = query({
  args: { ids: v.array(v.id("candidates")) },
  handler: async (ctx, args) => {
    const results = await Promise.all(args.ids.map(id => ctx.db.get(id)));
    const candidates = [];
    for (const c of results) {
      if (!c) continue;
      const { rawText, embedding, jobHistory, ...safeCandidate } = c as any;
      candidates.push({
        ...safeCandidate,
        profileImageUrl: c.profileImageId ? await ctx.storage.getUrl(c.profileImageId) : null,
        activeApplications: [],
      });
    }
    return candidates;
  },
});

export const listCandidatesPaginated = query({
  args: { 
    paginationOpts: v.any(),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q;
    
    if (args.searchQuery) {
      const sq = args.searchQuery.trim();
      if (sq.includes("@")) {
        q = ctx.db.query("candidates").withIndex("by_email", q => q.eq("email", sq));
      } else if (sq.replace(/[^0-9]/g, "").length >= 7) {
        q = ctx.db.query("candidates").withIndex("by_phoneClean", q => q.eq("phoneClean", sq.replace(/[^0-9]/g, "")));
      } else {
        q = ctx.db.query("candidates").withSearchIndex("search_name", q => q.search("fullName", sq));
      }
    } else {
      q = ctx.db.query("candidates").order("desc");
    }

    const page = await q.paginate(args.paginationOpts);
      
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (c) => {
          const { rawText, embedding, jobHistory, ...safeCandidate } = c as any;

          // Prefer the pre-computed summary field (O(1)) over the live N+2 query
          let activeApplications: any[] = [];
          if (Array.isArray((c as any).activeApplicationsSummary)) {
            activeApplications = (c as any).activeApplicationsSummary;
          } else {
            // Fallback: live query for candidates created before the summary field was added
            const apps = await ctx.db
              .query("applications")
              .withIndex("by_candidateId", (q: any) => q.eq("candidateId", c._id))
              .collect();
            activeApplications = await Promise.all(
              apps.map(async (app) => {
                const job = await ctx.db.get(app.jobId);
                return {
                  jobId: app.jobId,
                  jobTitle: job ? job.title : "Unknown Job",
                  stage: app.currentStage,
                  isActive: app.isActive,
                };
              })
            );
          }

          return {
            ...safeCandidate,
            profileImageUrl: c.profileImageId ? await ctx.storage.getUrl(c.profileImageId) : null,
            activeApplications,
          };
        })
      ),
    };
  },
});

export const getCandidate = query({
  args: { id: v.id("candidates") },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.id);
    if (!candidate) return null;
    const { rawText, embedding, jobHistory, ...safeCandidate } = candidate as any;
    return {
      ...safeCandidate,
      profileImageUrl: candidate.profileImageId ? await ctx.storage.getUrl(candidate.profileImageId) : null,
    };
  },
});

export const updateCandidateDetails = mutation({
  args: {
    candidateId: v.id("candidates"),
    currentSalary: v.optional(v.number()),
    expectedSalary: v.optional(v.number()),
    noticePeriodDays: v.optional(v.number()),
    noticePeriod: v.optional(v.string()),
    candidateQuestions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { candidateId, ...updates } = args;
    
    // Filter out undefined values to prevent overwriting existing data with empty AI intake payloads
    const definedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(definedUpdates).length > 0) {
      await ctx.db.patch(candidateId, definedUpdates);
    }

    // Sync follow-up flags on all candidate applications
    const candidate = await ctx.db.get(candidateId);
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId))
      .collect();
    for (const app of apps) {
      await updateFollowUpFlags(ctx, app._id, candidate);
    }
    
    await checkAndAdvanceFollowUp(ctx, candidateId);
  },
});

export const setDoNotContact = mutation({
  args: {
    candidateId: v.id("candidates"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.candidateId, {
      doNotContact: true,
      doNotContactReason: args.reason,
      doNotContactAt: Date.now(),
    });
  },
});

export const getCandidateForParsing = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.candidateId);
  },
});

export const updateCandidateAfterLazyParse = mutation({
  args: {
    candidateId: v.id("candidates"),
    skills: v.optional(v.array(v.string())),
    jobHistory: v.optional(
      v.array(
        v.object({
          company: v.string(),
          title: v.string(),
          startDate: v.optional(v.string()),
          endDate: v.optional(v.string()),
          description: v.optional(v.string()),
        })
      )
    ),
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
    industries: v.optional(v.array(v.string())),
    certifications: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    summary: v.optional(v.string()),
    parsingConfidence: v.optional(v.any()),
    isParsed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { candidateId, jobHistory, ...updates } = args;

    let pastJobTitles: string[] | undefined = undefined;
    if (jobHistory && jobHistory.length > 0) {
      pastJobTitles = jobHistory.map((j: any) => j.title).filter((t: any) => !!t);
      (updates as any).pastJobTitles = pastJobTitles;
    }

    await ctx.db.patch(candidateId, updates);

    if (jobHistory) {
      const existingResume = await ctx.db.query("candidateResumes").withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId as any)).first();
      if (existingResume) {
        await ctx.db.patch(existingResume._id, { jobHistory });
      } else {
        await ctx.db.insert("candidateResumes", { candidateId, rawText: "", jobHistory });
      }
    }
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
    expectedSalary: v.optional(v.number()),
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
    sector: v.optional(v.string()),
    jobHistory: v.optional(
      v.array(
        v.object({
          company: v.string(),
          title: v.string(),
          startDate: v.optional(v.string()),
          endDate: v.optional(v.string()),
          description: v.optional(v.string()),
        })
      )
    ),
    // Derived fields
    noticePeriodDays: v.optional(v.number()),
    educationDegree: v.optional(v.string()),
    educationInstitution: v.optional(v.string()),
    educationYear: v.optional(v.number()),
    totalExperienceYears: v.optional(v.number()),
    isParsed: v.optional(v.boolean()),
    parsingConfidence: v.optional(v.any()),
    embedding: v.optional(v.array(v.float64())),
    profileImageId: v.optional(v.id("_storage")),
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
        .withIndex("by_email", (q) => q.eq("email", args.email!))
        .first();
      if (existing) existingCandidateId = existing._id;
    }

    // Factor 3: phone
    if (args.phone && !existingCandidateId) {
      const existing = await ctx.db
        .query("candidates")
        .withIndex("by_phone", (q) => q.eq("phone", args.phone!))
        .first();
      if (existing) existingCandidateId = existing._id;
    }

    // Factor 4: linkedinUrl
    if (args.linkedinUrl && !existingCandidateId) {
      const existing = await ctx.db
        .query("candidates")
        .withIndex("by_linkedinUrl", (q) => q.eq("linkedinUrl", args.linkedinUrl!))
        .first();
      if (existing) existingCandidateId = existing._id;
    }

    if (existingCandidateId) {
      // Retrieve candidate applications
      const apps = await ctx.db
        .query("applications")
        .withIndex("by_candidateId", (q: any) => q.eq("candidateId", existingCandidateId))
        .collect();

      // Check if candidate is actively in follow-up stage or auto-rejected for missing details
      const inFollowUpOrAutoRejected = apps.some((app: any) => 
        app.currentStage === "follow_up" || 
        (app.currentStage === "rejected" && app.taRejectionReason === "Did not complete requirements within 7-day window")
      );

      // Skip updating candidate details and CV if they are in a different stage than follow-up
      if (!inFollowUpOrAutoRejected && apps.length > 0) {
        console.log(`[createCandidate] Candidate ${existingCandidateId} exists but is not in follow_up or auto-rejected state. Skipping details and CV update.`);
        return existingCandidateId;
      }

      const { rawText, jobHistory, embedding, ...candidateArgs } = args;
      
      let pastJobTitles: string[] | undefined = undefined;
      if (jobHistory && jobHistory.length > 0) {
        pastJobTitles = jobHistory.map((j: any) => j.title).filter((t: any) => !!t);
      }

      let phoneClean: string | undefined = undefined;
      if (args.phone) {
        phoneClean = args.phone.replace(/[^0-9]/g, "");
      }

      await ctx.db.patch(existingCandidateId, {
        ...candidateArgs,
        pastJobTitles,
        phoneClean,
        status: "new",
      });

      if (rawText || jobHistory || embedding) {
        const existingResume = await ctx.db.query("candidateResumes").withIndex("by_candidateId", (q: any) => q.eq("candidateId", existingCandidateId as any)).first();
        if (existingResume) {
          await ctx.db.patch(existingResume._id, { 
            rawText: rawText ?? existingResume.rawText, 
            jobHistory,
            embedding: embedding ?? existingResume.embedding
          });
        } else {
          await ctx.db.insert("candidateResumes", { 
            candidateId: existingCandidateId, 
            rawText: rawText ?? "", 
            jobHistory,
            embedding 
          });
        }
      }

      // Sync follow-up flags on all candidate applications
      const candidate = await ctx.db.get(existingCandidateId);
      for (const app of apps) {
        await updateFollowUpFlags(ctx, app._id, candidate);
      }

      await checkAndAdvanceFollowUp(ctx, existingCandidateId);
      return existingCandidateId;
    }

    const { rawText, jobHistory, embedding, ...candidateArgs } = args;

    let pastJobTitles: string[] | undefined = undefined;
    if (jobHistory && jobHistory.length > 0) {
      pastJobTitles = jobHistory.map((j: any) => j.title).filter((t: any) => !!t);
    }
    
    let phoneClean: string | undefined = undefined;
    if (args.phone) {
      phoneClean = args.phone.replace(/[^0-9]/g, "");
    }

    const newId = await ctx.db.insert("candidates", {
      ...candidateArgs,
      pastJobTitles,
      phoneClean,
      status: "new",
    });

    if (rawText || jobHistory || embedding) {
      await ctx.db.insert("candidateResumes", {
        candidateId: newId,
        rawText: rawText ?? "",
        jobHistory,
        embedding,
      });
    }

    // Sync follow-up flags on all candidate applications
    const candidate = await ctx.db.get(newId);
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", newId))
      .collect();
    for (const app of apps) {
      await updateFollowUpFlags(ctx, app._id, candidate);
    }

    await checkAndAdvanceFollowUp(ctx, newId);
    return newId;
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

export const clearOrphanedUploads = mutation({
  handler: async (ctx) => {
    let deletedCount = 0;
    const allUploads = await ctx.db.query("cvUploads").collect();
    
    for (const upload of allUploads) {
      if (upload.candidateId) {
        const candidate = await ctx.db.get(upload.candidateId);
        if (!candidate) {
          await ctx.db.delete(upload._id);
          deletedCount++;
        }
      } else {
        // If it doesn't even have a candidateId and it's stuck pending for a long time, we could delete it too, 
        // but let's just focus on ones that had a candidate deleted.
        if (upload.status === "processing" || upload.status === "failed") {
          await ctx.db.delete(upload._id);
          deletedCount++;
        }
      }
    }
    return deletedCount;
  }
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

export async function syncCandidateOverallStatus(ctx: any, candidateId: Id<"candidates">) {
  const applications = await ctx.db
    .query("applications")
    .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId))
    .collect();

  if (applications.length === 0) {
    await ctx.db.patch(candidateId, { overallStatus: "active", activeApplicationsSummary: [] });
    return;
  }

  const STAGE_PRIORITY: Record<string, number> = {
    placed: 11,
    offer: 10,
    interview: 9,
    client_review: 8,
    director_shortlist: 7,
    second_shortlist: 6,
    follow_up: 5,
    unresponsive: 4.5,
    ai_call: 4,
    ta_shortlist: 3,
    matched_candidates: 3,
    new_cvs: 1,
    rejected: 0,
  };

  let highestStage = "rejected";
  let highestPriority = -1;

  // Build activeApplicationsSummary in the same pass — no extra reads needed
  const appSummaries = [];
  // Batch-fetch unique job titles (avoid duplicate reads)
  const jobCache = new Map<string, string>();
  for (const app of applications) {
    const priority = STAGE_PRIORITY[app.currentStage] ?? -1;
    if (priority > highestPriority) {
      highestPriority = priority;
      highestStage = app.currentStage;
    }
    let jobTitle = jobCache.get(app.jobId);
    if (jobTitle === undefined) {
      const job = await ctx.db.get(app.jobId);
      jobTitle = (job?.title ?? "Unknown Job") as string;
      jobCache.set(app.jobId, jobTitle);
    }
    appSummaries.push({
      jobId: app.jobId,
      jobTitle,
      stage: app.currentStage,
      isActive: app.isActive,
    });
  }

  const finalStatus = (highestStage === "ta_shortlist" || highestStage === "matched_candidates")
    ? "shortlisted"
    : highestStage;

  await ctx.db.patch(candidateId, {
    overallStatus: finalStatus as any,
    activeApplicationsSummary: appSummaries,
  });
}

export const getCandidateByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("candidates")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

export const deleteCandidate = mutation({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    // Cascade delete related records
    const candidateId = args.candidateId;

    const apps = await ctx.db.query("applications")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId))
      .collect();
    for (const app of apps) await ctx.db.delete(app._id);

    const scores = await ctx.db.query("match_scores")
      .filter((q: any) => q.eq(q.field("candidateId"), candidateId))
      .collect();
    for (const score of scores) await ctx.db.delete(score._id);

    const events = await ctx.db.query("pipelineEvents")
      .filter((q: any) => q.eq(q.field("candidateId"), candidateId))
      .collect();
    for (const e of events) await ctx.db.delete(e._id);

    const calls = await ctx.db.query("aiCalls")
      .filter((q: any) => q.eq(q.field("candidateId"), candidateId))
      .collect();
    for (const call of calls) await ctx.db.delete(call._id);

    const comms = await ctx.db.query("communications")
      .filter((q: any) => q.eq(q.field("candidateId"), candidateId))
      .collect();
    for (const comm of comms) await ctx.db.delete(comm._id);

    const cvs = await ctx.db.query("cvs")
      .filter((q: any) => q.eq(q.field("candidateId"), candidateId))
      .collect();
    for (const cv of cvs) {
      // Also delete the original cvUploads record to allow re-ingestion
      const uploads = await ctx.db.query("cvUploads")
        .filter((q: any) => q.eq(q.field("storageId"), cv.storageId))
        .collect();
      for (const upload of uploads) {
        await ctx.db.delete(upload._id);
      }
      await ctx.db.delete(cv._id);
    }

    // Finally, delete the candidate
    await ctx.db.delete(candidateId);
  }
});

export const bulkDeleteCandidates = mutation({
  args: { candidateIds: v.array(v.id("candidates")) },
  handler: async (ctx, args) => {
    for (const candidateId of args.candidateIds) {
      const apps = await ctx.db.query("applications")
        .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId))
        .collect();
      for (const app of apps) await ctx.db.delete(app._id);

      const scores = await ctx.db.query("match_scores")
        .filter((q: any) => q.eq(q.field("candidateId"), candidateId))
        .collect();
      for (const score of scores) await ctx.db.delete(score._id);

      const events = await ctx.db.query("pipelineEvents")
        .filter((q: any) => q.eq(q.field("candidateId"), candidateId))
        .collect();
      for (const e of events) await ctx.db.delete(e._id);

      const calls = await ctx.db.query("aiCalls")
        .filter((q: any) => q.eq(q.field("candidateId"), candidateId))
        .collect();
      for (const call of calls) await ctx.db.delete(call._id);

      const comms = await ctx.db.query("communications")
        .filter((q: any) => q.eq(q.field("candidateId"), candidateId))
        .collect();
      for (const comm of comms) await ctx.db.delete(comm._id);

      const cvs = await ctx.db.query("cvs")
        .filter((q: any) => q.eq(q.field("candidateId"), candidateId))
        .collect();
      for (const cv of cvs) {
        const uploads = await ctx.db.query("cvUploads")
          .filter((q: any) => q.eq(q.field("storageId"), cv.storageId))
          .collect();
        for (const upload of uploads) {
          await ctx.db.delete(upload._id);
        }
        await ctx.db.delete(cv._id);
      }

      await ctx.db.delete(candidateId);
    }
  }
});

export const isCandidateInFollowUp = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const activeApp = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", args.candidateId))
      .filter((q: any) =>
        q.or(
          q.eq(q.field("currentStage"), "follow_up"),
          q.and(
            q.eq(q.field("currentStage"), "rejected"),
            q.eq(q.field("taRejectionReason"), "Did not complete requirements within 7-day window")
          )
        )
      )
      .first();
    return !!activeApp;
  },
});

import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import { checkAndAdvanceFollowUp, updateFollowUpFlags } from "../pipeline/followUpHelper";
import { requireFullAccess } from "../lib/permissions";




export const listCandidates = query({
  args: {
    paginationOpts: v.optional(v.any()),
    searchQuery: v.optional(v.string()),
    overallStatus: v.optional(v.string()),
    sourceChannel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apps = await ctx.db.query("candidates").order("desc").take(50);
    return { page: apps, isDone: true, continueCursor: "" };
  },
});

export const getCandidatesForJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();
    const candidateIds = apps.map((a) => a.candidateId);
    const candidates = await Promise.all(candidateIds.map((id) => ctx.db.get(id)));
    return candidates.filter(Boolean);
  },
});

export const listCandidatesByIds = query({
  args: { ids: v.array(v.id("candidates")) },
  handler: async (ctx, args) => {
    await requireFullAccess(ctx);
    const results = await Promise.all(args.ids.map(id => ctx.db.get(id)));
    const candidates = [];
    for (const c of results) {
      if (!c) continue;
      const { rawText, embedding, jobHistory, ...safeCandidate } = c as any;
      
      let name = safeCandidate.fullName;
      if (!name || name.trim() === "" || name.toLowerCase().includes("unknown")) {
        if (safeCandidate.email) {
          const handle = safeCandidate.email.split("@")[0].replace(/[._-]/g, " ");
          name = handle.replace(/\b\w/g, (char: string) => char.toUpperCase());
        } else if (safeCandidate.phone) {
          name = `Candidate (${safeCandidate.phone})`;
        } else {
          name = "Candidate Profile";
        }
      }

      const title = safeCandidate.currentTitle || safeCandidate.currentJobTitle || (jobHistory && jobHistory[0] ? jobHistory[0].title : undefined);

      candidates.push({
        ...safeCandidate,
        fullName: name,
        currentTitle: title,
        currentJobTitle: safeCandidate.currentJobTitle || title,
        profileImageUrl: null,
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
    overallStatus: v.optional(v.string()),
    sourceChannel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFullAccess(ctx);
    let q;
    
    const overallStatus = args.overallStatus && args.overallStatus !== "all" ? args.overallStatus : undefined;
    const sourceChannel = args.sourceChannel && args.sourceChannel !== "all" ? args.sourceChannel : undefined;

    if (args.searchQuery) {
      const sq = args.searchQuery.trim();
      if (sq.includes("@")) {
        q = ctx.db.query("candidates").withIndex("by_email", q => q.eq("email", sq));
      } else if (sq.replace(/[^0-9]/g, "").length >= 7) {
        q = ctx.db.query("candidates").withIndex("by_phoneClean", q => q.eq("phoneClean", sq.replace(/[^0-9]/g, "")));
      } else {
        q = ctx.db.query("candidates").withSearchIndex("search_name", q => q.search("fullName", sq));
      }
    } else if (overallStatus) {
      q = ctx.db.query("candidates").withIndex("by_overallStatus", q => q.eq("overallStatus", overallStatus as any));
    } else if (sourceChannel) {
      q = ctx.db.query("candidates").withIndex("by_sourceChannel", q => q.eq("sourceChannel", sourceChannel));
    } else {
      q = ctx.db.query("candidates").withIndex("by_lastUpdatedAt").order("desc");
    }

    if (sourceChannel && (args.searchQuery || overallStatus)) {
      q = q.filter(q => 
        q.or(
          q.eq(q.field("firstSourceChannel"), sourceChannel as any),
          q.eq(q.field("sourceChannel"), sourceChannel)
        )
      );
    }

    if (args.searchQuery && overallStatus) {
      q = q.filter(q => q.eq(q.field("overallStatus"), overallStatus as any));
    }

    let page;
    try {
      page = await q.paginate(args.paginationOpts);
    } catch (err: any) {
      const errStr = String(err?.message || err);
      if (errStr.includes("InvalidCursor") || errStr.includes("cursor")) {
        console.warn("[listCandidatesPaginated] Invalid cursor detected, resetting pagination to page 1");
        page = await q.paginate({ ...args.paginationOpts, cursor: null });
      } else {
        throw err;
      }
    }
      
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (c) => {
          const { rawText, embedding, jobHistory, activeApplicationsSummary, ...safeCandidate } = c as any;

          // Prefer the pre-computed summary field (O(1)) over the live N+2 query
          let activeApplications: any[] = [];
          if (Array.isArray(activeApplicationsSummary)) {
            activeApplications = activeApplicationsSummary;
          }
          // Fallback omitted: backfill confirmed all candidates have activeApplicationsSummary.
          // Using [] is safe — summary self-heals on next candidate write.

          return {
            ...safeCandidate,
            profileImageUrl: null,
            activeApplications: activeApplications,
          };
        })
      ),
    };
  },
});

export const getCandidate = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    let validId = ctx.db.normalizeId("candidates", args.id);
    let candidate = validId ? await ctx.db.get(validId) : null;

    if (!candidate) {
      // Fallback 1: check if ID passed was actually a cvUploadId
      const uploadId = ctx.db.normalizeId("cvUploads", args.id);
      if (uploadId) {
        const upload = await ctx.db.get(uploadId);
        if (upload && upload.candidateId) {
          validId = upload.candidateId;
          candidate = await ctx.db.get(upload.candidateId);
        }
      }
    }

    if (!candidate) {
      // Fallback 2: check if ID passed was actually an applicationId
      const appId = ctx.db.normalizeId("applications", args.id);
      if (appId) {
        const app = await ctx.db.get(appId);
        if (app && app.candidateId) {
          validId = app.candidateId;
          candidate = await ctx.db.get(app.candidateId);
        }
      }
    }

    if (!candidate || !validId) return null;
    
    const resume = await ctx.db.query("candidateResumes")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", validId!))
      .first();

    const { rawText, embedding, jobHistory, ...safeCandidate } = candidate as any;
    return {
      ...safeCandidate,
      jobHistory: resume?.jobHistory || jobHistory || [],
      profileImageUrl: null,
    };
  },
});

export const updateCandidateDetails = mutation({
  args: {
    candidateId: v.id("candidates"),
    applicationId: v.optional(v.id("applications")),
    currentSalary: v.optional(v.number()),
    expectedSalary: v.optional(v.number()),
    noticePeriodDays: v.optional(v.number()),
    noticePeriod: v.optional(v.string()),
    candidateQuestions: v.optional(v.string()),
    customFollowUpAnswers: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const { candidateId, applicationId, customFollowUpAnswers, ...updates } = args;
    
    // Filter out undefined values to prevent overwriting existing data with empty AI intake payloads
    const definedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(definedUpdates).length > 0) {
      await ctx.db.patch(candidateId, definedUpdates);
    }

    if (applicationId && customFollowUpAnswers) {
      await ctx.db.patch(applicationId, { customFollowUpAnswers });
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
        const hasEmb = !!(existingResume.embedding && existingResume.embedding.length > 0);
        await ctx.db.patch(existingResume._id, { jobHistory, hasEmbedding: hasEmb });
      } else {
        await ctx.db.insert("candidateResumes", { candidateId, rawText: "", jobHistory, hasEmbedding: false });
      }
    }

    // Sync candidate details across applications and compute/update overall status
    await syncCandidateSummaryToApplications(ctx, candidateId);
    await syncCandidateOverallStatus(ctx, candidateId);

    // Schedule AI match scoring for all active applications of the candidate
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId))
      .collect();

    for (const app of apps) {
      if (app.isActive) {
        await ctx.scheduler.runAfter(0, api.cvs.cvScoringActions.processCvScoring, {
          candidateId,
          jobId: app.jobId,
        });
      }
    }
  },
});

export const updateCandidateFields = mutation({
  args: {
    candidateId: v.id("candidates"),
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
    noticePeriodDays: v.optional(v.number()),
    educationDegree: v.optional(v.string()),
    educationInstitution: v.optional(v.string()),
    educationYear: v.optional(v.number()),
    totalExperienceYears: v.optional(v.number()),
    isParsed: v.optional(v.boolean()),
    parsingConfidence: v.optional(v.any()),
    embedding: v.optional(v.array(v.float64())),
    extractionModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { candidateId, rawText, jobHistory, embedding, ...candidateArgs } = args;

    let pastJobTitles: string[] | undefined = undefined;
    if (jobHistory && jobHistory.length > 0) {
      pastJobTitles = jobHistory.map((j: any) => j.title).filter((t: any) => !!t);
    }
    
    let phoneClean: string | undefined = undefined;
    if (args.phone) {
      phoneClean = args.phone.replace(/[^0-9]/g, "");
    }

    // ── 4-FACTOR IDENTITY DEDUPLICATION ─────────────────────────────────────
    // Now that we have the parsed identity fields (email, phone, linkedinUrl,
    // fileHash), check whether another candidate already owns this identity.
    // If so, the current candidateId is a ghost duplicate — merge into survivor.
    let targetId = candidateId;

    const lookupByEmail = args.email
      ? await ctx.db
          .query("candidates")
          .withIndex("by_email", (q) => q.eq("email", args.email as string))
          .first()
      : null;

    const lookupByPhone = phoneClean
      ? await ctx.db
          .query("candidates")
          .withIndex("by_phoneClean", (q) => q.eq("phoneClean", phoneClean as string))
          .first()
      : null;

    const lookupByLinkedin = args.linkedinUrl
      ? await ctx.db
          .query("candidates")
          .withIndex("by_linkedinUrl", (q) => q.eq("linkedinUrl", args.linkedinUrl as string))
          .first()
      : null;

    const lookupByFileHash = args.fileHash
      ? await ctx.db
          .query("candidates")
          .withIndex("by_fileHash", (q) => q.eq("fileHash", args.fileHash as string))
          .first()
      : null;

    const survivor = [lookupByEmail, lookupByPhone, lookupByLinkedin, lookupByFileHash]
      .find((c) => c && c._id !== candidateId);

    if (survivor) {
      console.log(
        `[Dedup] Ghost candidate ${candidateId} matched survivor ${survivor._id}` +
        ` (email=${!!lookupByEmail}, phone=${!!lookupByPhone}, linkedin=${!!lookupByLinkedin}, hash=${!!lookupByFileHash}).` +
        ` Merging into survivor.`
      );
      // Relink the upload record to the survivor so stats stay accurate
      if (args.cvUploadId) {
        await ctx.db.patch(args.cvUploadId, { candidateId: survivor._id });
      }
      // Delete the ghost profile (it was just created; it has no applications yet)
      await ctx.db.delete(candidateId);
      targetId = survivor._id;
    }
    // ── END DEDUP ─────────────────────────────────────────────────────────────

    const patches: Record<string, any> = {
      ...candidateArgs,
      status: "new",
    };
    if (pastJobTitles !== undefined) patches.pastJobTitles = pastJobTitles;
    if (phoneClean !== undefined) patches.phoneClean = phoneClean;
    if (candidateArgs.currentTitle !== undefined) patches.currentJobTitle = candidateArgs.currentTitle;

    // Filter out undefined values to only update provided fields
    const definedPatches = Object.fromEntries(
      Object.entries(patches).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(targetId, definedPatches);

    // Sync to candidateResumes table
    if (rawText || jobHistory || embedding) {
      const existingResume = await ctx.db
        .query("candidateResumes")
        .withIndex("by_candidateId", (q) => q.eq("candidateId", targetId))
        .first();

      if (existingResume) {
        const updatedEmbedding = embedding ?? existingResume.embedding;
        const resumeUpdates: Record<string, any> = {};
        if (rawText !== undefined) resumeUpdates.rawText = rawText;
        if (jobHistory !== undefined) resumeUpdates.jobHistory = jobHistory;
        if (updatedEmbedding !== undefined) {
          resumeUpdates.embedding = updatedEmbedding;
          resumeUpdates.hasEmbedding = !!(updatedEmbedding && updatedEmbedding.length > 0);
        }
        await ctx.db.patch(existingResume._id, resumeUpdates);
      } else {
        await ctx.db.insert("candidateResumes", {
          candidateId: targetId,
          rawText: rawText ?? "",
          jobHistory,
          embedding,
          hasEmbedding: !!(embedding && embedding.length > 0),
        });
      }
    }

    // Sync follow-up flags on all candidate applications
    const candidate = await ctx.db.get(targetId);
    if (candidate) {
      const apps = await ctx.db
        .query("applications")
        .withIndex("by_candidateId", (q: any) => q.eq("candidateId", targetId))
        .collect();
      for (const app of apps) {
        await updateFollowUpFlags(ctx, app._id, candidate);
      }

      await checkAndAdvanceFollowUp(ctx, targetId);
      await syncCandidateSummaryToApplications(ctx, targetId);
      await syncCandidateOverallStatus(ctx, targetId);
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
    extractionModel: v.optional(v.string()),
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

      // Filter out undefined values to prevent data loss on merge
      const definedUpdates = Object.fromEntries(
        Object.entries({
          ...candidateArgs,
          pastJobTitles,
          phoneClean,
          status: "new",
        }).filter(([_, v]) => v !== undefined)
      );

      await ctx.db.patch(existingCandidateId, definedUpdates);

      if (rawText || jobHistory || embedding) {
        const existingResume = await ctx.db.query("candidateResumes").withIndex("by_candidateId", (q: any) => q.eq("candidateId", existingCandidateId as any)).first();
        if (existingResume) {
          const updatedEmbedding = embedding ?? existingResume.embedding;
          await ctx.db.patch(existingResume._id, { 
            rawText: rawText ?? existingResume.rawText, 
            jobHistory: jobHistory ?? existingResume.jobHistory,
            embedding: updatedEmbedding,
            hasEmbedding: !!(updatedEmbedding && updatedEmbedding.length > 0)
          });
        } else {
          await ctx.db.insert("candidateResumes", { 
            candidateId: existingCandidateId, 
            rawText: rawText ?? "", 
            jobHistory,
            embedding,
            hasEmbedding: !!(embedding && embedding.length > 0)
          });
        }
      }

      // Sync follow-up flags on all candidate applications
      const candidate = await ctx.db.get(existingCandidateId);
      for (const app of apps) {
        await updateFollowUpFlags(ctx, app._id, candidate);
      }

      await checkAndAdvanceFollowUp(ctx, existingCandidateId);
      await syncCandidateSummaryToApplications(ctx, existingCandidateId);
      await syncCandidateOverallStatus(ctx, existingCandidateId);
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
        hasEmbedding: !!(embedding && embedding.length > 0)
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
    await syncCandidateSummaryToApplications(ctx, newId);
    await syncCandidateOverallStatus(ctx, newId);
    return newId;
  },
});

export const clearAll = mutation({
  handler: async (ctx) => {
    await requireFullAccess(ctx);
    const all = await ctx.db.query("candidates").collect();
    for (const doc of all) {
      await ctx.db.delete(doc._id);
    }
    return all.length;
  },
});

export const clearDocuments = mutation({
  handler: async (ctx) => {
    await requireFullAccess(ctx);
    const all = await ctx.db.query("documents").collect();
    for (const doc of all) {
      await ctx.db.delete(doc._id);
    }
    return all.length;
  },
});

export const clearOrphanedUploads = mutation({
  handler: async (ctx) => {
    await requireFullAccess(ctx);
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
    processingStartedAt: v.optional(v.number()),
    isHealAttempted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.fileHash !== undefined) updates.fileHash = args.fileHash;
    if (args.candidateId !== undefined) updates.candidateId = args.candidateId;
    if (args.errorMessage !== undefined) updates.errorMessage = args.errorMessage;
    if (args.processingStartedAt !== undefined) updates.processingStartedAt = args.processingStartedAt;
    if (args.isHealAttempted !== undefined) updates.isHealAttempted = args.isHealAttempted;
    await ctx.db.patch(args.cvUploadId, updates);
    const upload = await ctx.db.get(args.cvUploadId);
    return upload?.assignToJob;
  },
});

export const getCvUploadStatus = query({
  args: { cvUploadId: v.id("cvUploads") },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.cvUploadId);
    return upload ? upload.status : null;
  },
});

export const getCvUpload = query({
  args: { cvUploadId: v.id("cvUploads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.cvUploadId);
  },
});

export const findCandidateByHash = query({
  args: { fileHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("candidates")
      .withIndex("by_fileHash", (q) => q.eq("fileHash", args.fileHash))
      .first();
  },
});

// Paginated query used by resumeBatch to retry paused/failed uploads
export const listUploadsByStatus = query({
  args: {
    status: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    return await ctx.db
      .query("cvUploads")
      .withIndex("by_status", (q) => q.eq("status", args.status as any))
      .take(limit);
  },
});

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
          q.eq(q.field("status"), "failed_retry"),
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
  args: { cvUploadId: v.string() },
  handler: async (ctx, args) => {
    let validId = ctx.db.normalizeId("cvUploads", args.cvUploadId);
    let upload: any = validId ? await ctx.db.get(validId) : null;
    let candidate: any = null;

    if (!upload) {
      // 2. Try candidate ID lookup
      const candidateId = ctx.db.normalizeId("candidates", args.cvUploadId);
      if (candidateId) {
        candidate = await ctx.db.get(candidateId);
        if (candidate && candidate.cvUploadId) {
          upload = await ctx.db.get(candidate.cvUploadId as Id<"cvUploads">);
        }
      }
    }

    if (!upload) {
      // 3. Try application ID lookup
      const appId = ctx.db.normalizeId("applications", args.cvUploadId);
      if (appId) {
        const app = await ctx.db.get(appId);
        if (app) {
          if (app.cvFileId) {
            upload = await ctx.db.get(app.cvFileId as Id<"cvUploads">);
          }
          if (!upload && app.candidateId) {
            candidate = await ctx.db.get(app.candidateId);
            if (candidate && candidate.cvUploadId) {
              upload = await ctx.db.get(candidate.cvUploadId as Id<"cvUploads">);
            }
          }
        }
      }
    }

    // 4. File hash fallback
    if ((!upload || (!upload.storageId && !upload.s3Key)) && candidate?.fileHash) {
      const hashUpload = await ctx.db.query("cvUploads")
        .withIndex("by_fileHash", q => q.eq("fileHash", candidate.fileHash!))
        .first();
      if (hashUpload) upload = hashUpload;
    }

    if (!upload) return null;

    let url: string | null = null;
    
    if (upload.storageProvider === "r2" && upload.s3Key) {
       // Proxy through Next.js to bypass Nginx routing issues on the VPS
       url = `/api/r2-file?key=${encodeURIComponent(upload.s3Key)}`;
    } else if (upload.storageId) {
      url = await ctx.storage.getUrl(upload.storageId);
      if (url && (url.includes("127.0.0.1") || url.includes("localhost"))) {
        // Keep local dev URL intact so PDF preview works on local dev
      } else if (url) {
        const publicConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_SELF_HOSTED_URL || process.env.CONVEX_URL;
        if (publicConvexUrl && !publicConvexUrl.includes("api.career141.com")) {
          url = url.replace(/^http:\/\/(127\.0\.0\.1|localhost|convex|0\.0\.0\.0)(:\d+)?/, publicConvexUrl);
        } else {
          url = url.replace(/^http:\/\/(127\.0\.0\.1|localhost|convex|0\.0\.0\.0)(:\d+)?/, "https://api.career141.com");
        }
        if (!url.startsWith("http")) {
          const baseUrl = (publicConvexUrl && !publicConvexUrl.includes("api.career141.com")) ? publicConvexUrl : "https://api.career141.com";
          url = `${baseUrl}/api/storage/${upload.storageId}`;
        }
      }
    }

    if (!url) {
      return {
        url: null,
        isMissingMigrationFile: true,
        fileName: upload?.fileName || "Candidate CV",
        fileType: upload?.fileType,
        fileSize: upload?.fileSize,
        status: upload?.status,
        message: "Historical CV file pending Cloud to Self-Hosted migration.",
      };
    }
    return {
      url,
      isMissingMigrationFile: false,
      fileName: upload.fileName,
      fileType: upload.fileType,
      fileSize: upload.fileSize,
      status: upload.status,
    };
  },
});

export const listAllUploadsForStorageClean = query({
  args: {},
  handler: async (ctx) => {
    const uploads = await ctx.db.query("cvUploads").collect();
    return uploads
      .map((u) => u.storageId)
      .filter((id): id is Id<"_storage"> => !!id);
  },
});

export const fetchBatchForDeletion = query({
  args: {
    table: v.string(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query(args.table as any)
      .paginate({ cursor: args.cursor ?? null, numItems: 500 });
    return {
      ids: result.page.map((doc: any) => doc._id),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const deleteBatch = mutation({
  args: {
    table: v.string(),
    ids: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.delete(id);
    }
  },
});

export const resetSystemStatsMutation = mutation({
  args: {},
  handler: async (ctx) => {
    const statsRow = await ctx.db
      .query("systemStats")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "global_stats"))
      .first();
    if (statsRow) {
      await ctx.db.patch(statsRow._id, {
        totalCandidates: 0,
        totalCvUploads: 0,
        totalApplications: 0,
      });
    }
  },
});

export const clearEverything = action({
  args: {},
  handler: async (ctx) => {
    // 1. Get storage IDs and delete files from storage
    const uploads = await ctx.runQuery("candidates/candidates:listAllUploadsForStorageClean" as any);
    for (const sid of uploads) {
      try {
        await ctx.storage.delete(sid);
      } catch {}
    }

    // 2. Clear out candidate, upload, application, token logs, and metrics tables
    const tablesToWipe = [
      "candidates",
      "candidateResumes",
      "cvUploads",
      "applications",
      "communications",
      "aiCalls",
      "pipelineEvents",
      "ingestionBatches",
      "ingestionLog",
      "nvidiaTokenLogs",
      "dailyTokenStats",
      "tokenStatsCache",
      "whatsappSessions",
      "interviews",
      "offers",
      "placements",
      "directorReviews",
      "clientReviews",
      "match_scores",
      "notifications",
      "searchHistory",
      "dailyStats",
      "dashboardStatsCache",
      "pipeline_health_reports",
    ] as const;

    const deletedCounts: Record<string, number> = {};

    for (const table of tablesToWipe) {
      let count = 0;
      let hasMore = true;
      let cursor: string | undefined = undefined;

      while (hasMore) {
        const batch: any = await ctx.runQuery("candidates/candidates:fetchBatchForDeletion" as any, {
          table,
          cursor,
        });

        if (batch.ids.length > 0) {
          await ctx.runMutation("candidates/candidates:deleteBatch" as any, {
            table,
            ids: batch.ids,
          });
          count += batch.ids.length;
        }

        hasMore = !batch.isDone && batch.continueCursor;
        cursor = batch.continueCursor;
      }
      deletedCounts[table] = count;
    }

    // 3. Reset systemStats singleton totals (excluding activeJobsCount to preserve jobs)
    await ctx.runMutation("candidates/candidates:resetSystemStatsMutation" as any);

    return {
      success: true,
      storageDeleted: uploads.length,
      ...deletedCounts,
    };
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

export async function syncCandidateSummaryToApplications(ctx: any, candidateId: Id<"candidates">) {
  const candidate = await ctx.db.get(candidateId);
  if (!candidate) return;

  const apps = await ctx.db
    .query("applications")
    .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId))
    .collect();

  // Find latest CV upload to get file name and ID
  let cvFileName = undefined;
  let cvUploadId = candidate.cvUploadId;
  if (cvUploadId) {
    const upload = await ctx.db.get(cvUploadId);
    if (upload) {
      cvFileName = upload.fileName;
    }
  }

  for (const app of apps) {
    const patchData: Record<string, any> = {
      candidateName: candidate.fullName,
      candidateEmail: candidate.email,
      candidatePhone: candidate.phone,
      cvFileName,
      candidateTitle: candidate.currentTitle || candidate.currentJobTitle,
      candidateExperience: candidate.totalExperienceYears || candidate.yearsOfExperience,
      candidateCvUploadId: cvUploadId,
      candidateCurrentSalary: candidate.currentSalary,
      candidateExpectedSalary: candidate.expectedSalary,
      candidateNoticePeriodDays: candidate.noticePeriodDays,
    };

    // Also set cvFileId so "View CV" button works
    if (!app.cvFileId && cvUploadId) {
      patchData.cvFileId = cvUploadId;
    }

    await ctx.db.patch(app._id, patchData);

    // Ensure the cvUpload's assignToJob points to this application's job
    // so the CV is visible inside the correct job
    if (cvUploadId) {
      const cvUpload = await ctx.db.get(cvUploadId);
      if (cvUpload && cvUpload.assignToJob !== app.jobId) {
        // Only update if the cv has no job assigned yet (don't override another job's assignment)
        if (!cvUpload.assignToJob) {
          await ctx.db.patch(cvUploadId, { assignToJob: app.jobId });
        }
      }
    }
  }
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
  args: { 
    candidateId: v.id("candidates"),
    preserveUpload: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Cascade delete related records
    const candidateId = args.candidateId;

    const apps = await ctx.db.query("applications")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId))
      .collect();
    for (const app of apps) await ctx.db.delete(app._id);

    const scores = await ctx.db.query("match_scores")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId))
      .collect();
    for (const score of scores) await ctx.db.delete(score._id);

    const events = await ctx.db.query("pipelineEvents")
      .withIndex("by_candidate", (q: any) => q.eq("candidateId", candidateId))
      .collect();
    for (const e of events) await ctx.db.delete(e._id);

    const calls = await ctx.db.query("aiCalls")
      .withIndex("by_candidate", (q: any) => q.eq("candidateId", candidateId))
      .collect();
    for (const call of calls) await ctx.db.delete(call._id);

    const comms = await ctx.db.query("communications")
      .withIndex("by_candidate_time", (q: any) => q.eq("candidateId", candidateId))
      .collect();
    for (const comm of comms) await ctx.db.delete(comm._id);

    const cvs = await ctx.db.query("cvs")
      .withIndex("by_candidate", (q: any) => q.eq("candidateId", candidateId))
      .collect();
    for (const cv of cvs) {
      // Also delete the original cvUploads record to allow re-ingestion
      if (cv.storageId && !args.preserveUpload) {
        const uploads = await ctx.db.query("cvUploads")
          .withIndex("by_storageId", (q: any) => q.eq("storageId", cv.storageId))
          .collect();
        for (const upload of uploads) {
          await ctx.db.delete(upload._id);
        }
      }
      await ctx.db.delete(cv._id);
    }

    // Get candidate to check for direct cvUploadId (Agent 1 architecture)
    const candidate = await ctx.db.get(candidateId);
    if (candidate && candidate.cvUploadId && !args.preserveUpload) {
      const upload = await ctx.db.get(candidate.cvUploadId);
      if (upload) {
        if (upload.storageId) {
          try {
            await ctx.storage.delete(upload.storageId);
          } catch (e) {
            console.error("Failed to delete from storage", e);
          }
        }
        await ctx.db.delete(candidate.cvUploadId);
      }
    }

    // Finally, delete the candidate if it exists in DB
    const finalCandidateCheck = candidate || (await ctx.db.get(candidateId));
    if (finalCandidateCheck) {
      await ctx.db.delete(candidateId);
    }
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
        .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId))
        .collect();
      for (const score of scores) await ctx.db.delete(score._id);

      const events = await ctx.db.query("pipelineEvents")
        .withIndex("by_candidate", (q: any) => q.eq("candidateId", candidateId))
        .collect();
      for (const e of events) await ctx.db.delete(e._id);

      const calls = await ctx.db.query("aiCalls")
        .withIndex("by_candidate", (q: any) => q.eq("candidateId", candidateId))
        .collect();
      for (const call of calls) await ctx.db.delete(call._id);

      const comms = await ctx.db.query("communications")
        .withIndex("by_candidate_time", (q: any) => q.eq("candidateId", candidateId))
        .collect();
      for (const comm of comms) await ctx.db.delete(comm._id);

      const cvs = await ctx.db.query("cvs")
        .withIndex("by_candidate", (q: any) => q.eq("candidateId", candidateId))
        .collect();
      for (const cv of cvs) {
        if (cv.storageId) {
          const uploads = await ctx.db.query("cvUploads")
            .withIndex("by_storageId", (q: any) => q.eq("storageId", cv.storageId))
            .collect();
          for (const upload of uploads) {
            await ctx.db.delete(upload._id);
          }
        }
        await ctx.db.delete(cv._id);
      }

      const candidate = await ctx.db.get(candidateId);
      if (candidate && candidate.cvUploadId) {
        const upload = await ctx.db.get(candidate.cvUploadId);
        if (upload) {
          if (upload.storageId) {
            try {
              await ctx.storage.delete(upload.storageId);
            } catch (e) {
              console.error("Failed to delete from storage", e);
            }
          }
          await ctx.db.delete(candidate.cvUploadId);
        }
      }

      await ctx.db.delete(candidateId);
    }
  }
});

export const getActiveFollowUpApplication = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const activeApp = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", args.candidateId))
      .filter((q: any) =>
        q.or(
          q.eq(q.field("currentStage"), "follow_up"),
          q.eq(q.field("currentStage"), "ta_shortlist"),
          q.eq(q.field("currentStage"), "new_cvs"),
          q.and(
            q.eq(q.field("currentStage"), "rejected"),
            q.eq(q.field("taRejectionReason"), "Did not complete requirements within 7-day window")
          )
        )
      )
      .first();
    return activeApp;
  },
});

export const getRecentOutboundComm = query({
  args: {
    candidateId: v.id("candidates"),
    channel: v.string(),
    withinMs: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - args.withinMs;
    const recent = await ctx.db
      .query("communications")
      .withIndex("by_candidate_time", (q: any) => q.eq("candidateId", args.candidateId))
      .order("desc")
      .filter((q: any) => q.and(q.eq(q.field("direction"), "outbound"), q.eq(q.field("channel"), args.channel)))
      .first();

    if (recent && Number(recent.sentAt) > cutoffTime) {
      return { sentAt: Number(recent.sentAt), body: recent.body };
    }
    return null;
  },
});

export const getCandidatesByIds = query({
  args: { ids: v.array(v.id("candidates")) },
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.ids.map((id) => ctx.db.get(id))
    );
    // Strip heavy fields to prevent sending AI embeddings over the wire
    return results
      .filter((c) => c !== null)
      .map((c) => {
        const { rawText, embedding, jobHistory, ...safe } = c as any;
        return safe;
      });
  },
});

export const countHeavyCandidates = query({
  args: {},
  handler: async (ctx) => {
    const candidates = await ctx.db.query("candidates").collect();
    let hasRawText = 0;
    let hasEmbedding = 0;
    let hasJobHistory = 0;
    for (const c of candidates) {
      if ((c as any).rawText !== undefined) hasRawText++;
      if ((c as any).embedding !== undefined) hasEmbedding++;
      if ((c as any).jobHistory !== undefined) hasJobHistory++;
    }
    return {
      total: candidates.length,
      hasRawText,
      hasEmbedding,
      hasJobHistory,
    };
  },
});

export const updateCandidateRoleCacheBatch = mutation({
  args: {
    updates: v.array(
      v.object({
        candidateId: v.id("candidates"),
        currentRoleRank: v.union(v.number(), v.null()),
        currentRoleRankLabel: v.string(),
        currentRoleConfidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
        roleFamily: v.string(),
        currentRoleCacheFingerprint: v.string(),
        usedFallbackTitle: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const update of args.updates) {
      const cand = await ctx.db.get(update.candidateId);
      if (cand) {
        await ctx.db.patch(update.candidateId, {
          currentRoleRank: update.currentRoleRank ?? undefined,
          currentRoleRankLabel: update.currentRoleRankLabel,
          currentRoleConfidence: update.currentRoleConfidence,
          roleFamily: update.roleFamily,
          currentRoleCacheFingerprint: update.currentRoleCacheFingerprint,
          usedFallbackTitle: update.usedFallbackTitle,
        });
      }
    }
  },
});

import { mutation, query } from "./_generated/server";

export const checkRunningImports = query({
  args: {},
  handler: async (ctx) => {
    const runningWorkable = await ctx.db
      .query("workableImports")
      .filter((q) => q.eq(q.field("status"), "running"))
      .collect();

    const latestWorkable = await ctx.db
      .query("workableImports")
      .order("desc")
      .take(5);

    const runningBatches = await ctx.db
      .query("ingestionBatches")
      .filter((q) => q.eq(q.field("status"), "processing"))
      .collect();

    const pendingUploads = await ctx.db
      .query("cvUploads")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .take(20);

    return {
      runningWorkableCount: runningWorkable.length,
      runningWorkableJobs: runningWorkable,
      latestWorkableJobs: latestWorkable,
      runningBatchesCount: runningBatches.length,
      pendingUploadsCount: pendingUploads.length,
      pendingUploadsDetails: pendingUploads.map((u) => ({
        _id: u._id,
        fileName: u.fileName,
        source: u.source,
        status: u.status,
        errorMessage: u.errorMessage,
      })),
    };
  },
});

export const inspectUnpatchedDeepSeekCandidates = query({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db.query("nvidiaTokenLogs").order("desc").take(1000);
    const deepseekLogs = logs.filter(
      (l) =>
        (l.model || "").toLowerCase().includes("deepseek") &&
        l.taskType === "cv_structuring" &&
        l.success === true
    );

    const missingModelCandidateIds: string[] = [];
    const foundModelCandidateIds: string[] = [];
    const missingCandidateFieldInCvUpload: string[] = [];

    for (const log of deepseekLogs) {
      if (log.cvUploadId) {
        const cv: any = await ctx.db.get(log.cvUploadId as any);
        if (!cv) {
          missingCandidateFieldInCvUpload.push(`cvUpload ${log.cvUploadId} missing doc`);
        } else if (!cv.candidateId) {
          missingCandidateFieldInCvUpload.push(`cvUpload ${cv._id} status=${cv.status} missing candidateId`);
        } else {
          const candidate: any = await ctx.db.get(cv.candidateId);
          if (!candidate) {
            missingCandidateFieldInCvUpload.push(`candidate ${cv.candidateId} doc missing in DB`);
          } else if (!candidate.extractionModel) {
            missingModelCandidateIds.push(candidate._id);
          } else {
            foundModelCandidateIds.push(candidate._id);
          }
        }
      }
    }

    return {
      totalDeepSeekLogs: deepseekLogs.length,
      missingCandidateFieldInCvUploadCount: missingCandidateFieldInCvUpload.length,
      missingCandidateFieldInCvUploadSample: missingCandidateFieldInCvUpload.slice(0, 15),
      missingModelCandidatesCount: new Set(missingModelCandidateIds).size,
      missingModelCandidateIdsSample: Array.from(new Set(missingModelCandidateIds)).slice(0, 10),
      foundModelCandidatesCount: new Set(foundModelCandidateIds).size,
    };
  },
});

export const makeAdmin = mutation({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let count = 0;
    for (const u of users) {
      await ctx.db.patch(u._id, { role: "admin", isOnboarded: true });
      count++;
    }
    return count;
  }
});

export const checkReferees = mutation({
  handler: async (ctx) => {
    const refs = await ctx.db.query("referees").take(50);
    const candidateList = await ctx.db.query("candidates").order("desc").take(10);
    return {
      totalRefereesInSample: refs.length,
      sampleReferees: refs,
      sampleCandidates: candidateList.map(c => ({ _id: c._id, name: c.fullName })),
    };
  }
});

export const seedRefereesForBatchCandidates = mutation({
  handler: async (ctx) => {
    const candidates = await ctx.db.query("candidates").order("desc").take(10);
    let count = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const existing = await ctx.db
        .query("referees")
        .withIndex("by_candidateId", (q) => q.eq("candidateId", cand._id))
        .collect();

      if (existing.length === 0) {
        await ctx.db.insert("referees", {
          candidateId: cand._id,
          name: `Dr. Robert Sterling`,
          designation: `VP of Engineering`,
          company: `Apex Global Technologies`,
          contactNo: `+1 (555) 019-2831`,
          email: `r.sterling@apextech.com`,
          relationship: `Former Line Manager`,
          notes: `Direct supervisor for 3 years. Highly recommended.`,
          createdAt: now,
        });

        await ctx.db.insert("referees", {
          candidateId: cand._id,
          name: `Sarah Lin`,
          designation: `Senior Director`,
          company: `Nexus Enterprise Solutions`,
          contactNo: `+1 (555) 014-9920`,
          email: `slin@nexus-enterprise.io`,
          relationship: `Department Head / Mentor`,
          notes: `Verified technical leadership & domain knowledge.`,
          createdAt: now,
        });

        count += 2;
      }
    }

    return {
      candidatesUpdated: candidates.length,
      refereesInserted: count,
    };
  }
});

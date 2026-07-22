import { mutation } from "./_generated/server";

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

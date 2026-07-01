import { query } from "./_generated/server";
import { v } from "convex/values";

export const getFirst = query({
  handler: async (ctx) => {
    // Find application by candidate ID
    const apps = await ctx.db
      .query("applications")
      .filter(q => q.eq(q.field("candidateId"), "j978e4z4rnfn4hjyz7hwa2nyhd89mngw" as any))
      .collect();
      
    if (apps.length > 0) {
      return { applicationId: apps[0]._id, jobId: apps[0].jobId };
    }
    return { error: "No application found for this candidate." };
  },
});

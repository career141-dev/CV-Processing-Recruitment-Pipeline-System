import { query } from "./_generated/server";

export const getSystemStats = query({
  args: {},
  handler: async (ctx) => {
    // For small/medium sets, collecting is fine.
    const candidates = await ctx.db.query("candidates").collect();
    const cvUploads = await ctx.db.query("cvUploads").collect();
    
    return {
      candidatesCount: candidates.length,
      cvUploadsCount: cvUploads.length,
    };
  },
});

import { query } from "./_generated/server";

export const getFirst = query({
  args: {},
  handler: async (ctx) => {
    const app = await ctx.db.query("applications").first();
    if (!app) return "No applications found";
    
    return {
      applicationId: app._id,
      candidateId: app.candidateId,
    };
  }
});

import { query } from "../_generated/server";

export default query({
  handler: async (ctx) => {
    const candidate = await ctx.db.query("candidates")
      .filter(q => q.eq(q.field("email"), "sanjaysanjeev2000@gmail.com"))
      .first();

    const events = await ctx.db.query("pipelineEvents")
      .withIndex("by_candidate", q => q.eq("candidateId", candidate!._id))
      .collect();

    return events;
  }
});

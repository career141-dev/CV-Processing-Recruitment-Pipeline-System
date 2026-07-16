import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const backfillEmbeddingFlags = mutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("candidateResumes").paginate({
      numItems: 100,
      cursor: args.cursor ?? null,
    });
    
    let count = 0;
    for (const r of page.page) {
      const hasEmb = !!(r.embedding && r.embedding.length > 0);
      if (r.hasEmbedding === undefined || r.hasEmbedding !== hasEmb) {
        await ctx.db.patch(r._id, { hasEmbedding: hasEmb });
        count++;
      }
    }
    
    return {
      processed: page.page.length,
      backfilled: count,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  }
});

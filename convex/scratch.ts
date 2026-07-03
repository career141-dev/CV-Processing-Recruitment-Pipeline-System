import { query } from "./_generated/server";

export const getFirst = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("communications")
      .order("desc")
      .take(10);
  },
});

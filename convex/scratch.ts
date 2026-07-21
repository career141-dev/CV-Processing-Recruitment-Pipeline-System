import { query } from "./_generated/server";
import { v } from "convex/values";

export const testUrl = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.getUrl("da5a8273-0ba0-4da2-b4c0-217be92bb1df" as any);
  },
});

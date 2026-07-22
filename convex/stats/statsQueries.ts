// convex/stats/statsQueries.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getCandidatesPage = query({
  args: { cursor: v.union(v.string(), v.null()), limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("candidates")
      .paginate({ numItems: args.limit, cursor: args.cursor });
  },
});

export const getCvUploadsPage = query({
  args: { cursor: v.union(v.string(), v.null()), limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cvUploads")
      .paginate({ numItems: args.limit, cursor: args.cursor });
  },
});

export const getApplicationsPage = query({
  args: { cursor: v.union(v.string(), v.null()), limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applications")
      .paginate({ numItems: args.limit, cursor: args.cursor });
  },
});

export const getJobsPage = query({
  args: { cursor: v.union(v.string(), v.null()), limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .paginate({ numItems: args.limit, cursor: args.cursor });
  },
});

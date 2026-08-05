// convex/stats/statsQueries.ts
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const getCandidatesPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), limit: v.number() },
  handler: async (ctx, args) => {
    const res = await ctx.db
      .query("candidates")
      .paginate({ numItems: args.limit, cursor: args.cursor });
    return {
      count: res.page.length,
      isDone: res.isDone,
      continueCursor: res.continueCursor,
    };
  },
});

export const getCvUploadsPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), limit: v.number() },
  handler: async (ctx, args) => {
    const res = await ctx.db
      .query("cvUploads")
      .paginate({ numItems: args.limit, cursor: args.cursor });
    return {
      count: res.page.length,
      isDone: res.isDone,
      continueCursor: res.continueCursor,
    };
  },
});

export const getApplicationsPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), limit: v.number() },
  handler: async (ctx, args) => {
    const res = await ctx.db
      .query("applications")
      .paginate({ numItems: args.limit, cursor: args.cursor });
    return {
      count: res.page.length,
      isDone: res.isDone,
      continueCursor: res.continueCursor,
    };
  },
});

export const getJobsPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), limit: v.number() },
  handler: async (ctx, args) => {
    const res = await ctx.db
      .query("jobs")
      .paginate({ numItems: args.limit, cursor: args.cursor });
    const activeCount = res.page.filter((j) => j.status === "active").length;
    return {
      count: res.page.length,
      activeCount,
      isDone: res.isDone,
      continueCursor: res.continueCursor,
    };
  },
});

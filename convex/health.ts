import { query } from "./_generated/server";

export const ping = query({
  args: {},
  handler: async () => {
    return "ok";
  },
});

export const getCrashDiagnostic = query({
  args: {},
  handler: async (ctx) => {
    const recentSystemLogs = await ctx.db
      .query("systemLogs")
      .order("desc")
      .take(20);

    const recentIngestionLogs = await ctx.db
      .query("ingestionLog")
      .order("desc")
      .take(20);

    const recentCvUploads = await ctx.db
      .query("cvUploads")
      .order("desc")
      .take(20);

    return {
      systemLogs: recentSystemLogs,
      ingestionLog: recentIngestionLogs,
      cvUploads: recentCvUploads,
    };
  },
});

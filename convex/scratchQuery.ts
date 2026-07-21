import { query } from "./_generated/server";

export const countCvsFromYesterday = query({
  handler: async (ctx) => {
    // Saturday morning in local time
    const startTime = Date.parse("2026-07-18T00:00:00+05:30");
    // Sunday night in local time
    const endTime = Date.parse("2026-07-19T23:59:59+05:30");

    const logs = await ctx.db
      .query("ingestionLog")
      .withIndex("by_receivedAt", (q) => q.gte("receivedAt", startTime))
      .collect();

    // Filter to logs that have a cvFileId (representing a CV upload) and were received before endTime
    const cvLogs = logs.filter(log => log.cvFileId !== undefined && log.receivedAt <= endTime);

    return {
      startTimeStr: new Date(startTime).toString(),
      totalLogs: logs.length,
      cvCount: cvLogs.length,
      cvs: cvLogs.map(l => ({
        id: l._id,
        receivedAtStr: new Date(l.receivedAt).toString(),
        candidateName: l.candidateName,
        channelType: l.channelType,
        routingStatus: l.routingStatus,
      }))
    };
  }
});

export const getLatestIngestionLogs = query({
  handler: async (ctx) => {
    const logs = await ctx.db
      .query("ingestionLog")
      .order("desc")
      .take(10);

    const results = [];
    for (const log of logs) {
      let upload = null;
      if (log.cvFileId) {
        upload = await ctx.db.get(log.cvFileId);
      }
      results.push({
        log,
        upload,
      });
    }
    return results;
  }
});


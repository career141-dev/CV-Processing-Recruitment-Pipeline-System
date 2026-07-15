import { mutation } from "../_generated/server";
import { backfillCandidateSummaries } from "./ioPerformanceMigrations";

export const runBackfill = mutation({
  args: {},
  handler: async (ctx) => {
    return await backfillCandidateSummaries(ctx, {} as any);
  }
});

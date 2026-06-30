import { Id } from "../_generated/dataModel";

export async function checkAndAdvanceFollowUp(ctx: any, candidateId: Id<"candidates">) {
  // Find all active applications for this candidate
  const apps = await ctx.db.query("applications")
    .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId))
    .collect();

  for (const app of apps) {
    if (app.currentStage === "follow_up") {
      const candidate = await ctx.db.get(candidateId);
      if (!candidate) continue;

      const hasCV = !!candidate.cvUploadId;
      const hasCurrentSalary = candidate.currentSalary !== undefined;
      const hasExpectedSalary = candidate.expectedSalary !== undefined;
      const hasNoticePeriod = candidate.noticePeriodDays !== undefined;

      if (hasCV && hasCurrentSalary && hasExpectedSalary && hasNoticePeriod) {
        await ctx.db.patch(app._id, {
          currentStage: "second_shortlist",
          lastStageChangedAt: Date.now(),
          stageHistory: [...(app.stageHistory ?? []), {
            stage: "second_shortlist",
            enteredAt: new Date().toISOString(),
            changedBy: "system" as any,
            note: "Auto-advanced from Follow-up: All 4 data points completed.",
          }],
        });
      }
    }
  }
}

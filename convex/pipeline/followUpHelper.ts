import { Id } from "../_generated/dataModel";
import { syncCandidateOverallStatus } from "../candidates";

/**
 * Checks per-application follow-up completion flags.
 * If all 4 are true, auto-advances the application to second_shortlist.
 *
 * Uses per-application flags (followUpCvReceived etc.) rather than global
 * candidate fields to prevent cross-job contamination in multi-job scenarios.
 */
export async function checkAndAdvanceFollowUp(
  ctx: any,
  candidateId: Id<"candidates">
): Promise<void> {
  const apps = await ctx.db
    .query("applications")
    .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId))
    .collect();

  for (const app of apps) {
    const isFollowUp = app.currentStage === "follow_up";
    const isAutoRejected = app.currentStage === "rejected" && app.taRejectionReason === "Did not complete requirements within 7-day window";

    if (!isFollowUp && !isAutoRejected) continue;

    const allComplete =
      app.followUpCvReceived === true &&
      app.followUpCurrentSalary === true &&
      app.followUpExpectedSalary === true &&
      app.followUpNoticePeriod === true;

    if (allComplete) {
      const note = isAutoRejected 
        ? "Candidate provided late response. Reopened to Second Shortlist."
        : "Auto-advanced from Follow-up: all 4 data points completed.";

      await ctx.db.patch(app._id, {
        currentStage: "second_shortlist",
        taRejectionReason: undefined, // Clear rejection reason if reopening
        lastStageChangedAt: Date.now(),
        stageHistory: [
          ...(app.stageHistory ?? []),
          {
            stage: "second_shortlist",
            enteredAt: new Date().toISOString(),
            changedBy: "system" as any,
            note,
          },
        ],
      });
      await syncCandidateOverallStatus(ctx, candidateId);
    }
  }
}

/**
 * Sets one or more per-application follow-up flags based on what was just collected.
 * Call this after any data is written to the candidate record via TA call, AI call webhook,
 * or manual field edit.
 *
 * @param applicationId  The specific application to update
 * @param candidate      The full candidate record (used to derive flag values)
 */
export async function updateFollowUpFlags(
  ctx: any,
  applicationId: Id<"applications">,
  candidate: any
): Promise<void> {
  const app = await ctx.db.get(applicationId);
  if (!app) return;

  const updates: Record<string, boolean> = {};

  // CV: check cvUploadId on candidate OR on the application itself
  const hasCV = !!candidate.cvUploadId || !!app.cvFileId;
  if (hasCV && !app.followUpCvReceived) updates.followUpCvReceived = true;

  if (candidate.currentSalary !== undefined && candidate.currentSalary !== null && !app.followUpCurrentSalary)
    updates.followUpCurrentSalary = true;

  if (candidate.expectedSalary !== undefined && candidate.expectedSalary !== null && !app.followUpExpectedSalary)
    updates.followUpExpectedSalary = true;

  if (candidate.noticePeriodDays !== undefined && candidate.noticePeriodDays !== null && !app.followUpNoticePeriod)
    updates.followUpNoticePeriod = true;

  if (Object.keys(updates).length > 0) {
    await ctx.db.patch(applicationId, updates);
  }
}

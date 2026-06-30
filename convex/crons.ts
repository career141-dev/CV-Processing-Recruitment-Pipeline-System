import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

export const retryAiCalls = internalMutation({
  args: {},
  handler: async (ctx) => {
    const aiCalls = await ctx.db.query("aiCalls")
      .filter(q => q.or(
        q.eq(q.field("callStatus"), "scheduled"),
        q.eq(q.field("callStatus"), "no_answer")
      ))
      .collect();

    for (const call of aiCalls) {
      const attempts = call.attempts || 0;
      if (attempts < 6) {
        await ctx.db.patch(call._id, {
          attempts: attempts + 1,
        });

        // TODO: Call HTTP action to trigger outbound AI phone call here
        console.log(`Triggering AI call for ${call.candidateId}, attempt ${attempts + 1}`);

      } else {
        await ctx.db.patch(call._id, {
          callStatus: "failed",
        });

        if (call.applicationId) {
          const app = await ctx.db.get(call.applicationId);
          if (app) {
            await ctx.db.patch(app._id, {
              currentStage: "rejected",
              taRejectionReason: "Unreachable after 3 days",
              stageHistory: [...(app.stageHistory ?? []), {
                stage: "rejected",
                enteredAt: new Date().toISOString(),
                changedBy: (call.triggeredBy || app.candidateId) as any, // fallback
                note: "Unreachable after 3 days of attempts",
              }],
            });
          }
        }
      }
    }
  },
});

crons.daily(
  "retry-ai-calls",
  { minuteUTC: 0, hourUTC: 9 }, // Adjust to target 9am UTC for now
  (internal as any).crons.retryAiCalls
);

crons.daily(
  "retry-ai-calls-evening",
  { minuteUTC: 0, hourUTC: 17 }, // Adjust to target 5pm UTC for now
  internal.crons.retryAiCalls
);

export const evaluateFollowUpStage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const followUpApps = await ctx.db.query("applications")
      .filter(q => q.eq(q.field("currentStage"), "follow_up"))
      .collect();

    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    for (const app of followUpApps) {
      const candidate = await ctx.db.get(app.candidateId);
      if (!candidate) continue;

      const job = await ctx.db.get(app.jobId);
      if (!job) continue;

      const hasCV = !!candidate.cvUploadId;
      const hasCurrentSalary = candidate.currentSalary !== undefined;
      const hasExpectedSalary = candidate.expectedSalary !== undefined;
      const hasNoticePeriod = candidate.noticePeriodDays !== undefined;

      const allFourFieldsPresent = hasCV && hasCurrentSalary && hasExpectedSalary && hasNoticePeriod;

      if (allFourFieldsPresent) {
        // Auto-advance
        await ctx.db.patch(app._id, {
          currentStage: "second_shortlist",
          lastStageChangedAt: now,
          stageHistory: [...(app.stageHistory ?? []), {
            stage: "second_shortlist",
            enteredAt: new Date().toISOString(),
            changedBy: "system" as any,
            note: "Auto-advanced from Follow-up: All 4 data points completed.",
          }],
        });
        continue;
      }

      // Calculate elapsed time in follow-up
      const timeInStage = now - (app.lastStageChangedAt || now);
      const daysInStage = Math.floor(timeInStage / (24 * 60 * 60 * 1000));

      if (timeInStage >= SEVEN_DAYS_MS) {
        // Auto-reject
        await ctx.db.patch(app._id, {
          currentStage: "rejected",
          taRejectionReason: "Follow-up 7-day timeout (missing data)",
          lastStageChangedAt: now,
          stageHistory: [...(app.stageHistory ?? []), {
            stage: "rejected",
            enteredAt: new Date().toISOString(),
            changedBy: "system" as any,
            note: "Auto-rejected: 7-day timeout without completing missing data.",
          }],
        });
        continue;
      }

      // Day Tier mapping
      let targetDay = 1;
      if (daysInStage === 0) targetDay = 1;
      else if (daysInStage === 1) targetDay = 2;
      else if (daysInStage === 2) targetDay = 3;
      else if (daysInStage === 3) targetDay = 4;
      else if (daysInStage >= 6) targetDay = 7;
      else continue; // Day 5 & 6

      // Idempotency check: check if we've already done this day tier or higher
      const followUpState = app.followUpState || { lastContactDay: 0 };
      if (followUpState.lastContactDay >= targetDay) {
        continue;
      }

      const isExternal = app.sourceChannel !== "database";
      let channelToUse: "email" | "whatsapp" | null = null;
      let firstChannelUsed = followUpState.firstChannelUsed;
      let triggerAiCallRetry = false;

      if (targetDay === 1) {
        channelToUse = "email";
        firstChannelUsed = "email";
      } else if (targetDay === 2) {
        channelToUse = firstChannelUsed === "email" ? "whatsapp" : "email";
      } else if (targetDay === 3) {
        if (isExternal && (app.aiCallStatus === "failed" || app.aiCallStatus === "no_answer")) {
          triggerAiCallRetry = true;
        }
      } else if (targetDay === 4) {
        channelToUse = firstChannelUsed as "email" | "whatsapp";
      } else if (targetDay === 7) {
        channelToUse = firstChannelUsed === "email" ? "whatsapp" : "email";
        if (isExternal && (app.aiCallStatus === "failed" || app.aiCallStatus === "no_answer")) {
          triggerAiCallRetry = true;
        }
      }

      // Update follow-up state
      const updatedState = {
        lastContactDay: targetDay,
        firstChannelUsed,
      };

      await ctx.db.patch(app._id, {
        followUpState: updatedState,
      });

      // Dispatch messaging stubs
      if (channelToUse) {
        const missingFields: string[] = [];
        if (!hasCV) missingFields.push("CV (Resume)");
        if (!hasCurrentSalary) missingFields.push("Current Salary");
        if (!hasExpectedSalary) missingFields.push("Expected Salary");
        if (!hasNoticePeriod) missingFields.push("Notice Period");
        const missingStr = missingFields.join(", ");
        const body = `Hi ${candidate.fullName || "there"}, we are still missing your: ${missingStr} to continue your application for the ${job.title} position. Please update us!`;

        await ctx.db.insert("communications", {
          candidateId: app.candidateId,
          jobId: app.jobId,
          direction: "outbound",
          channel: channelToUse,
          subject: `Action Required: Complete your application for ${job.title}`,
          body,
          deliveryStatus: "sent",
          sentAt: now,
          stoppedSequence: false,
        });

        console.log(`[Follow-up Day ${targetDay}] Sent ${channelToUse} to ${candidate.fullName || "unknown candidate"}`);
      }

      // Dispatch AI Call stubs
      if (triggerAiCallRetry) {
        await ctx.db.insert("aiCalls", {
          candidateId: app.candidateId,
          jobId: app.jobId,
          applicationId: app._id,
          triggerType: "followup_retry",
          callStatus: "scheduled",
          callScriptUsed: "initial_screening",
          companyHidden: false,
          calledAt: now,
          followUpTriggered: true,
          attempts: 0,
        });

        console.log(`[Follow-up Day ${targetDay}] Queued AI Call retry for external candidate ${candidate.fullName || "unknown"}`);
      }
    }
  },
});

crons.hourly(
  "evaluate-follow-up",
  { minuteUTC: 0 },
  internal.crons.evaluateFollowUpStage
);

export default crons;

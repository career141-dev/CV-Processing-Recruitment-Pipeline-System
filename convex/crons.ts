import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { syncCandidateOverallStatus } from "./candidates";

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

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    for (const call of aiCalls) {
      if (!call.firstAttemptAt) {
        // Just created, hasn't been tried yet.
        await ctx.db.patch(call._id, { firstAttemptAt: now, attemptNumber: (call.attemptNumber || 0) + 1 });
        await ctx.scheduler.runAfter(0, internal.integrations.elevenlabs.triggerIntakeCall, {
          applicationId: call.applicationId as any,
          candidateId: call.candidateId as any,
          jobId: call.jobId as any,
        });
        continue;
      }

      const elapsedDays = Math.floor((now - call.firstAttemptAt) / DAY_MS);
      const attempts = call.attemptNumber || 1;

      // 7-day logic: retry on Day 2, Day 4, and Day 7
      let shouldRetry = false;
      if (elapsedDays === 2 && attempts < 2) shouldRetry = true;
      if (elapsedDays === 4 && attempts < 3) shouldRetry = true;
      if (elapsedDays === 7 && attempts < 4) shouldRetry = true;

      if (shouldRetry) {
        await ctx.db.patch(call._id, {
          attemptNumber: attempts + 1,
        });
        await ctx.scheduler.runAfter(0, internal.integrations.elevenlabs.triggerFollowUpCall, {
          applicationId: call.applicationId as any,
          candidateId: call.candidateId as any,
          jobId: call.jobId as any,
          attemptNumber: attempts + 1,
          lastContactChannel: "phone call"
        });
        console.log(`Triggering AI call for ${call.candidateId}, attempt ${attempts + 1} on Day ${elapsedDays}`);
      } else if (elapsedDays > 7) {
        // Maxed out, give up
        await ctx.db.patch(call._id, {
          callStatus: "failed",
        });

        if (call.applicationId) {
          const app = await ctx.db.get(call.applicationId);
          if (app) {
            await ctx.db.patch(app._id, {
              currentStage: "rejected",
              taRejectionReason: "Unreachable after 7-day AI Call window",
              stageHistory: [...(app.stageHistory ?? []), {
                stage: "rejected",
                enteredAt: new Date().toISOString(),
                changedBy: (call.triggeredBy || app.candidateId) as any,
                note: "Unreachable after 7 days of attempts",
              }],
            });
            await syncCandidateOverallStatus(ctx, app.candidateId);
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

      // ── Per-application completion flags (not global candidate fields) ──────
      // Falls back to candidate record for legacy apps that predate the flags.
      const hasCV =
        app.followUpCvReceived === true ||
        (app.followUpCvReceived === undefined && (!!candidate.cvUploadId || !!app.cvFileId));

      const hasCurrentSalary =
        app.followUpCurrentSalary === true ||
        (app.followUpCurrentSalary === undefined && candidate.currentSalary !== undefined);

      const hasExpectedSalary =
        app.followUpExpectedSalary === true ||
        (app.followUpExpectedSalary === undefined && candidate.expectedSalary !== undefined);

      const hasNoticePeriod =
        app.followUpNoticePeriod === true ||
        (app.followUpNoticePeriod === undefined && candidate.noticePeriodDays !== undefined);

      const allFourComplete = hasCV && hasCurrentSalary && hasExpectedSalary && hasNoticePeriod;

      if (allFourComplete) {
        // All data collected — auto-advance to Second Shortlist immediately
        await ctx.db.patch(app._id, {
          currentStage: "second_shortlist",
          lastStageChangedAt: now,
          followUpCvReceived: true,
          followUpCurrentSalary: true,
          followUpExpectedSalary: true,
          followUpNoticePeriod: true,
          stageHistory: [
            ...(app.stageHistory ?? []),
            {
              stage: "second_shortlist",
              enteredAt: new Date().toISOString(),
              changedBy: "system" as any,
              note: "Auto-advanced from Follow-up: All 4 data points confirmed.",
            },
          ],
        });
        await syncCandidateOverallStatus(ctx, app.candidateId);
        continue;
      }

      // ── 7-day clock: use followUpEnteredAt for precision, fall back to lastStageChangedAt ──
      const enteredAt = app.followUpEnteredAt ?? app.lastStageChangedAt ?? now;
      const timeInStage = now - enteredAt;
      const daysInStage = Math.floor(timeInStage / (24 * 60 * 60 * 1000));

      if (timeInStage >= SEVEN_DAYS_MS) {
        // 7 days elapsed without completion — auto-reject
        await ctx.db.patch(app._id, {
          currentStage: "rejected",
          taRejectionReason: "Did not complete requirements within 7-day window",
          lastStageChangedAt: now,
          stageHistory: [
            ...(app.stageHistory ?? []),
            {
              stage: "rejected",
              enteredAt: new Date().toISOString(),
              changedBy: "system" as any,
              note: "Auto-rejected: Did not complete requirements within 7-day Follow-up window.",
            },
          ],
        });
        await syncCandidateOverallStatus(ctx, app.candidateId);
        continue;
      }

      // ── Day-tier outreach scheduling ─────────────────────────────────────────
      // Contacts on Day 1, 2, 3, 4, 7 only — skips 5 & 6 to avoid saturation.
      let targetDay: number | null = null;
      if (daysInStage === 0) targetDay = 1;
      else if (daysInStage === 1) targetDay = 2;
      else if (daysInStage === 2) targetDay = 3;
      else if (daysInStage === 3) targetDay = 4;
      else if (daysInStage >= 6) targetDay = 7;

      if (targetDay === null) continue; // Days 5 & 6 — intentionally silent

      // Idempotency: skip if this day tier was already dispatched
      const followUpState = app.followUpState ?? { lastContactDay: 0 };
      if (followUpState.lastContactDay >= targetDay) continue;

      const isPathTwo = app.sourceChannel !== "database";
      let channelToUse: "email" | "whatsapp" | null = null;
      let firstChannelUsed = followUpState.firstChannelUsed;
      let triggerAiCallRetry = false;

      // Outreach channel rotation — alternates WhatsApp/email, never repeats on same channel twice
      if (targetDay === 1) {
        channelToUse = "email";
        firstChannelUsed = "email";
      } else if (targetDay === 2) {
        channelToUse = firstChannelUsed === "email" ? "whatsapp" : "email";
      } else if (targetDay === 3) {
        // Path 2 only: retry AI call if original call failed/no answer
        if (isPathTwo && (app.aiCallStatus === "failed" || app.aiCallStatus === "no_answer")) {
          triggerAiCallRetry = true;
        } else {
          channelToUse = firstChannelUsed === "email" ? "whatsapp" : "email";
        }
      } else if (targetDay === 4) {
        channelToUse = firstChannelUsed as "email" | "whatsapp";
      } else if (targetDay === 7) {
        channelToUse = firstChannelUsed === "email" ? "whatsapp" : "email";
        if (isPathTwo && (app.aiCallStatus === "failed" || app.aiCallStatus === "no_answer")) {
          triggerAiCallRetry = true;
        }
      }

      // Persist updated state
      await ctx.db.patch(app._id, {
        followUpState: { lastContactDay: targetDay, firstChannelUsed },
      });

      // ── Send message (only about MISSING fields) ─────────────────────────────
      if (channelToUse) {
        const missingFields: string[] = [];
        if (!hasCV) missingFields.push("CV / Resume");
        if (!hasCurrentSalary) missingFields.push("Current Salary");
        if (!hasExpectedSalary) missingFields.push("Expected Salary");
        if (!hasNoticePeriod) missingFields.push("Notice Period");

        const body = [
          `Hi ${candidate.fullName || "there"},`,
          `We're still waiting on the following to progress your application for **${job.title}**:`,
          missingFields.map(f => `• ${f}`).join("\n"),
          `Please share these at your earliest convenience. Thank you!`,
        ].join("\n\n");

        await ctx.db.insert("communications", {
          candidateId: app.candidateId,
          jobId: app.jobId,
          direction: "outbound",
          channel: channelToUse,
          subject: `Action Required: Missing info for your ${job.title} application`,
          body,
          deliveryStatus: "sent",
          sentAt: now,
          stoppedSequence: false,
        });

        console.log(`[Follow-up Day ${targetDay}] Sent ${channelToUse} to ${candidate.fullName ?? "unknown"}`);
      }

      // ── AI call retry — capped at 2 within follow-up ─────────────────────────
      if (triggerAiCallRetry) {
        const retryCount = app.followUpAiCallAttempts ?? 0;
        if (retryCount < 2) {
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
            attempts: retryCount + 1,
          });

          await ctx.db.patch(app._id, {
            followUpAiCallAttempts: retryCount + 1,
          });

          console.log(`[Follow-up Day ${targetDay}] AI retry #${retryCount + 1} queued for ${candidate.fullName ?? "unknown"}`);
        } else {
          console.log(`[Follow-up Day ${targetDay}] AI retry cap (max 2) reached for ${candidate.fullName ?? "unknown"} — skipping.`);
        }
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

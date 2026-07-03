import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { syncCandidateOverallStatus } from "./candidates";

const crons = cronJobs();

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
      if (job.status !== "active") continue;

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
      // Valid target days: 0, 2, 4, 6
      let targetDay: number | null = null;
      if (daysInStage === 0) targetDay = 0;
      else if (daysInStage >= 2 && daysInStage < 4) targetDay = 2;
      else if (daysInStage >= 4 && daysInStage < 6) targetDay = 4;
      else if (daysInStage === 6) targetDay = 6;

      if (targetDay === null) continue; // Off-days (1, 3, 5) intentionally silent

      // Idempotency: skip if this day tier was already dispatched
      const followUpState = (app.followUpState as any) || {};
      if (followUpState[`day${targetDay}Done`]) continue;

      let triggerWhatsApp = false;
      let triggerEmail = false;
      let triggerAiCall = false;

      if (targetDay === 0) {
        triggerWhatsApp = true;
        triggerEmail = true;
      } else if (targetDay === 2) {
        triggerAiCall = true;
        triggerWhatsApp = true; // Send WhatsApp 2 (can happen post-call or concurrently)
      } else if (targetDay === 4) {
        triggerWhatsApp = true; // WhatsApp 3
      } else if (targetDay === 6) {
        triggerWhatsApp = true; // WhatsApp 4
      }

      // Persist updated state
      await ctx.db.patch(app._id, {
        followUpState: { ...followUpState, [`day${targetDay}Done`]: true, lastContactDay: targetDay },
      });

      // ── Send message (only about MISSING fields) ─────────────────────────────
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

      if (triggerEmail) {
        await ctx.db.insert("communications", {
          candidateId: app.candidateId,
          jobId: app.jobId,
          direction: "outbound",
          channel: "email",
          subject: `Action Required: Missing info for your ${job.title} application`,
          body,
          deliveryStatus: "sent",
          sentAt: now,
          stoppedSequence: false,
        });
        console.log(`[Follow-up Day ${targetDay}] Sent email to ${candidate.fullName ?? "unknown"}`);
      }

      if (triggerWhatsApp) {
        await ctx.db.insert("communications", {
          candidateId: app.candidateId,
          jobId: app.jobId,
          direction: "outbound",
          channel: "whatsapp",
          subject: `Action Required: Missing info for your ${job.title} application`,
          body,
          deliveryStatus: "sent",
          sentAt: now,
          stoppedSequence: false,
        });
        console.log(`[Follow-up Day ${targetDay}] Sent WhatsApp to ${candidate.fullName ?? "unknown"}`);
      }

      // ── Follow-up AI call (Day 2) ─────────────────────────
      if (triggerAiCall) {
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
          attempts: 1,
        });

        await ctx.scheduler.runAfter(0, internal.integrations.elevenlabs.triggerFollowUpCall, {
          applicationId: app._id,
          candidateId: app.candidateId,
          jobId: app.jobId,
          attemptNumber: 1,
          lastContactChannel: "WhatsApp",
        });

        console.log(`[Follow-up Day ${targetDay}] AI Follow-up call queued for ${candidate.fullName ?? "unknown"}`);
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

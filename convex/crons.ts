import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { syncCandidateOverallStatus } from "./candidates/candidates";

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

      // Skip if followUpEnteredAt is not set (outreach has not been manually triggered by TA yet)
      if (!app.followUpEnteredAt) continue;

      const enteredAt = app.followUpEnteredAt;
      const timeInStage = now - enteredAt;
      const daysInStage = Math.floor(timeInStage / (24 * 60 * 60 * 1000));

      // Check if candidate replied (inbound messages or completed AI calls since followUpEnteredAt)
      const inboundComms = await ctx.db.query("communications")
        .withIndex("by_applicationId", (q: any) => q.eq("applicationId", app._id))
        .filter((q: any) => q.eq(q.field("direction"), "inbound"))
        .collect();

      const hasRepliedMessage = inboundComms.some((c: any) => {
        const sentAtMs = typeof c.sentAt === "number" ? c.sentAt : Number(c.sentAt);
        return sentAtMs >= enteredAt;
      });

      const completedCalls = await ctx.db.query("aiCalls")
        .withIndex("by_application", (q: any) => q.eq("applicationId", app._id))
        .filter((q: any) => q.eq(q.field("callStatus"), "completed"))
        .collect();

      const hasCompletedCall = completedCalls.some((c: any) => c.calledAt >= enteredAt);

      const hasReplied = hasRepliedMessage || hasCompletedCall;

      if (hasReplied) {
        // Record the platform they replied on if not already done
        if (!app.followUpState?.replyChannel) {
          let replyChannel = "unknown";
          if (hasRepliedMessage) {
            const sortedReplies = inboundComms
              .filter((c: any) => {
                const sentAtMs = typeof c.sentAt === "number" ? c.sentAt : Number(c.sentAt);
                return sentAtMs >= enteredAt;
              })
              .sort((a: any, b: any) => {
                const aTime = typeof a.sentAt === "number" ? a.sentAt : Number(a.sentAt);
                const bTime = typeof b.sentAt === "number" ? b.sentAt : Number(b.sentAt);
                return aTime - bTime;
              });
            replyChannel = sortedReplies[0]?.channel ?? "unknown";
          } else if (hasCompletedCall) {
            replyChannel = "phone";
          }
          await ctx.db.patch(app._id, {
            followUpState: {
              lastContactDay: app.followUpState?.lastContactDay ?? 0,
              firstChannelUsed: app.followUpState?.firstChannelUsed,
              replyChannel,
            }
          });
        }
        continue; // Candidate has replied, stop automated follow-up sequence
      }

      // If 7 days elapsed without reply, auto-reject
      if (timeInStage >= SEVEN_DAYS_MS) {
        await ctx.db.patch(app._id, {
          currentStage: "rejected",
          taRejectionReason: "Did not respond within 7-day follow-up window",
          lastStageChangedAt: now,
          stageHistory: [
            ...(app.stageHistory ?? []),
            {
              stage: "rejected",
              enteredAt: new Date().toISOString(),
              changedBy: "system" as any,
              note: "Auto-rejected: Did not reply within 7-day Follow-up window.",
            },
          ],
        });
        await syncCandidateOverallStatus(ctx, app.candidateId);
        continue;
      }

      // Day-tier outreach scheduling
      let targetDay: number | null = null;
      if (daysInStage === 0) targetDay = 0;
      else if (daysInStage === 2) targetDay = 2; // Day 3
      else if (daysInStage === 4) targetDay = 4; // Day 5
      else if (daysInStage === 6) targetDay = 6; // Day 7

      if (targetDay === null) continue; // Off-days (1, 3, 5) intentionally silent

      // Idempotency: skip if this day tier (or later) was already dispatched
      const followUpState = app.followUpState;
      if (followUpState !== undefined && followUpState.lastContactDay >= targetDay) continue;

      let triggerWhatsApp = false;
      let triggerEmail = false;
      let triggerAiCall = false;

      if (targetDay === 0) {
        triggerWhatsApp = true;
        triggerEmail = true;
      } else if (targetDay === 2) {
        triggerAiCall = true;
      } else if (targetDay === 4) {
        triggerWhatsApp = true;
        triggerEmail = true;
      } else if (targetDay === 6) {
        triggerWhatsApp = true;
        triggerEmail = true;
      }

      // Persist updated state
      await ctx.db.patch(app._id, {
        followUpState: {
          ...(followUpState ?? {}),
          lastContactDay: targetDay,
          firstChannelUsed: followUpState?.firstChannelUsed ?? "whatsapp",
        },
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
          applicationId: app._id,
          direction: "outbound",
          channel: "email",
          subject: `Action Required: Missing info for your ${job.title} application`,
          body,
          deliveryStatus: "sent",
          sentAt: now,
          stoppedSequence: false,
          sequenceDay: targetDay,
        });
        console.log(`[Follow-up Day ${targetDay}] Sent email to ${candidate.fullName ?? "unknown"}`);
      }

      if (triggerWhatsApp) {
        const commId = await ctx.db.insert("communications", {
          candidateId: app.candidateId,
          jobId: app.jobId,
          applicationId: app._id,
          direction: "outbound",
          channel: "whatsapp",
          subject: `Action Required: Missing info for your ${job.title} application`,
          body,
          deliveryStatus: "pending",
          sentAt: now,
          stoppedSequence: false,
          sequenceDay: targetDay,
        });

        await ctx.scheduler.runAfter(0, internal.communications.whatsappOutbound.sendWhatsApp, {
          communicationId: commId,
          candidateId: app.candidateId,
          jobId: app.jobId,
          body,
        });

        console.log(`[Follow-up Day ${targetDay}] Scheduled WhatsApp to ${candidate.fullName ?? "unknown"}`);
      }

      // ── Follow-up AI call (Day 2 elapsed / Day 3) ─────────────────────────
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

crons.daily(
  "renew-graph-subscriptions",
  { hourUTC: 3, minuteUTC: 0 }, // Runs daily at 03:00 UTC
  internal.communications.graphSubscriptions.renewExpiringSubscriptions
);

export default crons;

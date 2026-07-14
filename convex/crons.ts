import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { syncCandidateOverallStatus } from "./candidates/candidates";
import { adjustJobStageStat } from "./jobs/stats";

const crons = cronJobs();

export const evaluateFollowUpStage = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 1. Check Kill Switch
    const configRow = await ctx.db.query("appSettings").filter(q => q.eq(q.field("key"), "system")).first();
    if (configRow && configRow.autopilotEnabled === false) {
      console.log("Autopilot disabled via appSettings - skipping sweep");
      return;
    }
    
    const toggles = configRow?.channel_toggles;
    const whatsappFollowUpPaused = toggles?.whatsappFollowUp === false;
    const emailFollowUpPaused = toggles?.emailFollowUp === false;
    const allFollowUpsPaused = whatsappFollowUpPaused && emailFollowUpPaused;

    const followUpApps = await ctx.db.query("applications")
      .withIndex("by_stage", q => q.eq("currentStage", "follow_up"))
      .collect();

    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const MAX_CALLS_PER_RUN = 20;
    let aiCallsTriggeredThisRun = 0;

    function isWithinCallingHours(phone?: string) {
      if (!phone) return true; // Default allow if no phone available to check
      let offsetHours = 0; 
      if (phone.startsWith("+44") || phone.startsWith("07")) offsetHours = 0; // UK
      else if (phone.startsWith("+971")) offsetHours = 4; // UAE
      else if (phone.startsWith("+94")) offsetHours = 5.5; // Sri Lanka
      else if (phone.startsWith("+65")) offsetHours = 8; // Singapore
      else if (phone.startsWith("+1")) offsetHours = -5; // US EST roughly
      else if (phone.startsWith("+61")) offsetHours = 10; // Australia (AEST)
      
      const currentUtcHour = new Date().getUTCHours();
      const localHour = (currentUtcHour + offsetHours + 24) % 24;
      return localHour >= 9 && localHour < 20; // 9 AM to 8 PM
    }

    for (const app of followUpApps) {
      const candidate = await ctx.db.get(app.candidateId);
      if (!candidate) continue;

      // 2. Enforce doNotContact
      if (candidate.doNotContact) {
        continue;
      }

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
        await adjustJobStageStat(ctx, app.jobId, "follow_up", "second_shortlist");
        await syncCandidateOverallStatus(ctx, app.candidateId);
        continue;
      }

      // Skip if followUpEnteredAt is not set (outreach has not been manually triggered by TA yet)
      if (!app.followUpEnteredAt) continue;

      const enteredAt = app.followUpEnteredAt;
      const timeInStage = now - enteredAt;
      const daysInStage = Math.floor(timeInStage / (24 * 60 * 60 * 1000));

      // 1. First, check if 7 days have elapsed without collecting all required fields.
      // If 7 days elapsed, move to Unresponsive (not rejected)
      // DA will manually call these candidates using the Unresponsive sub-section
      // in the Follow-up tab. AI voice call is suspended.
      // Note: We suspend the 7-day expiration timer if ALL follow-up channels are globally paused.
      if (timeInStage >= SEVEN_DAYS_MS && !allFollowUpsPaused) {
        await ctx.db.patch(app._id, {
          currentStage: "unresponsive",
          lastStageChangedAt: now,
          stageHistory: [
            ...(app.stageHistory ?? []),
            {
              stage: "unresponsive",
              enteredAt: new Date().toISOString(),
              changedBy: "system" as any,
              note: "Auto-moved to Unresponsive: Profile still incomplete after 7 days in Follow-up.",
            },
          ],
        });
        await ctx.db.patch(app._id, {
          followUpState: {
            lastContactDay: app.followUpState?.lastContactDay ?? 0,
            firstChannelUsed: app.followUpState?.firstChannelUsed,
            replyChannel: "unresponsive",
          }
        });
        await adjustJobStageStat(ctx, app.jobId, "follow_up", "unresponsive");
        await syncCandidateOverallStatus(ctx, app.candidateId);
        continue;
      }

      // 2. If under 7 days, check if candidate replied (inbound messages or completed AI calls)
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

      if (targetDay === 0 || targetDay === 4 || targetDay === 6) {
        triggerWhatsApp = !whatsappFollowUpPaused;
        triggerEmail = !emailFollowUpPaused;
      } else if (targetDay === 2) {
        // AI voice call suspended (Sri Lankan phone number not yet available).
        // Backend code in elevenlabs.ts remains intact for future reactivation.
        // Day 2 is intentionally silent — next contact is Day 4 WhatsApp/Email.
        continue;
      }

      // If all scheduled actions for this day are paused, skip the rest to avoid empty states
      if (!triggerWhatsApp && !triggerEmail && !triggerAiCall) continue;

      // 3 & 4. Rate Limiting and Calling Hours for AI Calls
      if (triggerAiCall) {
        if (aiCallsTriggeredThisRun >= MAX_CALLS_PER_RUN) {
          console.log(`[Follow-up Day 2] Deferring AI Call for ${candidate.fullName ?? "unknown"} - Max calls per run reached.`);
          continue;
        }
        if (!isWithinCallingHours(candidate.phone)) {
          console.log(`[Follow-up Day 2] Deferring AI Call for ${candidate.fullName ?? "unknown"} - Outside calling hours for phone ${candidate.phone}.`);
          continue;
        }
      }

      // Persist updated state AFTER passing deferral checks
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
        aiCallsTriggeredThisRun++;
        
        const newAiCallId = await ctx.db.insert("aiCalls", {
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
          aiCallId: newAiCallId,
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

// Poll linkedin's inbox every 5 minutes
// Replace "fallback_job_id_here" with a real default Job ID if you want a catch-all.
crons.interval(
  "poll-linkedin-inbox",
  { minutes: 1 }, // Changed to 1 minute for faster testing
  api.communications.emailAgent.pollEmailInbox,
  { inboxEmail: "linkedin@career141.com" }
);

export const checkSlaBreaches = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check Kill Switch
    const configRow = await ctx.db.query("appSettings").filter(q => q.eq(q.field("key"), "system")).first();
    if (configRow && configRow.autopilotEnabled === false) return;

    const apps = await ctx.db.query("applications")
      .withIndex("by_active", q => q.eq("isActive", true))
      .collect();

    for (const app of apps) {
      if (!app.lastStageChangedAt) continue;

      const job = await ctx.db.get(app.jobId);
      if (!job || job.status !== "active") continue;

      let slaLimit = 0;
      let stageName = "";
      switch (app.currentStage) {
        case "ta_shortlist":
          slaLimit = job.slaTaReviewDays ?? 2;
          stageName = "TA Review";
          break;
        case "director_shortlist":
          slaLimit = job.slaDirectorReviewDays ?? 3;
          stageName = "Director Review";
          break;
        case "client_review":
          slaLimit = job.slaClientReviewDays ?? 5;
          stageName = "Client Review";
          break;
        case "interview":
          slaLimit = job.slaInterviewDays ?? 3;
          stageName = "Interview";
          break;
        case "offer":
          slaLimit = job.slaOfferDays ?? 2;
          stageName = "Offer";
          break;
        case "second_shortlist":
          slaLimit = job.slaSecondShortlistDays ?? 2;
          stageName = "2nd Shortlist";
          break;
        case "ai_call":
          slaLimit = job.slaAiCallDays ?? 1;
          stageName = "AI Call";
          break;
        default:
          continue;
      }

      const msElapsed = Date.now() - app.lastStageChangedAt;
      const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);

      if (daysElapsed > slaLimit) {
        const existingNotifs = await ctx.db.query("notifications")
          .filter(q => q.and(
            q.eq(q.field("type"), "sla_breached"),
            q.eq(q.field("candidateId"), app.candidateId),
            q.eq(q.field("jobId"), app.jobId)
          )).collect();
        
        // Prevent spam: only alert once per stage entry
        const recentNotif = existingNotifs.find(n => new Date(n.createdAt).getTime() > app.lastStageChangedAt);
        
        if (!recentNotif && job.primaryRecruiterId) {
           const candidate = await ctx.db.get(app.candidateId);
           await ctx.db.insert("notifications", {
              userId: job.primaryRecruiterId,
              type: "sla_breached",
              title: "Pipeline SLA Breached",
              body: `${candidate?.fullName || "A candidate"} has been stuck in ${stageName} for ${Math.floor(daysElapsed)} days (Limit: ${slaLimit}).`,
              candidateId: app.candidateId,
              jobId: app.jobId,
              read: false,
              createdAt: new Date().toISOString()
           });
           console.log(`[SLA] Breached for ${candidate?.fullName} in ${stageName}`);
        }
      }
    }
  }
});

crons.daily(
  "check-sla-breaches",
  { hourUTC: 8, minuteUTC: 0 },
  internal.crons.checkSlaBreaches
);

export default crons;

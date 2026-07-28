import { Id } from "../_generated/dataModel";
import { syncCandidateOverallStatus } from "../candidates/candidates";
import { internal } from "../_generated/api";
import { adjustJobStageStat } from "../jobs/stats";

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
    const isFollowUp = app.currentStage === "follow_up" || app.currentStage === "ta_shortlist";
    const isAutoRejected = app.currentStage === "rejected" && app.taRejectionReason === "Did not complete requirements within 7-day window";

    if (!isFollowUp && !isAutoRejected) continue;

    const candidate = await ctx.db.get(candidateId);
    if (!candidate) continue;

    const hasCV = !!candidate.cvUploadId || !!app.cvFileId;
    const hasCurrent = candidate.currentSalary !== undefined && candidate.currentSalary !== null;
    const hasExpected = candidate.expectedSalary !== undefined && candidate.expectedSalary !== null;
    const hasNotice = candidate.noticePeriodDays !== undefined && candidate.noticePeriodDays !== null;

    // Auto-fix any flags that should be true based on actual candidate data
    const updates: any = {};
    if (hasCV && !app.followUpCvReceived) updates.followUpCvReceived = true;
    if (hasCurrent && !app.followUpCurrentSalary) updates.followUpCurrentSalary = true;
    if (hasExpected && !app.followUpExpectedSalary) updates.followUpExpectedSalary = true;
    if (hasNotice && !app.followUpNoticePeriod) updates.followUpNoticePeriod = true;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(app._id, updates);
      Object.assign(app, updates); // apply updates locally for the next check
    }

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
      await adjustJobStageStat(ctx, app.jobId, app.currentStage, "second_shortlist");
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

/**
 * Initiates the follow-up outreach flow when a candidate first arrives at the follow_up stage.
 * Immediately builds and schedules the Day 0 WhatsApp notification outlining missing fields.
 */
export async function initiateFollowUpOutreach(
  ctx: any,
  applicationId: Id<"applications">
): Promise<Id<"communications"> | undefined> {
  const app = await ctx.db.get(applicationId);
  if (!app) return;

  const candidate = await ctx.db.get(app.candidateId);
  if (!candidate) return;

  const job = await ctx.db.get(app.jobId);
  if (!job) return;

  // Derive complete/missing status
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

  const customQuestions = job.customFollowUpQuestions || [];
  const customAnswers = app.customFollowUpAnswers || {};
  let customQuestionsComplete = true;
  for (const q of customQuestions) {
    if (!customAnswers[q]) {
      customQuestionsComplete = false;
      break;
    }
  }

  const allComplete = hasCV && hasCurrentSalary && hasExpectedSalary && hasNoticePeriod && customQuestionsComplete;
  if (allComplete) return; // All data points already gathered, no outreach needed

  const missingFields: string[] = [];
  if (!hasCV) missingFields.push("CV / Resume");
  if (!hasCurrentSalary) missingFields.push("Current Salary");
  if (!hasExpectedSalary) missingFields.push("Expected Salary");
  if (!hasNoticePeriod) missingFields.push("Notice Period");
  for (const q of customQuestions) {
    if (!customAnswers[q]) {
      missingFields.push(q);
    }
  }
  
  const formattedMissingFields = missingFields.map(f => `• ${f}`).join("\n");

  let body = "";
  if (job.followUpInitialTemplate) {
    const configRow = await ctx.db.query("appSettings")
      .withIndex("by_key", (q: any) => q.eq("key", "system"))
      .first();
    const companyName = configRow?.brandName || "our company";

    body = job.followUpInitialTemplate
      .replace(/{candidate_name}/g, candidate.fullName || "there")
      .replace(/{job_title}/g, job.title || "the role")
      .replace(/{missing_fields}/g, formattedMissingFields)
      .replace(/{company_name}/g, companyName);
  } else {
    body = [
      `Hi ${candidate.fullName || "there"},`,
      `We're still waiting on the following to progress your application for **${job.title}**:`,
      formattedMissingFields,
      `Please share these at your earliest convenience. Thank you!`,
    ].join("\n\n");
  }

  const now = Date.now();

  // Create WhatsApp communication record
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
    sequenceDay: 0,
  });

  // Create Email communication record (pending — will be sent via Graph)
  const emailCommId = await ctx.db.insert("communications", {
    candidateId: app.candidateId,
    jobId: app.jobId,
    applicationId: app._id,
    direction: "outbound",
    channel: "email",
    subject: `Action Required: Missing info for your ${job.title} application`,
    body,
    deliveryStatus: "pending",
    sentAt: now,
    stoppedSequence: false,
    sequenceDay: 0,
  });

  // Persist stage clock and mark day0Done
  const followUpState = app.followUpState;
  await ctx.db.patch(app._id, {
    followUpEnteredAt: app.followUpEnteredAt ?? now,
    followUpState: {
      lastContactDay: 0,
      firstChannelUsed: followUpState?.firstChannelUsed ?? "whatsapp",
    },
  });

  // Schedule the actual WhatsApp delivery
  await ctx.scheduler.runAfter(0, internal.communications.whatsappOutbound.sendWhatsApp, {
    communicationId: commId,
    candidateId: app.candidateId,
    jobId: app.jobId,
    body,
  });

  // Schedule the actual Email delivery via Microsoft Graph
  const recruiter = await ctx.db.get(job.primaryRecruiterId);
  const taEmail = recruiter?.email;
  const candidateEmail = candidate.email;

  if (taEmail && candidateEmail) {
    const htmlBody = body.replace(/\n/g, "<br>");
    await ctx.scheduler.runAfter(0, internal.communications.graphEmail.sendGraphEmail, {
      communicationId: emailCommId,
      candidateJobId: app._id as string,
      taEmail,
      toAddress: candidateEmail,
      subject: `Action Required: Missing info for your ${job.title} application`,
      bodyHtml: htmlBody,
    });
  } else {
    console.warn(
      `[Follow-up Outreach] Skipped email: taEmail=${taEmail ?? "missing"}, candidateEmail=${candidateEmail ?? "missing"}`
    );
    // Mark the email comm as failed if we can't send it
    await ctx.db.patch(emailCommId, {
      deliveryStatus: "failed",
      errorMessage: !taEmail
        ? "Recruiter has no email configured"
        : "Candidate has no email address",
    });
  }

  console.log(`[Follow-up Outreach] Day 0 WhatsApp & Email outreach scheduled for application ${applicationId}`);
  return commId;
}

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { getOpenAI, getModelForTask } from "../lib/llm";
import { buildStructuredEmailHtml } from "./emailHtml";

export const extractDetailsFromText = internalAction({
  args: {
    candidateId: v.id("candidates"),
    textBody: v.string(),
    channel: v.optional(v.string()),
    inboxEmail: v.optional(v.string()),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Guard: skip extraction if text is empty or trivially short
    if (!args.textBody || args.textBody.trim().length < 3) {
      console.warn(`[Inbound Extraction] Skipping extraction — text body is empty or trivial: "${args.textBody}"`);
      return;
    }

    console.log(`[Inbound Extraction] Starting extraction for candidate ${args.candidateId} (channel: ${args.channel || "whatsapp"}). Text: "${args.textBody.substring(0, 200)}"`);

    const activeApp = await ctx.runQuery(api.candidates.candidates.getActiveFollowUpApplication, {
      candidateId: args.candidateId,
    });

    if (!activeApp) {
      console.log(`[Inbound Extraction] Candidate ${args.candidateId} has no active follow-up application. Skipping details update.`);
      return;
    }

    const job = await ctx.runQuery(api.jobs.jobs.getJob, { jobId: activeApp.jobId });
    if (!job) {
      console.error(`[Inbound Extraction] Job ${activeApp.jobId} not found.`);
      return;
    }

    const candidate = await ctx.runQuery(api.candidates.candidates.getCandidate, { id: args.candidateId });

    const missingFields: string[] = [];
    const hasCV = activeApp.followUpCvReceived === true || !!candidate?.cvUploadId;
    const hasCurrentSalary = activeApp.followUpCurrentSalary === true || candidate?.currentSalary !== undefined;
    const hasExpectedSalary = activeApp.followUpExpectedSalary === true || candidate?.expectedSalary !== undefined;
    const hasNoticePeriod = activeApp.followUpNoticePeriod === true || candidate?.noticePeriodDays !== undefined;

    if (!hasCV) missingFields.push("CV Document");
    if (!hasCurrentSalary) missingFields.push("Current Salary");
    if (!hasExpectedSalary) missingFields.push("Expected Salary");
    if (!hasNoticePeriod) missingFields.push("Notice Period");

    const customQuestions = job.customFollowUpQuestions || [];
    const answeredCustomQuestions = activeApp.customFollowUpAnswers || {};
    for (const q of customQuestions) {
      if (!answeredCustomQuestions[q]) missingFields.push(q);
    }

    const openai = getOpenAI("email_auto_reply");
    const model = getModelForTask("email_auto_reply");

    const systemPrompt = `You are an AI recruitment assistant for Career141 managing candidate follow-ups.
Currently, before reading this message, these details are missing from candidate profile:
MISSING DETAILS BEFORE THIS MESSAGE: ${missingFields.join(", ")}

To understand the TA's tone, look at their templates:
INITIAL OUTREACH TEMPLATE:
"${(job.followUpInitialTemplate || 'Hi, please provide your missing details.').substring(0, 300)}"

SAMPLE FOLLOW-UP TEMPLATE:
"${(job.followUpSampleTemplate || 'Just checking in on the missing details. Please provide them at your earliest convenience.').substring(0, 300)}"

Your job is to analyze the candidate's chat message and output a JSON object.
Rules:
1. Extract the missing numeric/text details if provided in the candidate's message.
2. Determine if the candidate provided ALL remaining missing details in this message, PARTIAL details, an ETA (e.g., in an hour, tonight, tomorrow, next week), a question, or declined.
3. If an ETA is promised, estimate 'candidateEtaMinutes' (numeric minutes from now until candidate promised to reply).
4. CRITICAL RULE FOR nextActionMessage:
   - Calculate which fields are STILL missing AFTER accounting for the details provided in THIS candidate message.
   - If the candidate provided a field in THIS message (e.g., they gave Expected Salary), DO NOT ask for that field again!
   - If ALL missing details are now satisfied, set intent to 'provided_all' and nextActionMessage to null.
   - If 'provided_partial', ask ONLY for the REMAINING fields that are STILL missing.
   - If 'interested_no_eta', explicitly ask them "by what time could you provide these details?".
   - If 'asked_question', answer their question logically using job context while pivoting back to ask ONLY for the remaining missing details.
   - If 'provided_all' or 'not_interested', set nextActionMessage to null.
5. 'nextActionTimeHours': Set to candidateEtaMinutes/60 if ETA given. Set to 24 for the default 24-hour fallback nudge if 'provided_partial', 'asked_question', or 'interested_no_eta'. Set to null if 'provided_all' or 'not_interested'.
6. 'detectedQuestion': If candidate asked any question/inquiry in their message, analyze and categorize it into category ('salary_compensation' | 'visa_sponsorship' | 'location_remote' | 'notice_start_date' | 'tech_stack' | 'client_details' | 'general_inquiry') and importanceLevel ('high' | 'medium' | 'low').

Return ONLY a valid JSON object matching this schema. Do not add markdown formatting or backticks.
Schema:
{
  "currentSalary": number | null,
  "expectedSalary": number | null,
  "noticePeriodDays": number | null,
  "noticePeriod": string | null,
  "customAnswers": { [question: string]: string } | null,
  "intent": "provided_all" | "provided_partial" | "interested_no_eta" | "promised_eta" | "asked_question" | "not_interested",
  "candidateEtaMinutes": number | null,
  "nextActionTimeHours": number | null,
  "nextActionMessage": string | null,
  "detectedQuestion": {
    "hasQuestion": boolean,
    "questionText": string | null,
    "category": "salary_compensation" | "visa_sponsorship" | "location_remote" | "notice_start_date" | "tech_stack" | "client_details" | "general_inquiry" | null,
    "importanceLevel": "high" | "medium" | "low" | null
  } | null
}
If a field is not mentioned, return null for it. Do not invent or infer values.`;

    let completion = null;
    let attempts = 0;
    while (attempts < 3) {
      try {
        attempts++;
        completion = await openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: args.textBody },
          ],
          temperature: 0.1,
        });
        if (completion) break;
      } catch (llmErr: any) {
        console.warn(`[Inbound Extraction] Attempt ${attempts} LLM error: ${llmErr.message}`);
        if (attempts >= 3) throw llmErr;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    try {
      const responseText = completion?.choices[0]?.message?.content?.trim() || "";
      console.log(`[Inbound Extraction] Raw DeepSeek response: "${responseText}"`);

      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const extracted = JSON.parse(cleanJson);

      // Check 72-hour ETA Ceiling Safeguard
      const etaMins = typeof extracted.candidateEtaMinutes === "number" && extracted.candidateEtaMinutes > 0 ? extracted.candidateEtaMinutes : null;
      const MAX_ETA_MINS = 72 * 60; // 72 hours ceiling

      if (etaMins && etaMins > MAX_ETA_MINS) {
        console.log(`[Inbound Extraction] Candidate ${args.candidateId} promised ETA of ${etaMins} mins (>72h). Flagging for TA review and pausing automated nudges.`);
        await ctx.runMutation(internal.communications.followUpMutations.flagForTaReview, {
          applicationId: activeApp._id,
          reason: `Candidate promised long ETA (${Math.round(etaMins / 60)} hours > 72h max ceiling)`,
        });
        return;
      }

      const updates: Record<string, any> = {};
      if (typeof extracted.currentSalary === "number") updates.currentSalary = extracted.currentSalary;
      if (typeof extracted.expectedSalary === "number") updates.expectedSalary = extracted.expectedSalary;
      
      if (typeof extracted.noticePeriodDays === "number") {
        updates.noticePeriodDays = extracted.noticePeriodDays;
        updates.noticePeriod = `${extracted.noticePeriodDays} Days`;
      } else if (typeof extracted.noticePeriod === "string" && extracted.noticePeriod.trim() !== "") {
        updates.noticePeriod = extracted.noticePeriod;
        let numDays = parseInt(extracted.noticePeriod.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(numDays) && numDays > 0) {
          if (extracted.noticePeriod.toLowerCase().includes("month")) numDays *= 30;
          if (extracted.noticePeriod.toLowerCase().includes("week")) numDays *= 7;
          updates.noticePeriodDays = numDays;
        }
      }
      
      let finalCustomAnswers = undefined;
      if (extracted.customAnswers && Object.keys(extracted.customAnswers).length > 0) {
        finalCustomAnswers = { ...(activeApp.customFollowUpAnswers || {}), ...extracted.customAnswers };
        updates.customFollowUpAnswers = finalCustomAnswers;
      }

      // Candidate Inquiry placement (executed STRICTLY AFTER AI Analysis)
      try {
        const dq = extracted.detectedQuestion;
        const textLower = args.textBody.toLowerCase();
        const hasQuestion = dq?.hasQuestion === true || extracted.intent === "asked_question" || args.textBody.includes("?") ||
          textLower.includes("visa") || textLower.includes("remote") || textLower.includes("salary") || textLower.includes("relocat");

        if (hasQuestion) {
          let category: "salary_compensation" | "visa_sponsorship" | "location_remote" | "notice_start_date" | "tech_stack" | "client_details" | "general_inquiry" = dq?.category || "general_inquiry";
          let importanceLevel: "high" | "medium" | "low" = dq?.importanceLevel || "medium";

          if (!dq?.category) {
            if (textLower.includes("visa") || textLower.includes("sponsor")) {
              category = "visa_sponsorship";
              importanceLevel = "high";
            } else if (textLower.includes("salary") || textLower.includes("pay") || textLower.includes("compensation") || textLower.includes("package")) {
              category = "salary_compensation";
              importanceLevel = "high";
            } else if (textLower.includes("remote") || textLower.includes("location") || textLower.includes("office") || textLower.includes("relocat")) {
              category = "location_remote";
              importanceLevel = "high";
            } else if (textLower.includes("notice") || textLower.includes("start") || textLower.includes("join")) {
              category = "notice_start_date";
              importanceLevel = "medium";
            } else if (textLower.includes("tech") || textLower.includes("stack") || textLower.includes("framework")) {
              category = "tech_stack";
              importanceLevel = "medium";
            } else if (textLower.includes("client") || textLower.includes("company")) {
              category = "client_details";
              importanceLevel = "medium";
            }
          }

          await ctx.runMutation(internal.communications.inquiries.createInquiry, {
            candidateId: args.candidateId,
            applicationId: activeApp._id,
            jobId: activeApp.jobId,
            channel: "whatsapp",
            questionText: dq?.questionText || args.textBody,
            category,
            importanceLevel,
            aiAutoReplyText: extracted.nextActionMessage || undefined,
            status: extracted.nextActionMessage ? "answered_by_ai" : "unresolved",
          });
          console.log(`[Inbound Extraction] Placed post-analysis candidate inquiry (${category}, ${importanceLevel}) for candidate ${args.candidateId}`);
        }
      } catch (inqErr: any) {
        console.warn("[Inbound Extraction] Non-blocking inquiry logging error (safely swallowed):", inqErr.message || inqErr);
      }

      const hasUpdates = Object.keys(updates).length > 0 || extracted.cvReceived === true;
      const isQuestion = extracted.intent === "asked_question" && typeof extracted.nextActionMessage === "string" && extracted.nextActionMessage.trim() !== "";

      if (hasUpdates || isQuestion) {
        if (hasUpdates) {
          console.log(`[Inbound Extraction] Extracted updates for candidate ${args.candidateId}:`, updates);
          await ctx.runMutation(api.candidates.candidates.updateCandidateDetails, {
            candidateId: args.candidateId,
            applicationId: activeApp._id,
            ...updates,
          });
        }

        // Re-fetch updated application and candidate data post-update
        const updatedCandidate = await ctx.runQuery(api.candidates.candidates.getCandidate, { id: args.candidateId });
        const updatedApp = await ctx.runQuery(api.candidates.candidates.getActiveFollowUpApplication, { candidateId: args.candidateId });

        const isNoticePeriodPresent = updatedApp?.followUpNoticePeriod || updatedCandidate?.noticePeriodDays !== undefined || (updatedCandidate?.noticePeriod !== undefined && updatedCandidate?.noticePeriod !== "");

        // Determine if application is now complete or advanced
        const isCompleted = !updatedApp || updatedApp.currentStage === "second_shortlist" || (
          (updatedApp?.followUpCvReceived || updatedCandidate?.cvUploadId) &&
          (updatedApp?.followUpCurrentSalary || updatedCandidate?.currentSalary !== undefined) &&
          (updatedApp?.followUpExpectedSalary || updatedCandidate?.expectedSalary !== undefined) &&
          isNoticePeriodPresent
        );

        let replyMessage: string | null = null;
        let aiAnswer: string | null = null;

        // Acknowledge the details that were successfully recorded in this reply
        const recordedDetails: string[] = [];
        if (typeof updates.currentSalary === "number") recordedDetails.push(`Current Salary: ${updates.currentSalary}`);
        if (typeof updates.expectedSalary === "number") recordedDetails.push(`Expected Salary: ${updates.expectedSalary}`);
        if (updates.noticePeriod) recordedDetails.push(`Notice Period: ${updates.noticePeriod}`);
        else if (typeof updates.noticePeriodDays === "number") recordedDetails.push(`Notice Period: ${updates.noticePeriodDays} days`);

        // Fields still missing after this reply (plain names, used in the rich HTML card)
        const appRecord = updatedApp || activeApp;
        const remainingMissing: string[] = [];
        if (!appRecord.followUpCvReceived && !updatedCandidate?.cvUploadId) remainingMissing.push("CV Document");
        if (!appRecord.followUpCurrentSalary && updatedCandidate?.currentSalary === undefined) remainingMissing.push("Current Salary");
        if (!appRecord.followUpExpectedSalary && updatedCandidate?.expectedSalary === undefined) remainingMissing.push("Expected Salary");
        if (!appRecord.followUpNoticePeriod && updatedCandidate?.noticePeriodDays === undefined && (!updatedCandidate?.noticePeriod || updatedCandidate?.noticePeriod === "")) remainingMissing.push("Notice Period");
        for (const q of customQuestions) {
          const ans = appRecord.customFollowUpAnswers || {};
          if (!ans[q]) remainingMissing.push(q);
        }

        const preludeText =
          isCompleted
            ? `Great news! We have received all your application details for *${job.title}* and your profile is now 100% complete. Your application has been advanced to Second Shortlist.`
            : isQuestion
              ? `Thank you for your message regarding your application for *${job.title}*.`
              : `Thank you! We have recorded your update for *${job.title}*:`;

        if (isCompleted) {
          replyMessage = `Thank you ${updatedCandidate?.fullName || "there"}! We have received all your application details for *${job.title}*. Your profile is now 100% complete and has been advanced to Second Shortlist!`;
        } else if (isQuestion) {
          aiAnswer = extracted.nextActionMessage;
          replyMessage = extracted.nextActionMessage;
        } else if (remainingMissing.length > 0) {
          replyMessage = `Hi ${updatedCandidate?.fullName || "there"},\n\n${preludeText}\n\nWe are still waiting on the following to progress your application:\n\n${remainingMissing.map(m => `• ${m}`).join("\n")}\n\nPlease share these at your earliest convenience. Thank you!`;
        }

        if (replyMessage) {
          const hours = typeof extracted.nextActionTimeHours === "number" && extracted.nextActionTimeHours > 0 ? extracted.nextActionTimeHours : 24;
          await ctx.runMutation(internal.communications.followUpMutations.scheduleDynamicFollowUp, {
            applicationId: activeApp._id,
            nextActionTimeHours: hours,
            messageBody: replyMessage,
          });

          // Build the structured rich HTML rendering for the email channel
          const replyHtml = buildStructuredEmailHtml({
            candidateName: updatedCandidate?.fullName || "there",
            jobTitle: job.title,
            prelude: preludeText,
            aiAnswer,
            recordedDetails: recordedDetails.length > 0 ? recordedDetails : undefined,
            remainingMissing: remainingMissing.length > 0 ? remainingMissing : undefined,
          });

          // Send immediate reply over the originating channel (Email or WhatsApp)
          if (args.channel === "email") {
            const senderBox = args.inboxEmail || process.env.MS_SENDER_EMAIL || process.env.OUTBOUND_EMAIL_SENDER || "job@career141.com";
            const commId = await ctx.runMutation(internal.communications.emailAgent.createOutboundEmailRecord, {
              candidateId: args.candidateId,
              applicationId: activeApp._id,
              jobId: activeApp.jobId,
              subject: `Re: Application for ${job.title}`,
              body: replyMessage,
            });

            if (args.messageId) {
              await ctx.scheduler.runAfter(0, internal.communications.graphEmail.replyToMessage, {
                taEmail: senderBox,
                messageId: args.messageId,
                replyText: replyMessage,
                replyHtml,
              });
            } else {
              await ctx.scheduler.runAfter(0, internal.communications.graphEmail.sendGraphEmail, {
                communicationId: commId,
                candidateJobId: activeApp._id,
                taEmail: senderBox,
                toAddress: updatedCandidate?.email || candidate?.email || "",
                subject: `Re: Application for ${job.title}`,
                bodyHtml: replyHtml,
              });
            }
            console.log(`[Inbound Extraction] Dispatched immediate post-update EMAIL response to candidate ${args.candidateId}`);
          } else {
            const commId = await ctx.runMutation(internal.communications.whatsappOutbound.recordLocalWhatsappOutbound, {
              candidateId: args.candidateId,
              applicationId: activeApp._id,
              jobId: activeApp.jobId,
              body: replyMessage,
            });

            await ctx.scheduler.runAfter(0, internal.communications.whatsappOutbound.sendWhatsApp, {
              communicationId: commId,
              candidateId: args.candidateId,
              jobId: activeApp.jobId,
              body: replyMessage,
            });
            console.log(`[Inbound Extraction] Dispatched immediate post-update WHATSAPP response to candidate ${args.candidateId}`);
          }
        }
      } else {
        console.log(`[Inbound Extraction] No new updates extracted from message for candidate ${args.candidateId}. Suppressing duplicate reply loop.`);
      }

    } catch (err: any) {
      console.warn("[Inbound Extraction] Fail-open: Error during DeepSeek details extraction:", err.message);
      try {
        const fallbackHours = 24;
        const fallbackMsg = `Thank you! We've received your update regarding your *${job.title}* application. Please share any remaining details at your earliest convenience.`;
        await ctx.runMutation(internal.communications.followUpMutations.scheduleDynamicFollowUp, {
          applicationId: activeApp._id,
          nextActionTimeHours: fallbackHours,
          messageBody: fallbackMsg,
        });
      } catch (fallbackErr: any) {
        console.error("[Inbound Extraction] Fail-open fallback error:", fallbackErr.message);
      }
    }
  },
});

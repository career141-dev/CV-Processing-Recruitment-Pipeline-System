import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

export const sendMetaTemplate = internalAction({
  args: {
    applicationId: v.id("applications"),
    templateType: v.union(v.literal("initial_outreach"), v.literal("reengagement")),
  },
  handler: async (ctx, args) => {
    const metaAccessToken = process.env.META_ACCESS_TOKEN;
    if (!metaAccessToken) {
      console.error("[Meta Template Sender] META_ACCESS_TOKEN env variable is not set.");
      throw new Error("META_ACCESS_TOKEN is missing");
    }

    // 1. Fetch application, candidate, and job directly via internal queries
    const app = await ctx.runQuery(internal.communications.metaTemplateSender.getApplicationById, { applicationId: args.applicationId });
    if (!app) {
      throw new Error(`Application ${args.applicationId} not found`);
    }

    const candidate = await ctx.runQuery(internal.communications.metaTemplateSender.getCandidateById, { candidateId: app.candidateId });
    if (!candidate) {
      throw new Error(`Candidate ${app.candidateId} not found`);
    }

    const job = await ctx.runQuery(internal.communications.metaTemplateSender.getJobById, { jobId: app.jobId });
    if (!job) {
      throw new Error(`Job ${app.jobId} not found`);
    }

    // 2. Resolve the sender phone number and phone_number_id
    const outboundNumber = await ctx.runQuery(internal.communications.whatsappOutbound.getJobOutboundWhatsAppNumber, { jobId: app.jobId });
    let phoneId = process.env.WHATCHIMP_PHONE_NUMBER_ID || "965783109962872";
    if (outboundNumber) {
      const fetchedId = await ctx.runQuery(internal.communications.whatsappOutbound.getWhatChimpPhoneId, {
        targetWhatsAppNumber: outboundNumber,
      });
      if (fetchedId) {
        phoneId = fetchedId;
      }
    }

    // Clean destination phone number digits
    const cleanRecipientPhone = candidate.phone ? candidate.phone.replace(/\D/g, "") : "";
    if (!cleanRecipientPhone) {
      throw new Error(`Candidate ${candidate.fullName} has no valid phone number`);
    }

    // 3. Construct parameters and text representations based on template type
    let templateName = "";
    let parameters: any[] = [];
    let loggedBody = "";

    const candidateName = candidate.fullName || "Candidate";
    const jobTitle = job.title || "the role";

    if (args.templateType === "initial_outreach") {
      templateName = "career141_initial_outreach";

      // Build missing fields bullet list
      const missingList: string[] = [];
      const hasCV = app.followUpCvReceived === true || !!candidate.cvUploadId || !!app.cvFileId;
      const hasCurrentSalary = app.followUpCurrentSalary === true || candidate.currentSalary !== undefined;
      const hasExpectedSalary = app.followUpExpectedSalary === true || candidate.expectedSalary !== undefined;
      const hasNoticePeriod = app.followUpNoticePeriod === true || candidate.noticePeriodDays !== undefined;

      if (!hasCV) missingList.push("• CV / Resume");
      if (!hasCurrentSalary) missingList.push("• Current Salary");
      if (!hasExpectedSalary) missingList.push("• Expected Salary");
      if (!hasNoticePeriod) missingList.push("• Notice Period");

      const customQuestions = job.customFollowUpQuestions || [];
      const customAnswers = app.customFollowUpAnswers || {};
      for (const q of customQuestions) {
        if (!customAnswers[q]) missingList.push(`• ${q}`);
      }

      const missingFormatted = missingList.join("\n") || "• None (all submitted)";

      // Requirements snippet (max 200 chars)
      let requirementsSnippet = job.jobDescription || "";
      if (requirementsSnippet.length > 200) {
        requirementsSnippet = requirementsSnippet.substring(0, 197) + "...";
      }

      parameters = [
        { type: "text", text: candidateName },
        { type: "text", text: jobTitle },
        { type: "text", text: requirementsSnippet },
        { type: "text", text: missingFormatted },
      ];

      loggedBody = `Hi ${candidateName}, Thank you for your interest in the *${jobTitle}* role.\n\nBefore we can proceed with your application, please review the role requirements below:\n${requirementsSnippet}\n\nTo complete your application, we still require the following information:\n${missingFormatted}\n\nPlease reply directly to this chat with the requested details. Once we receive them, we'll continue with the next step of the recruitment process. Thank you!`;
    } else {
      templateName = "career141_followup_reminder";

      parameters = [
        { type: "text", text: candidateName },
        { type: "text", text: jobTitle },
      ];

      loggedBody = `Hi ${candidateName}, we're still looking forward to progressing your application for the *${jobTitle}* role at Career141.\n\nWe just need a few details from you to move things forward. Could you please reply to this message at your earliest convenience?\n\nWe'd love to keep you in the process! 😊`;
    }

    console.log(`[Meta Template Sender] Dispatching template "${templateName}" to target phone +${cleanRecipientPhone} using phone_number_id ${phoneId}`);

    // 4. Send request to Meta Cloud API
    const metaUrl = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to: cleanRecipientPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: parameters,
          },
        ],
      },
    };

    let sentSuccess = false;
    let errorMessage = "";

    try {
      const response = await fetch(metaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${metaAccessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      if (response.ok) {
        const responseData = JSON.parse(responseText);
        if (responseData.messages && responseData.messages.length > 0) {
          sentSuccess = true;
          console.log(`[Meta Template Sender] Successfully sent template message. Meta Msg ID: ${responseData.messages[0].id}`);
        } else {
          errorMessage = `Response payload missing message ID: ${responseText}`;
        }
      } else {
        errorMessage = `HTTP ${response.status}: ${responseText}`;
        console.error(`[Meta Template Sender] Meta API returned failure: ${errorMessage}`);
      }
    } catch (err: any) {
      errorMessage = err.message || String(err);
      console.error(`[Meta Template Sender] HTTP request failed: ${errorMessage}`);
    }

    // 5. Record the message in communications history
    await ctx.runMutation(internal.communications.metaTemplateSender.logTemplateCommunication, {
      applicationId: app._id,
      candidateId: app.candidateId,
      jobId: app.jobId,
      body: loggedBody,
      status: sentSuccess ? "sent" : "failed",
      error: errorMessage || undefined,
    });

    if (!sentSuccess) {
      throw new Error(`Failed to send WhatsApp Meta Template: ${errorMessage}`);
    }

    return { success: true };
  },
});

export const logTemplateCommunication = internalMutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    body: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("communications", {
      candidateId: args.candidateId,
      applicationId: args.applicationId,
      jobId: args.jobId,
      direction: "outbound",
      channel: "whatsapp",
      subject: args.status === "sent" ? "WhatsApp Template Outreach Sent" : "WhatsApp Template Outreach Failed",
      body: args.body,
      deliveryStatus: args.status === "sent" ? "sent" : "failed",
      errorMessage: args.error,
      sentAt: Date.now(),
      stoppedSequence: false,
    });
  },
});

// Internal query helpers — used by sendMetaTemplate action to load db records
import { internalQuery } from "../_generated/server";

export const getApplicationById = internalQuery({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.applicationId);
  },
});

export const getCandidateById = internalQuery({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.candidateId);
  },
});

export const getJobById = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

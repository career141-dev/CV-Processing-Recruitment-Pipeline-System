import { action, internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

// ----------------------------------------------------------------------------------
// STUBBED HELPER FUNCTIONS 
// (To be implemented when Microsoft Graph / AWS SES are configured)
// ----------------------------------------------------------------------------------
async function fetchUnreadEmails(inboxEmail: string) {
  console.log(`[Email Mock] Fetching unread emails for ${inboxEmail}`);
  return []; // Return empty array for now
}

async function markEmailAsRead(inboxEmail: string, messageId: string) {
  console.log(`[Email Mock] Marked message ${messageId} as read in ${inboxEmail}`);
}

async function sendConfirmationEmail(toEmail: string, jobId: string) {
  console.log(`[Email Mock] Sent confirmation email to ${toEmail} for job ${jobId}`);
}
// ----------------------------------------------------------------------------------

// Runs as a scheduled Convex action — polls email every 2 minutes
export const pollEmailInbox = action({
  args: { 
    inboxEmail: v.string(), 
    jobId: v.id("jobs") 
  },
  handler: async (ctx, { inboxEmail, jobId }) => {
    // 1. Fetch unread emails
    const messages = await fetchUnreadEmails(inboxEmail);
    
    for (const message of messages as any[]) {
      // 2. Find CV attachment
      const attachment = message.attachments?.find(
        (a: any) =>
          a.contentType?.includes("pdf") ||
          a.name?.endsWith(".docx") ||
          a.name?.endsWith(".pdf")
      );
      
      if (!attachment) {
        const senderEmail = message.from?.emailAddress?.address;
        if (senderEmail) {
          const checkResult = await ctx.runMutation(internal.communications.emailAgent.checkAndRecordEmailReply, {
            senderEmail,
            subject: message.subject ?? "",
            body: message.body ?? message.subject ?? "",
          });
          if (checkResult && checkResult.isFollowUpReply) {
            await markEmailAsRead(inboxEmail, message.id);
            continue;
          }
        }
        continue; // No CV attachment and not a follow-up reply — skip
      }

      const fileBuffer = Buffer.from(attachment.contentBytes, "base64");
      
      // Hash the file
      const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
      const fileHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      // Store in Convex Storage natively
      const fileBlob = new Blob([fileBuffer], { type: attachment.contentType || "application/pdf" });
      const storageId = await ctx.storage.store(fileBlob);

      // For LinkedIn shared inbox: extract keyword from subject
      let resolvedJobId = jobId;
      if (inboxEmail === process.env.LINKEDIN_SHARED_INBOX) {
        const subject = message.subject ?? "";
        const keywordMatch = subject.match(/\b([A-Z]{2,8}\d{2,6})\b/);
        
        if (keywordMatch) {
          const job = await ctx.runQuery(api.jobs.getByKeyword, { keyword: keywordMatch[1] });
          if (job) resolvedJobId = job._id;
        }
      }

      // 3. Process ingestion
      await ctx.runMutation(api.pipeline.ingestion.processCvIngestion, {
        jobId: resolvedJobId,
        sourceChannel: inboxEmail === process.env.LINKEDIN_SHARED_INBOX ? "linkedin" : "email_campaign",
        rawSender: message.from?.emailAddress?.address,
        storageId: storageId,
        fileHash: fileHash,
        fileName: attachment.name ?? "cv.pdf",
        fileType: attachment.contentType || "application/pdf",
        fileSizeBytes: fileBuffer.length,
      });

      // 4. Mark as read & reply
      await markEmailAsRead(inboxEmail, message.id);
      await sendConfirmationEmail(message.from?.emailAddress?.address, resolvedJobId);
    }
  },
});

// Schedule this action to run every 2 minutes for all active email channels
export const scheduleEmailPolling = internalAction({
  args: {},
  handler: async (ctx) => {
    // We would need an api.jobChannels.getActiveEmailChannels query here
    // For now, this is just the scaffolding as requested
    console.log("[Email Mock] Polling active email channels...");
    
    /*
    const activeChannels = await ctx.runQuery(api.jobChannels.getActiveEmailChannels);
    for (const channel of activeChannels) {
      await ctx.runAction(api.emailAgent.pollEmailInbox, {
        inboxEmail: channel.emailInbox,
        jobId: channel.jobId,
      });
    }
    */
  },
});

export const checkAndRecordEmailReply = internalMutation({
  args: {
    senderEmail: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.db
      .query("candidates")
      .withIndex("by_email", (q: any) => q.eq("email", args.senderEmail))
      .first();

    if (!candidate) return { isFollowUpReply: false };

    const activeApp = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidate._id))
      .filter((q: any) => q.eq(q.field("currentStage"), "follow_up"))
      .first();

    if (!activeApp) return { isFollowUpReply: false };

    await ctx.db.insert("communications", {
      candidateId: candidate._id,
      applicationId: activeApp._id,
      jobId: activeApp.jobId,
      direction: "inbound",
      channel: "email",
      subject: args.subject,
      body: args.body,
      deliveryStatus: "read",
      sentAt: Date.now(),
      stoppedSequence: false,
    });

    // Run text extraction in background to parse details
    await ctx.scheduler.runAfter(0, internal.communications.inboundExtraction.extractDetailsFromText, {
      candidateId: candidate._id,
      textBody: args.body,
    });

    return { isFollowUpReply: true };
  },
});

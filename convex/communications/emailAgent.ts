import { action, internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { getOpenAI, getModelForTask } from "../lib/llm";


// ----------------------------------------------------------------------------------
// MICROSOFT GRAPH API IMPLEMENTATION
// ----------------------------------------------------------------------------------

async function getGraphToken(): Promise<string | null> {
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.log("[EmailAgent] Missing Microsoft Graph API credentials in environment variables.");
    return null;
  }

  try {
    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        scope: "https://graph.microsoft.com/.default",
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      console.error("[EmailAgent] Failed to fetch Graph token:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("[EmailAgent] Error fetching Graph token:", error);
    return null;
  }
}

async function fetchUnreadEmails(inboxEmail: string) {
  const token = await getGraphToken();
  if (!token) return [];

  console.log(`[EmailAgent] Fetching unread emails for ${inboxEmail}`);
  try {
    const url = `https://graph.microsoft.com/v1.0/users/${inboxEmail}/mailFolders/inbox/messages?$filter=isRead eq false&$expand=attachments&$select=id,subject,body,from,attachments`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error("[EmailAgent] Failed to fetch emails:", await response.text());
      return [];
    }

    const data = await response.json();
    return data.value || [];
  } catch (error) {
    console.error("[EmailAgent] Error fetching emails:", error);
    return [];
  }
}

async function markEmailAsRead(inboxEmail: string, messageId: string) {
  const token = await getGraphToken();
  if (!token) return;

  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${inboxEmail}/messages/${messageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isRead: true }),
    });

    if (!response.ok) {
      console.error(`[EmailAgent] Failed to mark message ${messageId} as read:`, await response.text());
    } else {
      console.log(`[EmailAgent] Marked message ${messageId} as read in ${inboxEmail}`);
    }
  } catch (error) {
    console.error(`[EmailAgent] Error marking message ${messageId} as read:`, error);
  }
}

async function sendConfirmationEmail(toEmail: string, jobId: string) {
  // Can be implemented using Graph API sendMail endpoint if needed
  console.log(`[Email Mock] Sent confirmation email to ${toEmail} for job ${jobId}`);
}
// ----------------------------------------------------------------------------------


// Runs as a scheduled Convex action — polls email every 2 minutes
export const pollEmailInbox = action({
  args: { 
    inboxEmail: v.string(), 
    jobId: v.optional(v.id("jobs")) 
  },
  handler: async (ctx, { inboxEmail, jobId }) => {
    // 1. Fetch unread emails
    const messages = await fetchUnreadEmails(inboxEmail);
    if ((messages as any[]).length > 0) {
      console.log(`[EmailAgent] Found ${(messages as any[]).length} unread messages.`);
    } else {
      console.log(`[EmailAgent] No unread messages found.`);
    }
    
    for (const message of messages as any[]) {
      console.log(`[EmailAgent] Processing message: ${message.subject} from ${message.from?.emailAddress?.address}`);
      if (message.attachments && message.attachments.length > 0) {
        console.log(`[EmailAgent] Attachments found:`, message.attachments.map((a: any) => `${a.name} (${a.contentType})`));
      } else {
        console.log(`[EmailAgent] No attachments found on message.`);
      }
      
      // 2. Find CV attachment
      const attachment = message.attachments?.find(
        (a: any) =>
          a.contentType?.includes("pdf") ||
          a.name?.toLowerCase().endsWith(".docx") ||
          a.name?.toLowerCase().endsWith(".pdf")
      );
      
      if (!attachment) {
        const senderEmail = message.from?.emailAddress?.address;
        if (senderEmail) {
          const checkResult = await ctx.runMutation(internal.communications.emailAgent.checkAndRecordEmailReply, {
            senderEmail,
            subject: message.subject ?? "",
            body: ((typeof message.body === "object" && message.body !== null) ? (message.body.content || "") : (message.body || "")) || message.subject || "",
          });
          if (checkResult && checkResult.isFollowUpReply) {
            await markEmailAsRead(inboxEmail, message.id);
            continue;
          }
        }
        console.log(`[EmailAgent] Skipping message: ${message.subject} - No CV attachment and not a follow-up reply.`);
        continue; // No CV attachment and not a follow-up reply — skip
      }
      
      console.log(`[EmailAgent] Found CV attachment: ${attachment.name} (${attachment.contentType})`);

      const binaryString = atob(attachment.contentBytes);
      const fileBuffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileBuffer[i] = binaryString.charCodeAt(i);
      }
      
      // Hash the file
      const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
      const fileHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      // Store in Convex Storage natively
      const fileBlob = new Blob([fileBuffer], { type: attachment.contentType || "application/pdf" });
      const storageId = await ctx.storage.store(fileBlob);


      // Intelligent Email Routing via LLM
      let resolvedJobId = jobId;
      
      const subject = message.subject ?? "";
      const body = (typeof message.body === "object" && message.body !== null) ? (message.body.content || "") : (message.body || "");
      
      const isCommonInbox = inboxEmail.toLowerCase() === "cv@career141.com";

      if (isCommonInbox) {
        console.log("[EmailAgent] Processing common inbox cv@career141.com. Bypassing job matching.");
        resolvedJobId = undefined;
      } else {
        // Fetch active jobs for LLM to evaluate
        const activeJobs = await ctx.runQuery(api.jobs.jobs.getActiveJobsBasicInfo);
        
        if (!resolvedJobId && activeJobs.length > 0) {
          try {
            const openai = getOpenAI("email_routing");
            const model = getModelForTask("email_routing");
            
            const jobsListContext = activeJobs.map(j => `- ID: ${j._id} | Title: ${j.title} | Client: ${j.clientName} | Keyword: ${j.keyword}`).join("\\n");
            
            const prompt = `You are an intelligent recruitment email router.
Your task is to analyze an incoming email (subject and body) from a candidate and determine which active job they are applying for.

ACTIVE JOBS:
${jobsListContext}

EMAIL SUBJECT: ${subject}
EMAIL BODY: ${body.substring(0, 2000) /* limit length for context */}

Respond ONLY with a valid JSON object in this exact format:
{
  "matchedJobId": "string ID of the matched job, or null if absolutely no match could be determined"
}`;

            const completion = await openai.chat.completions.create({
              model: model,
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" },
              temperature: 0.1,
            });
            
            const resultStr = completion.choices[0]?.message?.content;
            if (resultStr) {
              const resultObj = JSON.parse(resultStr);
              if (resultObj.matchedJobId) {
                // Verify the ID actually exists in our active jobs
                const isValid = activeJobs.some(j => j._id === resultObj.matchedJobId);
                if (isValid) {
                  resolvedJobId = resultObj.matchedJobId;
                  console.log(`[EmailAgent] AI successfully routed email to job: ${resolvedJobId}`);
                }
              }
            }
          } catch (error) {
            console.error("[EmailAgent] LLM routing failed", error);
          }
        }
        
        // If we couldn't resolve a job ID via LLM and no jobId was provided to the cron, use the first active job as fallback
        if (!resolvedJobId && activeJobs.length > 0) {
          resolvedJobId = activeJobs[0]._id;
          console.log(`[EmailAgent] No jobId found, falling back to first active job: ${resolvedJobId}`);
        }

        if (!resolvedJobId) {
          console.error("[EmailAgent] Could not determine a jobId for the email and no active jobs exist to use as fallback.");
          continue;
        }
      }

      // 3. Process ingestion
      await ctx.runMutation(api.pipeline.ingestion.processCvIngestion, {
        jobId: resolvedJobId || undefined,
        sourceChannel: (inboxEmail === process.env.LINKEDIN_SHARED_INBOX || inboxEmail.toLowerCase() === "sanjeev@career141.com") ? "linkedin" : "email_campaign",
        rawSender: message.from?.emailAddress?.address,
        storageId: storageId,
        fileHash: fileHash,
        fileName: attachment.name ?? "cv.pdf",
        fileType: attachment.contentType || "application/pdf",
        fileSizeBytes: fileBuffer.length,
      });

      // 4. Mark as read & reply
      await markEmailAsRead(inboxEmail, message.id);
      if (resolvedJobId) {
        await sendConfirmationEmail(message.from?.emailAddress?.address, resolvedJobId);
      } else {
        console.log(`[Email Mock] Sent generic confirmation email to ${message.from?.emailAddress?.address} for general application pool.`);
      }
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

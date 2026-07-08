import { action, internalAction, internalMutation, query, internalQuery } from "../_generated/server";
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
    const targetInboxEmail = process.env.MS_SENDER_EMAIL || process.env.MICROSOFT_SENDER_EMAIL || inboxEmail;
    console.log(`[EmailAgent] Polling inbox: ${targetInboxEmail} (requested inbox parameter: ${inboxEmail})`);
    
    // 1. Fetch unread emails
    const messages = await fetchUnreadEmails(targetInboxEmail);
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

      const senderEmail = message.from?.emailAddress?.address;
      const subject = message.subject ?? "";
      const emailBody = ((typeof message.body === "object" && message.body !== null) 
        ? (message.body.content || "") 
        : (message.body || "")) || message.subject || "";

      // 2. Find CV attachment (including .doc, .docx, .pdf)
      const attachment = message.attachments?.find(
        (a: any) =>
          a.contentType?.includes("pdf") ||
          a.contentType?.includes("msword") ||
          a.contentType?.includes("officedocument.wordprocessingml") ||
          a.name?.endsWith(".docx") ||
          a.name?.endsWith(".doc") ||
          a.name?.endsWith(".pdf")
      );
      
      let isReplyProcessed = false;
      let isCandidateMatched = false;

      // Check if it's a follow-up reply
      if (senderEmail) {
        const checkResult = await ctx.runMutation(internal.communications.emailAgent.checkAndRecordEmailReply, {
          senderEmail,
          subject,
          body: emailBody,
        });

        if (checkResult) {
          isCandidateMatched = !!checkResult.isCandidateMatched;

          if (checkResult.isFollowUpReply) {
            // Trigger automatic AI reply email
            await ctx.scheduler.runAfter(0, internal.communications.emailAgent.generateAndSendAiEmailReply, {
              inboxEmail: targetInboxEmail,
              messageId: message.id,
              candidateId: checkResult.candidateId as any,
              jobId: checkResult.jobId as any,
              applicationId: checkResult.applicationId as any,
              incomingBody: emailBody,
            });
            isReplyProcessed = true;
          }
        }
      }

      if (!attachment) {
        if (isReplyProcessed || isCandidateMatched) {
          await markEmailAsRead(targetInboxEmail, message.id);
          continue;
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
      
      const isCommonInbox = targetInboxEmail.toLowerCase() === "cv@career141.com" || inboxEmail.toLowerCase() === "cv@career141.com";

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
            
            const jobsListContext = activeJobs.map(j => `- ID: ${j._id} | Title: ${j.title} | Client: ${j.clientName} | Keyword: ${j.keyword}`).join("\n");
            
            const prompt = `You are an intelligent recruitment email router.
Your task is to analyze an incoming email (subject and body) from a candidate and determine which active job they are applying for.

ACTIVE JOBS:
${jobsListContext}

EMAIL SUBJECT: ${subject}
EMAIL BODY: ${emailBody.substring(0, 2000) /* limit length for context */}

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

      // Process CV ingestion
      await ctx.runMutation(api.pipeline.ingestion.processCvIngestion, {
        jobId: resolvedJobId || undefined,
        sourceChannel: (targetInboxEmail === process.env.LINKEDIN_SHARED_INBOX || targetInboxEmail.toLowerCase() === "sanjeev@career141.com") ? "linkedin" : "email_campaign",
        rawSender: message.from?.emailAddress?.address,
        storageId: storageId,
        fileHash: fileHash,
        fileName: attachment.name ?? "cv.pdf",
        fileType: attachment.contentType || "application/pdf",
        fileSizeBytes: fileBuffer.length,
      });

      // Extract details from the email text body (salary, expected salary, notice period)
      if (senderEmail) {
        await ctx.scheduler.runAfter(0, internal.communications.emailAgent.extractAndApplyEmailBodyDetails, {
          senderEmail,
          emailBody,
        });
      }

      // Mark as read & reply
      await markEmailAsRead(targetInboxEmail, message.id);
      if (!isReplyProcessed) {
        if (resolvedJobId) {
          await sendConfirmationEmail(message.from?.emailAddress?.address, resolvedJobId);
        } else {
          console.log(`[Email Mock] Sent generic confirmation email to ${message.from?.emailAddress?.address} for general application pool.`);
        }
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
    let targetEmail = args.senderEmail;
    const isTestMode = process.env.EMAIL_TEST_MODE === "true";
    const testRecipient = process.env.EMAIL_TEST_RECIPIENT;

    if (isTestMode && testRecipient && args.senderEmail.toLowerCase() === testRecipient.toLowerCase()) {
      const lastOutbound = await ctx.db
        .query("communications")
        .filter((q: any) => 
          q.and(
            q.eq(q.field("direction"), "outbound"),
            q.eq(q.field("channel"), "email")
          )
        )
        .order("desc")
        .first();

      if (lastOutbound) {
        const testCandidate = await ctx.db.get(lastOutbound.candidateId);
        if (testCandidate && testCandidate.email) {
          targetEmail = testCandidate.email;
          console.log(`[EmailAgent Test Mode] Mapped test sender ${args.senderEmail} to actual candidate email: ${targetEmail}`);
        }
      }
    }

    const candidate = await ctx.db
      .query("candidates")
      .withIndex("by_email", (q: any) => q.eq("email", targetEmail))
      .first();

    if (!candidate) return { isFollowUpReply: false, isCandidateMatched: false };

    const activeApp = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidate._id))
      .order("desc")
      .first();

    await ctx.db.insert("communications", {
      candidateId: candidate._id,
      applicationId: activeApp?._id,
      jobId: activeApp?.jobId,
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

    const isFollowUp = activeApp?.currentStage === "follow_up";

    return {
      isCandidateMatched: true,
      isFollowUpReply: isFollowUp,
      candidateId: candidate._id,
      applicationId: activeApp?._id,
      jobId: activeApp?.jobId,
    };
  },
});

export const generateAndSendAiEmailReply = internalAction({
  args: {
    inboxEmail: v.string(),
    messageId: v.string(),
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    applicationId: v.id("applications"),
    incomingBody: v.string(),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.runQuery(api.candidates.candidates.getCandidate, {
      id: args.candidateId,
    });
    const job = await ctx.runQuery(api.jobs.jobs.getJob, {
      jobId: args.jobId,
    });
    const app = await ctx.runQuery(api.applications.applications.getApplication, {
      id: args.applicationId,
    });

    if (!candidate || !job || !app) {
      console.error("[EmailAgent AI Reply] Missing candidate, job, or application context.");
      return;
    }

    const hasCV = !!candidate.cvUploadId || !!app.cvFileId || app.followUpCvReceived;
    const hasCurrentSalary = candidate.currentSalary !== undefined || app.followUpCurrentSalary;
    const hasExpectedSalary = candidate.expectedSalary !== undefined || app.followUpExpectedSalary;
    const hasNoticePeriod = candidate.noticePeriodDays !== undefined || app.followUpNoticePeriod;

    const missingFields = [];
    if (!hasCV) missingFields.push("updated CV/resume file");
    if (!hasCurrentSalary) missingFields.push("current salary");
    if (!hasExpectedSalary) missingFields.push("expected salary");
    if (!hasNoticePeriod) missingFields.push("notice period");

    let systemPrompt = `You are an AI recruitment assistant for Career141, a premium recruitment agency.
You are communicating with a candidate via email regarding their application for the job: "${job.title}".
Keep your email response:
1. Warm, professional, and polite.
2. Concise (2-3 short paragraphs max).
3. Say "Thank you" for their response/message.
4. Address their email queries naturally.
5. If they still have missing details that we need to proceed, politely remind them to provide those details.
   Here are the fields we are still waiting for: ${missingFields.join(", ") || "None (all details captured!)"}.
Do not mention database fields, variables, or system internals. Write the email body only.`;

    const openai = getOpenAI("jd_matching");
    const model = getModelForTask("jd_matching");

    console.log(`[EmailAgent AI Reply] Generating LLM response for candidate ${candidate.fullName}...`);
    const completion = await openai.chat.completions.create({
      model: model || "meta/llama-3.1-70b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Incoming email body from candidate: "${args.incomingBody}"` },
      ],
      temperature: 0.5,
    });

    const replyText = completion.choices[0]?.message?.content?.trim() || "Thank you for your message. We have received it and will get back to you shortly.";
    console.log(`[EmailAgent AI Reply] Generated reply: "${replyText.slice(0, 100)}..."`);

    const commId = await ctx.runMutation(internal.communications.emailAgent.createOutboundEmailRecord, {
      candidateId: args.candidateId,
      applicationId: args.applicationId,
      jobId: args.jobId,
      subject: `Re: Application for ${job.title}`,
      body: replyText,
    });

    console.log(`[EmailAgent AI Reply] Dispatching reply through Microsoft Graph to ${candidate.email}...`);
    await ctx.runAction(internal.communications.graphEmail.replyToMessage, {
      taEmail: args.inboxEmail,
      messageId: args.messageId,
      replyText: replyText,
    });

    await ctx.runMutation(internal.communications.emailAgent.markOutboundEmailAsSent, {
      communicationId: commId,
    });
  },
});

export const createOutboundEmailRecord = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    applicationId: v.id("applications"),
    jobId: v.id("jobs"),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("communications", {
      candidateId: args.candidateId,
      applicationId: args.applicationId,
      jobId: args.jobId,
      direction: "outbound",
      channel: "email",
      subject: args.subject,
      body: args.body,
      deliveryStatus: "pending",
      sentAt: Date.now(),
      stoppedSequence: false,
    });
  },
});

export const markOutboundEmailAsSent = internalMutation({
  args: {
    communicationId: v.id("communications"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.communicationId, {
      deliveryStatus: "sent",
    });
  },
});

export const getLastOutboundEmailCommunication = internalQuery({
  args: {},
  handler: async (ctx: any) => {
    const lastOutbound = await ctx.db
      .query("communications")
      .filter((q: any) => 
        q.and(
          q.eq(q.field("direction"), "outbound"),
          q.eq(q.field("channel"), "email")
        )
      )
      .order("desc")
      .first();

    if (!lastOutbound) return null;
    
    const candidate = await ctx.db.get(lastOutbound.candidateId);
    return {
      candidateId: lastOutbound.candidateId,
      candidateEmail: candidate?.email,
    };
  }
});

export const extractAndApplyEmailBodyDetails = internalAction({
  args: {
    senderEmail: v.string(),
    emailBody: v.string(),
  },
  handler: async (ctx, args) => {
    let lookupEmail = args.senderEmail;
    const isTestMode = process.env.EMAIL_TEST_MODE === "true";
    const testRecipient = process.env.EMAIL_TEST_RECIPIENT;

    if (isTestMode && testRecipient && args.senderEmail.toLowerCase() === testRecipient.toLowerCase()) {
      const lastOutbound = await ctx.runQuery(internal.communications.emailAgent.getLastOutboundEmailCommunication);
      if (lastOutbound && lastOutbound.candidateEmail) {
        lookupEmail = lastOutbound.candidateEmail;
      }
    }

    let candidate = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      candidate = await ctx.runQuery(api.candidates.candidates.getCandidateByEmail, {
        email: lookupEmail,
      });
      if (candidate) break;
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    if (!candidate) {
      console.warn(`[Email Agent Inbound Details] Candidate not found for email: ${lookupEmail}`);
      return;
    }

    await ctx.runAction(internal.communications.inboundExtraction.extractDetailsFromText, {
      candidateId: candidate._id,
      textBody: args.emailBody,
    });
  },
});

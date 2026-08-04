import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { getOpenAI, getModelForTask } from "../lib/llm";

export const extractDetailsFromText = internalAction({
  args: {
    candidateId: v.id("candidates"),
    textBody: v.string(),
  },
  handler: async (ctx, args) => {
    const activeApp = await ctx.runQuery(api.candidates.candidates.getActiveFollowUpApplication, {
      candidateId: args.candidateId,
    });

    if (!activeApp) {
      console.log(`[Inbound Extraction] Candidate ${args.candidateId} is not in follow_up stage. Skipping details update.`);
      return;
    }

    const job = await ctx.runQuery(api.jobs.jobs.getJob, { jobId: activeApp.jobId });
    if (!job) {
      console.error(`[Inbound Extraction] Job ${activeApp.jobId} not found.`);
      return;
    }

    const missingFields: string[] = [];
    if (!activeApp.followUpCurrentSalary) missingFields.push("Current Salary");
    if (!activeApp.followUpExpectedSalary) missingFields.push("Expected Salary");
    if (!activeApp.followUpNoticePeriod) missingFields.push("Notice Period");
    if (!activeApp.followUpCvReceived) missingFields.push("CV Document");

    const customQuestions = job.customFollowUpQuestions || [];
    const answeredCustomQuestions = activeApp.customFollowUpAnswers || {};
    for (const q of customQuestions) {
      if (!answeredCustomQuestions[q]) missingFields.push(q);
    }

    const openai = getOpenAI("jd_extraction");
    const model = getModelForTask("jd_extraction");

    const systemPrompt = `You are an AI recruitment assistant for Career141 managing candidate follow-ups.
The Talent Acquisition (TA) team wants you to collect these missing details from the candidate:
MISSING DETAILS: ${missingFields.join(", ")}

To understand the TA's tone, look at their templates:
INITIAL OUTREACH TEMPLATE:
"${(job.followUpInitialTemplate || 'Hi, please provide your missing details.').substring(0, 300)}"

SAMPLE FOLLOW-UP TEMPLATE:
"${(job.followUpSampleTemplate || 'Just checking in on the missing details. Please provide them at your earliest convenience.').substring(0, 300)}"

Your job is to analyze the candidate's chat message and output a JSON object.
Rules:
1. Extract the missing numeric details if provided.
2. Determine the candidate's 'intent' (e.g., 'provided_all', 'provided_partial', 'interested_no_eta', 'provided_eta', 'asked_question', 'not_interested').
3. 'nextActionTimeHours': If they provide an ETA (e.g., "this evening"), calculate roughly how many hours from now that is. If they are interested but give no ETA, set it to 3. If they provide all details or are not interested, set it to null.
4. 'nextActionMessage': Draft the exact next message to send to the candidate. 
   - Match the TA's tone from the templates.
   - If 'provided_partial', ask ONLY for the remaining missing fields.
   - If 'interested_no_eta', explicitly ask them "by what time could you provide these details?".
   - If 'asked_question', answer their question logically while pivoting back to ask for the missing details.
   - If 'provided_all' or 'not_interested', leave nextActionMessage as null.

Return ONLY a valid JSON object matching this schema. Do not add any markdown formatting, code block backticks, or other text.
Schema:
{
  "currentSalary": number | null,
  "expectedSalary": number | null,
  "noticePeriodDays": number | null,
  "noticePeriod": string | null,
  "customAnswers": { [question: string]: string } | null,
  "intent": "provided_all" | "provided_partial" | "interested_no_eta" | "provided_eta" | "asked_question" | "not_interested",
  "nextActionTimeHours": number | null,
  "nextActionMessage": string | null
}
If a field is not mentioned, return null for it. Do not invent or infer values.`;

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: args.textBody },
        ],
        temperature: 0.1,
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || "";
      console.log(`[Inbound Extraction] Raw response: "${responseText}"`);

      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const extracted = JSON.parse(cleanJson);

      const updates: Record<string, any> = {};
      if (typeof extracted.currentSalary === "number") updates.currentSalary = extracted.currentSalary;
      if (typeof extracted.expectedSalary === "number") updates.expectedSalary = extracted.expectedSalary;
      if (typeof extracted.noticePeriodDays === "number") updates.noticePeriodDays = extracted.noticePeriodDays;
      if (typeof extracted.noticePeriod === "string") updates.noticePeriod = extracted.noticePeriod;
      
      let finalCustomAnswers = undefined;
      if (extracted.customAnswers && Object.keys(extracted.customAnswers).length > 0) {
        finalCustomAnswers = { ...(activeApp.customFollowUpAnswers || {}), ...extracted.customAnswers };
        updates.customFollowUpAnswers = finalCustomAnswers;
      }

      if (Object.keys(updates).length > 0) {
        console.log(`[Inbound Extraction] Extracted updates for candidate ${args.candidateId}:`, updates);
        await ctx.runMutation(api.candidates.candidates.updateCandidateDetails, {
          candidateId: args.candidateId,
          applicationId: activeApp._id,
          ...updates,
        });
      }

      // Schedule or send the next follow-up message if the AI drafted one
      if (extracted.nextActionMessage) {
        const hours = typeof extracted.nextActionTimeHours === "number" ? extracted.nextActionTimeHours : 0;
        await ctx.runMutation(internal.communications.followUpMutations.scheduleDynamicFollowUp, {
          applicationId: activeApp._id,
          nextActionTimeHours: hours,
          messageBody: extracted.nextActionMessage,
        });

        if (hours <= 0) {
          // Create outbound comm and send immediate WhatsApp reply
          const commId = await ctx.runMutation(internal.communications.whatsappOutbound.recordLocalWhatsappOutbound, {
            candidateId: args.candidateId,
            applicationId: activeApp._id,
            jobId: activeApp.jobId,
            body: extracted.nextActionMessage,
          });

          await ctx.scheduler.runAfter(0, internal.communications.whatsappOutbound.sendWhatsApp, {
            communicationId: commId,
            candidateId: args.candidateId,
            jobId: activeApp.jobId,
            body: extracted.nextActionMessage,
          });
          console.log(`[Inbound Extraction] Dispatched immediate AI response to candidate ${args.candidateId}`);
        }
      }

    } catch (err: any) {
      console.error("[Inbound Extraction] Error during LLM details extraction:", err.message);
    }
  },
});

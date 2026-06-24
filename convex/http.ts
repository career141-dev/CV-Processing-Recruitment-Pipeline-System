import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { handleWhatsappWebhook } from "./communications/whatsappAgent";


const http = httpRouter();

// Twilio WhatsApp Webhook
http.route({
  path: "/api/twilio/whatsapp",
  method: "POST",
  handler: handleWhatsappWebhook,
});

// A simple REST endpoint to test Job Creation via Postman
http.route({
  path: "/api/test-job",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      // Look up a fallback user to assign as the recruiter for this test
      const defaultUser = await ctx.runQuery(api.users.getTeamMembers);
      if (!defaultUser || defaultUser.length === 0) {
        return new Response(JSON.stringify({ 
          error: "No users found in database. Please log in via the UI at least once to create a user." 
        }), { status: 400 });
      }

      // Step 1: Create Job
      const { jobId, keyword } = await ctx.runMutation(api.jobs.createJob, {
        title: body.title || "Postman API Tester",
        clientName: body.clientName || "API Inc.",
        clientIndustry: body.clientIndustry || "Technology",
        recruitmentType: "both",
        isConfidential: false,
        jobDescription: body.jobDescription || "Test description generated via Postman REST request.",
        requiredSkills: body.requiredSkills || ["Postman", "REST APIs"],
        niceToHaveSkills: ["GraphQL", "Convex"],
        seniorityLevel: "mid_level",
        experienceMinYears: 3,
        experienceMaxYears: 5,
        location: "Remote",
        salaryMin: 50000,
        salaryMax: 90000,
        salaryCurrency: "USD",
        primaryRecruiterId: defaultUser[0]._id as any,
      });

      // Step 2: Update Channels
      await ctx.runMutation(api.jobs.updateJobChannels, {
        jobId,
        channels: body.channels || [
          {
            channelType: "whatsapp",
            isEnabled: true,
            whatsappNumber: "+1234567890",
          },
          {
            channelType: "email",
            isEnabled: true,
            emailInbox: "postman@career141.com",
          }
        ]
      });

      // Step 3: Update AI Config
      await ctx.runMutation(api.jobs.updateJobAiConfig, {
        jobId,
        minMatchScoreToShow: body.aiConfig?.minMatchScoreToShow ?? 60,
        reverseMatchOnPublish: body.aiConfig?.reverseMatchOnPublish ?? true,
        scoreWeightSkills: 40,
        scoreWeightExperience: 30,
        scoreWeightJobTitle: 15,
        scoreWeightIndustry: 10,
        scoreWeightLocation: 5,
        agent3Enabled: true,
        agent3Day2Channel: "email",
        agent3Day7Channel: "whatsapp",
        agent3AfterDay7: "trigger_agent5",
        agent5Enabled: true,
        agent5Trigger: "all_new_applicants",
        agent5CallScript: "default",
        agent5CustomQuestions: ["What is your notice period?"],
        agent5NoAnswerAction: "trigger_agent3",
        agent5HideCompany: false,
        directorReviewEnabled: false,
        clientReviewEnabled: false,
        clientAccessLevel: "view_only",
        esaCheckEnabled: true,
        rejectionLoopAction: "restart_from_new_cvs",
        slaNoNewCvsDays: 5,
        slaTaReviewDays: 2,
        slaAiCallDays: 1,
        slaSecondShortlistDays: 2,
        slaDirectorReviewDays: 3,
        slaClientReviewDays: 5,
        slaEsaDays: 3,
        slaInterviewDays: 3,
        slaOfferDays: 2,
      });

      // Step 4: Publish Job instantly for this test
      await ctx.runMutation(api.jobs.publishJob, { jobId });

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Job successfully created and published via Postman!",
        jobId, 
        keyword 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;

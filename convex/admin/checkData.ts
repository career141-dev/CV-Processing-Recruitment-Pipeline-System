import { query } from "../_generated/server";
export const checkDb = query({
  handler: async (ctx) => {
    const cvUploads = await ctx.db.query("cvUploads").collect();
    const candidates = await ctx.db.query("candidates").collect();

    // Explicitly check for lingering heavy fields
    let candidatesWithRawText = 0;
    let candidatesWithEmbedding = 0;
    for (const c of candidates) {
      if ((c as any).rawText !== undefined) candidatesWithRawText++;
      if ((c as any).embedding !== undefined) candidatesWithEmbedding++;
    }

    const noCand = cvUploads.filter(u => !u.candidateId).length;

    // Group cvUploads by candidateId
    const groups: Record<string, number> = {};
    for (const u of cvUploads) {
      if (u.candidateId) {
        groups[u.candidateId] = (groups[u.candidateId] || 0) + 1;
      }
    }
    const maxGroup = Math.max(...Object.values(groups), 0);
    const maxGroupCandidateId = Object.keys(groups).find(k => groups[k] === maxGroup);

    let maxCandidateDetails = null;
    if (maxGroupCandidateId) {
      maxCandidateDetails = await ctx.db.get(maxGroupCandidateId as any);
    }

    return {
      totalCvUploads: cvUploads.length,
      totalCandidates: candidates.length,
      candidatesWithRawText,
      candidatesWithEmbedding,
      cvUploadsWithoutCandidate: noCand,
      maxCvUploadsForOneCandidate: maxGroup,
      maxCandidateDetails,
    };
  }
});

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

export const createProductManagerJob = mutation({
  handler: async (ctx) => {
    // 1. Get a recruiter (admin) ID
    const user = await ctx.db.query("users").first();
    if (!user) throw new Error("No user found to act as recruiter");

    // 2. Create Job
    const jobId = await ctx.db.insert("jobs", {
      title: "Product Manager – Patient Payments & RCM Platforms",
      clientName: "Leading International Technology Solutions Provider",
      clientIndustry: "IT / Software Development / Cloud Technology",
      recruitmentType: "both",
      isConfidential: false,
      jobDescription: "Company: Career141 (20 Years of Excellence)\n\nRequirements:\n* 5+ years of experience in Product Management (SaaS, Fintech, Healthcare, or Payments).\n* Technical SaaS expertise with APIs and system integrations.\n* Proven track record of driving KPIs and business outcomes.\n* Strong stakeholder management and cross-functional communication skills.\n* Experience with US Healthcare RCM and EHR/PMS integrations.\n* Exposure to payment platforms such as Stripe, Square, or similar.\n\nContact Information:\nTalent Acquisition (TA):\n* Email: zainab.f@career141.com\n* Mobile: +94 76 87 83 739",
      requiredSkills: ["Product Management", "SaaS", "APIs", "Stakeholder Management"],
      seniorityLevel: "mid_level",
      experienceMinYears: 5,
      location: "Remote",
      salaryMin: 1800,
      salaryMax: 2300,
      salaryCurrency: "USD",
      primaryRecruiterId: user._id,
      status: "active",
      keyword: "Product Manager", // Forced exact keyword
      scoreWeightSkills: 35,
      scoreWeightExperience: 15,
      scoreWeightJobTitle: 30,
      scoreWeightIndustry: 15,
      scoreWeightLocation: 5,
      minMatchScoreToShow: 60,
      reverseMatchOnPublish: false,
      agent3Enabled: true,
      agent3AfterDay7: "mark_unresponsive",
      agent5Enabled: false,
      agent5Trigger: "manual_only",
      agent5CallScript: "default",
      agent5NoAnswerAction: "notify_ta",
      agent5HideCompany: false,
      directorReviewEnabled: false,
      clientReviewEnabled: false,
      esaCheckEnabled: false,
      rejectionLoopAction: "restart_from_new_cvs",
      headhuntingEnabled: false,
      slaNoNewCvsDays: 5,
      slaTaReviewDays: 2,
      slaAiCallDays: 1,
      slaSecondShortlistDays: 2,
      slaDirectorReviewDays: 3,
      slaEsaDays: 3,
      slaClientReviewDays: 5,
      slaInterviewDays: 3,
      slaOfferDays: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    });

    // 3. Create only WhatsApp Channel
    await ctx.db.insert("jobChannels", {
      jobId: jobId,
      channelType: "whatsapp",
      isEnabled: true,
      whatsappNumber: "+94742197476",
      agentStatus: "active",
      cvCountToday: 0,
      cvCountTotal: 0,
      createdAt: new Date().toISOString(),
      configuredSourceLevel2: "WhatsApp Campaign — Product Manager",
    });

    // Generate assets mapping
    await ctx.db.insert("job_assets", {
      jobId: jobId,
      whatsappDeepLink: `https://wa.me/94742197476?text=Product Manager`,
      shortApplyLink: `career141.com/apply/Product Manager`,
      metaAdLink: `https://wa.me/94742197476?text=Product Manager`,
      linkedinIntakeEmail: "linkedin@career141.com",
      generatedFromChannelHash: "manual_override",
      generatedAt: new Date().toISOString(),
    });

    return { jobId, keyword: "Product Manager" };
  }
});
export const checkJobChannels = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobChannels")
      .withIndex("by_job", q => q.eq("jobId", args.jobId))
      .collect();
  }
});

export const muteTechLeadJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, { muteDefaultWhatsappReply: true });
    return "Muted AI for job";
  }
});

export const checkJobApps = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_job_active", q => q.eq("jobId", args.jobId).eq("isActive", true))
      .collect();
    return apps.map(a => ({
      _id: a._id,
      candidateId: a.candidateId,
      candidateName: a.candidateName,
      currentStage: a.currentStage,
      sourceChannel: a.sourceChannel,
      aiMatchScore: a.aiMatchScore,
      isActive: a.isActive,
      _creationTime: a._creationTime,
    }));
  }
});

export const pauseAllExceptWhatsapp = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      pausedChannels: ["linkedin", "email", "email_campaign", "headhunting", "workable"],
    });
    return "Paused all non-WhatsApp channels for this job";
  }
});

export const removeNonWhatsappApps = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_job_active", q => q.eq("jobId", args.jobId).eq("isActive", true))
      .collect();
    
    let removed = 0;
    for (const app of apps) {
      if (app.sourceChannel !== "whatsapp") {
        await ctx.db.patch(app._id, { isActive: false });
        removed++;
      }
    }
    return `Deactivated ${removed} non-WhatsApp applications from PM job`;
  }
});

export const createJuniorSeniorHRJob = mutation({
  handler: async (ctx) => {
    const user = await ctx.db.query("users").first();
    if (!user) throw new Error("No user found to act as recruiter");

    // 1. Create Job — pausedChannels set from day 1 to block all non-WhatsApp sources
    const jobId = await ctx.db.insert("jobs", {
      title: "Senior Executive – Talent Acquisition",
      clientName: "Career141",
      clientIndustry: "Recruitment / Executive Search",
      recruitmentType: "both",
      isConfidential: false,
      jobDescription: `COMPANY: Career141 - Executive Search

DESIGNATION: Executive Search Consultant
(Should possess a network of 500 – 5,000 LinkedIn connections)

PACKAGE: Attractive Monthly Remuneration + Quarterly Incentive (Rs. 150,000 – Rs. 500,000) + Yearly Bonus (Based on performance)

WORK: Hybrid & Remote (remote after 3 months of training)

LOCATION: Colombo 04 (Bambalapitiya)

REQUIREMENTS:
* Bachelor's Degree or Professional Qualification in Human Resource Management, Business Management, Marketing, Psychology, or related discipline.
* 3–4 years of proven experience in Talent Acquisition, Executive Search, Recruitment, Human Resources, Customer Service, Marketing, Business Development, Client Servicing, Relationship Management, or similar communication-driven roles.
* Experience using LinkedIn Recruiter, ATS, recruitment technologies, or CRM platforms will be an added advantage.
* Should possess a network of 500 – 5,000 LinkedIn connections.

KEY RESPONSIBILITIES:
* Independently manage end-to-end Executive Search assignments across multiple industries.
* Develop customised search strategies aligned with each client's organisational structure.
* Conduct comprehensive talent mapping across local and international markets.
* Develop and write compelling job descriptions to attract suitable candidates.
* Utilise various sourcing methods to identify potential candidates.
* Facilitate negotiation process between clients and candidates.

Contact: Azeem Ansar, Founder & MD of Career141`,
      requiredSkills: ["Talent Acquisition", "Executive Search", "Recruitment", "LinkedIn Recruiter", "HR"],
      seniorityLevel: "mid_level",
      experienceMinYears: 3,
      location: "Colombo 04, Sri Lanka",
      salaryMin: 150000,
      salaryMax: 500000,
      salaryCurrency: "LKR",
      primaryRecruiterId: user._id,
      status: "active",
      keyword: "Junior HR / Senior HR",
      // ✅ Block all non-WhatsApp channels from day 1 — lesson learned
      pausedChannels: ["linkedin", "email", "email_campaign", "headhunting", "workable"],
      muteDefaultWhatsappReply: true,
      scoreWeightSkills: 35,
      scoreWeightExperience: 15,
      scoreWeightJobTitle: 30,
      scoreWeightIndustry: 15,
      scoreWeightLocation: 5,
      minMatchScoreToShow: 60,
      reverseMatchOnPublish: false,
      agent3Enabled: true,
      agent3AfterDay7: "mark_unresponsive",
      agent5Enabled: false,
      agent5Trigger: "manual_only",
      agent5CallScript: "default",
      agent5NoAnswerAction: "notify_ta",
      agent5HideCompany: false,
      directorReviewEnabled: false,
      clientReviewEnabled: false,
      esaCheckEnabled: false,
      rejectionLoopAction: "restart_from_new_cvs",
      headhuntingEnabled: false,
      slaNoNewCvsDays: 5,
      slaTaReviewDays: 2,
      slaAiCallDays: 1,
      slaSecondShortlistDays: 2,
      slaDirectorReviewDays: 3,
      slaEsaDays: 3,
      slaClientReviewDays: 5,
      slaInterviewDays: 3,
      slaOfferDays: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    });

    // 2. Create WhatsApp Channel only — same number as PM job
    await ctx.db.insert("jobChannels", {
      jobId,
      channelType: "whatsapp",
      isEnabled: true,
      whatsappNumber: "+94742197476",
      agentStatus: "active",
      cvCountToday: 0,
      cvCountTotal: 0,
      createdAt: new Date().toISOString(),
      configuredSourceLevel2: "WhatsApp Campaign — Junior HR / Senior HR",
    });

    // 3. Create job assets
    await ctx.db.insert("job_assets", {
      jobId,
      whatsappDeepLink: `https://wa.me/94742197476?text=Junior HR / Senior HR`,
      shortApplyLink: `career141.com/apply/Junior-HR-Senior-HR`,
      metaAdLink: `https://wa.me/94742197476?text=Junior HR / Senior HR`,
      linkedinIntakeEmail: "linkedin@career141.com",
      generatedFromChannelHash: "manual_override",
      generatedAt: new Date().toISOString(),
    });

    return { jobId, keyword: "Junior HR / Senior HR" };
  }
});

export const createSeniorAISolutionsArchitectJob = mutation({
  handler: async (ctx) => {
    const user = await ctx.db.query("users").first();
    if (!user) throw new Error("No user found to act as recruiter");

    // 1. Create Job — pausedChannels set from day 1 to block all non-WhatsApp sources
    const jobId = await ctx.db.insert("jobs", {
      title: "Senior AI Solutions Architect – U.S. Healthcare RCM Automation",
      clientName: "Leading International Technology Solutions Provider",
      clientIndustry: "IT / Software Development / Cloud Technology",
      recruitmentType: "both",
      isConfidential: false,
      jobDescription: `Company: Career141 (20 Years of Excellence)

Level: Senior Level
Location: India (Remote)

REQUIREMENTS:
* 8+ years of overall IT experience, including 3+ years in U.S. Healthcare Revenue Cycle Management.
* 2+ years designing and deploying Production AI, Generative AI, Agentic AI, or AI Agent solutions.
* Hands-on experience with LLMs, Prompt Engineering, RAG, and AI Orchestration/Agent Frameworks.
* Strong understanding of HIPAA, PHI handling, and Responsible AI principles.

Contact Information:
Talent Acquisition (TA):
Email: Jesmeen@career141.com
Mobile: +94 74 011 0130`,
      requiredSkills: ["U.S. Healthcare RCM", "AI Solutions", "Generative AI", "LLMs", "Prompt Engineering", "RAG", "HIPAA", "Agentic AI"],
      seniorityLevel: "senior_manager",
      experienceMinYears: 8,
      location: "India (Remote)",
      salaryMin: 1800,
      salaryMax: 2300,
      salaryCurrency: "USD",
      primaryRecruiterId: user._id,
      status: "active",
      keyword: "Senior AI Solutions Architect",
      // ✅ Block all non-WhatsApp channels from day 1
      pausedChannels: ["linkedin", "email", "email_campaign", "headhunting", "workable"],
      muteDefaultWhatsappReply: true,
      scoreWeightSkills: 35,
      scoreWeightExperience: 15,
      scoreWeightJobTitle: 30,
      scoreWeightIndustry: 15,
      scoreWeightLocation: 5,
      minMatchScoreToShow: 60,
      reverseMatchOnPublish: false,
      agent3Enabled: true,
      agent3AfterDay7: "mark_unresponsive",
      agent5Enabled: false,
      agent5Trigger: "manual_only",
      agent5CallScript: "default",
      agent5NoAnswerAction: "notify_ta",
      agent5HideCompany: false,
      directorReviewEnabled: false,
      clientReviewEnabled: false,
      esaCheckEnabled: false,
      rejectionLoopAction: "restart_from_new_cvs",
      headhuntingEnabled: false,
      slaNoNewCvsDays: 5,
      slaTaReviewDays: 2,
      slaAiCallDays: 1,
      slaSecondShortlistDays: 2,
      slaDirectorReviewDays: 3,
      slaEsaDays: 3,
      slaClientReviewDays: 5,
      slaInterviewDays: 3,
      slaOfferDays: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    });

    // 2. Create WhatsApp Channel only
    await ctx.db.insert("jobChannels", {
      jobId,
      channelType: "whatsapp",
      isEnabled: true,
      whatsappNumber: "+94742197476",
      agentStatus: "active",
      cvCountToday: 0,
      cvCountTotal: 0,
      createdAt: new Date().toISOString(),
      configuredSourceLevel2: "WhatsApp Campaign — Senior AI Solutions Architect",
    });

    // 3. Create job assets
    await ctx.db.insert("job_assets", {
      jobId,
      whatsappDeepLink: `https://wa.me/94742197476?text=Senior AI Solutions Architect`,
      shortApplyLink: `career141.com/apply/Senior-AI-Solutions-Architect`,
      metaAdLink: `https://wa.me/94742197476?text=Senior AI Solutions Architect`,
      linkedinIntakeEmail: "linkedin@career141.com",
      generatedFromChannelHash: "manual_override",
      generatedAt: new Date().toISOString(),
    });

    return { jobId, keyword: "Senior AI Solutions Architect" };
  }
});

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    fullName: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("director"),
      v.literal("ta"),
      v.literal("ops")
    ),
    avatarUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
    notificationPrefs: v.optional(
      v.object({
        email: v.boolean(),
        whatsapp: v.boolean(),
        inApp: v.boolean(),
      })
    ),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_isActive", ["isActive"]),

  jobs: defineTable({
    title: v.string(),
    clientName: v.string(),
    clientIndustry: v.string(),
    recruitmentType: v.union(v.literal("headhunting"), v.literal("job_posting"), v.literal("both")),
    isConfidential: v.boolean(),
    jobDescription: v.string(),
    requiredSkills: v.array(v.string()),
    niceToHaveSkills: v.optional(v.array(v.string())),
    seniorityLevel: v.union(
      v.literal("executive"),
      v.literal("senior_executive"),
      v.literal("manager"),
      v.literal("senior_manager"),
      v.literal("agm"),
      v.literal("gm"),
      v.literal("director"),
      v.literal("c_suite"),
      v.literal("other")
    ),
    experienceMinYears: v.number(),
    experienceMaxYears: v.optional(v.number()),
    location: v.string(),
    salaryRangeMin: v.optional(v.number()),
    salaryRangeMax: v.optional(v.number()),
    salaryCurrency: v.optional(v.string()),
    educationLevel: v.optional(
      v.union(
        v.literal("any"),
        v.literal("diploma"),
        v.literal("bachelor"),
        v.literal("master"),
        v.literal("phd"),
        v.literal("professional_cert")
      )
    ),
    languagesRequired: v.optional(v.array(v.string())),
    keyword: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("on_hold"),
      v.literal("filled"),
      v.literal("cancelled"),
      v.literal("draft")
    ),
    primaryRecruiterId: v.id("users"),
    directorId: v.optional(v.id("users")),
    clientContactName: v.optional(v.string()),
    clientContactEmail: v.optional(v.string()),
    clientAccessLevel: v.optional(
      v.union(v.literal("view_only"), v.literal("view_comment"), v.literal("approve_reject"))
    ),
    directorReviewEnabled: v.boolean(),
    clientReviewEnabled: v.boolean(),
    esaCheckEnabled: v.boolean(),
    rejectionLoopAction: v.union(
      v.literal("restart_from_new_cvs"),
      v.literal("return_to_client_review"),
      v.literal("ask_ta_each_time")
    ),
    scoreWeightSkills: v.number(),
    scoreWeightExperience: v.number(),
    scoreWeightJobTitle: v.number(),
    scoreWeightIndustry: v.number(),
    scoreWeightLocation: v.number(),
    minMatchScoreToShow: v.number(),
    reverseMatchOnPublish: v.boolean(),
    agent3Enabled: v.boolean(),
    agent3Day2Channel: v.optional(v.union(v.literal("email"), v.literal("whatsapp"), v.literal("sms"))),
    agent3Day4Channel: v.optional(v.union(v.literal("email"), v.literal("whatsapp"), v.literal("sms"))),
    agent3Day7Channel: v.optional(v.union(v.literal("email"), v.literal("whatsapp"), v.literal("sms"))),
    agent3AfterDay7: v.union(v.literal("mark_unresponsive"), v.literal("continue_weekly")),
    agent5Enabled: v.boolean(),
    agent5Trigger: v.union(
      v.literal("all_new_applicants"),
      v.literal("database_matches_70_plus"),
      v.literal("manual_only")
    ),
    agent5CallScript: v.union(v.literal("default"), v.literal("initial_screening"), v.literal("technical_prescreen")),
    agent5CustomQuestions: v.optional(v.array(v.string())),
    agent5NoAnswerAction: v.union(v.literal("trigger_agent3"), v.literal("retry_after_2hrs"), v.literal("notify_ta")),
    agent5HideCompany: v.boolean(),
    slaNoNewCvsDays: v.number(),
    slaTaReviewDays: v.number(),
    slaAiCallDays: v.number(),
    slaSecondShortlistDays: v.number(),
    slaDirectorReviewDays: v.number(),
    slaEsaDays: v.number(),
    slaClientReviewDays: v.number(),
    slaInterviewDays: v.number(),
    slaOfferDays: v.number(),
    headhuntingEnabled: v.boolean(),
    benchmarkProfileUrl: v.optional(v.string()),
    createdAt: v.number(),
    publishedAt: v.optional(v.number()),
    filledAt: v.optional(v.number()),
  })
    .index("by_keyword", ["keyword"])
    .index("by_status", ["status"])
    .index("by_primaryRecruiterId", ["primaryRecruiterId"])
    .index("by_clientName", ["clientName"])
    .index("by_createdAt", ["createdAt"]),

  jobChannels: defineTable({
    jobId: v.id("jobs"),
    channelType: v.union(
      v.literal("whatsapp"),
      v.literal("meta_campaign"),
      v.literal("email_campaign"),
      v.literal("linkedin"),
      v.literal("workable"),
      v.literal("manual_upload"),
      v.literal("headhunting")
    ),
    isEnabled: v.boolean(),
    whatsappNumber: v.optional(v.string()),
    metaCampaignId: v.optional(v.string()),
    emailInbox: v.optional(v.string()),
    workableJobId: v.optional(v.string()),
    lastCvReceivedAt: v.optional(v.number()),
    cvCountToday: v.number(),
    cvCountTotal: v.number(),
    agentStatus: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("error"),
      v.literal("not_configured")
    ),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_jobId", ["jobId"])
    .index("by_type_and_enabled", ["channelType", "isEnabled"])
    .index("by_whatsappNumber", ["whatsappNumber"])
    .index("by_emailInbox", ["emailInbox"])
    .index("by_workableJobId", ["workableJobId"]),

  jobAssets: defineTable({
    jobId: v.id("jobs"),
    whatsappQrUrl: v.optional(v.string()),
    whatsappQrPdfUrl: v.optional(v.string()),
    whatsappDeepLink: v.optional(v.string()),
    shortApplyLink: v.optional(v.string()),
    metaAdLink: v.optional(v.string()),
    emailApplyAddress: v.optional(v.string()),
    linkedinJobTitle: v.optional(v.string()),
    linkedinIntakeEmail: v.string(),
    fullPosterPdfUrl: v.optional(v.string()),
    fullPosterPngUrl: v.optional(v.string()),
    generatedAt: v.number(),
    generatedFromChannelHash: v.string(),
  }).index("by_jobId", ["jobId"]),

  cvUploads: defineTable({
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.float64(),
    fileType: v.string(),
    fileHash: v.optional(v.string()),
    source: v.optional(v.string()),
    campaignLabel: v.optional(v.string()),
    assignToJob: v.optional(v.string()),
    uploadedBy: v.string(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    candidateId: v.optional(v.id("candidates")),
  })
    .index("by_uploadedBy", ["uploadedBy"])
    .index("by_status", ["status"])
    .index("by_fileHash", ["fileHash"]),

  candidates: defineTable({
    // New fields from PDF (kept optional to avoid breaking existing queries)
    fullName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    currentJobTitle: v.optional(v.string()),
    currentEmployer: v.optional(v.string()),
    totalExperienceYears: v.optional(v.number()),
    skills: v.optional(v.array(v.string())),
    educationDegree: v.optional(v.string()),
    educationInstitution: v.optional(v.string()),
    educationYear: v.optional(v.number()),
    certifications: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    expectedSalary: v.optional(v.union(v.number(), v.string())),
    expectedSalaryCurrency: v.optional(v.string()),
    currentSalary: v.optional(v.number()),
    currentSalaryCurrency: v.optional(v.string()),
    noticePeriodDays: v.optional(v.number()),
    availability: v.optional(v.string()),
    firstSourceChannel: v.optional(
      v.union(
        v.literal("whatsapp"),
        v.literal("meta_campaign"),
        v.literal("email_campaign"),
        v.literal("linkedin"),
        v.literal("workable"),
        v.literal("manual_upload"),
        v.literal("headhunting")
      )
    ),
    firstSourceJobId: v.optional(v.id("jobs")),
    firstSeenAt: v.optional(v.number()),
    lastUpdatedAt: v.optional(v.number()),
    parsingConfidence: v.optional(v.any()),
    fieldsNeedingReview: v.optional(v.array(v.string())),
    isDuplicateOf: v.optional(v.id("candidates")),
    mergedInto: v.optional(v.id("candidates")),
    vectorEmbeddingId: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
    rawText: v.optional(v.string()),
    overallStatus: v.optional(
      v.union(v.literal("active"), v.literal("placed"), v.literal("not_available"), v.literal("merged"))
    ),

    // Existing legacy fields to prevent breaking changes
    status: v.optional(v.string()),
    isArchivedLocally: v.optional(v.boolean()),
    currentTitle: v.optional(v.string()),
    seniorityLevel: v.optional(v.string()),
    yearsOfExperience: v.optional(v.float64()),
    industries: v.optional(v.array(v.string())),
    noticePeriod: v.optional(v.string()),
    employmentStatus: v.optional(v.string()),
    education: v.optional(
      v.array(
        v.object({
          degree: v.optional(v.string()),
          institution: v.optional(v.string()),
          year: v.optional(v.float64()),
          field: v.optional(v.string()),
        })
      )
    ),
    workableCandidateId: v.optional(v.string()),
    sourceChannel: v.optional(v.string()),
    fileHash: v.optional(v.string()),
    summary: v.optional(v.string()),
    cvUploadId: v.optional(v.id("cvUploads")),
  })
    .index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_status", ["status"])
    .index("by_workableCandidateId", ["workableCandidateId"])
    .index("by_fullName", ["fullName"])
    .index("by_fileHash", ["fileHash"])
    .index("by_cvUploadId", ["cvUploadId"])
    .index("by_linkedinUrl", ["linkedinUrl"])
    .index("by_overallStatus", ["overallStatus"])
    .index("by_lastUpdatedAt", ["lastUpdatedAt"])
    .searchIndex("search_text", {
      searchField: "rawText",
    })
    .searchIndex("search_skills", {
      searchField: "skills",
    })
    .searchIndex("search_title", {
      searchField: "currentTitle",
    })
    .searchIndex("search_summary", {
      searchField: "summary",
    })
    .vectorIndex("vector_index_candidates", {
      vectorField: "embedding",
      dimensions: 1536,
    }),

  applications: defineTable({
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    cvFileId: v.optional(v.id("cvUploads")),
    sourceChannel: v.union(
      v.literal("whatsapp"),
      v.literal("meta_campaign"),
      v.literal("email_campaign"),
      v.literal("linkedin"),
      v.literal("workable"),
      v.literal("manual_upload"),
      v.literal("headhunting")
    ),
    currentStage: v.union(
      v.literal("new_cvs"),
      v.literal("ta_shortlist"),
      v.literal("ai_call"),
      v.literal("second_shortlist"),
      v.literal("director_review"),
      v.literal("client_review"),
      v.literal("interview"),
      v.literal("offer"),
      v.literal("placed"),
      v.literal("rejected")
    ),
    aiMatchScore: v.optional(v.number()),
    aiMatchExplanation: v.optional(v.string()),
    taShortlistStatus: v.optional(
      v.union(v.literal("pending"), v.literal("shortlisted"), v.literal("rejected"))
    ),
    taShortlistBy: v.optional(v.id("users")),
    taShortlistAt: v.optional(v.number()),
    taRejectionReason: v.optional(v.string()),
    aiCallStatus: v.optional(
      v.union(
        v.literal("not_called"),
        v.literal("scheduled"),
        v.literal("completed"),
        v.literal("no_answer"),
        v.literal("declined"),
        v.literal("failed")
      )
    ),
    aiCallId: v.optional(v.string()),
    secondShortlistStatus: v.optional(
      v.union(v.literal("pending"), v.literal("shortlisted"), v.literal("rejected"))
    ),
    secondShortlistBy: v.optional(v.id("users")),
    secondShortlistAt: v.optional(v.number()),
    secondRejectReason: v.optional(v.string()),
    directorReviewId: v.optional(v.string()),
    clientReviewId: v.optional(v.string()),
    interviewId: v.optional(v.string()),
    offerId: v.optional(v.string()),
    loopIteration: v.number(),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    lastStageChangedAt: v.number(),
  })
    .index("by_job_stage", ["jobId", "currentStage"])
    .index("by_candidateId", ["candidateId"])
    .index("by_job_source", ["jobId", "sourceChannel"])
    .index("by_job_score", ["jobId", "aiMatchScore"])
    .index("by_job_active", ["jobId", "isActive"])
    .index("by_job_stage_changed", ["jobId", "lastStageChangedAt"])
    .index("by_candidate_job", ["candidateId", "jobId"]),

  pipelineEvents: defineTable({
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    eventType: v.union(
      v.literal("stage_change"),
      v.literal("note_added"),
      v.literal("cv_uploaded"),
      v.literal("ai_call_completed"),
      v.literal("message_sent"),
      v.literal("shortlisted"),
      v.literal("rejected"),
      v.literal("loop_restarted")
    ),
    fromStage: v.optional(v.string()),
    toStage: v.optional(v.string()),
    actorType: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
    actorId: v.optional(v.id("users")),
    actorAgent: v.optional(
      v.union(
        v.literal("agent1"),
        v.literal("agent2"),
        v.literal("agent3"),
        v.literal("agent4"),
        v.literal("agent5"),
        v.literal("agent6"),
        v.literal("agent7"),
        v.literal("agent8")
      )
    ),
    notes: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_application_time", ["applicationId", "createdAt"])
    .index("by_candidate_time", ["candidateId", "createdAt"])
    .index("by_job_time", ["jobId", "createdAt"])
    .index("by_event_type", ["eventType"]),

  aiCalls: defineTable({
    candidateId: v.id("candidates"),
    applicationId: v.optional(v.id("applications")),
    jobId: v.id("jobs"),
    triggeredBy: v.optional(v.id("users")),
    triggerType: v.union(
      v.literal("automatic_new_applicant"),
      v.literal("automatic_database_match"),
      v.literal("manual_ta_trigger")
    ),
    callStatus: v.union(
      v.literal("scheduled"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("no_answer"),
      v.literal("failed"),
      v.literal("declined")
    ),
    ivrResponse: v.optional(
      v.union(
        v.literal("pressed_1_interested"),
        v.literal("pressed_2_declined"),
        v.literal("pressed_3_connect_recruiter"),
        v.literal("no_response")
      )
    ),
    callDurationSeconds: v.optional(v.number()),
    recordingUrl: v.optional(v.string()),
    transcript: v.optional(v.string()),
    currentSalary: v.optional(v.number()),
    currentSalaryCurrency: v.optional(v.string()),
    expectedSalary: v.optional(v.number()),
    expectedSalaryCurrency: v.optional(v.string()),
    noticePeriodDays: v.optional(v.number()),
    availability: v.optional(v.string()),
    customQuestionAnswers: v.optional(
      v.array(v.object({ question: v.string(), answer: v.string() }))
    ),
    callScriptUsed: v.union(
      v.literal("default"),
      v.literal("initial_screening"),
      v.literal("technical_prescreen")
    ),
    companyHidden: v.boolean(),
    twilioCallSid: v.optional(v.string()),
    calledAt: v.number(),
    completedAt: v.optional(v.number()),
    followUpTriggered: v.boolean(),
  })
    .index("by_candidate_time", ["candidateId", "calledAt"])
    .index("by_applicationId", ["applicationId"])
    .index("by_job_time", ["jobId", "calledAt"])
    .index("by_callStatus", ["callStatus"]),

  communications: defineTable({
    candidateId: v.id("candidates"),
    applicationId: v.optional(v.id("applications")),
    jobId: v.optional(v.id("jobs")),
    direction: v.union(v.literal("outbound"), v.literal("inbound")),
    channel: v.union(v.literal("email"), v.literal("whatsapp"), v.literal("sms")),
    subject: v.optional(v.string()),
    body: v.string(),
    senderId: v.optional(v.id("users")),
    senderAgent: v.optional(v.union(v.literal("agent3"), v.literal("agent5"), v.literal("system"))),
    sequenceDay: v.optional(v.number()),
    deliveryStatus: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed"),
      v.literal("bounced")
    ),
    openedAt: v.optional(v.number()),
    repliedAt: v.optional(v.number()),
    sentAt: v.number(),
    stoppedSequence: v.boolean(),
    fromCredentials: v.optional(v.string()),
  })
    .index("by_candidate_time", ["candidateId", "sentAt"])
    .index("by_applicationId", ["applicationId"])
    .index("by_channel_time", ["channel", "sentAt"])
    .index("by_app_sequence", ["applicationId", "sequenceDay"]),

  directorReviews: defineTable({
    applicationId: v.id("applications"),
    jobId: v.id("jobs"),
    directorId: v.id("users"),
    decision: v.optional(v.union(v.literal("approved"), v.literal("rejected"), v.literal("request_changes"))),
    feedback: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
    slaBreachAt: v.optional(v.number()),
    slaBreached: v.boolean(),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_jobId", ["jobId"])
    .index("by_directorId", ["directorId"]),

  clientReviews: defineTable({
    applicationId: v.id("applications"),
    jobId: v.id("jobs"),
    decision: v.optional(v.union(v.literal("selected_for_interview"), v.literal("hold"), v.literal("rejected"))),
    clientFeedback: v.optional(v.string()),
    reviewedByName: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
    slaBreachAt: v.optional(v.number()),
    slaBreached: v.boolean(),
    esaVerified: v.boolean(),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_jobId", ["jobId"]),

  interviews: defineTable({
    applicationId: v.id("applications"),
    jobId: v.id("jobs"),
    candidateId: v.id("candidates"),
    interviewType: v.union(v.literal("first_interview"), v.literal("second_interview"), v.literal("final_interview"), v.literal("other")),
    scheduledAt: v.optional(v.number()),
    interviewFormat: v.optional(v.union(v.literal("in_person"), v.literal("video"), v.literal("phone"))),
    panelNames: v.optional(v.string()),
    outcome: v.optional(v.union(v.literal("pending"), v.literal("passed"), v.literal("failed"), v.literal("no_show"), v.literal("rescheduled"))),
    clientRating: v.optional(v.number()),
    clientFeedback: v.optional(v.string()),
    taNotes: v.optional(v.string()),
    coordinatedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_jobId", ["jobId"])
    .index("by_candidateId", ["candidateId"])
    .index("by_coordinatedBy", ["coordinatedBy"]),

  offers: defineTable({
    applicationId: v.id("applications"),
    jobId: v.id("jobs"),
    candidateId: v.id("candidates"),
    offeredSalary: v.number(),
    offeredSalaryCurrency: v.string(),
    offeredStartDate: v.optional(v.string()),
    contractTerms: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined"), v.literal("withdrawn")),
    aiCallConfirmation: v.boolean(),
    candidateResponseAt: v.optional(v.number()),
    taConfirmedAt: v.optional(v.number()),
    createdAt: v.number(),
    loopActionTaken: v.optional(v.union(v.literal("restart_from_new_cvs"), v.literal("return_to_client_review"))),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_jobId", ["jobId"])
    .index("by_candidateId", ["candidateId"]),

  placements: defineTable({
    applicationId: v.id("applications"),
    jobId: v.id("jobs"),
    candidateId: v.id("candidates"),
    offerId: v.id("offers"),
    placedBy: v.id("users"),
    sourceChannel: v.union(
      v.literal("whatsapp"),
      v.literal("meta_campaign"),
      v.literal("email_campaign"),
      v.literal("linkedin"),
      v.literal("workable"),
      v.literal("manual_upload"),
      v.literal("headhunting")
    ),
    joinDate: v.string(),
    placedSalary: v.number(),
    placedSalaryCurrency: v.string(),
    invoiceSent: v.boolean(),
    invoiceSentAt: v.optional(v.number()),
    invoiceAmount: v.optional(v.number()),
    joinConfirmedAt: v.optional(v.number()),
    placementSnippetSent: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_jobId", ["jobId"])
    .index("by_placedBy", ["placedBy"])
    .index("by_sourceChannel", ["sourceChannel"])
    .index("by_invoiceSent_joinDate", ["invoiceSent", "joinDate"]),

  rejectionLoopEvents: defineTable({
    jobId: v.id("jobs"),
    triggerEvent: v.union(v.literal("client_rejected_all"), v.literal("candidate_declined_offer")),
    loopIteration: v.number(),
    actionTaken: v.union(v.literal("restart_from_new_cvs"), v.literal("return_to_client_review")),
    decidedBy: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    triggeredAt: v.number(),
  })
    .index("by_jobId", ["jobId"])
    .index("by_decidedBy", ["decidedBy"]),

  ingestionLog: defineTable({
    jobId: v.optional(v.id("jobs")),
    channelType: v.union(
      v.literal("whatsapp"),
      v.literal("meta_campaign"),
      v.literal("email_campaign"),
      v.literal("linkedin"),
      v.literal("workable"),
      v.literal("manual_upload"),
      v.literal("headhunting")
    ),
    rawSender: v.optional(v.string()),
    keywordFound: v.optional(v.string()),
    routingStatus: v.union(
      v.literal("routed"),
      v.literal("unrouted"),
      v.literal("duplicate_file"),
      v.literal("duplicate_candidate"),
      v.literal("error")
    ),
    cvFileId: v.optional(v.id("cvUploads")),
    candidateId: v.optional(v.id("candidates")),
    errorMessage: v.optional(v.string()),
    metaCampaignId: v.optional(v.string()),
    processingTimeMs: v.optional(v.number()),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_job_time", ["jobId", "receivedAt"])
    .index("by_channel_time", ["channelType", "receivedAt"])
    .index("by_status", ["routingStatus"])
    .index("by_receivedAt", ["receivedAt"]),

  customFilters: defineTable({
    jobId: v.id("jobs"),
    filterType: v.union(
      v.literal("qualification"),
      v.literal("skill"),
      v.literal("license"),
      v.literal("language"),
      v.literal("company_type")
    ),
    filterValue: v.string(),
    source: v.union(v.literal("ai_extracted"), v.literal("manual"), v.literal("from_previous_job")),
    isActive: v.boolean(),
    savedToLibrary: v.boolean(),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_jobId", ["jobId"])
    .index("by_createdBy", ["createdBy"]),

  savedFilters: defineTable({
    filterType: v.union(
      v.literal("qualification"),
      v.literal("skill"),
      v.literal("license"),
      v.literal("language"),
      v.literal("company_type")
    ),
    filterValue: v.string(),
    usageCount: v.number(),
    industries: v.optional(v.array(v.string())),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  }).index("by_createdBy", ["createdBy"]),

  matchScores: defineTable({
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    applicationId: v.optional(v.id("applications")),
    score: v.number(),
    scoreBreakdown: v.optional(v.any()),
    explanation: v.optional(v.string()),
    trigger: v.union(v.literal("job_published"), v.literal("job_opened"), v.literal("search"), v.literal("manual_rescore")),
    scoredAt: v.number(),
  })
    .index("by_job_score", ["jobId", "score"])
    .index("by_candidate_job_scoredAt", ["candidateId", "jobId", "scoredAt"]),

  pipelineHealthReports: defineTable({
    jobId: v.id("jobs"),
    reportDate: v.string(),
    healthScore: v.number(),
    cvFlowScore: v.number(),
    outreachScore: v.number(),
    reviewSpeedScore: v.number(),
    placementScore: v.number(),
    activeAlerts: v.optional(v.any()),
    stageCounts: v.any(),
    daysOpen: v.number(),
    newCvsLast7Days: v.number(),
    generatedAt: v.number(),
  })
    .index("by_job_reportDate", ["jobId", "reportDate"])
    .index("by_reportDate", ["reportDate"]),

  esaRecords: defineTable({
    clientName: v.string(),
    clientEmail: v.string(),
    jobId: v.optional(v.id("jobs")),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("signed"), v.literal("expired"), v.literal("not_required")),
    sentAt: v.optional(v.number()),
    signedAt: v.optional(v.number()),
    signedBy: v.optional(v.string()),
    esaDocumentUrl: v.optional(v.string()),
    slaDeadlineAt: v.optional(v.number()),
    slaBreached: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_client_status", ["clientName", "status"])
    .index("by_jobId", ["jobId"])
    .index("by_slaBreached", ["slaBreached"]),

  documents: defineTable({
    fileHash: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.float64()),
    fileType: v.optional(v.string()),
    rawText: v.optional(v.string()),
    status: v.optional(v.string()),
    storageId: v.optional(v.string()),
    uploadedBy: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    candidateName: v.optional(v.string()),
    currentTitle: v.optional(v.string()),
    email: v.optional(v.string()),
    industry: v.optional(v.string()),
    isStructured: v.optional(v.boolean()),
    languages: v.optional(v.array(v.string())),
    location: v.optional(v.string()),
    phone: v.optional(v.string()),
    sector: v.optional(v.string()),
    seniority: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    summary: v.optional(v.string()),
    yearsOfExperience: v.optional(v.float64()),
    workableCandidateId: v.optional(v.string()),
  })
    .index("by_fileHash", ["fileHash"])
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_uploadedBy", ["uploadedBy"]),

  workableImports: defineTable({
    status: v.union(v.literal("running"), v.literal("done"), v.literal("error"), v.literal("stopped")),
    totalCandidates: v.number(),
    imported: v.number(),
    skipped: v.number(),
    deduplicated: v.optional(v.number()),
    failed: v.number(),
    userId: v.string(),
    startedAt: v.string(),
    errorMessage: v.optional(v.string()),
    lastCursor: v.optional(v.string()),
    subdomain: v.optional(v.string()),
    apiKey: v.optional(v.string()),
  }).index("by_user", ["userId"]),
});

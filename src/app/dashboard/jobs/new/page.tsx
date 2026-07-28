"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Loader2, ShieldAlert, Mail, MessageSquare, Sparkles, Clock, Eye, Edit3, Check } from "lucide-react";
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { useErrorPopup } from "@/components/ui/ErrorPopupProvider";
import { SmartTemplateEditor } from '@/components/ui/SmartTemplateEditor';
import { Modal } from '@/components/ui/Modal';
import { MessageTemplatesTab } from '@/components/settings/tabs/MessageTemplatesTab';

export default function CreateJobWizard() {
  const { showError } = useErrorPopup();
  const router = useRouter();
  const { canCreateJob, isLoaded } = usePermissions();
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // RBAC Gate
  useEffect(() => {
    if (isLoaded && !canCreateJob) {
      router.push('/dashboard');
    }
  }, [isLoaded, canCreateJob, router]);


  const availableRecruiters = useQuery(api.users.users.listByRoles, { roles: ["senior_ta", "recruiter", "admin", "ta_manager", "ta", "test_ta"] });
  const availableDirectors = useQuery(api.users.users.listByRoles, { roles: ["director", "admin", "ta_manager"] });
  const allUsers = useQuery(api.users.users.getAllUsers);
  const templates = useQuery(api.templates.messageTemplates.getTemplates, {});
  const currentUser = useQuery(api.users.users.getCurrentUser);
  const createJob = useMutation(api.jobs.jobs.createJob);
  const createDraftJob = useMutation(api.jobs.jobs.createDraftJob);
  const whatChimpNumbersDB = useQuery(api.settings.whatsappNumbers.list) || [];
  const updateJobDetails = useMutation(api.jobs.jobs.updateJobDetails);
  const updateJobChannels = useMutation(api.jobs.jobs.updateJobChannels);
  const updateJobAiConfig = useMutation(api.jobs.jobs.updateJobAiConfig);
  const publishJob = useMutation(api.jobs.jobs.publishJob);
  const assignTeamToJob = useMutation(api.jobs.jobs.assignTeamToJob);
  const extractRequirements = useAction(api.jobs.actions.extractRequirementsAction);
  const [isExtracting, setIsExtracting] = useState(false);

  const [isPublishing, setIsPublishing] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [showRecruiterDropdown, setShowRecruiterDropdown] = useState(false);
  const [lastSavedKeyword, setLastSavedKeyword] = useState<string>('');
  const [createdJobId, setCreatedJobId] = useState<string>('');
  const [isCustomEducation, setIsCustomEducation] = useState(false);
  const [customEdValue, setCustomEdValue] = useState('');
  const [customEducationLevels, setCustomEducationLevels] = useState<string[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateModalTab, setTemplateModalTab] = useState<'schedule' | 'sequence'>('schedule');
  const [templateModalDay, setTemplateModalDay] = useState<'day0' | 'day2' | 'day4' | 'day7'>('day0');
  const [templateModalStepIndex, setTemplateModalStepIndex] = useState<number>(0);
  const [templateModalChannel, setTemplateModalChannel] = useState<'email' | 'whatsapp'>('email');
  const [templateModalView, setTemplateModalView] = useState<'editor' | 'preview'>('editor');

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Job Details
    jobTitle: '',
    clientCompany: '',
    recruitmentType: 'Both (headhunting + posting)',
    jobStatus: 'Active',
    confidential: false,
    industry: '',
    jobDescription: '',
    requiredSkills: '',
    niceToHaveSkills: '',
    seniorityLevel: 'Mid-Level',
    experienceMin: '0',
    experienceMax: '3',
    location: '',
    salaryRange: '',
    educationLevel: 'Bachelor',
    languages: '',
    supportingRecruiters: [] as string[],
    primaryRecruiter: 'Shambra Ameen',
    hiringManager: '',
    director: '',
    clientContactName: '',
    clientContactEmail: '',

    // Step 2: Channel Setup
    jobKeyword: '',
    outreachWhatsAppNumber: '',
    muteDefaultWhatsappReply: false,
    linkedinEmail: 'linkedin@career141.com',
    linkedinEmailSaved: false,
    commonWhatsAppNumber: '',
    whatsappSaved: false,
    channels: {
      linkedin: false,
      whatsapp: false,
      metaCampaign: false,
      emailCampaign: false,
      workable: false,
      headhunting: false,
    },
    metaCampaignId: '',
    useDifferentMetaNumber: false,
    metaWhatsAppNumber: '',
    emailInbox: '',
    emailSaved: false,
    workableJobId: '',
    benchmarkProfile: '',
    headhuntingNudgeDays: '5',

    // Step 3: AI Configuration
    enableMatching: true,
    minMatchScore: 60,
    reverseMatchOnPublish: true,
    scoreWeights: {
      skills: 35,
      experience: 25,
      jobTitle: 20,
      industry: 15,
      location: 5,
    },
    agent3TriggerStages: ['shortlisted'] as string[],
    enableFollowUps: false,
    followUpInitialTemplate: `Hi {candidate_name},\n\nThank you for applying for the {job_title} role!\n\nTo progress your application, please provide the following details:\n{missing_fields}\n\nPlease let us know how soon you can provide this information.\n\nBest regards,\nTalent Acquisition Team`,
    followUpSampleTemplate: `Hi {candidate_name}, thanks for getting back to us.\n\nWe just need your {missing_fields} to move forward.\n\nPlease share them at your earliest convenience.`,
    maxFollowUpDays: 3,
    maxFollowUpAttempts: 3,
    customFollowUpQuestions: [] as string[],
    unresponsiveDays: '7',
    followUpSchedule: {
      day2: true, day2Channel: 'Email',
      day4: true, day4Channel: 'Email',
      day7: true, day7Channel: 'WhatsApp',
      markUnresponsive: true,
    },
    followUpMode: 'system' as 'system' | 'custom',
    followUpWindowStart: '09:00',
    followUpWindowEnd: '17:00',
    followUpAllowedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    followUpTimeZone: 'Asia/Colombo',
    customFollowUpSteps: [
      {
        id: 'step0',
        day: 0,
        channel: 'WhatsApp',
        emailSubject: "Action Required: Missing info for your {job_title} application",
        emailBody: `Hi {candidate_name},\n\nThank you for applying for the {job_title} role!\n\nTo progress your application, please provide the following details:\n{missing_fields}\n\nPlease reply to this email at your earliest convenience.\n\nBest regards,\nTalent Acquisition Team`,
        whatsappBody: `Hi *{candidate_name}*! 👋\n\nWe received your application for *{job_title}*!\n\nTo move forward, could you please share:\n{missing_fields}\n\nJust reply here — it only takes a minute. Thank you!`,
      },
      {
        id: 'step1',
        day: 2,
        channel: 'Email',
        emailSubject: "Reminder: We still need your details — {job_title}",
        emailBody: `Hi {candidate_name},\n\nThis is a gentle reminder regarding your application for the {job_title} role.\n\nWe haven't received the following details yet:\n{missing_fields}\n\nCould you please send these across so we can continue reviewing your application?\n\nBest regards,\nTalent Acquisition Team`,
        whatsappBody: `Hi *{candidate_name}*, just a quick follow-up! 📋\n\nWe're still waiting on a few details for your *{job_title}* application:\n{missing_fields}\n\nCould you share these when you get a chance? Thanks!`,
      },
      {
        id: 'step2',
        day: 4,
        channel: 'WhatsApp',
        emailSubject: "Final Reminder: {job_title} Application — Action Needed",
        emailBody: `Hi {candidate_name},\n\nWe wanted to reach out one more time regarding your {job_title} application.\n\nWe are still missing:\n{missing_fields}\n\nWithout this information, we may not be able to progress your application further. Please respond at the earliest.\n\nBest regards,\nTalent Acquisition Team`,
        whatsappBody: `Hi *{candidate_name}*, this is our third follow-up for your *{job_title}* application.\n\nWe still need:\n{missing_fields}\n\nPlease reply so we don't have to close your application. We'd love to keep you in the running! 🙏`,
      },
      {
        id: 'step3',
        day: 7,
        channel: 'Email',
        emailSubject: "Last Chance: {job_title} — Please Respond",
        emailBody: `Hi {candidate_name},\n\nWe have made several attempts to reach you regarding your {job_title} application. Unfortunately, we have not received the required information.\n\nIf we do not hear from you, we will be unable to proceed with your application for this role.\n\nIf you are still interested, please reply to this email immediately.\n\nBest regards,\nTalent Acquisition Team`,
        whatsappBody: `Hi *{candidate_name}*, this is our final follow-up for the *{job_title}* role.\n\nIf we don't hear from you today, we'll have to mark your application as unresponsive.\n\nStill interested? Just reply here! ✅`,
      },
    ],
    followUpTemplates: {
      requestCv: true,
      requestCurrentSalary: true,
      requestExpectedSalary: true,
      requestNoticePeriod: true,
      day0: {
        emailSubject: "Action Required: Missing info for your {job_title} application",
        emailBody: `Hi {candidate_name},\n\nThank you for applying for the {job_title} role!\n\nTo progress your application, please provide the following details:\n{missing_fields}\n\nPlease reply to this email at your earliest convenience.\n\nBest regards,\nTalent Acquisition Team`,
        whatsappBody: `Hi *{candidate_name}*! 👋\n\nWe received your application for *{job_title}*!\n\nTo move forward, could you please share:\n{missing_fields}\n\nJust reply here — it only takes a minute. Thank you!`,
      },
      day2: {
        emailSubject: "Reminder: We still need your details — {job_title}",
        emailBody: `Hi {candidate_name},\n\nThis is a gentle reminder regarding your application for the {job_title} role.\n\nWe haven't received the following details yet:\n{missing_fields}\n\nCould you please send these across so we can continue reviewing your application?\n\nBest regards,\nTalent Acquisition Team`,
        whatsappBody: `Hi *{candidate_name}*, just a quick follow-up! 📋\n\nWe're still waiting on a few details for your *{job_title}* application:\n{missing_fields}\n\nCould you share these when you get a chance? Thanks!`,
      },
      day4: {
        emailSubject: "Final Reminder: {job_title} Application — Action Needed",
        emailBody: `Hi {candidate_name},\n\nWe wanted to reach out one more time regarding your {job_title} application.\n\nWe are still missing:\n{missing_fields}\n\nWithout this information, we may not be able to progress your application further. Please respond at the earliest.\n\nBest regards,\nTalent Acquisition Team`,
        whatsappBody: `Hi *{candidate_name}*, this is our third follow-up for your *{job_title}* application.\n\nWe still need:\n{missing_fields}\n\nPlease reply so we don't have to close your application. We'd love to keep you in the running! 🙏`,
      },
      day7: {
        emailSubject: "Last Chance: {job_title} — Please Respond",
        emailBody: `Hi {candidate_name},\n\nWe have made several attempts to reach you regarding your {job_title} application. Unfortunately, we have not received the required information.\n\nIf we do not hear from you, we will be unable to proceed with your application for this role.\n\nIf you are still interested, please reply to this email immediately.\n\nBest regards,\nTalent Acquisition Team`,
        whatsappBody: `Hi *{candidate_name}*, this is our final follow-up for the *{job_title}* role.\n\nIf we don't hear from you today, we'll have to mark your application as unresponsive.\n\nStill interested? Just reply here! ✅`,
      },
    },
    enablePhoneScreening: false,
    phoneScreeningTriggers: {
      newApplicants: true,
      databaseMatches: true,
      manualOnly: false,
    },
    callScript: 'Initial Screening',
    additionalQuestions: [
      'Current notice period',
      'Current monthly salary',
      'Expected salary'
    ],
    phoneScreeningNoAnswer: 'triggerEmail',
    phoneScreeningConfidential: false,
    reviewLevels: {
      taShortlist: true,
      directorReview: false,
      directorSla: '3',
      directorOnBreach: 'notifyBoth',
      clientReview: false,
      clientName: '',
      clientEmail: '',
      clientAccess: 'View + Comment',
      clientSla: '5',
      clientOnBreach: 'notifyOps',
      esaStatusCheck: true,
      offerRejectionLoop: 'restart',
    },
    customFilters: [],
    newFilterType: 'Qualification',
    newFilterValue: '',
    ndaRequired: false,
    enablePipelineHealth: true,
    pipelineAlerts: {
      noNewCvs: '5',
      taReviewPending: '2',
      aiCallNotCompleted: '1',
      secondShortlistPending: '2',
      directorReviewPending: '3',
      clientReviewPending: '5',
      interviewNotScheduled: '3',
      offerNotMade: '2',
    }
  });

  useEffect(() => {
    if (formData.jobKeyword && !lastSavedKeyword) {
      setLastSavedKeyword(formData.jobKeyword);
    }
  }, [formData.jobKeyword, lastSavedKeyword]);

  useEffect(() => {
    const hasWhatsAppChannel = formData.channels.whatsapp;
    if (formData.channels.metaCampaign && !hasWhatsAppChannel && !formData.useDifferentMetaNumber) {
      setFormData(prev => ({ ...prev, useDifferentMetaNumber: true }));
    }
  }, [formData.channels.metaCampaign, formData.channels.whatsapp, formData.useDifferentMetaNumber]);

  const [isCustomNumber, setIsCustomNumber] = useState(false);
  const [isCustomMetaNumber, setIsCustomMetaNumber] = useState(false);

  const whatChimpNumbers = whatChimpNumbersDB.length > 0 
    ? whatChimpNumbersDB.map(n => ({ number: n.phone, name: n.name }))
    : [
        { number: "+94 74 011 0130", name: "Jesmeen Mohammad" },
        { number: "+94 74 219 7476", name: "Sudaraka De Alwis" },
        { number: "+94 75 377 8899", name: "Uzmaan" }
      ];

  if (!isLoaded || !canCreateJob) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        {!isLoaded ? (
          <Loader2 className="w-8 h-8 animate-spin text-primary-container" />
        ) : (
          <>
            <ShieldAlert className="w-12 h-12 text-red-500" />
            <h2 className="text-xl font-bold text-text-primary">Access Denied</h2>
            <p className="text-text-secondary text-center max-w-md">
              You do not have permission to create jobs. If you believe this is an error, please contact your System Administrator.
            </p>
          </>
        )}
      </div>
    );
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateNestedFormData = (parent: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...(prev as any)[parent],
        [field]: value
      }
    }));
  };

  const updateDayTemplate = (day: 'day0' | 'day2' | 'day4' | 'day7', field: 'emailSubject' | 'emailBody' | 'whatsappBody', value: string) => {
    setFormData(prev => ({
      ...prev,
      followUpTemplates: {
        ...prev.followUpTemplates,
        [day]: {
          ...prev.followUpTemplates[day],
          [field]: value
        }
      }
    }));
  };

  const addFollowUpStep = () => {
    setFormData(prev => {
      const steps = prev.customFollowUpSteps || [];
      const lastStep = steps[steps.length - 1];
      const nextDay = lastStep ? lastStep.day + 3 : 10;
      const newStep = {
        id: `step_${Date.now()}`,
        day: nextDay,
        channel: 'Email',
        emailSubject: `Follow-up: Action needed for your {job_title} application`,
        emailBody: `Hi {candidate_name},\n\nWe are following up regarding your application for the {job_title} position.\n\nWe still need the following details:\n{missing_fields}\n\nPlease reply at your earliest convenience.\n\nBest regards,\nTalent Acquisition Team`,
        whatsappBody: `Hi *{candidate_name}*, following up on your *{job_title}* application! 📋\n\nPlease share:\n{missing_fields}\n\nThank you!`,
      };
      return {
        ...prev,
        customFollowUpSteps: [...steps, newStep],
      };
    });
  };

  const removeFollowUpStep = (index: number) => {
    setFormData(prev => {
      const steps = prev.customFollowUpSteps || [];
      if (steps.length <= 1) return prev; // Keep at least 1 step
      const newSteps = steps.filter((_, i) => i !== index);
      return { ...prev, customFollowUpSteps: newSteps };
    });
  };

  const updateCustomStep = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const steps = [...(prev.customFollowUpSteps || [])];
      if (steps[index]) {
        steps[index] = { ...steps[index], [field]: value };
      }
      return { ...prev, customFollowUpSteps: steps };
    });
  };

  const toggleAllowedDay = (dayName: string) => {
    setFormData(prev => {
      const currentDays = prev.followUpAllowedDays || [];
      const exists = currentDays.includes(dayName);
      const updatedDays = exists
        ? currentDays.filter(d => d !== dayName)
        : [...currentDays, dayName];
      return { ...prev, followUpAllowedDays: updatedDays };
    });
  };

  const isNextDisabled = () => {
    if (isPublishing) return true;
    if (currentStep === 1) {
      if (!formData.jobTitle.trim() || !formData.jobDescription.trim() || formData.requiredSkills.length === 0) {
        return true;
      }
    }
    return false;
  };

  const handleNext = () => {
    if (currentStep === 1 && !formData.jobKeyword) {
      const title = formData.jobTitle?.trim() || '';
      let prefix = 'JOB';
      if (title) {
        const words = title.split(/\s+/);
        if (words.length > 1) {
          prefix = words.map(w => w[0]).join('').substring(0, 4).toUpperCase();
        } else {
          prefix = title.substring(0, 4).toUpperCase();
        }
        prefix = prefix.replace(/[^A-Z]/g, '') || 'JOB';
      }
      const generatedKw = prefix + Math.floor(100 + Math.random() * 900);
      setFormData(prev => ({ ...prev, jobKeyword: generatedKw }));
      setLastSavedKeyword(generatedKw);
    }
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  const handleSaveDraft = async () => {
    setIsDrafting(true);
    setPublishError("");
    try {
      const recruiterPool = (availableRecruiters && availableRecruiters.length > 0)
        ? availableRecruiters
        : (allUsers && allUsers.length > 0)
        ? allUsers
        : currentUser
        ? [currentUser]
        : [];

      const primaryRecruiterObj = recruiterPool.find(m => m.fullName === formData.primaryRecruiter);
      const primaryRecruiterId = primaryRecruiterObj?._id || recruiterPool[0]?._id;

      const directorPool = (availableDirectors && availableDirectors.length > 0) ? availableDirectors : (allUsers || []);
      const directorObj = directorPool.find(m => m.fullName === formData.director);
      const directorId = directorObj?._id;

      const supportingRecruiterIds = formData.supportingRecruiters
        .map(name => recruiterPool.find(m => m.fullName === name)?._id)
        .filter(Boolean) as string[];

      const { jobId } = await createDraftJob({
        title: formData.jobTitle || "Draft Job",
        description: formData.jobDescription || "No description provided.",
        clientName: formData.confidential ? "Confidential Client" : (formData.clientCompany || undefined),
        clientIndustry: formData.industry || undefined,
        recruitmentType: formData.recruitmentType.includes("headhunting") && formData.recruitmentType.includes("posting") ? "both" : formData.recruitmentType.includes("headhunting") ? "headhunting" : "job_posting",
        isConfidential: formData.confidential,
        location: formData.location || undefined,
        requiredSkills: formData.requiredSkills ? formData.requiredSkills.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        niceToHaveSkills: formData.niceToHaveSkills ? formData.niceToHaveSkills.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        seniorityLevel: formData.seniorityLevel ? formData.seniorityLevel.toLowerCase().replace(/ /g, "_").replace("-", "_") : undefined,
        experienceMinYears: parseInt(formData.experienceMin) || undefined,
        experienceMaxYears: parseInt(formData.experienceMax) || undefined,
        salaryRangeMin: parseInt(formData.salaryRange.split("-")[0]?.replace(/[^0-9]/g, '')) || undefined,
        salaryRangeMax: parseInt(formData.salaryRange.split("-")[1]?.replace(/[^0-9]/g, '')) || undefined,
        salaryCurrency: formData.salaryRange.replace(/[0-9\- ]/g, '').trim() || undefined,
        primaryRecruiterId: primaryRecruiterId as any,
        directorId: directorId as any,
        supportingRecruiterIds: supportingRecruiterIds as any,
        clientContactName: formData.clientContactName || undefined,
        clientContactEmail: formData.clientContactEmail || undefined,
        muteDefaultWhatsappReply: formData.muteDefaultWhatsappReply,
      });

      toast.success("Job saved as draft successfully");
      router.push(`/dashboard/jobs`);
    } catch (error: any) {
      setPublishError(error.message || "Failed to save draft. Please try again.");
      showError(error, { title: "Failed to Save Draft" });
    } finally {
      setIsDrafting(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError("");
    
    try {
      if (formData.channels.whatsapp && !formData.commonWhatsAppNumber.trim()) {
        throw new Error("WhatsApp channel is enabled, but no WhatsApp number was selected in Step 2.");
      }
      if (formData.channels.metaCampaign) {
        const metaNum = formData.useDifferentMetaNumber ? formData.metaWhatsAppNumber : formData.commonWhatsAppNumber;
        if (!metaNum || !metaNum.trim()) {
          throw new Error("Meta Campaign is enabled, but no WhatsApp number for ads was configured in Step 2.");
        }
      }
      if (formData.channels.emailCampaign && !formData.emailInbox.trim()) {
        throw new Error("Email Campaign is enabled, but no inbox address was entered in Step 2.");
      }

      const recruiterPool = (availableRecruiters && availableRecruiters.length > 0)
        ? availableRecruiters
        : (allUsers && allUsers.length > 0)
        ? allUsers
        : currentUser
        ? [currentUser]
        : [];

      const primaryRecruiterObj = recruiterPool.find(m => m.fullName === formData.primaryRecruiter);
      const isAssignedTAExplicit = !!primaryRecruiterObj;
      const primaryRecruiterId = primaryRecruiterObj?._id || recruiterPool[0]?._id;
      
      if (!primaryRecruiterId) {
         throw new Error("No team members found in database to assign as Primary Recruiter.");
      }

      const directorPool = (availableDirectors && availableDirectors.length > 0) ? availableDirectors : (allUsers || []);
      const directorObj = directorPool.find(m => m.fullName === formData.director);
      const directorId = directorObj?._id;

      const supportingRecruiterIds = formData.supportingRecruiters
        .map(name => recruiterPool.find(m => m.fullName === name)?._id)
        .filter(Boolean) as string[];

      // Step 1: createJob
      const { jobId } = await createJob({
        title: formData.jobTitle || "Untitled Job",
        clientName: formData.confidential ? "Confidential Client" : (formData.clientCompany || "Unknown Client"),
        clientIndustry: formData.industry || "Other",
        recruitmentType: formData.recruitmentType.includes("headhunting") && formData.recruitmentType.includes("posting") ? "both" : formData.recruitmentType.includes("headhunting") ? "headhunting" : "job_posting",
        isConfidential: formData.confidential,
        jobDescription: formData.jobDescription || "No description provided.",
        requiredSkills: formData.requiredSkills ? formData.requiredSkills.split(",").map(s => s.trim()).filter(Boolean) : ["Not specified"],
        niceToHaveSkills: formData.niceToHaveSkills ? formData.niceToHaveSkills.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        seniorityLevel: formData.seniorityLevel.toLowerCase().replace(/ /g, "_").replace("-", "_"),
        experienceMinYears: parseInt(formData.experienceMin) || 0,
        experienceMaxYears: parseInt(formData.experienceMax) || undefined,
        location: formData.location || "Remote",
        salaryMin: parseInt(formData.salaryRange.split("-")[0]?.replace(/[^0-9]/g, '')) || undefined,
        salaryMax: parseInt(formData.salaryRange.split("-")[1]?.replace(/[^0-9]/g, '')) || undefined,
        salaryCurrency: formData.salaryRange.replace(/[0-9\- ]/g, '').trim() || "LKR",
        educationLevel: formData.educationLevel
          ? (["Bachelor", "Master", "PhD", "Diploma", "Professional Cert", "Bachelor or Master", "any", "diploma", "bachelor", "master", "phd", "professional_cert", "bachelor_or_master"].includes(formData.educationLevel)
              ? formData.educationLevel.toLowerCase().replace(/ /g, "_")
              : formData.educationLevel)
          : undefined,
        languagesRequired: formData.languages ? formData.languages.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        keyword: formData.jobKeyword || undefined,
        primaryRecruiterId: primaryRecruiterId as any,
        isAssignedTAExplicit,
        supportingRecruiterIds: supportingRecruiterIds as any,
        directorId: directorId as any,
        clientContactName: formData.clientContactName || undefined,
        clientContactEmail: formData.clientContactEmail || undefined,
      });
      setCreatedJobId(jobId);

      if (formData.muteDefaultWhatsappReply || formData.outreachWhatsAppNumber) {
        await updateJobDetails({
          jobId,
          muteDefaultWhatsappReply: formData.muteDefaultWhatsappReply,
          outreachWhatsAppNumber: formData.outreachWhatsAppNumber || undefined,
        });
      }

      // Step 2: updateJobChannels
      const channelsPayload: any[] = [];
      if (formData.channels.whatsapp) {
        channelsPayload.push({
          channelType: "whatsapp",
          isEnabled: true,
          whatsappNumber: formData.commonWhatsAppNumber || undefined,
        });
      }
      if (formData.channels.linkedin) {
        channelsPayload.push({
          channelType: "linkedin",
          isEnabled: true,
          emailInbox: formData.linkedinEmail || undefined,
        });
      }
      if (formData.channels.metaCampaign) {
        channelsPayload.push({
          channelType: "meta_campaign",
          isEnabled: true,
          whatsappNumber: (formData.useDifferentMetaNumber ? formData.metaWhatsAppNumber : formData.commonWhatsAppNumber) || undefined,
        });
      }
      if (formData.channels.emailCampaign) {
        channelsPayload.push({
          channelType: "email_campaign",
          isEnabled: true,
          emailInbox: formData.emailInbox || undefined,
        });
      }
      if (formData.channels.workable) {
        channelsPayload.push({
          channelType: "workable",
          isEnabled: true,
          workableJobId: formData.workableJobId || undefined,
        });
      }

      await updateJobChannels({
        jobId,
        channels: channelsPayload,
      });

      // Step 3: updateJobAiConfig
      await updateJobAiConfig({
        jobId,
        minMatchScoreToShow: formData.minMatchScore,
        reverseMatchOnPublish: formData.reverseMatchOnPublish,
        scoreWeightSkills: formData.scoreWeights.skills,
        scoreWeightExperience: formData.scoreWeights.experience,
        scoreWeightJobTitle: formData.scoreWeights.jobTitle,
        scoreWeightIndustry: formData.scoreWeights.industry,
        scoreWeightLocation: formData.scoreWeights.location,
        
        agent3Enabled: formData.enableFollowUps,
        followUpInitialTemplate: formData.followUpInitialTemplate,
        followUpSampleTemplate: formData.followUpSampleTemplate,
        maxFollowUpDays: formData.maxFollowUpDays,
        maxFollowUpAttempts: formData.maxFollowUpAttempts,
        customFollowUpQuestions: formData.customFollowUpQuestions,
        agent3TriggerStages: formData.agent3TriggerStages,
        agent3AfterDay7: "mark_unresponsive",
        
        agent5Enabled: false,
        agent5Trigger: "manual_only",
        agent5CallScript: "default",
        agent5CustomQuestions: formData.additionalQuestions,
        agent5NoAnswerAction: "notify_ta",
        agent5HideCompany: false,
        
        directorReviewEnabled: formData.reviewLevels.directorReview,
        clientReviewEnabled: formData.reviewLevels.clientReview,
        clientContactName: formData.reviewLevels.clientName || undefined,
        clientContactEmail: formData.reviewLevels.clientEmail || undefined,
        clientAccessLevel: formData.reviewLevels.clientAccess === 'Approve & Reject' ? 'approve_reject' : formData.reviewLevels.clientAccess === 'View Only' ? 'view_only' : 'view_comment',
        esaCheckEnabled: formData.reviewLevels.esaStatusCheck,
        rejectionLoopAction: formData.reviewLevels.offerRejectionLoop === "restart" ? "restart_from_new_cvs" : formData.reviewLevels.offerRejectionLoop === "clientReview" ? "return_to_client_review" : "ask_ta_each_time",
        
        slaNoNewCvsDays: parseInt(formData.pipelineAlerts.noNewCvs) || 5,
        slaTaReviewDays: parseInt(formData.pipelineAlerts.taReviewPending) || 2,
        slaAiCallDays: parseInt(formData.pipelineAlerts.aiCallNotCompleted) || 1,
        slaSecondShortlistDays: parseInt(formData.pipelineAlerts.secondShortlistPending) || 2,
        slaDirectorReviewDays: parseInt(formData.pipelineAlerts.directorReviewPending) || 3,
        slaClientReviewDays: parseInt(formData.pipelineAlerts.clientReviewPending) || 5,
        slaEsaDays: 3,
        slaInterviewDays: parseInt(formData.pipelineAlerts.interviewNotScheduled) || 3,
        slaOfferDays: parseInt(formData.pipelineAlerts.offerNotMade) || 2,
      });

      // Step 3.5: assignTeamToJob
      await assignTeamToJob({
        jobId,
        primaryRecruiterId: primaryRecruiterId as any,
        supportingRecruiterIds: supportingRecruiterIds as any,
        directorId: directorId as any,
      });

      // Step 4: publishJob
      if (formData.jobStatus === 'Active') {
        await publishJob({ jobId });
      }

      setShowSuccessModal(true);
    } catch (err: any) {
      console.error("Publishing error:", err);
      setPublishError(err.message || "An unexpected error occurred while publishing.");
      showError(err, { title: "Failed to Publish Job" });
    } finally {
      setIsPublishing(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center gap-4 mb-8">
      {[1, 2, 3, 4].map(step => (
        <div key={step} className="flex items-center gap-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            currentStep === step ? 'bg-primary-container text-on-primary' : 
            currentStep > step ? 'bg-primary-fixed-dim text-primary-container' : 
            'bg-surface-variant text-text-secondary'
          }`}>
            {currentStep > step ? '✓' : step}
          </div>
          <span className={`text-sm font-medium ${currentStep === step ? 'text-primary-container' : 'text-text-secondary'}`}>
            {step === 1 && 'Job Details'}
            {step === 2 && 'Channel Setup'}
            {step === 3 && 'AI Config'}
            {step === 4 && 'Review'}
          </span>
          {step < 4 && <div className="w-12 h-px bg-border"></div>}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-1">Job Details</h2>
        <p className="text-sm text-text-secondary">Define the role, client, and requirements.</p>
      </div>

      {/* Core info */}
      <div className="grid gap-5">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Job Title *</label>
          <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.jobTitle} onChange={e => updateFormData('jobTitle', e.target.value)} placeholder="e.g. Senior Brand Manager" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Job Description *</label>
          <textarea rows={5} className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.jobDescription} onChange={e => updateFormData('jobDescription', e.target.value)} placeholder="Paste full job description including responsibilities, requirements..."></textarea>
          <div className="mt-2 flex justify-end">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-primary-container/10 text-primary-container rounded hover:bg-primary-container/20 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed" disabled={isExtracting || !formData.jobDescription} onClick={async (e) => {
              e.preventDefault();
              if (!formData.jobDescription) return;
              setIsExtracting(true);
              try {
                const res = await extractRequirements({ description: formData.jobDescription });
                setFormData(prev => ({
                  ...prev,
                  requiredSkills: res.requiredSkills ? res.requiredSkills.join(", ") : "",
                  niceToHaveSkills: res.niceToHaveSkills ? res.niceToHaveSkills.join(", ") : "",
                  location: res.location ? res.location : prev.location,
                  jobTitle: res.title ? res.title : prev.jobTitle,
                  industry: res.industry ? res.industry : prev.industry,
                  experienceMin: res.minYearsExperience !== null && res.minYearsExperience !== undefined ? String(res.minYearsExperience) : prev.experienceMin,
                  seniorityLevel: res.seniority ? res.seniority.charAt(0).toUpperCase() + res.seniority.slice(1) : prev.seniorityLevel,
                  educationLevel: res.education ? res.education : prev.educationLevel,
                  languages: res.languages && res.languages.length > 0 ? res.languages.join(", ") : prev.languages,
                  clientCompany: res.clientCompany ? res.clientCompany : prev.clientCompany,
                  clientContactEmail: res.clientContactEmail ? res.clientContactEmail : prev.clientContactEmail,
                  salaryRange: res.salaryRange ? res.salaryRange : prev.salaryRange,
                }));
              } catch (err) {
                alert("Failed to extract requirements. Please try again.");
                console.error(err);
              } finally {
                setIsExtracting(false);
              }
            }}>
              {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="material-symbols-outlined text-[16px]">auto_awesome</span>}
              {isExtracting ? "Extracting..." : "Auto-Extract Requirements"}
            </button>
          </div>
        </div>
      </div>

      {/* Client info */}
      <div className="border-t border-border pt-6">
        <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-container text-[20px]">corporate_fare</span> Client & Recruitment
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Client Name</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.clientCompany} onChange={e => updateFormData('clientCompany', e.target.value)} placeholder="e.g. Unilever" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Client Industry</label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.industry} onChange={e => updateFormData('industry', e.target.value)}>
              <option value="">Select industry</option>
              <option>FMCG</option>
              <option>Finance</option>
              <option>Technology</option>
              <option>Apparel</option>
              <option>Healthcare</option>
              <option>Retail</option>
              <option>Manufacturing</option>
              <option>Telecoms</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Recruitment Type</label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.recruitmentType} onChange={e => updateFormData('recruitmentType', e.target.value)}>
              <option>Both (headhunting + posting)</option>
              <option>Headhunting (passive candidate search)</option>
              <option>Job Posting (active applicants)</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pt-7">
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer">
              <input type="checkbox" checked={formData.confidential} onChange={e => updateFormData('confidential', e.target.checked)} className="rounded text-primary-container focus:ring-primary-container w-4 h-4" />
              Confidential role
            </label>
          </div>
        </div>
      </div>

      {/* Requirements */}
      <div className="border-t border-border pt-6">
        <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-container text-[20px]">bolt</span> Requirements
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Location</label>
              <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.location} onChange={e => updateFormData('location', e.target.value)} placeholder="e.g. Colombo, Sri Lanka" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Seniority Level</label>
              <select className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.seniorityLevel} onChange={e => updateFormData('seniorityLevel', e.target.value)}>
                <option>Entry-Level</option>
                <option>Mid-Level</option>
                <option>Executive</option>
                <option>Senior Executive</option>
                <option>Manager</option>
                <option>Senior Manager</option>
                <option>AGM</option>
                <option>GM</option>
                <option>Director</option>
                <option>C-Suite</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Min Years Exp</label>
              <input type="number" className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.experienceMin} onChange={e => updateFormData('experienceMin', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Max Years Exp</label>
              <input type="number" className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.experienceMax} onChange={e => updateFormData('experienceMax', e.target.value)} placeholder="15" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Education</label>
              {isCustomEducation ? (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" 
                    value={customEdValue} 
                    onChange={e => setCustomEdValue(e.target.value)} 
                    placeholder="e.g. CIMA / ACCA / specific degree..." 
                  />
                  <button 
                    type="button" 
                    onClick={() => {
                      if (customEdValue.trim() !== "") {
                        const trimmed = customEdValue.trim();
                        if (!customEducationLevels.includes(trimmed)) {
                          setCustomEducationLevels(prev => [...prev, trimmed]);
                        }
                        updateFormData('educationLevel', trimmed);
                      }
                      setIsCustomEducation(false);
                    }}
                    className="px-3 py-2 bg-primary-container text-on-primary rounded-md text-xs font-semibold"
                  >
                    Save
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsCustomEducation(false);
                    }}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-xs font-semibold text-text-primary"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select 
                  className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" 
                  value={formData.educationLevel} 
                  onChange={e => {
                    if (e.target.value === 'custom') {
                      setIsCustomEducation(true);
                      setCustomEdValue('');
                    } else {
                      updateFormData('educationLevel', e.target.value);
                    }
                  }}
                >
                  <option value="any">Any</option>
                  <option value="diploma">Diploma</option>
                  <option value="bachelor">Bachelor</option>
                  <option value="master">Master</option>
                  <option value="phd">PhD</option>
                  <option value="professional_cert">Professional Cert</option>
                  <option value="bachelor_or_master">Bachelor or Master</option>
                  {customEducationLevels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                  <option value="custom">Other / Custom...</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Salary Range (Min - Max)</label>
              <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.salaryRange} onChange={e => updateFormData('salaryRange', e.target.value)} placeholder="e.g. 200k - 300k LKR" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Job Status</label>
              <select className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.jobStatus} onChange={e => updateFormData('jobStatus', e.target.value)}>
                <option>Active</option>
                <option>Draft</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Required Skills *</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.requiredSkills} onChange={e => updateFormData('requiredSkills', e.target.value)} placeholder="Comma separated (e.g. React, Node.js)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Nice-to-Have Skills</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.niceToHaveSkills} onChange={e => updateFormData('niceToHaveSkills', e.target.value)} placeholder="Comma separated" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Languages Required</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.languages} onChange={e => updateFormData('languages', e.target.value)} placeholder="e.g. English, Arabic" />
          </div>
        </div>
      </div>

      {/* People */}
      <div className="border-t border-border pt-6">
        <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-container text-[20px]">group</span> People
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Primary Recruiter (Optional)</label>
            <select 
              className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface disabled:opacity-50" 
              value={formData.primaryRecruiter} 
              onChange={e => updateFormData('primaryRecruiter', e.target.value)}
              disabled={!availableRecruiters || availableRecruiters.length === 0}
            >
              {availableRecruiters === undefined ? (
                <option>Loading...</option>
              ) : availableRecruiters.length === 0 ? (
                <option>No recruiters found</option>
              ) : (
                <>
                  <option value="">Select a Recruiter</option>
                  {availableRecruiters.map(member => {
                    const displayName = member.fullName && member.fullName.trim() !== "Unknown User" && member.fullName.trim() !== "" ? member.fullName : (member.email || "Unknown User");
                    return (
                      <option key={member._id} value={member.fullName}>{displayName} ({member.role})</option>
                    );
                  })}
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Director (Optional)</label>
            <select 
              className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface disabled:opacity-50" 
              value={formData.director} 
              onChange={e => updateFormData('director', e.target.value)}
              disabled={!availableDirectors || availableDirectors.length === 0}
            >
              {availableDirectors === undefined ? (
                <option value="">Loading...</option>
              ) : (
                <>
                  <option value="">None</option>
                  {availableDirectors.map(member => {
                    const displayName = member.fullName && member.fullName.trim() !== "Unknown User" && member.fullName.trim() !== "" ? member.fullName : (member.email || "Unknown User");
                    return (
                      <option key={member._id} value={member.fullName}>{displayName} ({member.role})</option>
                    );
                  })}
                </>
              )}
            </select>
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Supporting Recruiters</label>
            <div 
              className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface cursor-pointer min-h-[42px] flex flex-wrap gap-2 items-center"
              onClick={() => setShowRecruiterDropdown(!showRecruiterDropdown)}
            >
              {formData.supportingRecruiters.length === 0 ? (
                <span className="text-gray-400">Select supporting recruiters...</span>
              ) : (
                formData.supportingRecruiters.map(rec => (
                  <span key={rec} className="bg-primary-container text-on-primary text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    {rec}
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        updateFormData('supportingRecruiters', formData.supportingRecruiters.filter(r => r !== rec));
                      }}
                      className="hover:text-red-500 font-bold"
                    >×</button>
                  </span>
                ))
              )}
            </div>
            {showRecruiterDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {availableRecruiters?.map(member => {
                  const isSelected = formData.supportingRecruiters.includes(member.fullName);
                  const displayName = member.fullName && member.fullName.trim() !== "Unknown User" && member.fullName.trim() !== "" ? member.fullName : (member.email || "Unknown User");
                  return (
                    <div 
                      key={member._id} 
                      className="px-3 py-2 hover:bg-surface-container cursor-pointer flex items-center gap-2"
                      onClick={() => {
                        if (isSelected) {
                          updateFormData('supportingRecruiters', formData.supportingRecruiters.filter(r => r !== member.fullName));
                        } else {
                          updateFormData('supportingRecruiters', [...formData.supportingRecruiters, member.fullName]);
                        }
                      }}
                    >
                      <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-primary-container border-primary-container' : 'border-border'}`}>
                        {isSelected && <span className="material-symbols-outlined text-on-primary text-[14px]">check</span>}
                      </div>
                      <span className="text-sm text-body">{displayName} ({member.role})</span>
                    </div>
                  );
                })}
              </div>
            )}
            {showRecruiterDropdown && (
              <div className="fixed inset-0 z-[5]" onClick={() => setShowRecruiterDropdown(false)}></div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Client Contact Name</label>
              <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.clientContactName} onChange={e => updateFormData('clientContactName', e.target.value)} placeholder="Name of contact" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Client Contact Email</label>
              <input type="email" className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.clientContactEmail} onChange={e => updateFormData('clientContactEmail', e.target.value)} placeholder="Email address" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const commonWhatsAppNumber = formData.commonWhatsAppNumber || "";
    const hasWhatsAppChannel = formData.channels.whatsapp;
    const keyword = formData.jobKeyword;
    const isKeywordChanged = formData.jobKeyword.trim() !== '' && formData.jobKeyword.trim() !== lastSavedKeyword;

    const handleSaveKeyword = (e: React.MouseEvent) => {
      e.preventDefault();
      const cleanKeyword = formData.jobKeyword.trim().toUpperCase();
      if (!cleanKeyword) return;
      updateFormData('jobKeyword', cleanKeyword);
      setLastSavedKeyword(cleanKeyword);
      toast.success('Keyword saved successfully!');
    };
    
    // Construct the full webhook URL dynamically
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
    const webhookUrl = convexUrl ? `${convexUrl.replace('.cloud', '.site')}/api/whatsapp-whatchimp` : "Your Convex Site URL + /api/whatsapp-whatchimp";

    const metaNumber = formData.useDifferentMetaNumber ? formData.metaWhatsAppNumber : commonWhatsAppNumber;
    const displayMetaNumber = metaNumber ? metaNumber.replace(/[^0-9]/g, '') : '[WhatsApp Number]';

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 max-w-4xl">
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-1">Channel Setup</h2>
          <p className="text-sm text-text-secondary">Configure where CVs will come from for this job.</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <label className="block text-sm font-medium text-text-secondary mb-2">Job Keyword (Auto-generated)</label>
          <div className="flex gap-3 items-center">
            <input type="text" className="w-64 border border-gray-700 rounded-md px-3 py-2 text-white font-mono font-bold bg-gray-800 focus:outline-none focus:border-primary-container" value={keyword} onChange={e => updateFormData('jobKeyword', e.target.value)} />
            <button className="bg-surface-variant text-text-primary border border-border px-4 py-2 rounded-md text-sm font-medium hover:bg-surface-container-high transition-colors flex items-center gap-1.5" onClick={(e) => { 
              e.preventDefault(); 
              const title = formData.jobTitle?.trim() || '';
              let prefix = 'JOB';
              if (title) {
                const words = title.split(/\s+/);
                if (words.length > 1) {
                  prefix = words.map(w => w[0]).join('').substring(0, 4).toUpperCase();
                } else {
                  prefix = title.substring(0, 4).toUpperCase();
                }
                prefix = prefix.replace(/[^A-Z]/g, '') || 'JOB';
              }
              const newKw = prefix + Math.floor(100 + Math.random() * 900);
              updateFormData('jobKeyword', newKw); 
              setLastSavedKeyword(newKw);
            }}>
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Regenerate
            </button>
            {isKeywordChanged && (
              <button
                type="button"
                className="bg-primary-container text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-container/90 transition-all flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200 shadow-sm"
                onClick={handleSaveKeyword}
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                Save Keyword
              </button>
            )}
          </div>
          <p className="text-xs text-text-secondary mt-2">Required for routing applicants to this job (used only in Meta Campaigns).</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <label className="block text-sm font-medium text-text-primary mb-2">TA Outreach WhatsApp Number (Agent 3 Follow-ups)</label>
          <select
            name="outreachWhatsAppNumber"
            value={formData.outreachWhatsAppNumber}
            onChange={e => updateFormData('outreachWhatsAppNumber', e.target.value)}
            className="w-full max-w-md border border-border rounded-md px-3 py-2 text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
          >
            <option value="">-- Use Default Campaign Number --</option>
            {whatChimpNumbersDB.map((num: any) => (
              <option key={num._id} value={num.phone}>
                {num.name} ({num.phone})
              </option>
            ))}
          </select>
          <p className="text-xs text-text-secondary mt-2">Select your designated Business WhatsApp number to be used as the sender for automated candidate outreach on this job.</p>
        </div>

        <div className="space-y-4">
          
          {/* Manual Upload */}
          <div className="border border-border rounded-xl p-4 bg-surface transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-surface-variant text-text-secondary">
                  <span className="material-symbols-outlined text-[20px]">upload</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Manual / Bulk Upload</p>
                  <p className="text-xs text-text-secondary mt-0.5">Team uploads CVs directly</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-not-allowed opacity-70">
                <input type="checkbox" className="sr-only peer" checked disabled />
                <div className="w-9 h-5 bg-primary-container rounded-full after:absolute after:top-[2px] after:left-[18px] after:bg-white after:rounded-full after:h-4 after:w-4"></div>
              </label>
            </div>
          </div>

          {/* WhatsApp */}
          <div className={`border rounded-xl p-4 transition-all ${formData.channels.whatsapp ? 'border-primary-container/30 bg-primary-container/5' : 'border-border bg-surface'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${formData.channels.whatsapp ? 'bg-primary-container/10 text-primary-container' : 'bg-surface-variant text-text-secondary'}`}>
                  <span className="material-symbols-outlined text-[20px]">sms</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">WhatsApp</p>
                  <p className="text-xs text-text-secondary mt-0.5">Receive CVs via WhatsApp number</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={formData.channels.whatsapp} onChange={e => updateNestedFormData('channels', 'whatsapp', e.target.checked)} />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            {formData.channels.whatsapp && (
              <div className="mt-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">WhatsApp Number</label>
                <div className="flex flex-col gap-2 mb-2">
                  <select 
                    className="w-64 border border-border rounded-md px-3 py-2 text-sm bg-surface text-text-primary"
                    value={isCustomNumber ? "custom" : (commonWhatsAppNumber || "")} 
                    onChange={e => {
                      if (e.target.value === "custom") {
                        setIsCustomNumber(true);
                        updateFormData('commonWhatsAppNumber', "");
                      } else {
                        setIsCustomNumber(false);
                        updateFormData('commonWhatsAppNumber', e.target.value);
                      }
                    }}
                  >
                    <option value="" disabled>Select a number...</option>
                    {whatChimpNumbers.map(item => (
                      <option key={item.number} value={item.number}>
                        {item.name} ({item.number})
                      </option>
                    ))}
                    <option value="custom">+ Custom / Add New</option>
                  </select>

                  {isCustomNumber && (
                    <input 
                      type="text"
                      className="w-64 border border-border rounded-md px-3 py-2 text-sm bg-surface text-text-primary animate-in fade-in"
                      placeholder="e.g. +94 77 000 0001"
                      value={commonWhatsAppNumber} 
                      onChange={e => updateFormData('commonWhatsAppNumber', e.target.value)}
                    />
                  )}
                </div>
                
                {isCustomNumber && (
                  <div className="bg-primary-container/10 border border-primary-container/20 rounded-lg p-3 mb-4 animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs font-medium text-primary-container mb-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">webhook</span> Adding a new number?
                    </p>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      First, configure it in WhatChimp. Then, set your WhatChimp Webhook URL exactly to this address so CVs are routed here:
                    </p>
                    <code className="block mt-2 bg-surface text-text-primary px-2 py-1.5 rounded border border-border text-[11px] font-mono select-all">
                      {webhookUrl}
                    </code>
                  </div>
                )}


                {commonWhatsAppNumber ? (
                  <div className="p-3 bg-surface-container-low border border-border rounded-lg text-sm text-text-primary flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] text-text-secondary">share</span>
                    <div className="text-xs leading-relaxed">
                      Share this direct application link with candidates: 
                      <br/>
                      <a href={`https://wa.me/${commonWhatsAppNumber.replace(/[^0-9]/g, '')}?text=${keyword}`} target="_blank" rel="noreferrer" className="text-primary-container hover:underline mt-1 inline-block font-mono bg-surface px-1.5 py-0.5 rounded border border-border">
                        https://wa.me/{commonWhatsAppNumber.replace(/[^0-9]/g, '')}?text={keyword}
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-surface-container-low border border-border rounded-lg text-sm text-text-primary flex items-start gap-2 opacity-70">
                    <span className="material-symbols-outlined text-[18px] text-text-secondary">info</span>
                    <div className="text-xs leading-relaxed">
                      Select or type a WhatsApp number above to generate a shareable application link.
                    </div>
                  </div>
                )}

                <div className="mt-4 p-3 bg-surface border border-border rounded-lg flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">Mute Default Auto-Reply</p>
                    <p className="text-xs text-text-secondary mt-0.5">Turn this ON if you are running a custom WhatChimp auto-reply for this campaign and don't want the ATS to send its default "Thank you" message.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input type="checkbox" className="sr-only peer" checked={formData.muteDefaultWhatsappReply} onChange={e => updateFormData('muteDefaultWhatsappReply', e.target.checked)} />
                    <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Email Campaign */}
          <div className={`border rounded-xl p-4 transition-all ${formData.channels.emailCampaign ? 'border-primary-container/30 bg-primary-container/5' : 'border-border bg-surface'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${formData.channels.emailCampaign ? 'bg-primary-container/10 text-primary-container' : 'bg-surface-variant text-text-secondary'}`}>
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Email Campaign</p>
                  <p className="text-xs text-text-secondary mt-0.5">Monitor inbox for CV attachments</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={formData.channels.emailCampaign} onChange={e => updateNestedFormData('channels', 'emailCampaign', e.target.checked)} />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            {formData.channels.emailCampaign && (
              <div className="mt-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Email Inbox Address</label>
                <input type="text" className="w-64 border border-border rounded-md px-3 py-2 text-sm bg-surface mb-3" placeholder="jobs@career141.com" value={formData.emailInbox} onChange={e => updateFormData('emailInbox', e.target.value)} />
                <div className="p-3 bg-surface-container-low border border-border rounded-lg text-sm text-text-primary flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-text-secondary">info</span>
                  <div className="text-xs leading-relaxed">
                    CVs sent to this inbox will be auto-imported and routed by the Email Agent.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* LinkedIn */}
          <div className={`border rounded-xl p-4 transition-all ${formData.channels.linkedin ? 'border-primary-container/30 bg-primary-container/5' : 'border-border bg-surface'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${formData.channels.linkedin ? 'bg-primary-container/10 text-primary-container' : 'bg-surface-variant text-text-secondary'}`}>
                  <span className="material-symbols-outlined text-[20px]">link</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">LinkedIn</p>
                  <p className="text-xs text-text-secondary mt-0.5">Collect applicants via LinkedIn title routing</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={formData.channels.linkedin} onChange={e => updateNestedFormData('channels', 'linkedin', e.target.checked)} />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            {formData.channels.linkedin && (
              <div className="mt-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2">
                 <p className="text-xs text-text-secondary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">info</span> No additional config needed. CVs will be automatically collected by the Email Agent.
                </p>
              </div>
            )}
          </div>

          {/* Meta Campaign */}
          <div className={`border rounded-xl p-4 transition-all ${formData.channels.metaCampaign ? 'border-primary-container/30 bg-primary-container/5' : 'border-border bg-surface'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${formData.channels.metaCampaign ? 'bg-primary-container/10 text-primary-container' : 'bg-surface-variant text-text-secondary'}`}>
                  <span className="material-symbols-outlined text-[20px]">public</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Meta Campaign</p>
                  <p className="text-xs text-text-secondary mt-0.5">Facebook/Instagram ad linking to WhatsApp</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={formData.channels.metaCampaign} onChange={e => updateNestedFormData('channels', 'metaCampaign', e.target.checked)} />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            {formData.channels.metaCampaign && (
              <div className="mt-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">WhatsApp Number for Ads</label>
                  <div className="space-y-3">
                    <label className={`flex items-center gap-2 ${hasWhatsAppChannel ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                      <input 
                        type="radio" 
                        disabled={!hasWhatsAppChannel}
                        checked={!formData.useDifferentMetaNumber} 
                        onChange={() => {
                          if (hasWhatsAppChannel) {
                            updateFormData('useDifferentMetaNumber', false);
                          }
                        }} 
                        className="text-primary-container focus:ring-primary-container w-4 h-4 disabled:opacity-50" 
                      />
                      <span className="text-xs">
                        Use same number as WhatsApp above {!hasWhatsAppChannel && "(WhatsApp channel not enabled above)"}
                      </span>
                    </label>

                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          checked={formData.useDifferentMetaNumber} 
                          onChange={() => updateFormData('useDifferentMetaNumber', true)} 
                          className="text-primary-container focus:ring-primary-container w-4 h-4" 
                        />
                        <span className="text-xs">Use different / dedicated number:</span>
                      </label>
                      {formData.useDifferentMetaNumber && (
                        <div className="pl-6 space-y-2 animate-in fade-in slide-in-from-top-1">
                          <select 
                            className="w-64 border border-border rounded-md px-3 py-2 text-xs bg-surface text-text-primary"
                            value={isCustomMetaNumber ? "custom" : (formData.metaWhatsAppNumber || "")} 
                            onChange={e => {
                              if (e.target.value === "custom") {
                                setIsCustomMetaNumber(true);
                                updateFormData('metaWhatsAppNumber', "");
                              } else {
                                setIsCustomMetaNumber(false);
                                updateFormData('metaWhatsAppNumber', e.target.value);
                              }
                            }}
                          >
                            <option value="" disabled>Select a WhatChimp number...</option>
                            {whatChimpNumbers.map(item => (
                              <option key={item.number} value={item.number}>
                                {item.name} ({item.number})
                              </option>
                            ))}
                            <option value="custom">+ Custom / Add New</option>
                          </select>

                          {isCustomMetaNumber && (
                            <input 
                              type="text" 
                              className="w-64 border border-border rounded-md px-3 py-2 text-xs bg-surface text-text-primary animate-in fade-in" 
                              placeholder="e.g. +94 77 000 0001" 
                              value={formData.metaWhatsAppNumber} 
                              onChange={e => updateFormData('metaWhatsAppNumber', e.target.value)} 
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-surface-container-low border border-border rounded-lg">
                  <label className="block text-xs font-medium text-text-secondary mb-1">Ad Destination Link (Click to WhatsApp)</label>
                  <div className="flex items-center justify-between bg-surface border border-border rounded px-3 py-1.5">
                    <span className="text-xs font-mono text-text-secondary truncate pr-4">wa.me/{displayMetaNumber}?text={keyword}</span>
                    <button className="text-primary-container text-xs font-medium hover:underline flex-shrink-0" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(`wa.me/${displayMetaNumber}?text=${keyword}`); alert('Link copied!'); }}>Copy</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Workable */}
          <div className={`border rounded-xl p-4 transition-all ${formData.channels.workable ? 'border-primary-container/30 bg-primary-container/5' : 'border-border bg-surface'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${formData.channels.workable ? 'bg-primary-container/10 text-primary-container' : 'bg-surface-variant text-text-secondary'}`}>
                  <span className="material-symbols-outlined text-[20px]">search</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Workable ATS</p>
                  <p className="text-xs text-text-secondary mt-0.5">Sync candidates from Workable ATS</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={formData.channels.workable} onChange={e => updateNestedFormData('channels', 'workable', e.target.checked)} />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            {formData.channels.workable && (
              <div className="mt-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Workable Job ID</label>
                <input type="text" className="w-64 border border-border rounded-md px-3 py-2 text-sm bg-surface" value={formData.workableJobId} onChange={e => updateFormData('workableJobId', e.target.value)} placeholder="e.g. wk-brand-mgr" />
              </div>
            )}
          </div>

          {/* Headhunting */}
          <div className={`border rounded-xl p-4 transition-all ${formData.channels.headhunting ? 'border-primary-container/30 bg-primary-container/5' : 'border-border bg-surface'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${formData.channels.headhunting ? 'bg-primary-container/10 text-primary-container' : 'bg-surface-variant text-text-secondary'}`}>
                  <span className="material-symbols-outlined text-[20px]">headset_mic</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Headhunting</p>
                  <p className="text-xs text-text-secondary mt-0.5">Direct sourcing by recruiters</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={formData.channels.headhunting} onChange={e => updateNestedFormData('channels', 'headhunting', e.target.checked)} />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            {formData.channels.headhunting && (
              <div className="mt-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2">
                 <p className="text-xs text-text-secondary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">info</span> Agent 2 will scan the database for existing matches immediately after this job is published.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    );
  };
  const renderStep3 = () => {
    const weightSum = formData.scoreWeights.skills + formData.scoreWeights.experience + formData.scoreWeights.jobTitle + formData.scoreWeights.industry + formData.scoreWeights.location;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-4xl">
        <div>
          <h2 className="text-lg font-semibold mb-1 text-text-primary">AI & Pipeline Config</h2>
          <p className="text-sm text-text-secondary">Configure how AI matches candidates and the pipeline gates.</p>
        </div>

        {/* Match weights */}
        <div className="border border-border rounded-xl p-4 space-y-4 bg-surface">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-text-primary">
              <span className="material-symbols-outlined text-[16px] text-primary-container">bolt</span> AI Match Weights
            </h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${weightSum === 100 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {weightSum}/100
            </span>
          </div>
          {[
            { key: "skills", label: "Skills", value: formData.scoreWeights.skills },
            { key: "experience", label: "Experience", value: formData.scoreWeights.experience },
            { key: "jobTitle", label: "Job Title", value: formData.scoreWeights.jobTitle },
            { key: "industry", label: "Industry", value: formData.scoreWeights.industry },
            { key: "location", label: "Location", value: formData.scoreWeights.location },
          ].map((w) => (
            <div key={w.key} className="flex items-center gap-3">
              <span className="text-xs w-20 shrink-0 text-text-primary">{w.label}</span>
              <input 
                type="range" min="0" max="100" step="5"
                value={w.value}
                onChange={(e) => updateNestedFormData('scoreWeights', w.key, parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary-container"
              />
              <span className="text-xs font-mono w-8 text-right text-text-primary">{w.value}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <span className="text-xs w-20 shrink-0 text-text-primary">Min Score</span>
            <input 
                type="range" min="0" max="100" step="5"
                value={formData.minMatchScore}
                onChange={(e) => updateFormData('minMatchScore', parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary-container"
              />
            <span className="text-xs font-mono w-8 text-right text-text-primary">{formData.minMatchScore}</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" className="sr-only peer" checked={formData.reverseMatchOnPublish} onChange={e => updateFormData('reverseMatchOnPublish', e.target.checked)} />
              <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
            </label>
            <label className="text-xs text-text-primary">Run reverse match on publish (scan existing CVs)</label>
          </div>
        </div>

        {/* Pipeline gates */}
        <div className="border border-border rounded-xl p-4 space-y-4 bg-surface">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-text-primary">
            <span className="material-symbols-outlined text-[16px] text-primary-container">group</span> Pipeline Gates
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-text-primary">Director review required</label>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" className="sr-only peer" checked={formData.reviewLevels.directorReview} onChange={e => updateNestedFormData('reviewLevels', 'directorReview', e.target.checked)} />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-text-primary">Client review required</label>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" className="sr-only peer" checked={formData.reviewLevels.clientReview} onChange={e => updateNestedFormData('reviewLevels', 'clientReview', e.target.checked)} />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-text-primary">ESA check required</label>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" className="sr-only peer" checked={formData.reviewLevels.esaStatusCheck} onChange={e => updateNestedFormData('reviewLevels', 'esaStatusCheck', e.target.checked)} />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block text-text-primary">On Rejection</label>
              <select 
                value={formData.reviewLevels.offerRejectionLoop}
                onChange={e => updateNestedFormData('reviewLevels', 'offerRejectionLoop', e.target.value)}
                className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-surface text-text-primary h-9"
              >
                <option value="restart">Restart from new CVs</option>
                <option value="clientReview">Return to client review</option>
                <option value="ask_ta_each_time">Ask TA each time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Agent 3 — Follow-Up Sequence */}
        <div className="border border-border rounded-xl p-4 space-y-4 bg-surface">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 text-text-primary">
                <span className="material-symbols-outlined text-[18px] text-primary-container">forum</span> Follow-Up Sequence & Outreach
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Automatically follow up with candidates to request missing information.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" className="sr-only peer" checked={formData.enableFollowUps} onChange={e => updateFormData('enableFollowUps', e.target.checked)} />
              <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
            </label>
          </div>

          {formData.enableFollowUps && (
            <div className="space-y-4 pt-4 border-t border-border animate-in fade-in">
              <div className="bg-surface-container-low p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary-container" />
                  <span className="text-sm font-bold text-text-primary">AI-Driven Dynamic Follow-Up</span>
                </div>
                <p className="text-xs text-text-secondary mb-4">
                  The AI will automatically handle up to {formData.maxFollowUpAttempts} follow-ups within {formData.maxFollowUpDays} days. It uses the initial template to start the conversation, and learns your tone from the sample template to draft contextual replies based on the candidate's answers.
                </p>

                {/* Custom Follow-up Questions */}
                <div className="mb-6 pt-4 border-t border-border">
                  <div className="mb-2">
                    <label className="text-xs font-semibold text-text-primary block">Custom Follow-Up Questions (Optional)</label>
                    <p className="text-[10px] text-text-secondary">The AI will automatically ask these questions and extract the candidate's answers. They will be included in the {'{missing_fields}'} list.</p>
                  </div>
                  
                  <div className="space-y-2 max-w-md">
                    {formData.customFollowUpQuestions.map((q, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-surface-container-low border border-border rounded-lg p-2">
                        <span className="text-xs text-text-primary">{q}</span>
                        <button 
                          onClick={() => updateFormData('customFollowUpQuestions', formData.customFollowUpQuestions.filter((_, i) => i !== idx))}
                          className="text-text-secondary hover:text-red-500 transition-colors p-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                    
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        id="new-custom-question"
                        className="flex-1 bg-surface border border-border rounded-lg p-2 text-xs text-text-primary outline-none focus:border-primary-container"
                        placeholder="e.g. Do you have a valid UAE driver's license?"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val && !formData.customFollowUpQuestions.includes(val)) {
                              updateFormData('customFollowUpQuestions', [...formData.customFollowUpQuestions, val]);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <button 
                        onClick={() => {
                          const input = document.getElementById('new-custom-question') as HTMLInputElement;
                          const val = input.value.trim();
                          if (val && !formData.customFollowUpQuestions.includes(val)) {
                            updateFormData('customFollowUpQuestions', [...formData.customFollowUpQuestions, val]);
                            input.value = '';
                          }
                        }}
                        className="bg-surface-container border border-border hover:bg-surface-container-highest px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <div>
                        <label className="text-xs font-semibold text-text-primary block flex items-center gap-2">
                          Initial Outreach Template
                          <div className="group relative">
                            <span className="material-symbols-outlined text-[14px] text-text-secondary cursor-help">info</span>
                            <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-surface-container shadow-lg border border-border rounded-lg text-[10px] text-text-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              <span className="font-bold">Note:</span> {'{missing_fields}'} will automatically list 'CV', 'Current Salary', 'Expected Salary', 'Notice Period' and any Custom Questions below if the candidate has not provided them yet.
                            </div>
                          </div>
                        </label>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-text-secondary">Sent immediately when candidate enters follow-up.</p>
                        </div>
                      </div>
                      <select 
                        className="text-[10px] bg-surface-container border border-border rounded px-2 py-1 outline-none cursor-pointer max-w-[150px] truncate"
                        value=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'manage') {
                            setIsTemplateModalOpen(true);
                          } else {
                            const t = templates?.find(temp => temp._id === val);
                            if (t) updateFormData('followUpInitialTemplate', t.content);
                          }
                        }}
                      >
                        <option value="" disabled>Load Template...</option>
                        {templates?.filter(t => t.type === 'initial_outreach').map(t => (
                          <option key={t._id} value={t._id}>{t.name}</option>
                        ))}
                        <option disabled>──────────</option>
                        <option value="manage">+ Manage Templates</option>
                      </select>
                    </div>
                    <SmartTemplateEditor 
                      value={formData.followUpInitialTemplate}
                      onChange={(val) => updateFormData('followUpInitialTemplate', val)}
                      requiredVariables={['{missing_fields}']}
                      rows={8}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <div>
                        <label className="text-xs font-semibold text-text-primary block">Sample Follow-Up Template</label>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-text-secondary">The AI learns your tone from this.</p>
                        </div>
                      </div>
                      <select 
                        className="text-[10px] bg-surface-container border border-border rounded px-2 py-1 outline-none cursor-pointer max-w-[150px] truncate"
                        value=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'manage') {
                            setIsTemplateModalOpen(true);
                          } else {
                            const t = templates?.find(temp => temp._id === val);
                            if (t) updateFormData('followUpSampleTemplate', t.content);
                          }
                        }}
                      >
                        <option value="" disabled>Load Template...</option>
                        {templates?.filter(t => t.type === 'sample_follow_up').map(t => (
                          <option key={t._id} value={t._id}>{t.name}</option>
                        ))}
                        <option disabled>──────────</option>
                        <option value="manage">+ Manage Templates</option>
                      </select>
                    </div>
                    <SmartTemplateEditor 
                      value={formData.followUpSampleTemplate}
                      onChange={(val) => updateFormData('followUpSampleTemplate', val)}
                      rows={8}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-sm">
                  <div>
                    <label className="text-xs font-semibold text-text-primary mb-1 block">Max Attempts</label>
                    <input 
                      type="number" 
                      min="1" max="5"
                      className="w-full text-sm h-8 border border-border rounded-md px-2 bg-surface text-text-primary"
                      value={formData.maxFollowUpAttempts}
                      onChange={(e) => updateFormData('maxFollowUpAttempts', parseInt(e.target.value) || 3)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-primary mb-1 block">Max Days (Timeout)</label>
                    <input 
                      type="number" 
                      min="1" max="14"
                      className="w-full text-sm h-8 border border-border rounded-md px-2 bg-surface text-text-primary"
                      value={formData.maxFollowUpDays}
                      onChange={(e) => updateFormData('maxFollowUpDays', parseInt(e.target.value) || 3)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="border border-border rounded-xl p-4 space-y-4 bg-surface">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-text-primary">
              <span className="material-symbols-outlined text-[16px] text-primary-container">schedule</span> SLA Thresholds (days)
            </h3>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" className="sr-only peer" checked={formData.enablePipelineHealth} onChange={e => updateFormData('enablePipelineHealth', e.target.checked)} />
              <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
            </label>
          </div>
          {formData.enablePipelineHealth && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-border animate-in fade-in">
              {[
                { key: "noNewCvs", label: "No New CVs", def: formData.pipelineAlerts.noNewCvs },
                { key: "taReviewPending", label: "TA Review", def: formData.pipelineAlerts.taReviewPending },
                { key: "secondShortlistPending", label: "2nd Shortlist", def: formData.pipelineAlerts.secondShortlistPending },
                { key: "directorReviewPending", label: "Director Review", def: formData.pipelineAlerts.directorReviewPending },
                { key: "clientReviewPending", label: "Client Review", def: formData.pipelineAlerts.clientReviewPending },
                { key: "interviewNotScheduled", label: "Interview", def: formData.pipelineAlerts.interviewNotScheduled },
                { key: "offerNotMade", label: "Offer", def: formData.pipelineAlerts.offerNotMade },
              ].map((sla) => (
                <div key={sla.key}>
                  <label className="text-xs text-text-secondary mb-1 block">{sla.label}</label>
                  <input
                    type="number" min="1"
                    value={sla.def}
                    onChange={(e) => updateNestedFormData('pipelineAlerts', sla.key, e.target.value)}
                    className="w-full text-sm h-8 border border-border rounded-md px-2 bg-surface text-text-primary"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };


    const renderStep4 = () => {
    // Advanced validation logic
    const mustFix = [];
    const recommended = [];
    const ready = [];

    if (!formData.jobTitle) mustFix.push({ msg: "Job Title: Enter the position name", action: "Fix Now", step: 1 });
    else ready.push("Job Title added");

    if (!formData.requiredSkills) mustFix.push({ msg: "Required Skills: Add at least 1 skill", action: "Fix Now", step: 1 });
    else ready.push("Matching Criteria configured");

    if (formData.channels.metaCampaign) {
      const metaNumber = formData.useDifferentMetaNumber ? formData.metaWhatsAppNumber : formData.commonWhatsAppNumber;
      if (!metaNumber || !metaNumber.trim()) {
        mustFix.push({ msg: "Meta Campaign: WhatsApp number for ads is required", action: "Fix Now", step: 2 });
      } else {
        ready.push("Meta Campaign WhatsApp number configured");
      }
    }

    if (formData.channels.whatsapp && !formData.commonWhatsAppNumber.trim()) {
      mustFix.push({ msg: "WhatsApp Channel: Select or enter a WhatsApp number", action: "Fix Now", step: 2 });
    } else if (formData.channels.whatsapp) {
      ready.push("WhatsApp channel configured");
      recommended.push({ msg: "WhatsApp: Common number configured but QR not downloaded yet", action: "Download QR", step: 2 });
    }
    
    if (formData.jobDescription) ready.push("Job Description added");
    if (formData.channels.emailCampaign && formData.emailInbox) ready.push("Email Campaign inbox ready");
    else if (formData.channels.emailCampaign && !formData.emailInbox) mustFix.push({ msg: "Email Campaign: Inbox address is missing", action: "Fix Now", step: 2 });
    if (formData.enableMatching) ready.push("Agent 2 Matching enabled");
    
    const keyword = formData.jobKeyword || 'JOB24';
    const commonWhatsAppNumber = "+94770000001";

    const enabledChannels = Object.entries(formData.channels).filter(([_, enabled]) => enabled).map(([key]) => key);

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-4xl">
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-1">Review & Publish</h2>
          <p className="text-sm text-text-secondary">Review your job configuration before publishing.</p>
        </div>

        {/* Keyword Badge */}
        <div className="flex items-center gap-3 bg-primary-container/10 border border-primary-container/20 rounded-xl p-4">
          <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px] text-primary-container">work</span>
          </div>
          <div>
            <p className="font-semibold text-text-primary">{formData.jobTitle || "Untitled Job"}</p>
            <p className="text-xs text-text-secondary">Keyword: <span className="font-mono font-bold text-primary-container">{keyword}</span></p>
          </div>
        </div>

        {/* Validation Status Panels */}
        <div className="space-y-4">
          {mustFix.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-700 font-bold mb-3">
                <span className="material-symbols-outlined text-[20px]">error</span>
                MUST FIX BEFORE PUBLISHING ({mustFix.length})
              </div>
              <ul className="space-y-2 ml-7">
                {mustFix.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-red-600">
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] opacity-70">close</span> {item.msg}</span>
                    <button className="bg-white border border-red-200 text-red-700 px-3 py-1 rounded shadow-sm hover:bg-red-50 font-medium transition-colors text-xs" onClick={() => setCurrentStep(item.step)}>{item.action}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recommended.length > 0 && mustFix.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-700 font-bold mb-3">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                RECOMMENDED ({recommended.length})
              </div>
              <ul className="space-y-2 ml-7">
                {recommended.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-amber-700">
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] opacity-70">info</span> {item.msg}</span>
                    <div className="flex gap-2">
                      <button className="bg-white border border-amber-200 text-amber-700 px-3 py-1 rounded shadow-sm hover:bg-amber-50 font-medium transition-colors text-xs">{item.action}</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mustFix.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl p-4 font-medium">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              Ready to publish! All required fields are filled.
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-border bg-surface rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Details</p>
            <div className="space-y-1.5 text-xs">
              <p><span className="text-text-secondary inline-block w-20">Client:</span> <span className="text-text-primary font-medium">{formData.clientCompany || "—"}</span></p>
              <p><span className="text-text-secondary inline-block w-20">Location:</span> <span className="text-text-primary font-medium">{formData.location || "—"}</span></p>
              <p><span className="text-text-secondary inline-block w-20">Seniority:</span> <span className="text-text-primary font-medium">{formData.seniorityLevel || "—"}</span></p>
              <p><span className="text-text-secondary inline-block w-20">Type:</span> <span className="text-text-primary font-medium">{formData.recruitmentType || "—"}</span></p>
              <p><span className="text-text-secondary inline-block w-20">Recruiter:</span> <span className="text-text-primary font-medium">{formData.primaryRecruiter || "—"}</span></p>
            </div>
          </div>
          
          <div className="border border-border bg-surface rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Channels ({enabledChannels.length})</p>
            <div className="flex flex-wrap gap-2">
              {enabledChannels.length > 0 ? enabledChannels.map((ch) => (
                <span key={ch} className="text-xs bg-surface-variant text-text-primary border border-border px-2.5 py-1 rounded-md capitalize">
                  {ch.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              )) : (
                <span className="text-xs text-text-secondary italic">None enabled</span>
              )}
            </div>
          </div>
          
          <div className="border border-border bg-surface rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Requirements</p>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {formData.requiredSkills ? formData.requiredSkills.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                  <span key={s} className="text-[10px] bg-primary-container/10 text-primary-container border border-primary-container/20 px-2 py-0.5 rounded-full">{s}</span>
                )) : <span className="text-xs text-text-secondary italic">No skills added</span>}
              </div>
              <p className="text-xs"><span className="text-text-secondary inline-block w-20">Experience:</span> <span className="text-text-primary font-medium">{formData.experienceMin}-{formData.experienceMax} years</span></p>
            </div>
          </div>
          
          <div className="border border-border bg-surface rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">AI Config</p>
            <div className="space-y-1.5 text-xs">
              <p><span className="text-text-secondary inline-block w-28">Matching:</span> <span className="text-text-primary font-medium">{formData.enableMatching ? `Score Min ${formData.minMatchScore}` : 'Disabled'}</span></p>
              <p><span className="text-text-secondary inline-block w-28">Follow-Ups:</span> <span className="text-text-primary font-medium">{formData.enableFollowUps ? 'Active' : 'Disabled'}</span></p>
              <p><span className="text-text-secondary inline-block w-28">Pipeline Health:</span> <span className="text-text-primary font-medium">{formData.enablePipelineHealth ? 'Active' : 'Disabled'}</span></p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded || !canCreateJob) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        {!isLoaded ? (
          <Loader2 className="w-8 h-8 animate-spin text-primary-container" />
        ) : (
          <>
            <ShieldAlert className="w-12 h-12 text-red-500" />
            <h2 className="text-xl font-bold text-text-primary">Access Denied</h2>
            <p className="text-text-secondary text-center max-w-md">
              You do not have permission to create jobs. If you believe this is an error, please contact your System Administrator.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-background p-8 min-h-screen font-body max-w-5xl mx-auto pb-32">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Create New Job</h1>
        <p className="text-text-secondary mt-1 text-sm">Configure job details, ingestion channels, and AI agents.</p>
      </div>

      {renderStepIndicator()}

      <div className="mb-10 min-h-[400px]">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-40 pl-64">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            {currentStep > 1 && (
              <button 
                className="px-6 py-2 border border-border text-text-secondary rounded-md hover:bg-surface-variant transition-colors font-medium bg-white disabled:opacity-50" 
                onClick={handleBack}
                disabled={isPublishing}
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-4 items-center">
            {publishError && (
              <span className="text-red-500 text-sm font-medium">{publishError}</span>
            )}
            <button 
              className="px-6 py-2 border border-border text-text-primary rounded-md hover:bg-surface-variant transition-colors bg-white font-medium disabled:opacity-50 flex items-center gap-2" 
              onClick={handleSaveDraft}
              disabled={!formData.jobTitle || isDrafting || isPublishing}
            >
              {isDrafting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isDrafting ? "Saving..." : "Save as Draft"}
            </button>
            {currentStep < 4 ? (
              <button 
                className="px-8 py-2 bg-primary-container text-on-primary rounded-md hover:bg-primary transition-colors font-medium shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleNext}
                disabled={isNextDisabled()}
              >
                Next Step <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            ) : (
              <div className="flex gap-4">
                <button 
                  className="px-6 py-2 bg-surface border-2 border-border text-text-primary rounded-md hover:bg-surface-variant transition-colors font-medium shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={handleSaveDraft}
                  disabled={!formData.jobTitle || isDrafting || isPublishing}
                >
                  {isDrafting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="material-symbols-outlined">save</span>}
                  {isDrafting ? "Saving..." : "Save as Draft"}
                </button>
                <button 
                  className="px-8 py-2 bg-primary-container text-on-primary rounded-md hover:bg-primary transition-colors font-medium shadow-md flex items-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={handlePublish}
                  disabled={!formData.jobTitle || !formData.requiredSkills || isPublishing || isDrafting}
                >
                {isPublishing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="material-symbols-outlined">rocket_launch</span>
                )}
                {isPublishing ? "Publishing..." : "Publish Job"}
              </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showTemplateModal && (() => {
        const isSystemMode = formData.followUpMode === 'system';
        const steps = isSystemMode 
          ? [
              { id: 'day0', day: 0, channel: 'WhatsApp', emailSubject: formData.followUpTemplates.day0.emailSubject, emailBody: formData.followUpTemplates.day0.emailBody, whatsappBody: formData.followUpTemplates.day0.whatsappBody },
              { id: 'day2', day: 2, channel: 'Email', emailSubject: formData.followUpTemplates.day2.emailSubject, emailBody: formData.followUpTemplates.day2.emailBody, whatsappBody: formData.followUpTemplates.day2.whatsappBody },
              { id: 'day4', day: 4, channel: 'WhatsApp', emailSubject: formData.followUpTemplates.day4.emailSubject, emailBody: formData.followUpTemplates.day4.emailBody, whatsappBody: formData.followUpTemplates.day4.whatsappBody },
              { id: 'day7', day: 7, channel: 'Email', emailSubject: formData.followUpTemplates.day7.emailSubject, emailBody: formData.followUpTemplates.day7.emailBody, whatsappBody: formData.followUpTemplates.day7.whatsappBody },
            ]
          : (formData.customFollowUpSteps || []);

        const activeIndex = Math.min(Math.max(0, templateModalStepIndex), steps.length - 1);
        const activeStep = steps[activeIndex] || steps[0] || { day: 0, channel: 'Email', emailSubject: '', emailBody: '', whatsappBody: '' };

        const activeSubject = activeStep.emailSubject || '';
        const activeBody = templateModalChannel === 'email' ? activeStep.emailBody || '' : activeStep.whatsappBody || '';

        const getPreviewText = (text: string) => {
          if (!text) return '';
          const candidateName = "Jane Doe";
          const jobTitle = formData.jobTitle || "Product Manager";
          const missingFieldsList = [];
          if (formData.followUpTemplates.requestCv) missingFieldsList.push("CV / Resume Document");
          if (formData.followUpTemplates.requestCurrentSalary) missingFieldsList.push("Current Salary Details");
          if (formData.followUpTemplates.requestExpectedSalary) missingFieldsList.push("Expected Salary Range");
          if (formData.followUpTemplates.requestNoticePeriod) missingFieldsList.push("Notice Period / Availability");
          const missingFieldsStr = missingFieldsList.length > 0 
            ? missingFieldsList.map(f => `• ${f}`).join('\n') 
            : "• CV / Resume Document\n• Current Salary Details\n• Expected Salary Range\n• Notice Period / Availability";
          return text
            .replace(/\{candidate_name\}/g, candidateName)
            .replace(/\{job_title\}/g, jobTitle)
            .replace(/\{missing_fields\}/g, missingFieldsStr);
        };

        return (
          <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="p-5 border-b border-border flex items-center justify-between bg-surface-container-low">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary-container">
                    <span className="material-symbols-outlined text-[22px]">tune</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-text-primary flex items-center gap-2">
                      Customize Follow-Up Sequence & Schedule
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        isSystemMode 
                          ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' 
                          : 'text-blue-700 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                      }`}>
                        {isSystemMode ? 'System Recommended' : 'Custom Config'}
                      </span>
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">Configure dispatch timing, trigger stages, requested info, and message templates.</p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowTemplateModal(false)}
                  className="w-8 h-8 rounded-lg hover:bg-surface-variant flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Top Navigation Tabs (Schedule vs Sequence) */}
              <div className="flex border-b border-border bg-surface-container-low px-6 gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateModalTab('schedule')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    templateModalTab === 'schedule'
                      ? 'border-primary-container text-primary-container'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Clock className="w-4 h-4" /> 1. Schedule & Triggers
                </button>

                <button
                  type="button"
                  onClick={() => setTemplateModalTab('sequence')}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    templateModalTab === 'sequence'
                      ? 'border-primary-container text-primary-container'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" /> 2. Message Sequence & Templates ({steps.length})
                </button>
              </div>

              {/* Modal Content Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* TAB 1: Schedule & Triggers */}
                {templateModalTab === 'schedule' && (
                  <div className="space-y-5 animate-in fade-in">
                    
                    {/* Preset Mode Switcher */}
                    <div className="flex items-center gap-1 bg-surface-container-low p-1.5 rounded-xl border border-border">
                      <button
                        type="button"
                        onClick={() => updateFormData('followUpMode', 'system')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          formData.followUpMode === 'system'
                            ? 'bg-primary-container text-white shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        System Recommended Protocol (Default)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateFormData('followUpMode', 'custom')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          formData.followUpMode === 'custom'
                            ? 'bg-surface text-text-primary shadow-sm border border-border'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">tune</span>
                        Custom Configuration Mode
                      </button>
                    </div>

                    {/* Time Window & Allowed Days */}
                    <div className="bg-surface-container-low p-4 rounded-xl border border-border space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary-container" />
                          <span className="text-xs font-bold text-text-primary">Outreach Time Window & Schedule</span>
                        </div>
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-surface border border-border text-emerald-700 dark:text-emerald-400 font-semibold">
                          Sri Lanka Time (UTC+5:30)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="text-[11px] font-semibold text-text-secondary block mb-1">Active Window Hours</label>
                          <div className="flex items-center gap-2">
                            <select
                              value={formData.followUpWindowStart}
                              disabled={isSystemMode}
                              onChange={e => updateFormData('followUpWindowStart', e.target.value)}
                              className="flex-1 text-xs h-8 border border-border rounded-lg px-2 bg-surface text-text-primary disabled:opacity-60"
                            >
                              {['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00'].map(t => (
                                <option key={t} value={t}>{t} (Morning)</option>
                              ))}
                            </select>
                            <span className="text-xs text-text-secondary">to</span>
                            <select
                              value={formData.followUpWindowEnd}
                              disabled={isSystemMode}
                              onChange={e => updateFormData('followUpWindowEnd', e.target.value)}
                              className="flex-1 text-xs h-8 border border-border rounded-lg px-2 bg-surface text-text-primary disabled:opacity-60"
                            >
                              {['16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'].map(t => (
                                <option key={t} value={t}>{t} (Evening)</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-text-secondary block mb-1">Allowed Dispatch Days</label>
                          <div className="flex flex-wrap gap-1">
                            {[
                              { name: 'Monday', short: 'Mon' },
                              { name: 'Tuesday', short: 'Tue' },
                              { name: 'Wednesday', short: 'Wed' },
                              { name: 'Thursday', short: 'Thu' },
                              { name: 'Friday', short: 'Fri' },
                              { name: 'Saturday', short: 'Sat' },
                              { name: 'Sunday', short: 'Sun' },
                            ].map(d => {
                              const active = (formData.followUpAllowedDays || []).includes(d.name);
                              return (
                                <button
                                  key={d.name}
                                  type="button"
                                  disabled={isSystemMode}
                                  onClick={() => toggleAllowedDay(d.name)}
                                  className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-all ${
                                    active
                                      ? 'bg-primary-container text-white border-primary-container shadow-xs'
                                      : 'bg-surface text-text-secondary border-border hover:border-primary-container/40'
                                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                                >
                                  {d.short}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Trigger Stage & Checklist */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Trigger stage selection */}
                      <div className="bg-surface-container-low p-3.5 rounded-xl border border-border">
                        <label className="text-xs font-bold text-text-primary mb-1.5 block">Trigger outreach when candidate reaches</label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { value: "applied", label: "Applied" },
                            { value: "shortlisted", label: "Shortlisted" },
                            { value: "interview_scheduled", label: "Interview Scheduled" },
                            { value: "offered", label: "Offered" }
                          ].map((stage) => {
                            const selected = formData.agent3TriggerStages.includes(stage.value);
                            return (
                              <button
                                key={stage.value}
                                type="button"
                                disabled={isSystemMode}
                                onClick={() => {
                                  const newStages = selected
                                    ? formData.agent3TriggerStages.filter(s => s !== stage.value)
                                    : [...formData.agent3TriggerStages, stage.value];
                                  updateFormData('agent3TriggerStages', newStages);
                                }}
                                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all cursor-pointer ${
                                  selected
                                    ? 'bg-primary-container text-white border-primary-container shadow-xs'
                                    : 'bg-surface text-text-secondary hover:border-primary-container/40'
                                } disabled:opacity-60 disabled:cursor-not-allowed`}
                              >
                                {stage.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Requested Info Checklist */}
                      <div className="bg-surface-container-low p-3.5 rounded-xl border border-border">
                        <label className="text-xs font-bold text-text-primary mb-1.5 block">Requested Information Checklist:</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { key: "requestCv", label: "CV / Resume" },
                            { key: "requestCurrentSalary", label: "Current Salary" },
                            { key: "requestExpectedSalary", label: "Expected Salary" },
                            { key: "requestNoticePeriod", label: "Notice Period" },
                          ].map(item => {
                            const checked = (formData.followUpTemplates as any)[item.key];
                            return (
                              <label
                                key={item.key}
                                className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                  checked
                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-semibold'
                                    : 'bg-surface border-border text-text-secondary hover:bg-surface-container-low'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isSystemMode}
                                  onChange={e => updateNestedFormData('followUpTemplates', item.key, e.target.checked)}
                                  className="rounded text-primary-container focus:ring-0 w-3 h-3 disabled:opacity-60"
                                />
                                <span className="text-[10px] truncate">{item.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Action after final step */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-surface-container-low rounded-xl border border-border text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                        <span className="text-text-secondary">Sequence automatically stops as soon as the candidate replies.</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-text-primary">After Final Step:</span>
                        <select
                          value={formData.followUpSchedule.markUnresponsive ? "mark_unresponsive" : "continue_weekly"}
                          disabled={isSystemMode}
                          onChange={e => updateNestedFormData('followUpSchedule', 'markUnresponsive', e.target.value === 'mark_unresponsive')}
                          className="text-xs h-8 border border-border rounded-md px-2 bg-surface text-text-primary disabled:opacity-60"
                        >
                          <option value="mark_unresponsive">Mark unresponsive & notify TA</option>
                          <option value="continue_weekly">Continue weekly follow-ups</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: Message Sequence & Templates */}
                {templateModalTab === 'sequence' && (
                  <div className="space-y-5 animate-in fade-in">
                    
                    {/* Dynamic Steps Selector & Add Step button */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border">
                      <div className="flex gap-1.5 overflow-x-auto">
                        {steps.map((st, i) => (
                          <button
                            key={st.id || i}
                            type="button"
                            onClick={() => {
                              setTemplateModalStepIndex(i);
                              setTemplateModalChannel(st.channel.toLowerCase() as any);
                            }}
                            className={`py-2 px-3.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                              activeIndex === i
                                ? 'bg-primary-container text-white border-primary-container shadow-xs'
                                : 'bg-surface text-text-secondary hover:text-text-primary border-border'
                            }`}
                          >
                            Follow-up {i + 1} <span className="text-[10px] opacity-80">(Day {st.day})</span>
                          </button>
                        ))}
                      </div>

                      {!isSystemMode && (
                        <button
                          type="button"
                          onClick={addFollowUpStep}
                          className="text-xs font-bold text-primary-container px-3 py-1.5 rounded-lg border border-primary-container/20 hover:bg-primary-container/10 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">add</span> Add Step
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col md:flex-row gap-6">
                      
                      {/* Editor Column */}
                      <div className="flex-1 space-y-4">
                        
                        {/* Step Configuration Controls */}
                        {!isSystemMode && (
                          <div className="p-3 bg-surface-container-low border border-border rounded-xl flex items-center justify-between flex-wrap gap-3 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-text-primary">Dispatch Delay:</span>
                              <div className="flex items-center gap-1">
                                <span className="text-text-secondary">Day</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="90"
                                  value={activeStep.day}
                                  onChange={e => updateCustomStep(activeIndex, 'day', parseInt(e.target.value) || 0)}
                                  className="w-14 h-7 text-xs font-mono font-bold border border-border rounded px-1.5 bg-surface text-text-primary text-center"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="font-bold text-text-primary">Channel:</span>
                              <select
                                value={activeStep.channel}
                                onChange={e => {
                                  const newChan = e.target.value;
                                  updateCustomStep(activeIndex, 'channel', newChan);
                                  setTemplateModalChannel(newChan.toLowerCase() as any);
                                }}
                                className="text-xs h-7 border border-border rounded px-2 bg-surface text-text-primary font-semibold"
                              >
                                <option value="WhatsApp">WhatsApp</option>
                                <option value="Email">Email</option>
                              </select>
                            </div>

                            {steps.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  removeFollowUpStep(activeIndex);
                                  setTemplateModalStepIndex(Math.max(0, activeIndex - 1));
                                }}
                                className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[14px]">delete</span> Delete Step
                              </button>
                            )}
                          </div>
                        )}

                        {/* Channel Switcher */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setTemplateModalChannel('email')}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                templateModalChannel === 'email'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-surface-container-low text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              <Mail className="w-3.5 h-3.5" /> Email Template
                            </button>
                            <button
                              type="button"
                              onClick={() => setTemplateModalChannel('whatsapp')}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                templateModalChannel === 'whatsapp'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-surface-container-low text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Message
                            </button>
                          </div>

                          <div className="flex items-center bg-surface-container-low p-0.5 rounded-lg border border-border">
                            <button
                              type="button"
                              onClick={() => setTemplateModalView('editor')}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                templateModalView === 'editor'
                                  ? 'bg-surface text-text-primary shadow-xs'
                                  : 'text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setTemplateModalView('preview')}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                templateModalView === 'preview'
                                  ? 'bg-surface text-text-primary shadow-xs'
                                  : 'text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              <Eye className="w-3 h-3" /> Preview
                            </button>
                          </div>
                        </div>

                        {templateModalView === 'editor' ? (
                          <div className="space-y-4 animate-in fade-in">
                            {/* Insert Tag pills */}
                            {!isSystemMode && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-text-secondary mr-1 uppercase">Insert tag:</span>
                                {[
                                  { label: "{candidate_name}", tag: "{candidate_name}" },
                                  { label: "{job_title}", tag: "{job_title}" },
                                  { label: "{missing_fields}", tag: "{missing_fields}" },
                                ].map(ph => (
                                  <button
                                    key={ph.tag}
                                    type="button"
                                    onClick={() => {
                                      if (templateModalChannel === 'email') {
                                        updateCustomStep(activeIndex, 'emailBody', activeBody + ` ${ph.tag}`);
                                      } else {
                                        updateCustomStep(activeIndex, 'whatsappBody', activeBody + ` ${ph.tag}`);
                                      }
                                    }}
                                    className="text-[10px] px-2 py-0.5 bg-surface-container-low hover:bg-primary-container/10 hover:text-primary-container border border-border rounded font-mono text-text-primary transition-colors cursor-pointer"
                                  >
                                    + {ph.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Email subject line */}
                            {templateModalChannel === 'email' && (
                              <div>
                                <label className="text-xs font-bold text-text-primary block mb-1">Email Subject Line</label>
                                <input
                                  type="text"
                                  value={activeSubject}
                                  disabled={isSystemMode}
                                  onChange={e => updateCustomStep(activeIndex, 'emailSubject', e.target.value)}
                                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary-container disabled:opacity-75 disabled:cursor-not-allowed"
                                  placeholder="Email subject line with placeholders..."
                                />
                              </div>
                            )}

                            {/* Body text area */}
                            <div>
                              <label className="text-xs font-bold text-text-primary block mb-1">
                                {templateModalChannel === 'email' ? 'Email Body' : 'WhatsApp Message'}
                              </label>
                              <textarea
                                rows={8}
                                value={activeBody}
                                disabled={isSystemMode}
                                onChange={e => {
                                  if (templateModalChannel === 'email') {
                                    updateCustomStep(activeIndex, 'emailBody', e.target.value);
                                  } else {
                                    updateCustomStep(activeIndex, 'whatsappBody', e.target.value);
                                  }
                                }}
                                className="w-full text-xs border border-border rounded-lg p-3.5 bg-surface text-text-primary font-mono focus:outline-none focus:border-primary-container resize-none disabled:opacity-75 disabled:cursor-not-allowed leading-relaxed"
                                placeholder="Write your custom message template..."
                              />
                            </div>
                          </div>
                        ) : (
                          /* Embedded Simple Preview */
                          <div className="bg-surface-container-low p-4 rounded-xl border border-border space-y-3 animate-in fade-in">
                            <p className="text-[11px] font-bold text-text-secondary uppercase">Simple preview:</p>
                            {templateModalChannel === 'email' ? (
                              <div className="space-y-2 text-xs">
                                <div className="bg-surface p-2 rounded-lg border border-border font-semibold text-text-primary">
                                  Subject: {getPreviewText(activeSubject)}
                                </div>
                                <div className="bg-surface p-3 rounded-lg border border-border text-text-primary whitespace-pre-wrap leading-relaxed">
                                  {getPreviewText(activeBody)}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-[#E7F8EE] dark:bg-emerald-950/60 p-3.5 rounded-xl border border-[#CDE5D2] dark:border-emerald-800 text-xs text-gray-900 dark:text-emerald-100 whitespace-pre-wrap leading-relaxed">
                                {getPreviewText(activeBody)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Side Mock Preview Column */}
                      <div className="w-full md:w-[320px] shrink-0 space-y-3">
                        <span className="text-xs font-bold text-text-secondary block uppercase">Live Client Screen Preview</span>
                        
                        {templateModalChannel === 'email' ? (
                          <div className="border border-border rounded-2xl overflow-hidden bg-[#F4F6F9] dark:bg-zinc-950 shadow-inner flex flex-col h-[320px]">
                            <div className="bg-white dark:bg-zinc-900 p-3 border-b border-border space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-text-secondary font-mono">From: recruiter@career141.com</span>
                                <span className="text-[9px] text-text-secondary">Just now</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[9px] font-bold text-blue-600 dark:text-blue-400">R</span>
                                <span className="text-[10px] text-text-primary font-bold">To: Jane Doe</span>
                              </div>
                              <p className="text-[10px] font-bold text-text-primary pt-1 truncate">
                                Subject: {getPreviewText(activeSubject) || '(No subject)'}
                              </p>
                            </div>
                            
                            <div className="p-4 overflow-y-auto flex-1 bg-white dark:bg-zinc-900 m-2 rounded-lg border border-border/60 text-[10px] text-text-primary whitespace-pre-wrap leading-relaxed">
                              {getPreviewText(activeBody) || '(No template body message content)'}
                            </div>
                          </div>
                        ) : (
                          <div className="border border-border rounded-2xl overflow-hidden bg-[#ECE5DD] dark:bg-zinc-900 shadow-inner flex flex-col h-[320px]">
                            <div className="bg-[#075E54] dark:bg-[#004d40] text-white px-3 py-2 flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-[10px] font-bold text-emerald-800 dark:text-emerald-300">WA</div>
                              <div>
                                <p className="text-[10px] font-bold">Career141 Assistant</p>
                                <p className="text-[7px] text-emerald-100 opacity-90">Online</p>
                              </div>
                            </div>

                            <div className="flex-1 p-3 overflow-y-auto space-y-2 flex flex-col justify-end">
                              <div className="bg-white dark:bg-zinc-800 text-[10px] text-text-primary p-3 rounded-lg shadow-sm border border-border/20 max-w-[85%] self-start relative leading-relaxed">
                                <p className="whitespace-pre-wrap">{getPreviewText(activeBody) || '(No template body message content)'}</p>
                                <span className="text-[8px] text-text-secondary block text-right mt-1.5">12:00 PM</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border bg-surface-container-low flex items-center justify-between">
                <span className="text-[11px] text-text-secondary font-medium">
                  {templateModalTab === 'schedule' ? 'Tab 1 of 2 · Schedule & Triggers' : `Tab 2 of 2 · Step ${activeIndex + 1} of ${steps.length}`}
                </span>

                <div className="flex items-center gap-2">
                  {templateModalTab === 'schedule' ? (
                    <button
                      type="button"
                      onClick={() => setTemplateModalTab('sequence')}
                      className="px-4 py-2 bg-primary-container text-white rounded-lg text-xs font-semibold hover:bg-primary transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      Next: Edit Messages <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTemplateModal(false)}
                      className="px-5 py-2 bg-primary-container text-on-primary rounded-lg text-xs font-semibold hover:bg-primary transition-all shadow-xs cursor-pointer"
                    >
                      Done & Save
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-border animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-b from-green-50 to-surface p-8 flex flex-col items-center border-b border-border">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <span className="material-symbols-outlined text-[36px]">check_circle</span>
              </div>
              <h3 className="font-bold text-2xl text-text-primary mb-1 text-center">Job Published!</h3>
              <p className="text-text-secondary text-center text-sm font-medium">
                {formData.jobTitle || 'Brand Manager'} — {formData.clientCompany || 'Atlas Holdings'}
              </p>
              <div className="mt-3 bg-gray-800 px-3 py-1 rounded-full border border-gray-700 text-xs font-mono font-bold text-white shadow-sm inline-block">
                Keyword: {formData.jobKeyword || 'JOB24'}
              </div>
            </div>
            
            <div className="p-8 bg-surface">
              <h4 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Now Active:</h4>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-text-primary bg-surface-container-low p-3 rounded-lg border border-border">
                  <span className="material-symbols-outlined text-[18px] text-green-500">mark_email_read</span> Agent 7 monitoring email
                </div>
                <div className="flex items-center gap-2 text-sm text-text-primary bg-surface-container-low p-3 rounded-lg border border-border">
                  <span className="material-symbols-outlined text-[18px] text-green-500">forum</span> Agent 4 monitoring WA
                </div>
                <div className="flex items-center gap-2 text-sm text-text-primary bg-surface-container-low p-3 rounded-lg border border-border">
                  <span className="material-symbols-outlined text-[18px] text-green-500">search</span> Agent 2 scanning DB
                </div>
                <div className="flex items-center gap-2 text-sm text-text-primary bg-surface-container-low p-3 rounded-lg border border-border">
                  <span className="material-symbols-outlined text-[18px] text-green-500">health_and_safety</span> Agent 8 health monitor
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 flex items-start gap-3">
                <span className="material-symbols-outlined text-blue-600">info</span>
                <div className="text-sm text-blue-800">
                  <strong>23 existing database candidates</strong> match this role. Agent 5 is ready to begin phone screening based on your triggers.
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => router.push(`/dashboard/jobs/${createdJobId || formData.jobKeyword}`)} className="flex-1 py-3 bg-primary-container text-on-primary rounded-lg text-sm font-bold hover:bg-primary transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                  View Job Dashboard
                </button>
                <button className="flex-1 py-3 bg-surface border-2 border-border text-text-primary rounded-lg text-sm font-bold hover:bg-surface-variant transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">download</span> Job Assets
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Template Manager Modal */}
      <Modal 
        isOpen={isTemplateModalOpen} 
        onClose={() => setIsTemplateModalOpen(false)}
        title="Template Library"
        maxWidth="max-w-5xl"
      >
        <div className="p-4 bg-surface-container-low max-h-[70vh] overflow-y-auto">
          <MessageTemplatesTab />
        </div>
      </Modal>

    </div>
  );
}


"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Loader2 } from "lucide-react";

export default function CreateJobWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const teamMembers = useQuery(api.users.getTeamMembers);
  const createJob = useMutation(api.jobs.createJob);
  const updateJobChannels = useMutation(api.jobs.updateJobChannels);
  const updateJobAiConfig = useMutation(api.jobs.updateJobAiConfig);
  const publishJob = useMutation(api.jobs.publishJob);

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");

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
    supportingRecruiters: '',
    primaryRecruiter: 'Shambra Ameen',
    hiringManager: '',
    director: '',
    clientContact: '',

    // Step 2: Channel Setup
    jobKeyword: 'BRAND24',
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
    enableFollowUps: false,
    followUpSchedule: {
      day2: true, day2Channel: 'Email',
      day4: true, day4Channel: 'Email',
      day7: true, day7Channel: 'WhatsApp',
      markUnresponsive: true,
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
      dailyReport: true,
    }
  });

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

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError("");
    
    try {
      const primaryRecruiterObj = teamMembers?.find(m => m.fullName === formData.primaryRecruiter) || teamMembers?.[0];
      const primaryRecruiterId = primaryRecruiterObj?._id;
      
      if (!primaryRecruiterId) {
         throw new Error("No team members found in database to assign as Primary Recruiter.");
      }

      const directorObj = teamMembers?.find(m => m.fullName === formData.director);
      const directorId = directorObj?._id;

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
        primaryRecruiterId: primaryRecruiterId as any,
        directorId: directorId as any,
        clientContactName: formData.clientContact || undefined,
        clientContactEmail: formData.clientContact || undefined,
      });

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
          channelType: "meta",
          isEnabled: true,
          metaCampaignId: formData.metaCampaignId || undefined,
          whatsappNumber: (formData.useDifferentMetaNumber ? formData.metaWhatsAppNumber : formData.commonWhatsAppNumber) || undefined,
        });
      }
      if (formData.channels.emailCampaign) {
        channelsPayload.push({
          channelType: "email",
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
        agent3Day2Channel: formData.followUpSchedule.day2 ? formData.followUpSchedule.day2Channel.toLowerCase() : undefined,
        agent3Day4Channel: formData.followUpSchedule.day4 ? formData.followUpSchedule.day4Channel.toLowerCase() : undefined,
        agent3Day7Channel: formData.followUpSchedule.day7 ? formData.followUpSchedule.day7Channel.toLowerCase() : undefined,
        agent3AfterDay7: formData.followUpSchedule.markUnresponsive ? "mark_unresponsive" : "trigger_agent5",
        
        agent5Enabled: formData.enablePhoneScreening,
        agent5Trigger: "all_new_applicants",
        agent5CallScript: "default",
        agent5CustomQuestions: formData.additionalQuestions,
        agent5NoAnswerAction: "trigger_agent3",
        agent5HideCompany: formData.phoneScreeningConfidential,
        
        directorReviewEnabled: formData.reviewLevels.directorReview,
        clientReviewEnabled: formData.reviewLevels.clientReview,
        clientContactName: formData.reviewLevels.clientName || undefined,
        clientContactEmail: formData.reviewLevels.clientEmail || undefined,
        clientAccessLevel: "view_comment",
        esaCheckEnabled: formData.reviewLevels.esaStatusCheck,
        rejectionLoopAction: "restart_from_new_cvs",
        
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

      // Step 4: publishJob
      if (formData.jobStatus === 'Active') {
        await publishJob({ jobId });
      }

      setShowSuccessModal(true);
    } catch (err: any) {
      console.error("Publishing error:", err);
      setPublishError(err.message || "An unexpected error occurred while publishing.");
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
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
        <h3 className="font-card-header text-lg mb-4 text-text-primary">Job Identity</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Job Title *</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.jobTitle} onChange={e => updateFormData('jobTitle', e.target.value)} placeholder="e.g. Brand Manager" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Recruitment Type</label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.recruitmentType} onChange={e => updateFormData('recruitmentType', e.target.value)}>
              <option>Headhunting (passive candidate search)</option>
              <option>Job Posting (active applicants)</option>
              <option>Both (headhunting + posting)</option>
            </select>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-4 bg-surface-container-low p-4 rounded-md border border-border">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                <input type="checkbox" checked={formData.confidential} onChange={e => updateFormData('confidential', e.target.checked)} className="rounded text-primary-container focus:ring-primary-container" />
                Confidential Position?
              </label>
              <p className="text-xs text-text-secondary ml-6">If YES: Show industry only, hide client name</p>
            </div>
            {!formData.confidential ? (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Client/Company *</label>
                <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.clientCompany} onChange={e => updateFormData('clientCompany', e.target.value)} placeholder="e.g. Atlas Holdings" />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Industry shown to candidates *</label>
                <select className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.industry} onChange={e => updateFormData('industry', e.target.value)}>
                  <option value="">-- Select Industry --</option>
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
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Industry / Sector *</label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.industry} onChange={e => updateFormData('industry', e.target.value)}>
              <option value="">-- Select Industry --</option>
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
            <label className="block text-sm font-medium text-text-secondary mb-1">Job Status</label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.jobStatus} onChange={e => updateFormData('jobStatus', e.target.value)}>
              <option>Active</option>
              <option>Draft</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
        <h3 className="font-card-header text-lg mb-4 text-text-primary">Job Content</h3>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Job Description *</label>
          <textarea rows={6} className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.jobDescription} onChange={e => updateFormData('jobDescription', e.target.value)} placeholder="Paste full job description here..."></textarea>
          <div className="mt-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-md hover:bg-secondary-fixed-dim transition-colors text-sm font-medium" onClick={(e) => {
              e.preventDefault();
              alert("AI is extracting requirements...");
              updateFormData('requiredSkills', 'Brand Strategy, P&L Management, Marketing');
              updateFormData('niceToHaveSkills', 'Nielsen, Digital Marketing');
            }}>
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              Auto-Extract Requirements
            </button>
            <p className="text-xs text-text-secondary mt-1 ml-1">Click to let AI read the JD and auto-fill requirements below.</p>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
        <h3 className="font-card-header text-lg mb-4 text-text-primary">Matching Criteria</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Required Skills (comma separated) *</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.requiredSkills} onChange={e => updateFormData('requiredSkills', e.target.value)} placeholder="e.g. React, Node.js" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Nice-to-have Skills</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.niceToHaveSkills} onChange={e => updateFormData('niceToHaveSkills', e.target.value)} placeholder="e.g. TypeScript, AWS" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Min Exp (Yrs)</label>
              <input type="number" className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.experienceMin} onChange={e => updateFormData('experienceMin', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Max Exp (Yrs)</label>
              <input type="number" className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.experienceMax} onChange={e => updateFormData('experienceMax', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Seniority Level</label>
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
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Location</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.location} onChange={e => updateFormData('location', e.target.value)} placeholder="e.g. Colombo, Sri Lanka (Hybrid)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Salary Range + Currency</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.salaryRange} onChange={e => updateFormData('salaryRange', e.target.value)} placeholder="e.g. 200k - 300k LKR" />
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
        <h3 className="font-card-header text-lg mb-4 text-text-primary">Team Assignment</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Primary Recruiter</label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.primaryRecruiter} onChange={e => updateFormData('primaryRecruiter', e.target.value)}>
              <option>Shambra Ameen</option>
              <option>John Doe</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Supporting Recruiters (Optional)</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.supportingRecruiters} onChange={e => updateFormData('supportingRecruiters', e.target.value)} placeholder="Select team members..." />
            <p className="text-[11px] text-text-secondary mt-1">Additional TAs who can access and work on this job.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Director / Reviewer *</label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.director} onChange={e => updateFormData('director', e.target.value)}>
              <option value="">Select Director</option>
              <option>Jane Smith</option>
              <option>Michael Brown</option>
            </select>
            <p className="text-[11px] text-text-secondary mt-1">Person who does Level 2 review.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Client Contact (Optional)</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.clientContact} onChange={e => updateFormData('clientContact', e.target.value)} placeholder="Name + Email" />
            <p className="text-[11px] text-text-secondary mt-1">For Level 3 client review access.</p>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 opacity-50 px-2 pointer-events-none">
        <span className="text-sm font-medium text-text-secondary">Job Keyword preview:</span>
        <span className="text-sm font-mono bg-surface-variant px-2 py-1 rounded text-text-secondary">[ {formData.jobKeyword || 'BRAND--'} ]</span>
        <span className="text-xs text-text-secondary">Full keyword assigned in Channel Setup</span>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const commonWhatsAppNumber = formData.commonWhatsAppNumber || "";
    const keyword = formData.jobKeyword;
    const metaNumber = formData.useDifferentMetaNumber ? formData.metaWhatsAppNumber : commonWhatsAppNumber;
    const displayMetaNumber = metaNumber ? metaNumber.replace(/[^0-9]/g, '') : '[WhatsApp Number]';

    return (
      <div className="space-y-6">
        <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
          <h3 className="font-card-header text-lg mb-4 text-text-primary">Global Routing</h3>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Job Keyword (Auto-generated address label)</label>
            <div className="flex gap-2">
              <input type="text" className="w-64 border border-border rounded-md px-3 py-2 text-body font-mono" value={keyword} onChange={e => updateFormData('jobKeyword', e.target.value)} />
              <button className="bg-primary-container/10 text-primary-container border border-primary-container/20 px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-container/20 transition-colors flex items-center gap-1.5" onClick={(e) => { e.preventDefault(); updateFormData('jobKeyword', 'BRAND' + Math.floor(100 + Math.random() * 900)); }}>
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Regenerate
              </button>
            </div>
            <p className="text-xs text-text-secondary mt-1">Required for LinkedIn subject parsing and WhatsApp/Meta detection.</p>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-card-header text-lg text-text-primary">Channel Configuration</h3>
            <div className="text-xs text-text-secondary">Priority (Drag to reorder coming soon)</div>
          </div>
          <div className="space-y-4">
            
            {/* Manual/Bulk */}
            <div className="flex items-start gap-4 p-4 border border-border rounded-md bg-surface-container-low">
              <span className="material-symbols-outlined text-text-secondary cursor-grab pt-1">drag_indicator</span>
              <input type="checkbox" checked disabled className="mt-1" />
              <div className="flex-1">
                <div className="font-medium text-text-primary">Manual / Bulk Upload</div>
                <p className="text-xs text-text-secondary mt-1">Always on. Recruiter can manually upload CVs to this job.</p>
              </div>
            </div>

            {/* LinkedIn */}
            <div className="flex items-start gap-4 p-4 border border-border rounded-md">
              <span className="material-symbols-outlined text-text-secondary cursor-grab pt-1">drag_indicator</span>
              <input type="checkbox" checked={formData.channels.linkedin} onChange={e => updateNestedFormData('channels', 'linkedin', e.target.checked)} className="mt-1" />
              <div className="flex-1">
                <div className="font-medium text-text-primary">LinkedIn</div>
                {formData.channels.linkedin && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-text-secondary mb-1">LinkedIn Routing Email</label>
                    {!formData.linkedinEmailSaved ? (
                      <div className="flex items-center gap-2 mb-2">
                        <input type="email" className="w-64 border border-border rounded-md px-3 py-2 text-sm bg-surface font-medium text-text-primary" placeholder="e.g. linkedin@career141.com" value={formData.linkedinEmail} onChange={e => updateFormData('linkedinEmail', e.target.value)} />
                        <button className="bg-primary-container text-on-primary px-4 py-2 rounded-md text-sm font-medium hover:bg-primary transition-colors" onClick={(e) => { e.preventDefault(); if (formData.linkedinEmail) updateFormData('linkedinEmailSaved', true); }}>Save</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                          <span className="font-mono bg-surface-variant px-2 py-1 rounded border border-border">{formData.linkedinEmail}</span>
                          <span className="text-green-600 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">check_circle</span> Active</span>
                        </div>
                        <button className="text-primary-container text-sm font-medium hover:underline" onClick={(e) => { e.preventDefault(); updateFormData('linkedinEmailSaved', false); }}>[Edit]</button>
                      </div>
                    )}
                    <div className="p-3 bg-blue-50 text-blue-800 rounded text-sm border border-blue-100 flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] mt-0.5">info</span>
                      <div>
                        CVs sent to this inbox with the subject line <strong>{keyword}</strong> will be automatically tagged as LinkedIn applicants.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp */}
            <div className="flex items-start gap-4 p-4 border border-border rounded-md">
              <span className="material-symbols-outlined text-text-secondary cursor-grab pt-1">drag_indicator</span>
              <input type="checkbox" checked={formData.channels.whatsapp} onChange={e => updateNestedFormData('channels', 'whatsapp', e.target.checked)} className="mt-1" />
              <div className="flex-1">
                <div className="font-medium text-text-primary">WhatsApp</div>
                {formData.channels.whatsapp && (
                  <div className="mt-3 bg-surface-container-low p-4 rounded-md border border-border">
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-text-secondary mb-1">WhatsApp Number</label>
                      {!formData.whatsappSaved ? (
                        <div className="flex items-center gap-2">
                          <input type="text" className="w-64 border border-border rounded-md px-3 py-2 text-sm bg-surface font-medium text-text-primary" placeholder="e.g. +94 77 000 0001" value={commonWhatsAppNumber} onChange={e => updateFormData('commonWhatsAppNumber', e.target.value)} />
                          <button className="bg-primary-container text-on-primary px-4 py-2 rounded-md text-sm font-medium hover:bg-primary transition-colors" onClick={(e) => { e.preventDefault(); if (commonWhatsAppNumber) updateFormData('whatsappSaved', true); }}>Save</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                            <span className="font-mono bg-surface-variant px-2 py-1 rounded border border-border">{commonWhatsAppNumber}</span>
                            <span className="text-green-600 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">check_circle</span> Active</span>
                          </div>
                          <button className="text-primary-container text-sm font-medium hover:underline" onClick={(e) => { e.preventDefault(); updateFormData('whatsappSaved', false); }}>[Edit]</button>
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-md text-sm text-green-900 flex flex-col gap-2">
                      <div className="font-semibold text-green-800">Instruction for TA:</div>
                      <div className="text-xs text-green-700">Copy this exact text and paste it into your job advertisement:</div>
                      <div className="font-mono text-xs bg-white/60 p-3 rounded border border-green-200/60 leading-relaxed">
                        "Send your CV to {commonWhatsAppNumber || '+94 77 000 0001'} on WhatsApp.<br/>
                        Start your message with: {keyword}"
                      </div>
                      <button 
                        className="bg-white text-green-800 border border-green-300 px-3 py-1.5 rounded text-xs font-medium hover:bg-green-100 transition-colors flex items-center gap-1.5 w-fit mt-1 shadow-sm"
                        onClick={(e) => {
                          e.preventDefault();
                          const text = `Send your CV to ${commonWhatsAppNumber || '+94 77 000 0001'} on WhatsApp.\nStart your message with: ${keyword}`;
                          navigator.clipboard.writeText(text);
                          alert('Instruction copied to clipboard!');
                        }}
                      >
                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                        Copy Candidate Instruction
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Meta Campaign */}
            <div className="flex items-start gap-4 p-4 border border-border rounded-md">
              <span className="material-symbols-outlined text-text-secondary cursor-grab pt-1">drag_indicator</span>
              <input type="checkbox" checked={formData.channels.metaCampaign} onChange={e => updateNestedFormData('channels', 'metaCampaign', e.target.checked)} className="mt-1" />
              <div className="flex-1">
                <div className="font-medium text-text-primary mb-2">Meta Campaign (Facebook / Instagram Ads)</div>
                {formData.channels.metaCampaign && (
                  <div className="mt-3 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Ad Campaign ID * <span className="text-[10px] bg-primary-container/10 text-primary-container px-1 py-0.5 rounded ml-1">Required</span></label>
                      <input type="text" className="w-64 border border-border rounded-md px-3 py-2 text-sm" value={formData.metaCampaignId} onChange={e => updateFormData('metaCampaignId', e.target.value)} placeholder="e.g. 1202029393" />
                      <div className="mt-2 bg-blue-50 border border-blue-100 p-2 rounded text-[11px] text-blue-800 flex items-start gap-1">
                        <span className="material-symbols-outlined text-[14px]">info</span>
                        <div>
                          Campaign IDs are numeric only, usually 10-16 digits.<br />
                          Found in <strong>Meta Ads Manager &rarr; Campaigns &rarr; Campaign ID</strong> column.
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border">
                      <label className="block text-xs font-medium text-text-secondary mb-3">WhatsApp Number for Ads</label>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input 
                            type="radio" 
                            checked={!formData.useDifferentMetaNumber} 
                            onChange={() => updateFormData('useDifferentMetaNumber', false)}
                            className="text-primary-container focus:ring-primary-container w-4 h-4"
                          />
                          <span className="text-sm">Use same number as WhatsApp above <span className="text-text-secondary font-mono bg-surface px-1 py-0.5 rounded ml-1 border border-border">{commonWhatsAppNumber || 'Not set'}</span></span>
                        </label>
                        <div className="flex items-start gap-3">
                          <label className="flex items-center gap-3 cursor-pointer mt-1">
                            <input 
                              type="radio" 
                              checked={formData.useDifferentMetaNumber} 
                              onChange={() => updateFormData('useDifferentMetaNumber', true)}
                              className="text-primary-container focus:ring-primary-container w-4 h-4"
                            />
                            <span className="text-sm min-w-[250px]">Use different number for this campaign:</span>
                          </label>
                          {formData.useDifferentMetaNumber && (
                            <input 
                              type="text" 
                              className="w-48 border border-border rounded-md px-3 py-1.5 text-sm" 
                              value={formData.metaWhatsAppNumber} 
                              onChange={e => updateFormData('metaWhatsAppNumber', e.target.value)} 
                              placeholder="e.g. +94 77 000 0001" 
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-border">
                      <label className="block text-xs font-medium text-text-secondary mb-1">Ad Destination Link <span className="text-[10px] bg-surface-variant text-text-secondary px-1 py-0.5 rounded ml-1">Copy for Ad</span></label>
                      <div className="mt-1 flex items-center justify-between bg-surface border border-border rounded px-3 py-2">
                        <span className="text-sm font-mono text-text-secondary truncate pr-4">wa.me/{displayMetaNumber}?text={keyword}</span>
                        <button className="text-primary-container text-xs font-medium hover:underline flex-shrink-0" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(`wa.me/${displayMetaNumber}?text=${keyword}`); alert('Link copied!'); }}>Copy Link</button>
                      </div>
                      <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                        Paste into your Facebook/Instagram ad as "Website URL" or "Click to WhatsApp" destination.
                      </p>
                      <div className="mt-2 bg-green-50 border border-green-100 p-2 rounded text-xs text-green-800 flex items-start gap-1.5">
                        <span className="text-green-600 font-medium">✅</span>
                        <span>CVs from this ad will be tagged as Meta Campaign automatically.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Email Campaign */}
            <div className="flex items-start gap-4 p-4 border border-border rounded-md">
              <span className="material-symbols-outlined text-text-secondary cursor-grab pt-1">drag_indicator</span>
              <input type="checkbox" checked={formData.channels.emailCampaign} onChange={e => updateNestedFormData('channels', 'emailCampaign', e.target.checked)} className="mt-1" />
              <div className="flex-1">
                <div className="font-medium text-text-primary mb-2">Email Campaign</div>
                {formData.channels.emailCampaign && (
                  <div className="mt-3 bg-surface-container-low p-4 rounded-md border border-border">
                    <label className="block text-xs font-medium text-text-secondary mb-1">Email Inbox</label>
                    {!formData.emailSaved ? (
                      <div className="flex items-center gap-2">
                        <input type="text" className="w-64 border border-border rounded-md px-3 py-2 text-sm bg-surface font-medium text-text-primary" placeholder="e.g. brand24@career141.com" value={formData.emailInbox} onChange={e => updateFormData('emailInbox', e.target.value)} />
                        <button className="bg-primary-container text-on-primary px-4 py-2 rounded-md text-sm font-medium hover:bg-primary transition-colors" onClick={(e) => { e.preventDefault(); if (formData.emailInbox) updateFormData('emailSaved', true); }}>Save</button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                            <span className="font-mono bg-surface-variant px-2 py-1 rounded border border-border">{formData.emailInbox}</span>
                            <span className="text-green-600 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">check_circle</span> Agent 7 monitoring</span>
                          </div>
                          <button className="text-primary-container text-sm font-medium hover:underline" onClick={(e) => { e.preventDefault(); updateFormData('emailSaved', false); }}>[Edit]</button>
                        </div>
                        <div className="flex gap-2">
                          <button className="text-primary-container text-xs font-medium hover:underline flex items-center gap-1" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(formData.emailInbox); alert('Email copied!'); }}><span className="material-symbols-outlined text-[14px]">content_copy</span> Copy Email</button>
                          <span className="text-border">|</span>
                          <button className="text-primary-container text-xs font-medium hover:underline" onClick={(e) => { e.preventDefault(); alert('Test email sent'); }}>[ Send Test Email ]</button>
                        </div>
                        
                        <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-md text-sm text-green-900 flex flex-col gap-2">
                          <div className="font-semibold text-green-800">Instruction for TA:</div>
                          <div className="text-xs text-green-700">Copy this exact text and paste it into your job advertisement:</div>
                          <div className="font-mono text-xs bg-white/60 p-3 rounded border border-green-200/60 leading-relaxed">
                            "Email your CV to {formData.emailInbox}<br />
                            Subject line: {keyword}"
                          </div>
                          <button 
                            className="bg-white text-green-800 border border-green-300 px-3 py-1.5 rounded text-xs font-medium hover:bg-green-100 transition-colors flex items-center gap-1.5 w-fit mt-1 shadow-sm"
                            onClick={(e) => {
                              e.preventDefault();
                              const text = `Email your CV to ${formData.emailInbox}\nSubject line: ${keyword}`;
                              navigator.clipboard.writeText(text);
                              alert('Instruction copied to clipboard!');
                            }}
                          >
                            <span className="material-symbols-outlined text-[14px]">content_copy</span>
                            Copy Candidate Instruction
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Headhunting */}
            <div className="flex items-start gap-4 p-4 border border-border rounded-md">
              <span className="material-symbols-outlined text-text-secondary cursor-grab pt-1">drag_indicator</span>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="font-medium text-text-primary">Headhunting</div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={formData.channels.headhunting} onChange={e => updateNestedFormData('channels', 'headhunting', e.target.checked)} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                  </label>
                  <span className="text-sm font-medium text-text-secondary">
                    {formData.channels.headhunting ? "On — Include passive candidate sourcing" : "Off — Active applications only"}
                  </span>
                </div>

                {formData.channels.headhunting && (
                  <div className="mt-4 bg-surface-container-low p-4 rounded-md border border-border">
                    <div className="text-sm text-text-secondary leading-relaxed mb-4">
                      <strong>Agent 2</strong> will scan the 115k+ database for existing matches immediately after this job is published.
                    </div>
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded p-3">
                      <div className="flex items-center gap-2 text-sm text-blue-800">
                        <span className="material-symbols-outlined text-[18px]">search_check</span>
                        <span>Found <strong>23 potential matches</strong> already.</span>
                      </div>
                      <button className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded text-xs font-medium transition-colors shadow-sm" onClick={(e) => e.preventDefault()}>
                        Preview Matches
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Workable ATS */}
            <div className="flex items-start gap-4 p-4 border border-border rounded-md">
              <span className="material-symbols-outlined text-text-secondary cursor-grab pt-1">drag_indicator</span>
              <input type="checkbox" checked={formData.channels.workable} onChange={e => updateNestedFormData('channels', 'workable', e.target.checked)} className="mt-1" />
              <div className="flex-1">
                <div className="font-medium text-text-primary">Workable ATS</div>
                {formData.channels.workable && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-text-secondary mb-1">Map to Workable Job</label>
                    {!formData.workableJobId ? (
                      <select className="w-64 border border-border rounded-md px-3 py-2 text-sm bg-surface" value={formData.workableJobId} onChange={e => updateFormData('workableJobId', e.target.value)}>
                        <option value="">-- Select Workable Job --</option>
                        <option value="wk-brand-mgr">Brand Manager (W-982)</option>
                      </select>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                            <span className="font-medium bg-surface-variant px-2 py-1 rounded border border-border">Brand Manager (W-982)</span>
                            <span className="text-green-600 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">check_circle</span> Connected</span>
                          </div>
                          <button className="text-primary-container text-sm font-medium hover:underline" onClick={(e) => { e.preventDefault(); updateFormData('workableJobId', ''); }}>[Change]</button>
                        </div>
                        <div className="text-xs text-text-secondary">
                          Last synced: 4 min ago | Next sync: in 11 min<br />
                          CVs synced today: 5
                        </div>
                        <div>
                          <button className="text-primary-container text-xs font-medium hover:underline" onClick={(e) => { e.preventDefault(); alert('Sync started'); }}>[ Sync Now ]</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Auto-Generated Assets Section */}
        <div className="bg-surface border border-border rounded-lg p-6 shadow-sm bg-gradient-to-br from-surface to-surface-container-low">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary-container text-[24px]">auto_awesome_mosaic</span>
            <h3 className="font-card-header text-lg text-text-primary">JOB ASSETS (Auto-Generated)</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white border border-border rounded-lg p-5 shadow-subtle flex gap-4">
              <div className="flex-shrink-0 border border-border p-2 rounded-md">
                <QRCode value={`https://wa.me/${commonWhatsAppNumber ? commonWhatsAppNumber.replace(/[^0-9]/g, '') : ''}?text=${keyword}`} size={100} />
              </div>
              <div className="flex flex-col justify-between py-1">
                <div>
                  <h4 className="font-semibold text-sm text-text-primary mb-1">WhatsApp QR Code</h4>
                  {!commonWhatsAppNumber ? (
                    <div className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 p-2 rounded flex items-start gap-1.5 mt-2 w-48">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      <span>Enter and save your WhatsApp number above to generate this QR code.</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-text-secondary mb-2">Scan to apply via WhatsApp</p>
                      <div className="text-[10px] font-mono text-text-secondary bg-surface px-2 py-1 rounded border border-border truncate w-48">wa.me/{commonWhatsAppNumber.replace(/[^0-9]/g, '')}?text={keyword}</div>
                    </>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="text-xs font-medium text-primary-container hover:underline">Download PNG</button>
                  <span className="text-border">|</span>
                  <button className="text-xs font-medium text-primary-container hover:underline">Download PDF</button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-white border border-border rounded-lg p-4 shadow-subtle">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-semibold text-sm text-text-primary">Short Apply Link</h4>
                  <button className="text-xs font-medium text-primary-container hover:underline" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(`career141.com/apply/${keyword}`); alert('Link copied!'); }}>Copy Link</button>
                </div>
                <div className="text-xs font-mono text-text-secondary bg-surface px-2 py-1 rounded border border-border inline-block mb-2">career141.com/apply/{keyword}</div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Use this memorable link in text messages, social media posts, or anywhere candidates cannot scan a QR code. It automatically redirects to your WhatsApp number with the correct keyword.
                </p>
              </div>

              <div className="bg-white border border-border rounded-lg p-4 shadow-subtle">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-semibold text-sm text-text-primary">Meta Ad Link</h4>
                  <button className="text-xs font-medium text-primary-container hover:underline" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(`wa.me/${displayMetaNumber}?text=${keyword}`); alert('Link copied!'); }}>Copy Link</button>
                </div>
                <div className="text-xs font-mono text-text-secondary bg-surface px-2 py-1 rounded border border-border inline-block truncate w-full">wa.me/{displayMetaNumber}?text={keyword}</div>
              </div>
            </div>

            {formData.channels.emailCampaign && (
              <div className="col-span-2 bg-white border border-border rounded-lg p-4 shadow-subtle flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px] text-text-secondary">mail</span>
                  <div>
                    <h4 className="font-semibold text-sm text-text-primary mb-1">Email Campaign</h4>
                    <p className="text-xs text-text-secondary">{formData.emailInbox || 'cvs@career141.com'} | Subject: {keyword}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="text-xs font-medium text-primary-container border border-primary-container px-3 py-1.5 rounded hover:bg-primary-container hover:text-on-primary transition-colors" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(formData.emailInbox || 'cvs@career141.com'); alert('Email copied!'); }}>Copy Email</button>
                  <button className="text-xs font-medium text-primary-container border border-primary-container px-3 py-1.5 rounded hover:bg-primary-container hover:text-on-primary transition-colors" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(`Email your CV to ${formData.emailInbox || 'cvs@career141.com'}\nSubject line: ${keyword}`); alert('Instruction copied!'); }}>Copy Full Instruction</button>
                </div>
              </div>
            )}

            <div className="col-span-2 bg-white border border-border rounded-lg p-4 shadow-subtle">
              <h4 className="font-semibold text-sm text-text-primary mb-3">LinkedIn Routing Instruction</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Application Email:</label>
                  <div className="flex items-center justify-between bg-surface border border-border rounded px-3 py-2">
                    <span className="text-sm font-mono text-text-secondary">linkedin@career141.com</span>
                    <button className="text-primary-container text-xs font-medium hover:underline flex-shrink-0" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText('linkedin@career141.com'); alert('Email copied!'); }}>Copy Email</button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Job Title to use on LinkedIn:</label>
                  <div className="flex items-center justify-between bg-surface border border-border rounded px-3 py-2">
                    <span className="text-sm font-mono text-text-secondary truncate pr-4">{formData.jobTitle || 'Job Title'} &mdash; {keyword}</span>
                    <button className="text-primary-container text-xs font-medium hover:underline flex-shrink-0" onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(`${formData.jobTitle || 'Job Title'} - ${keyword}`); alert('Title copied!'); }}>Copy Title</button>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 bg-yellow-50 border border-yellow-100 p-2 rounded flex items-start gap-2 text-yellow-800 text-xs">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                <span>Keyword <strong>{keyword}</strong> must be in your LinkedIn job title for CVs to route automatically.</span>
              </div>
            </div>
            
            <div className="col-span-2 mt-2 flex flex-col items-center">
              <div className="bg-surface-container-low border border-border rounded-lg p-4 w-full flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-16 bg-white border border-border rounded shadow-sm flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[24px] text-text-secondary">description</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-text-primary flex items-center gap-2">Full Job Poster with QR <span className="bg-surface-variant text-text-secondary text-[10px] px-1.5 py-0.5 rounded uppercase">PDF + PNG</span></h4>
                    <p className="text-xs text-text-secondary mt-1">Contains: Job title, company, QR code, WhatsApp number, email address, apply link.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="text-sm font-medium text-primary-container hover:bg-primary-container/10 px-3 py-1.5 rounded transition-colors border border-transparent">Preview</button>
                  <button className="flex items-center gap-1.5 bg-primary-container text-on-primary px-4 py-1.5 rounded shadow-sm hover:bg-primary transition-colors text-sm font-medium">
                    <span className="material-symbols-outlined text-[16px]">download</span> Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
        <h3 className="font-card-header text-lg mb-4 text-text-primary">AI Agents Configuration</h3>
        <div className="space-y-6">
          
          {/* Agent 2: AI Matching */}
          <div className="border-b border-border pb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-medium text-text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary-container">smart_toy</span>
                  Enable AI Matching (Agent 2)
                </div>
                <p className="text-sm text-text-secondary mt-1">Auto-scores candidates against job description and matching criteria.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={formData.enableMatching} onChange={e => updateFormData('enableMatching', e.target.checked)} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            {formData.enableMatching && (
              <div className="bg-surface-container-low p-5 rounded-md border border-border">
                <div className="mb-6 flex items-center gap-4">
                  <label className="text-sm font-medium text-text-secondary">Minimum Match Score to Show:</label>
                  <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-1">
                    <input type="number" className="w-12 text-center font-medium bg-transparent outline-none" value={formData.minMatchScore} onChange={e => updateFormData('minMatchScore', parseInt(e.target.value))} />
                    <span className="text-text-secondary">/100</span>
                  </div>
                  <span className="text-xs text-text-secondary">(Candidates below this score hidden)</span>
                </div>

                
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium text-text-primary">Reverse Match on Publish:</label>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={formData.reverseMatchOnPublish} onChange={e => updateFormData('reverseMatchOnPublish', e.target.checked)} className="mt-0.5 rounded text-primary-container focus:ring-primary-container" />
                    <div>
                      <span className="text-sm text-text-primary">Scan 115,000+ database when job is published and show top matches</span>
                      <p className="text-xs text-text-secondary mt-1 italic">Agent 2 will immediately find existing candidates who match this role</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Agent 3: Follow-ups */}
          <div className="border-b border-border pb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="font-medium text-text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary-container">schedule_send</span>
                  Enable Automated Follow-ups (Agent 3)
                </div>
                <p className="text-sm text-text-secondary mt-1">Chases non-responsive candidates automatically.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={formData.enableFollowUps} onChange={e => updateFormData('enableFollowUps', e.target.checked)} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            {formData.enableFollowUps && (
              <div className="bg-surface-container-low p-5 rounded-md border border-border">
                <label className="block text-sm font-medium text-text-primary mb-3">Follow-up Schedule:</label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.followUpSchedule.day2} onChange={e => updateNestedFormData('followUpSchedule', 'day2', e.target.checked)} className="rounded text-primary-container focus:ring-primary-container" />
                    <span className="text-sm text-text-primary font-medium w-14">Day 2:</span>
                    <select className="border border-border rounded px-2 py-1 text-sm bg-surface" value={formData.followUpSchedule.day2Channel} onChange={e => updateNestedFormData('followUpSchedule', 'day2Channel', e.target.value)}>
                      <option>Email</option>
                      <option>WhatsApp</option>
                      <option>AI Phone Call</option>
                    </select>
                    <span className="text-sm text-text-secondary">Initial outreach</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.followUpSchedule.day4} onChange={e => updateNestedFormData('followUpSchedule', 'day4', e.target.checked)} className="rounded text-primary-container focus:ring-primary-container" />
                    <span className="text-sm text-text-primary font-medium w-14">Day 4:</span>
                    <select className="border border-border rounded px-2 py-1 text-sm bg-surface" value={formData.followUpSchedule.day4Channel} onChange={e => updateNestedFormData('followUpSchedule', 'day4Channel', e.target.value)}>
                      <option>Email</option>
                      <option>WhatsApp</option>
                      <option>AI Phone Call</option>
                    </select>
                    <span className="text-sm text-text-secondary">Follow-up</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.followUpSchedule.day7} onChange={e => updateNestedFormData('followUpSchedule', 'day7', e.target.checked)} className="rounded text-primary-container focus:ring-primary-container" />
                    <span className="text-sm text-text-primary font-medium w-14">Day 7:</span>
                    <select className="border border-border rounded px-2 py-1 text-sm bg-surface" value={formData.followUpSchedule.day7Channel} onChange={e => updateNestedFormData('followUpSchedule', 'day7Channel', e.target.value)}>
                      <option>Email</option>
                      <option>WhatsApp</option>
                      <option>AI Phone Call</option>
                    </select>
                    <span className="text-sm text-text-secondary">Final attempt</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-2 italic">Alternating channels increases response rate</p>
                </div>
                
                <div className="mt-5 pt-4 border-t border-border">
                  <label className="block text-sm font-medium text-text-primary mb-3">After Day 7 with no response:</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="unresponsiveAction" checked={formData.followUpSchedule.markUnresponsive} onChange={() => updateNestedFormData('followUpSchedule', 'markUnresponsive', true)} className="text-primary-container focus:ring-primary-container" />
                      <span className="text-sm">Mark as Unresponsive — notify TA</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="unresponsiveAction" checked={!formData.followUpSchedule.markUnresponsive} onChange={() => updateNestedFormData('followUpSchedule', 'markUnresponsive', false)} className="text-primary-container focus:ring-primary-container" />
                      <span className="text-sm">Continue weekly until job closes</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Agent 5: Phone Screening */}
          <div className="border-b border-border pb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="font-medium text-text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary-container">call</span>
                  Enable AI Phone Screening (Agent 5)
                </div>
                <p className="text-sm text-text-secondary mt-1">Automatically calls and screens candidates.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={formData.enablePhoneScreening} onChange={e => updateFormData('enablePhoneScreening', e.target.checked)} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            
            {formData.enablePhoneScreening && (
              <div className="bg-surface-container-low p-5 rounded-md border border-border">
                <label className="block text-sm font-medium text-text-primary mb-3">Automatically call candidates when:</label>
                <div className="space-y-3 mb-6">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.phoneScreeningTriggers.newApplicants} onChange={e => updateNestedFormData('phoneScreeningTriggers', 'newApplicants', e.target.checked)} className="rounded text-primary-container focus:ring-primary-container" />
                    <span className="text-sm text-text-primary">New applicants enter the pipeline</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.phoneScreeningTriggers.databaseMatches} onChange={e => updateNestedFormData('phoneScreeningTriggers', 'databaseMatches', e.target.checked)} className="rounded text-primary-container focus:ring-primary-container" />
                    <span className="text-sm text-text-primary">Database candidates matched 70+ score</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.phoneScreeningTriggers.manualOnly} onChange={e => updateNestedFormData('phoneScreeningTriggers', 'manualOnly', e.target.checked)} className="rounded text-primary-container focus:ring-primary-container" />
                    <span className="text-sm text-text-primary">Only when TA manually triggers</span>
                  </label>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Call Script</label>
                    <div className="flex gap-2 items-center">
                      <select className="w-64 border border-border rounded-md px-3 py-2 text-sm bg-surface" value={formData.callScript} onChange={e => updateFormData('callScript', e.target.value)}>
                        <option>Default</option>
                        <option>Initial Screening</option>
                        <option>Technical Pre-screen</option>
                      </select>
                      <button className="text-primary-container text-sm font-medium hover:underline">Preview Script</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Custom Questions (after Press 1):</label>
                    {formData.additionalQuestions.map((q, idx) => (
                      <div key={idx} className="flex gap-2 mb-2 items-center">
                        <span className="text-sm font-medium text-text-secondary w-6">Q{idx+1}:</span>
                        <input type="text" className="flex-1 border border-border rounded-md px-3 py-2 text-sm" value={q} onChange={(e) => {
                          const newQ = [...formData.additionalQuestions];
                          newQ[idx] = e.target.value;
                          updateFormData('additionalQuestions', newQ);
                        }} placeholder="Enter custom question" />
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">check</span> default</span>
                        <button className="text-text-secondary hover:text-error ml-1" onClick={() => {
                          const newQ = formData.additionalQuestions.filter((_, i) => i !== idx);
                          updateFormData('additionalQuestions', newQ);
                        }}><span className="material-symbols-outlined">delete</span></button>
                      </div>
                    ))}
                    <button className="text-primary-container text-sm font-medium flex items-center gap-1 mt-3 border border-primary-container px-3 py-1.5 rounded hover:bg-primary-container hover:text-on-primary transition-colors" onClick={() => updateFormData('additionalQuestions', [...formData.additionalQuestions, ''])}>
                      <span className="material-symbols-outlined text-[16px]">add</span> Add Custom Question
                    </button>
                  </div>
                  
                  <div className="pt-4 border-t border-border mt-4">
                    <label className="block text-sm font-medium text-text-primary mb-2">If no answer:</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={formData.phoneScreeningNoAnswer === 'triggerEmail'} onChange={() => updateFormData('phoneScreeningNoAnswer', 'triggerEmail')} className="text-primary-container focus:ring-primary-container" />
                        <span className="text-sm">Trigger Agent 3 email follow-up</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={formData.phoneScreeningNoAnswer === 'retryCall'} onChange={() => updateFormData('phoneScreeningNoAnswer', 'retryCall')} className="text-primary-container focus:ring-primary-container" />
                        <span className="text-sm">Retry call after 2 hours</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={formData.phoneScreeningNoAnswer === 'notifyTa'} onChange={() => updateFormData('phoneScreeningNoAnswer', 'notifyTa')} className="text-primary-container focus:ring-primary-container" />
                        <span className="text-sm">Notify TA to call manually</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border mt-4">
                    <label className="block text-sm font-medium text-text-primary mb-2">Confidential Position:</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={formData.phoneScreeningConfidential} onChange={() => updateFormData('phoneScreeningConfidential', true)} className="text-primary-container focus:ring-primary-container" />
                        <div>
                          <span className="text-sm">Hide company name in call script</span>
                          <p className="text-xs text-text-secondary">"...an exciting opportunity with a leading FMCG company..."</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer mt-2">
                        <input type="radio" checked={!formData.phoneScreeningConfidential} onChange={() => updateFormData('phoneScreeningConfidential', false)} className="text-primary-container focus:ring-primary-container" />
                        <div>
                          <span className="text-sm">Mention company name</span>
                          <p className="text-xs text-text-secondary">"...a role at Atlas Holdings..."</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Agent 8: Pipeline Health */}
          <div className="pt-2">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="font-medium text-text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary-container">monitor_heart</span>
                  Pipeline Health (Agent 8)
                </div>
                <p className="text-sm text-text-secondary mt-1">Monitors SLAs and pipeline stagnation.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={formData.enablePipelineHealth} onChange={e => updateFormData('enablePipelineHealth', e.target.checked)} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>
            {formData.enablePipelineHealth && (
              <div className="bg-surface-container-low p-5 rounded-md border border-border">
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">Alert if no new CVs in:</span>
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-16 border border-border rounded px-2 py-1 text-sm text-center" value={formData.pipelineAlerts.noNewCvs} onChange={e => updateNestedFormData('pipelineAlerts', 'noNewCvs', e.target.value)} />
                      <span className="text-sm text-text-secondary">days</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">Alert if TA review pending:</span>
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-16 border border-border rounded px-2 py-1 text-sm text-center" value={formData.pipelineAlerts.taReviewPending} onChange={e => updateNestedFormData('pipelineAlerts', 'taReviewPending', e.target.value)} />
                      <span className="text-sm text-text-secondary">days</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">Alert if AI call not completed:</span>
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-16 border border-border rounded px-2 py-1 text-sm text-center" value={formData.pipelineAlerts.aiCallNotCompleted} onChange={e => updateNestedFormData('pipelineAlerts', 'aiCallNotCompleted', e.target.value)} />
                      <span className="text-sm text-text-secondary">days</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">Alert if second shortlist pending:</span>
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-16 border border-border rounded px-2 py-1 text-sm text-center" value={formData.pipelineAlerts.secondShortlistPending} onChange={e => updateNestedFormData('pipelineAlerts', 'secondShortlistPending', e.target.value)} />
                      <span className="text-sm text-text-secondary">days</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">Alert if director review pending:</span>
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-16 border border-border rounded px-2 py-1 text-sm text-center" value={formData.pipelineAlerts.directorReviewPending} onChange={e => updateNestedFormData('pipelineAlerts', 'directorReviewPending', e.target.value)} />
                      <span className="text-sm text-text-secondary">days</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">Daily health report:</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.pipelineAlerts.dailyReport} onChange={e => updateNestedFormData('pipelineAlerts', 'dailyReport', e.target.checked)} className="rounded text-primary-container focus:ring-primary-container" />
                      <span className="text-sm">Include this job</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">Alert if client review pending:</span>
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-16 border border-border rounded px-2 py-1 text-sm text-center" value={formData.pipelineAlerts.clientReviewPending} onChange={e => updateNestedFormData('pipelineAlerts', 'clientReviewPending', e.target.value)} />
                      <span className="text-sm text-text-secondary">days</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">Alert if interview not scheduled:</span>
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-16 border border-border rounded px-2 py-1 text-sm text-center" value={formData.pipelineAlerts.interviewNotScheduled} onChange={e => updateNestedFormData('pipelineAlerts', 'interviewNotScheduled', e.target.value)} />
                      <span className="text-sm text-text-secondary">days</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">Alert if offer not made:</span>
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-16 border border-border rounded px-2 py-1 text-sm text-center" value={formData.pipelineAlerts.offerNotMade} onChange={e => updateNestedFormData('pipelineAlerts', 'offerNotMade', e.target.value)} />
                      <span className="text-sm text-text-secondary">days</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
        <h3 className="font-card-header text-lg mb-4 text-text-primary">Pipeline Configuration</h3>
        
        <div className="mb-8">
          <label className="block text-sm font-medium text-text-secondary mb-3">Review Levels (Gates)</label>
          <p className="text-xs text-text-secondary mb-4">Only candidates approved at each level proceed to the next gate</p>
          
          <div className="space-y-4">
            {/* Level 1 */}
            <div className="bg-surface-container-low p-4 rounded-md border border-border flex items-start gap-3">
              <input type="checkbox" checked disabled className="mt-1 rounded text-primary-container" />
              <div className="flex-1">
                <div className="font-medium text-text-primary text-sm">Level 1 — TA Shortlist <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-[10px] ml-2 border border-green-100 uppercase tracking-wider font-bold">Always Required</span></div>
                <p className="text-xs text-text-secondary mt-1">Recruiter reviews all AI-ranked candidates</p>
              </div>
            </div>

            {/* Level 2 */}
            <div className="bg-surface-container-low p-4 rounded-md border border-border flex items-start gap-3">
              <input type="checkbox" checked disabled className="mt-1 rounded text-primary-container" />
              <div className="flex-1">
                <div className="font-medium text-text-primary text-sm">Level 2 — AI Call <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-[10px] ml-2 border border-green-100 uppercase tracking-wider font-bold">Always Required</span></div>
                <p className="text-xs text-text-secondary mt-1">AI conducts preliminary interview</p>
              </div>
            </div>

            {/* Level 3 */}
            <div className="bg-surface-container-low p-4 rounded-md border border-border flex items-start gap-3">
              <input type="checkbox" checked disabled className="mt-1 rounded text-primary-container" />
              <div className="flex-1">
                <div className="font-medium text-text-primary text-sm">Level 3 — Second Shortlist <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-[10px] ml-2 border border-green-100 uppercase tracking-wider font-bold">Always Required</span></div>
                <p className="text-xs text-text-secondary mt-1">Review AI Call outcomes</p>
              </div>
            </div>

            {/* Level 4 */}
            <div className={`p-4 rounded-md border ${formData.reviewLevels.directorReview ? 'bg-surface-container-low border-primary-container/30' : 'bg-surface border-border'} flex items-start gap-3 transition-colors`}>
              <input type="checkbox" checked={formData.reviewLevels.directorReview} onChange={e => updateNestedFormData('reviewLevels', 'directorReview', e.target.checked)} className="mt-1 rounded text-primary-container focus:ring-primary-container" />
              <div className="flex-1">
                <div className="font-medium text-text-primary text-sm mb-1">Level 4 — Director Review</div>
                {formData.reviewLevels.directorReview && (
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Director:</label>
                      <select className="w-full border border-border rounded px-2 py-1.5 text-sm bg-surface" value={formData.director} onChange={e => updateFormData('director', e.target.value)}>
                        <option value="">Select Director ▾</option>
                        <option value="Jane Smith">Jane Smith</option>
                        <option value="Michael Brown">Michael Brown</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">SLA:</label>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-text-secondary">Flag if not reviewed within</span>
                        <input type="number" className="w-12 border border-border rounded px-2 py-1 text-center" value={formData.reviewLevels.directorSla} onChange={e => updateNestedFormData('reviewLevels', 'directorSla', e.target.value)} />
                        <span className="text-text-secondary">days</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-text-secondary mb-1">On breach:</label>
                      <div className="space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" checked={formData.reviewLevels.directorOnBreach === 'notifyBoth'} onChange={() => updateNestedFormData('reviewLevels', 'directorOnBreach', 'notifyBoth')} className="text-primary-container focus:ring-primary-container" />
                          <span className="text-sm">Notify Director + TA</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" checked={formData.reviewLevels.directorOnBreach === 'notifyDirector'} onChange={() => updateNestedFormData('reviewLevels', 'directorOnBreach', 'notifyDirector')} className="text-primary-container focus:ring-primary-container" />
                          <span className="text-sm">Notify Director only</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" checked={formData.reviewLevels.directorOnBreach === 'escalateAdmin'} onChange={() => updateNestedFormData('reviewLevels', 'directorOnBreach', 'escalateAdmin')} className="text-primary-container focus:ring-primary-container" />
                          <span className="text-sm">Auto-escalate to admin</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Level 5 */}
            <div className={`p-4 rounded-md border ${formData.reviewLevels.clientReview ? 'bg-surface-container-low border-primary-container/30' : 'bg-surface border-border'} flex items-start gap-3 transition-colors`}>
              <input type="checkbox" checked={formData.reviewLevels.clientReview} onChange={e => updateNestedFormData('reviewLevels', 'clientReview', e.target.checked)} className="mt-1 rounded text-primary-container focus:ring-primary-container" />
              <div className="flex-1">
                <div className="font-medium text-text-primary text-sm mb-1">Level 5 — Client Review</div>
                {formData.reviewLevels.clientReview && (
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Client Name:</label>
                      <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-sm" value={formData.reviewLevels.clientName} onChange={e => updateNestedFormData('reviewLevels', 'clientName', e.target.value)} placeholder="Client Name" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Client Email:</label>
                      <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-sm" value={formData.reviewLevels.clientEmail} onChange={e => updateNestedFormData('reviewLevels', 'clientEmail', e.target.value)} placeholder="Client Email" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Access Level:</label>
                      <select className="border border-border rounded px-2 py-1.5 text-sm bg-surface w-full" value={formData.reviewLevels.clientAccess} onChange={e => updateNestedFormData('reviewLevels', 'clientAccess', e.target.value)}>
                        <option>View Only</option>
                        <option>View + Comment</option>
                        <option>Approve/Reject</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">SLA:</label>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-text-secondary">Flag if not reviewed within</span>
                        <input type="number" className="w-12 border border-border rounded px-2 py-1 text-center" value={formData.reviewLevels.clientSla} onChange={e => updateNestedFormData('reviewLevels', 'clientSla', e.target.value)} />
                        <span className="text-text-secondary">days</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-text-secondary mb-1">On breach:</label>
                      <div className="space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" checked={formData.reviewLevels.clientOnBreach === 'notifyOps'} onChange={() => updateNestedFormData('reviewLevels', 'clientOnBreach', 'notifyOps')} className="text-primary-container focus:ring-primary-container" />
                          <span className="text-sm">Notify Ops team</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" checked={formData.reviewLevels.clientOnBreach === 'notifyTa'} onChange={() => updateNestedFormData('reviewLevels', 'clientOnBreach', 'notifyTa')} className="text-primary-container focus:ring-primary-container" />
                          <span className="text-sm">Notify TA</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Level 6 */}
            <div className="bg-surface-container-low p-4 rounded-md border border-border flex items-start gap-3 mt-4">
              <input type="checkbox" checked disabled className="mt-1 rounded text-primary-container" />
              <div className="flex-1">
                <div className="font-medium text-text-primary text-sm">Level 6 — Interview <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-[10px] ml-2 border border-green-100 uppercase tracking-wider font-bold">Always Required</span></div>
                <p className="text-xs text-text-secondary mt-1">Client and TA coordinate interviews</p>
              </div>
            </div>

            {/* Level 7 */}
            <div className="bg-surface-container-low p-4 rounded-md border border-border flex items-start gap-3 mt-4">
              <input type="checkbox" checked disabled className="mt-1 rounded text-primary-container" />
              <div className="flex-1">
                <div className="font-medium text-text-primary text-sm mb-3">Level 7 — Offer <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-[10px] ml-2 border border-green-100 uppercase tracking-wider font-bold">Always Required</span></div>
                
                <div className="bg-surface p-3 rounded border border-border">
                  <label className="block text-xs font-medium text-text-primary mb-2">If candidate rejects offer or client rejects all candidates:</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={formData.reviewLevels.offerRejectionLoop === 'restart'} onChange={() => updateNestedFormData('reviewLevels', 'offerRejectionLoop', 'restart')} className="text-primary-container focus:ring-primary-container" />
                      <span className="text-sm">Restart sourcing from New CVs</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={formData.reviewLevels.offerRejectionLoop === 'clientReview'} onChange={() => updateNestedFormData('reviewLevels', 'offerRejectionLoop', 'clientReview')} className="text-primary-container focus:ring-primary-container" />
                      <span className="text-sm">Return to Client Review only</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border mt-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={formData.reviewLevels.esaStatusCheck} onChange={e => updateNestedFormData('reviewLevels', 'esaStatusCheck', e.target.checked)} className="mt-0.5 rounded text-primary-container focus:ring-primary-container" />
                <div>
                  <span className="text-sm font-medium text-text-primary">ESA Status Check</span>
                  <p className="text-xs text-text-secondary mt-1">Flag if ESA not signed before candidates are submitted to client</p>
                </div>
              </label>
            </div>

            {formData.confidential && (
              <div className="pt-4 border-t border-border mt-4">
                <div className="mb-2">
                  <span className="text-sm font-medium text-text-primary">NDA Required before Interview:</span>
                </div>
                <div className="flex gap-4 items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={!formData.ndaRequired} onChange={() => updateFormData('ndaRequired', false)} className="text-primary-container focus:ring-primary-container" />
                    <span className="text-sm">OFF</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={formData.ndaRequired} onChange={() => updateFormData('ndaRequired', true)} className="text-primary-container focus:ring-primary-container" />
                    <span className="text-sm">ON</span>
                  </label>
                </div>
                <p className="text-xs text-text-secondary mt-2">"Candidate must sign NDA before interview details are shared"</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Job-Specific Custom Filters</label>
          <p className="text-xs text-text-secondary mb-4">Pre-load niche requirements for Advanced Search. These filters are saved and reusable.</p>
          
          <div className="bg-surface-container-low p-4 rounded-md border border-border mb-4">
            <h4 className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Suggested from JD (AI-extracted):</h4>
            <div className="flex flex-wrap gap-2">
              {['P&L Management', 'Nielsen', 'Brand Strategy'].map(tag => (
                <button key={tag} className="text-xs bg-white border border-primary-container/30 text-primary-container px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-primary-container/10 transition-colors" onClick={() => {
                  if(!formData.customFilters.includes(tag as never)) {
                    updateFormData('customFilters', [...formData.customFilters, tag]);
                  }
                }}>
                  <span className="material-symbols-outlined text-[14px]">add</span> {tag}
                </button>
              ))}
              <span className="text-xs text-text-secondary self-center ml-2 italic">Click + to add</span>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Current filters:</h4>
            {formData.customFilters.length === 0 ? (
              <p className="text-sm text-text-secondary italic bg-surface-container-low p-3 rounded border border-dashed border-border text-center">No filters added yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {formData.customFilters.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-primary-container text-on-primary px-3 py-1.5 rounded-full text-sm shadow-sm">
                    <span>{f}</span>
                    <button className="hover:text-white/80 flex items-center justify-center" onClick={() => {
                      const newF = formData.customFilters.filter((_, i) => i !== idx);
                      updateFormData('customFilters', newF);
                    }}><span className="material-symbols-outlined text-[16px]">close</span></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-2/3">
            <select className="border border-border rounded-md px-3 py-2 text-sm bg-surface w-1/3" value={formData.newFilterType} onChange={e => updateFormData('newFilterType', e.target.value)}>
              <option>Qualification</option>
              <option>Skill</option>
              <option>License</option>
              <option>Language</option>
            </select>
            <input type="text" className="flex-1 border border-border rounded-md px-3 py-2 text-sm" placeholder="Enter value and press Enter..." value={formData.newFilterValue} onChange={e => updateFormData('newFilterValue', e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter' && formData.newFilterValue.trim() !== '') {
                e.preventDefault();
                const newTag = `${formData.newFilterType}: ${formData.newFilterValue.trim()}`;
                if (!formData.customFilters.includes(newTag as never)) {
                  updateFormData('customFilters', [...formData.customFilters, newTag]);
                }
                updateFormData('newFilterValue', '');
              }
            }} />
            <button className="bg-surface-variant text-text-primary px-4 py-2 rounded-md text-sm font-medium hover:bg-border transition-colors" onClick={(e) => {
              e.preventDefault();
              if (formData.newFilterValue.trim() !== '') {
                const newTag = `${formData.newFilterType}: ${formData.newFilterValue.trim()}`;
                if (!formData.customFilters.includes(newTag as never)) {
                  updateFormData('customFilters', [...formData.customFilters, newTag]);
                }
                updateFormData('newFilterValue', '');
              }
            }}>Add</button>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Saved from previous similar jobs:</h4>
            <div className="flex flex-wrap gap-2">
              {['ISO 27001', 'Big 4 Experience'].map(tag => (
                <button key={tag} className="text-xs bg-surface border border-border text-text-secondary px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-surface-variant transition-colors" onClick={() => {
                  if(!formData.customFilters.includes(tag as never)) {
                    updateFormData('customFilters', [...formData.customFilters, tag]);
                  }
                }}>
                  <span className="material-symbols-outlined text-[14px]">add</span> {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>
    );

  const renderStep4 = () => {
    // Advanced validation logic
    const mustFix = [];
    const recommended = [];
    const ready = [];

    if (!formData.jobTitle) mustFix.push({ msg: "Job Title: Enter the position name", action: "Fix Now", step: 1 });
    else ready.push("Job Title added");

    if (!formData.requiredSkills) mustFix.push({ msg: "Required Skills: Add at least 1 skill", action: "Fix Now", step: 1 });
    else ready.push("Matching Criteria configured");

    if (formData.channels.metaCampaign && !formData.metaCampaignId) {
      mustFix.push({ msg: "Meta Campaign: Ad Campaign ID is required", action: "Fix Now", step: 2 });
    }

    if (formData.channels.whatsapp) {
      recommended.push({ msg: "WhatsApp: Common number configured but QR not downloaded yet", action: "Download QR", step: 2 });
    }
    
    if (formData.jobDescription) ready.push("Job Description added");
    if (formData.channels.emailCampaign && formData.emailInbox) ready.push("Email Campaign inbox ready");
    else if (formData.channels.emailCampaign && !formData.emailInbox) mustFix.push({ msg: "Email Campaign: Inbox address is missing", action: "Fix Now", step: 2 });
    if (formData.enableMatching) ready.push("Agent 2 Matching enabled");
    
    const keyword = formData.jobKeyword || 'BRAND24';
    const commonWhatsAppNumber = "+94770000001";

    return (
      <div className="space-y-6">
        
        {/* Validation Status Panels */}
        <div className="space-y-4">
          {mustFix.length > 0 && (
            <div className="bg-[#FFEBEE] border border-[#E53935] rounded-lg p-5">
              <div className="flex items-center gap-2 text-[#C62828] font-bold mb-3">
                <span className="material-symbols-outlined text-[20px]">error</span>
                🔴 MUST FIX BEFORE PUBLISHING ({mustFix.length} issues)
              </div>
              <ul className="space-y-2 ml-7">
                {mustFix.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-[#B71C1C]">
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] opacity-70">arrow_right_alt</span> {item.msg}</span>
                    <button className="bg-white border border-[#EF5350] text-[#C62828] px-3 py-1 rounded shadow-sm hover:bg-[#FFEBEE] font-medium transition-colors" onClick={() => setCurrentStep(item.step)}>{item.action}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recommended.length > 0 && mustFix.length === 0 && (
            <div className="bg-[#FFF8E1] border border-[#FFB300] rounded-lg p-5">
              <div className="flex items-center gap-2 text-[#F57F17] font-bold mb-3">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                🟡 RECOMMENDED ({recommended.length} issue)
              </div>
              <ul className="space-y-2 ml-7">
                {recommended.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-[#F57F17]">
                    <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] opacity-70">arrow_right_alt</span> {item.msg}</span>
                    <div className="flex gap-2">
                      <button className="bg-white border border-[#FFCA28] text-[#F57F17] px-3 py-1 rounded shadow-sm hover:bg-[#FFF8E1] font-medium transition-colors">{item.action}</button>
                      <button className="text-[#F57F17] hover:underline px-2 py-1">Skip</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mustFix.length === 0 && (
            <div className="bg-[#E8F5E9] border border-[#43A047] rounded-lg p-5">
              <div className="flex items-center gap-2 text-[#2E7D32] font-bold mb-3">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                🟢 READY ({ready.length} items)
              </div>
              <div className="grid grid-cols-2 gap-2 ml-7">
                {ready.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-[#1B5E20]">
                    <span className="material-symbols-outlined text-[16px] text-[#43A047]">check</span> {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ready to Use Assets Panel */}
        {mustFix.length === 0 && (
          <div className="bg-surface border border-border rounded-lg p-6 shadow-sm mt-6">
            <h3 className="font-card-header text-lg text-text-primary mb-4">JOB ASSETS (Ready to use)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between bg-surface-container-low p-3 rounded border border-border">
                <div>
                  <div className="font-medium text-sm text-text-primary flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-green-600">check_circle</span> WhatsApp QR</div>
                  <div className="text-xs text-text-secondary mt-1">Generated &amp; Ready</div>
                </div>
                <button className="text-primary-container text-sm font-medium hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">download</span> Download QR</button>
              </div>
              
              <div className="flex items-center justify-between bg-surface-container-low p-3 rounded border border-border">
                <div>
                  <div className="font-medium text-sm text-text-primary">Apply Link</div>
                  <div className="text-xs font-mono text-text-secondary mt-1">c141.io/apply/{keyword}</div>
                </div>
                <button className="text-primary-container text-sm font-medium hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">content_copy</span> Copy</button>
              </div>
              
              <div className="flex items-center justify-between bg-surface-container-low p-3 rounded border border-border">
                <div>
                  <div className="font-medium text-sm text-text-primary">Meta Ad Link</div>
                  <div className="text-[10px] font-mono text-text-secondary mt-1 w-48 truncate">wa.me/{commonWhatsAppNumber.replace(/[^0-9]/g, '')}?text={keyword}</div>
                </div>
                <button className="text-primary-container text-sm font-medium hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">content_copy</span> Copy</button>
              </div>
              
              <div className="flex items-center justify-between bg-surface-container-low p-3 rounded border border-border">
                <div>
                  <div className="font-medium text-sm text-text-primary">Email Inbox</div>
                  <div className="text-xs font-mono text-text-secondary mt-1">{formData.emailInbox || 'Not Configured'}</div>
                </div>
                <button className="text-primary-container text-sm font-medium hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">content_copy</span> Copy</button>
              </div>
            </div>
            
            <div className="mt-5 flex justify-center">
              <button className="flex items-center gap-2 bg-surface border border-border text-text-primary px-6 py-2 rounded-md hover:bg-surface-variant transition-colors text-sm font-medium">
                <span className="material-symbols-outlined text-[18px]">archive</span>
                Download All Assets as ZIP
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6 opacity-70">
          {/* Summary Step 1 */}
          <div className="bg-surface border border-border rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-card-header text-primary-container">Job Details</h3>
              <button className="text-text-secondary hover:text-primary-container text-sm underline" onClick={() => setCurrentStep(1)}>Edit</button>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
              <p><strong className="text-text-primary">Title:</strong> {formData.jobTitle || '—'}</p>
              <p><strong className="text-text-primary">Type:</strong> {formData.recruitmentType || '—'}</p>
              <p><strong className="text-text-primary">Recruiter:</strong> {formData.primaryRecruiter}</p>
              <p><strong className="text-text-primary">Director:</strong> {formData.director || '—'}</p>
            </div>
          </div>

          {/* Summary Step 2 */}
          <div className="bg-surface border border-border rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-card-header text-primary-container">Channels</h3>
              <button className="text-text-secondary hover:text-primary-container text-sm underline" onClick={() => setCurrentStep(2)}>Edit</button>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
              <p><strong className="text-text-primary">Keyword:</strong> {keyword}</p>
              <p><strong className="text-text-primary">LinkedIn:</strong> {formData.channels.linkedin ? 'Enabled' : 'Disabled'}</p>
              <p><strong className="text-text-primary">WhatsApp:</strong> {formData.channels.whatsapp ? 'Central Routing' : 'Disabled'}</p>
              <p><strong className="text-text-primary">Headhunting:</strong> {formData.channels.headhunting ? 'Active' : 'Disabled'}</p>
            </div>
          </div>

          {/* Summary Step 3 */}
          <div className="bg-surface border border-border rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-card-header text-primary-container">AI Config</h3>
              <button className="text-text-secondary hover:text-primary-container text-sm underline" onClick={() => setCurrentStep(3)}>Edit</button>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
              <p><strong className="text-text-primary">Matching:</strong> {formData.enableMatching ? `Min Score ${formData.minMatchScore}` : 'Off'}</p>
              <p><strong className="text-text-primary">Phone Screen:</strong> {formData.enablePhoneScreening ? 'Auto-triggers ON' : 'Off'}</p>
              <p><strong className="text-text-primary">Director Review:</strong> {formData.reviewLevels.directorReview ? 'Required' : 'Skip'}</p>
              <p><strong className="text-text-primary">Pipeline Health:</strong> {formData.enablePipelineHealth ? 'Active' : 'Off'}</p>
            </div>
          </div>
        </div>

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
            <button className="px-6 py-2 border border-border text-text-primary rounded-md hover:bg-surface-variant transition-colors bg-white font-medium disabled:opacity-50" disabled={isPublishing}>
              Save as Draft
            </button>
            {currentStep < 4 ? (
              <button 
                className="px-8 py-2 bg-primary-container text-on-primary rounded-md hover:bg-primary transition-colors font-medium shadow-sm flex items-center gap-2 disabled:opacity-50" 
                onClick={handleNext}
                disabled={isPublishing}
              >
                Next Step <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            ) : (
              <button 
                className="px-8 py-2 bg-primary-container text-on-primary rounded-md hover:bg-primary transition-colors font-medium shadow-md flex items-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handlePublish}
                disabled={!formData.jobTitle || !formData.requiredSkills || isPublishing}
              >
                {isPublishing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="material-symbols-outlined">rocket_launch</span>
                )}
                {isPublishing ? "Publishing..." : "Publish Job"}
              </button>
            )}
          </div>
        </div>
      </div>
      
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
              <div className="mt-3 bg-white px-3 py-1 rounded-full border border-border text-xs font-mono text-text-secondary shadow-sm">
                Keyword: {formData.jobKeyword || 'BRAND24'}
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
                <button onClick={() => router.push('/dashboard/jobs/wk-brand-mgr')} className="flex-1 py-3 bg-primary-container text-on-primary rounded-lg text-sm font-bold hover:bg-primary transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
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
    </div>
  );
}

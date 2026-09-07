"use client";

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { SkillsInput } from '@/components/ui/SkillsInput';
import { HelpCircle, Plus, Trash2, Sparkles, ChevronDown } from 'lucide-react';

interface EditJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onSuccess?: () => void;
}

const SENIORITY_LEVELS = [
  { value: 'entry_level', label: 'Entry Level' },
  { value: 'mid_level', label: 'Mid Level' },
  { value: 'executive', label: 'Executive' },
  { value: 'senior_executive', label: 'Senior Executive' },
  { value: 'manager', label: 'Manager' },
  { value: 'senior_manager', label: 'Senior Manager' },
  { value: 'agm', label: 'AGM' },
  { value: 'gm', label: 'GM' },
  { value: 'director', label: 'Director' },
  { value: 'c_suite', label: 'C-Suite' },
  { value: 'other', label: 'Other' },
];

const RECRUITMENT_TYPES = [
  { value: 'job_posting', label: 'Job Posting' },
  { value: 'headhunting', label: 'Headhunting' },
  { value: 'both', label: 'Both' },
];

export function EditJobModal({ isOpen, onClose, job, onSuccess }: EditJobModalProps) {
  const updateJobDetails = useMutation(api.jobs.jobs.updateJobDetails);
  const updateJobChannels = useMutation(api.jobs.jobs.updateJobChannels);
  const triggerReverseMatch = useMutation(api.jobs.jobs.triggerReverseMatch);

  // Fetch actual configured channels from the database
  const jobChannels = useQuery(
    api.jobs.jobs.getJobChannels,
    job?._id ? { jobId: job._id } : 'skip'
  );

  // Fetch authorized WhatsApp numbers for outreach
  const whatsappNumbers = useQuery(api.settings.whatsappNumbers.list) || [];

  // All possible channels — always shown in the Edit modal
  // Channels that were never configured appear as OFF; toggling ON creates them on save
  const ALL_CHANNELS = [
    { id: 'whatsapp',       label: 'WhatsApp',            configField: 'whatsappNumber',  configLabel: 'WhatsApp Number (e.g. +94771234567)',  configPlaceholder: '+94771234567' },
    { id: 'linkedin',       label: 'LinkedIn Inbox',       configField: 'emailInbox',      configLabel: 'LinkedIn Email Inbox',                 configPlaceholder: 'linkedin@career141.com' },
    { id: 'meta_campaign',  label: 'Meta / Facebook Ads (Marketing Team)',  configField: 'whatsappNumber',  configLabel: 'Campaign WhatsApp Number',             configPlaceholder: '+94771234567' },
    { id: 'email_campaign', label: 'Email Campaign (Marketing Team)',       configField: 'emailInbox',      configLabel: 'Email Inbox Address',                  configPlaceholder: 'cvs@career141.com' },
  ] as const;

  // Local toggle state: channelType -> isEnabled (all default OFF)
  const [channelToggles, setChannelToggles] = useState<Record<string, boolean>>(
    Object.fromEntries((['whatsapp','linkedin','meta_campaign','email_campaign'] as const).map(c => [c, false]))
  );

  // Inline config values for each channel (populated from existing jobChannels or typed in)
  const [channelConfig, setChannelConfig] = useState<Record<string, string>>({});
  const [editingChannelKey, setEditingChannelKey] = useState<string | null>(null);
  const [newQuestionInput, setNewQuestionInput] = useState('');
  const [rescanImmediately, setRescanImmediately] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    clientName: '',
    clientIndustry: '',
    recruitmentType: 'both',
    location: '',
    requiredSkills: [] as string[],
    niceToHaveSkills: [] as string[],
    seniorityLevel: 'mid_level',
    experienceMinYears: 0,
    experienceMaxYears: '' as number | string,
    jobDescription: '',
    muteDefaultWhatsappReply: false,
    enableEmailFollowUpTemplate: false,
    followUpEmailSubjectTemplate: '',
    followUpEmailBodyTemplate: '',
    pausedChannels: [] as string[],
    outreachWhatsAppNumber: '',
    customFollowUpQuestions: [] as string[],
    conversationTone: 'professional_formal' as string,
    enableWhatsAppFollowUp: true,
    enableEmailFollowUp: true,
    scoreWeights: {
      skills: 35,
      experience: 25,
      jobTitle: 20,
      industry: 15,
      location: 5,
    },
    minMatchScore: 60,
    reverseMatchOnPublish: true,
    directorReviewEnabled: false,
    clientReviewEnabled: false,
    esaCheckEnabled: false,
    rejectionLoopAction: 'restart_from_new_cvs' as 'restart_from_new_cvs' | 'return_to_client_review' | 'ask_ta_each_time',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const weightSum =
    (formData.scoreWeights.skills || 0) +
    (formData.scoreWeights.experience || 0) +
    (formData.scoreWeights.jobTitle || 0) +
    (formData.scoreWeights.industry || 0) +
    (formData.scoreWeights.location || 0);

  useEffect(() => {
    if (job) {
      setFormData({
        title: job.title || '',
        clientName: job.clientName || '',
        clientIndustry: job.clientIndustry || '',
        recruitmentType: job.recruitmentType || 'both',
        location: job.location || '',
        requiredSkills: job.requiredSkills || [],
        niceToHaveSkills: job.niceToHaveSkills || [],
        seniorityLevel: job.seniorityLevel || 'mid_level',
        experienceMinYears: job.experienceMinYears || 0,
        experienceMaxYears: job.experienceMaxYears !== undefined && job.experienceMaxYears !== null ? String(job.experienceMaxYears) : '',
        jobDescription: job.jobDescription || '',
        muteDefaultWhatsappReply: job.muteDefaultWhatsappReply || false,
        enableEmailFollowUpTemplate: job.enableEmailFollowUpTemplate || false,
        followUpEmailSubjectTemplate: job.followUpEmailSubjectTemplate || '',
        followUpEmailBodyTemplate: job.followUpEmailBodyTemplate || '',
        pausedChannels: job.pausedChannels || [],
        outreachWhatsAppNumber: job.outreachWhatsAppNumber || '',
        customFollowUpQuestions: job.customFollowUpQuestions || job.agent5CustomQuestions || [],
        conversationTone: (job as any).conversationTone || 'professional_formal',
        enableWhatsAppFollowUp: job.enableWhatsAppFollowUp !== false,
        enableEmailFollowUp: job.enableEmailFollowUp !== false,
        scoreWeights: {
          skills: job.scoreWeightSkills ?? 35,
          experience: job.scoreWeightExperience ?? 25,
          jobTitle: job.scoreWeightJobTitle ?? 20,
          industry: job.scoreWeightIndustry ?? 15,
          location: job.scoreWeightLocation ?? 5,
        },
        minMatchScore: job.minMatchScoreToShow ?? 60,
        reverseMatchOnPublish: job.reverseMatchOnPublish ?? true,
        directorReviewEnabled: job.directorReviewEnabled ?? false,
        clientReviewEnabled: job.clientReviewEnabled ?? false,
        esaCheckEnabled: job.esaCheckEnabled ?? false,
        rejectionLoopAction: job.rejectionLoopAction || 'restart_from_new_cvs',
      });
      setRescanImmediately(false);
    }
  }, [job, isOpen]);

  // Sync channel toggles AND config when jobChannels data arrives
  // Start all OFF, then set ON for channels that exist and are enabled
  useEffect(() => {
    const defaults: Record<string, boolean> = Object.fromEntries(ALL_CHANNELS.map(c => [c.id, false]));
    const configs: Record<string, string> = {};
    if (jobChannels) {
      jobChannels.forEach(ch => {
        // Map whatsapp_campaign -> whatsapp for display purposes
        const key = ch.channelType === 'whatsapp_campaign' ? 'whatsapp' : ch.channelType;
        defaults[key] = ch.isEnabled;
        // Populate existing config values
        if (ch.whatsappNumber) configs[`${key}_whatsappNumber`] = ch.whatsappNumber;
        if (ch.emailInbox) configs[`${key}_emailInbox`] = ch.emailInbox;
        if (ch.workableJobId) configs[`${key}_workableJobId`] = ch.workableJobId;
      });
    }
    setChannelToggles(defaults);
    setChannelConfig(configs);
  }, [jobChannels, isOpen]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'experienceMinYears'
        ? (parseInt(value) || 0)
        : name === 'experienceMaxYears'
        ? (value === '' ? '' : parseInt(value) || 0)
        : value
    }));
  };

  const handleAddQuestion = () => {
    const q = newQuestionInput.trim();
    if (!q) return;
    if (formData.customFollowUpQuestions.includes(q)) {
      toast.info("Question already in list");
      return;
    }
    setFormData(prev => ({
      ...prev,
      customFollowUpQuestions: [...prev.customFollowUpQuestions, q]
    }));
    setNewQuestionInput('');
  };

  const handleRemoveQuestion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      customFollowUpQuestions: prev.customFollowUpQuestions.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    if (weightSum !== 100) {
      toast.error(`AI match weights must total exactly 100% (currently ${weightSum}%)`);
      return;
    }

    setIsSubmitting(true);
    try {
      const requiredSkillsArr = Array.isArray(formData.requiredSkills)
        ? formData.requiredSkills
        : (typeof formData.requiredSkills === 'string' && formData.requiredSkills ? (formData.requiredSkills as string).split(',').map(s => s.trim()).filter(Boolean) : []);

      const niceToHaveSkillsArr = Array.isArray(formData.niceToHaveSkills)
        ? formData.niceToHaveSkills
        : (typeof formData.niceToHaveSkills === 'string' && formData.niceToHaveSkills ? (formData.niceToHaveSkills as string).split(',').map(s => s.trim()).filter(Boolean) : []);

      await updateJobDetails({
        jobId: job._id,
        title: formData.title,
        clientName: formData.clientName,
        clientIndustry: formData.clientIndustry,
        recruitmentType: formData.recruitmentType as any,
        location: formData.location,
        requiredSkills: requiredSkillsArr,
        niceToHaveSkills: niceToHaveSkillsArr,
        seniorityLevel: formData.seniorityLevel,
        experienceMinYears: formData.experienceMinYears,
        experienceMaxYears: formData.experienceMaxYears === '' ? undefined : Number(formData.experienceMaxYears),
        description: formData.jobDescription,
        muteDefaultWhatsappReply: formData.muteDefaultWhatsappReply,
        enableEmailFollowUpTemplate: formData.enableEmailFollowUpTemplate,
        followUpEmailSubjectTemplate: formData.followUpEmailSubjectTemplate || undefined,
        followUpEmailBodyTemplate: formData.followUpEmailBodyTemplate || undefined,
        outreachWhatsAppNumber: formData.outreachWhatsAppNumber || undefined,
        customFollowUpQuestions: formData.customFollowUpQuestions,
        conversationTone: formData.conversationTone,
        enableWhatsAppFollowUp: formData.enableWhatsAppFollowUp,
        enableEmailFollowUp: formData.enableEmailFollowUp,
        // AI Match Scoring Weights
        scoreWeightSkills: formData.scoreWeights.skills,
        scoreWeightExperience: formData.scoreWeights.experience,
        scoreWeightJobTitle: formData.scoreWeights.jobTitle,
        scoreWeightIndustry: formData.scoreWeights.industry,
        scoreWeightLocation: formData.scoreWeights.location,
        minMatchScoreToShow: formData.minMatchScore,
        reverseMatchOnPublish: formData.reverseMatchOnPublish,
        // Pipeline Gates
        directorReviewEnabled: formData.directorReviewEnabled,
        clientReviewEnabled: formData.clientReviewEnabled,
        esaCheckEnabled: formData.esaCheckEnabled,
        rejectionLoopAction: formData.rejectionLoopAction,
      });

      // If user opted to rescan candidates immediately with updated weights
      if (rescanImmediately) {
        try {
          await triggerReverseMatch({ jobId: job._id });
        } catch (scanErr: any) {
          console.error("Failed to trigger reverse match:", scanErr);
        }
      }

      // Save ALL channel states — creates new channels if toggled ON for the first time,
      // updates existing channels, disables ones toggled OFF
      const existingByType: Record<string, any> = {};
      (jobChannels || []).forEach(ch => {
        const key = ch.channelType === 'whatsapp_campaign' ? 'whatsapp' : ch.channelType;
        existingByType[key] = ch;
      });

      const channelsPayload = ALL_CHANNELS.map(ch => {
        const cfgKey = (field: string) => `${ch.id}_${field}`;
        return {
          channelType: ch.id,
          isEnabled: channelToggles[ch.id] ?? false,
          // Prefer newly typed config, fall back to existing saved config
          whatsappNumber: channelConfig[cfgKey('whatsappNumber')] || existingByType[ch.id]?.whatsappNumber,
          emailInbox:     channelConfig[cfgKey('emailInbox')]     || existingByType[ch.id]?.emailInbox,
          workableJobId:  channelConfig[cfgKey('workableJobId')]  || existingByType[ch.id]?.workableJobId,
          metaCampaignId: existingByType[ch.id]?.metaCampaignId,
        };
      });
      await updateJobChannels({ jobId: job._id, channels: channelsPayload });

      if (rescanImmediately) {
        toast.success('Job details updated & candidate rescan started!');
      } else {
        toast.success('Job details updated successfully!');
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update job details');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Job Details"
      maxWidth="max-w-5xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button variant="primary" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          {/* Job Title */}
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs font-semibold text-text-secondary">Job Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
            />
          </div>

          {/* Client Company */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-secondary">Client Company *</label>
            <input
              type="text"
              name="clientName"
              value={formData.clientName}
              onChange={handleChange}
              required
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
            />
          </div>

          {/* Client Industry */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-secondary">Client Industry *</label>
            <input
              type="text"
              name="clientIndustry"
              value={formData.clientIndustry}
              onChange={handleChange}
              required
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
            />
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-secondary">Location *</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
            />
          </div>

          {/* Experience Min Years */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-secondary">Min Experience (Years) *</label>
            <input
              type="number"
              name="experienceMinYears"
              value={formData.experienceMinYears}
              onChange={handleChange}
              required
              min="0"
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
            />
          </div>

          {/* Experience Max Years */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-secondary">Max Experience (Years)</label>
            <input
              type="number"
              name="experienceMaxYears"
              placeholder="e.g. 5 (Optional)"
              value={formData.experienceMaxYears}
              onChange={handleChange}
              min="0"
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
            />
          </div>

          {/* Seniority Level */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-secondary">Seniority Level *</label>
            <select
              name="seniorityLevel"
              value={formData.seniorityLevel}
              onChange={handleChange}
              required
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
            >
              {SENIORITY_LEVELS.map(lvl => (
                <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
              ))}
            </select>
          </div>

          {/* Recruitment Type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-secondary">Recruitment Type *</label>
            <select
              name="recruitmentType"
              value={formData.recruitmentType}
              onChange={handleChange}
              required
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
            >
              {RECRUITMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Required Skills */}
          <SkillsInput
            className="col-span-2"
            label="Required Skills"
            required
            skills={formData.requiredSkills}
            onChange={(skills) => setFormData(prev => ({ ...prev, requiredSkills: skills }))}
            placeholder="Type required skill (e.g. React.js) and press Enter, comma, or click Add..."
          />

          {/* Nice to Have Skills */}
          <SkillsInput
            className="col-span-2"
            label="Nice to Have Skills"
            skills={formData.niceToHaveSkills}
            onChange={(skills) => setFormData(prev => ({ ...prev, niceToHaveSkills: skills }))}
            placeholder="Type nice-to-have skill (e.g. AWS) and press Enter, comma, or click Add..."
          />

          {/* Job Description */}
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs font-semibold text-text-secondary">Job Description *</label>
            <textarea
              name="jobDescription"
              value={formData.jobDescription}
              onChange={handleChange}
              required
              rows={10}
              placeholder="Enter detailed job description, responsibilities, and requirements..."
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container leading-relaxed font-sans resize-y min-h-[220px]"
            />
          </div>

          {/* TA Outreach WhatsApp Number */}
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs font-semibold text-text-secondary">TA Outreach WhatsApp Number (Agent 3 Follow-ups)</label>
            <select
              name="outreachWhatsAppNumber"
              value={formData.outreachWhatsAppNumber}
              onChange={handleChange}
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
            >
              <option value="">-- Use Default Campaign Number --</option>
              {whatsappNumbers.map(num => (
                <option key={num._id} value={num.phone}>
                  {num.name} ({num.phone})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-text-secondary mt-0.5">Select your designated Business WhatsApp number to be used as the sender for automated candidate outreach on this job.</p>
          </div>

          {/* Mute Default WhatsApp Reply */}
          <div className="flex items-center gap-3 col-span-2 p-3 bg-surface border border-border rounded-lg mt-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">Mute Default Auto-Reply</p>
              <p className="text-xs text-text-secondary mt-0.5">Turn this ON if you are running a custom WhatChimp auto-reply for this campaign and don't want the ATS to send its default "Thank you" message.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={formData.muteDefaultWhatsappReply} 
                onChange={e => setFormData(prev => ({ ...prev, muteDefaultWhatsappReply: e.target.checked }))} 
              />
              <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
            </label>
          </div>

          {/* Automated Follow-Up Channel Toggles */}
          <div className="grid grid-cols-2 gap-4 col-span-2 mt-2">
            <div className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg shadow-2xs">
              <div>
                <p className="text-sm font-medium text-text-primary">WhatsApp Follow-ups</p>
                <p className="text-xs text-text-secondary mt-0.5">Send automated outreach via WhatsApp Cloud API.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={formData.enableWhatsAppFollowUp} 
                  onChange={e => setFormData(prev => ({ ...prev, enableWhatsAppFollowUp: e.target.checked }))} 
                />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1B5E20]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg shadow-2xs">
              <div>
                <p className="text-sm font-medium text-text-primary">Email Follow-ups</p>
                <p className="text-xs text-text-secondary mt-0.5">Send automated outreach via Microsoft Graph email.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={formData.enableEmailFollowUp} 
                  onChange={e => setFormData(prev => ({ ...prev, enableEmailFollowUp: e.target.checked }))} 
                />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Custom Email Follow-Up Template */}
          <div className="flex flex-col gap-3 col-span-2 p-3 bg-surface border border-border rounded-lg mt-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Enable Custom Email Follow-Up Template</p>
                <p className="text-xs text-text-secondary mt-0.5">Toggle ON to customize the subject line and body of automated candidate follow-up emails for this job.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={formData.enableEmailFollowUpTemplate} 
                  onChange={e => setFormData(prev => ({ ...prev, enableEmailFollowUpTemplate: e.target.checked }))} 
                />
                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
              </label>
            </div>

            {formData.enableEmailFollowUpTemplate && (
              <div className="flex flex-col gap-3 mt-2 pt-2 border-t border-border/50">
                <div>
                  <label className="text-xs font-semibold text-text-primary block mb-1">Email Subject Line Template</label>
                  <input
                    type="text"
                    name="followUpEmailSubjectTemplate"
                    value={formData.followUpEmailSubjectTemplate}
                    onChange={handleChange}
                    placeholder="Action Required: Missing info for your {job_title} application"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
                  />
                  <p className="text-[11px] text-text-secondary mt-1">Available tags: <code className="bg-surface-variant px-1 py-0.5 rounded text-[10px]">&#123;candidate_name&#125;</code>, <code className="bg-surface-variant px-1 py-0.5 rounded text-[10px]">&#123;job_title&#125;</code>, <code className="bg-surface-variant px-1 py-0.5 rounded text-[10px]">&#123;company_name&#125;</code></p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-primary block mb-1">Email Body Template</label>
                  <textarea
                    name="followUpEmailBodyTemplate"
                    value={formData.followUpEmailBodyTemplate}
                    onChange={handleChange}
                    rows={5}
                    placeholder={`Hi {candidate_name},\n\nThank you for applying for the {job_title} role at {company_name}.\n\nTo progress your application, please provide the following details:\n{missing_fields}\n\nPlease reply at your earliest convenience.\n\nBest regards,\nTalent Acquisition Team`}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container font-mono"
                  />
                  <p className="text-[11px] text-text-secondary mt-1">Available tags: <code className="bg-surface-variant px-1 py-0.5 rounded text-[10px]">&#123;candidate_name&#125;</code>, <code className="bg-surface-variant px-1 py-0.5 rounded text-[10px]">&#123;job_title&#125;</code>, <code className="bg-surface-variant px-1 py-0.5 rounded text-[10px]">&#123;missing_fields&#125;</code>, <code className="bg-surface-variant px-1 py-0.5 rounded text-[10px]">&#123;company_name&#125;</code></p>
                </div>
              </div>
            )}
          </div>

          {/* Custom Follow-Up Questions (Screening / Portfolio Requirements) */}
          <div className="flex flex-col gap-3 col-span-2 p-4 bg-surface border border-border rounded-xl mt-2 shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <HelpCircle className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-text-primary">Custom Screening & Follow-up Questions</p>
              </div>
              <p className="text-xs text-text-secondary">
                Add custom mandatory questions for this job (e.g. <em>"Portfolio Link / Showreel"</em>, <em>"GitHub Profile"</em>, <em>"Willing to relocate?"</em>). These questions will be tracked alongside salary & notice period in the Follow-up stage.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Portfolio Link / Showreel (Google Drive, Vimeo, Behance)"
                value={newQuestionInput}
                onChange={(e) => setNewQuestionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddQuestion();
                  }
                }}
                className="flex-1 px-3 py-2 bg-surface-bright/50 border border-border rounded-lg text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-3.5 py-2 bg-primary text-on-primary hover:bg-primary/90 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>

            {formData.customFollowUpQuestions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {formData.customFollowUpQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-surface-bright/40 border border-border/80 rounded-lg text-xs"
                  >
                    <span className="font-medium text-text-primary flex-1">{q}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(idx)}
                      className="p-1 text-text-tertiary hover:text-red-500 hover:bg-red-500/10 rounded transition-colors ml-2 cursor-pointer"
                      title="Remove Question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI & Pipeline Config */}
          <div className="flex flex-col gap-4 col-span-2 p-4 bg-surface border border-border rounded-xl mt-2 shadow-xs">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 text-text-primary">
                <span className="material-symbols-outlined text-[18px] text-primary">bolt</span> AI & Pipeline Config
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Configure how AI matches candidates and the pipeline gates.
              </p>
            </div>

            {/* AI Match Weights Card */}
            <div className="border border-border rounded-xl p-4 space-y-4 bg-surface-variant/20">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold flex items-center gap-1.5 text-text-primary uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[16px] text-primary">tune</span> AI Match Weights
                </h4>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full transition-colors ${
                  weightSum === 100 
                    ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300 border border-green-300/50" 
                    : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300/50"
                }`}>
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
                  <span className="text-xs w-24 shrink-0 text-text-primary font-medium">{w.label}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={w.value}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setFormData(prev => ({
                        ...prev,
                        scoreWeights: {
                          ...prev.scoreWeights,
                          [w.key]: val,
                        }
                      }));
                    }}
                    className="flex-1 h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-xs font-mono w-10 text-right font-semibold text-text-primary">{w.value}%</span>
                </div>
              ))}

              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <span className="text-xs w-24 shrink-0 text-text-primary font-medium">Min Score</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.minMatchScore}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setFormData(prev => ({ ...prev, minMatchScore: val }));
                  }}
                  className="flex-1 h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-xs font-mono w-10 text-right font-semibold text-primary">{formData.minMatchScore}%</span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-text-primary">Run reverse match on publish (scan existing CVs)</label>
                  <p className="text-[11px] text-text-secondary">Keep automatic background candidate matching active for this job.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.reverseMatchOnPublish}
                    onChange={e => setFormData(prev => ({ ...prev, reverseMatchOnPublish: e.target.checked }))}
                  />
                  <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Immediate rescan on save option */}
              <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-primary">Rescan Candidate Database on Save</span>
                  <span className="text-[11px] text-text-secondary">Trigger AI reverse match across all CVs in database using the updated weights immediately when saved.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={rescanImmediately}
                    onChange={e => setRescanImmediately(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            {/* Pipeline Gates Card */}
            <div className="border border-border rounded-xl p-4 space-y-4 bg-surface-variant/20">
              <h4 className="text-xs font-semibold flex items-center gap-1.5 text-text-primary uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px] text-primary">group</span> Pipeline Gates
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-text-primary">Director review required</label>
                    <p className="text-[11px] text-text-secondary">Requires Director sign-off before candidate is sent to client.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.directorReviewEnabled}
                      onChange={e => setFormData(prev => ({ ...prev, directorReviewEnabled: e.target.checked }))}
                    />
                    <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-text-primary">Client review required</label>
                    <p className="text-[11px] text-text-secondary">Candidates must be reviewed by the client portal before interview.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.clientReviewEnabled}
                      onChange={e => setFormData(prev => ({ ...prev, clientReviewEnabled: e.target.checked }))}
                    />
                    <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-text-primary">ESA contract check</label>
                    <p className="text-[11px] text-text-secondary">Require signed Employment Services Agreement before placement.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.esaCheckEnabled}
                      onChange={e => setFormData(prev => ({ ...prev, esaCheckEnabled: e.target.checked }))}
                    />
                    <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                  <label className="text-xs font-medium text-text-primary">If all candidates rejected at client review:</label>
                  <select
                    value={formData.rejectionLoopAction}
                    onChange={e => setFormData(prev => ({ ...prev, rejectionLoopAction: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface text-text-primary focus:outline-none focus:border-primary"
                  >
                    <option value="restart_from_new_cvs">Restart sourcing from New CVs</option>
                    <option value="return_to_client_review">Keep in Client Review and notify recruiter</option>
                    <option value="ask_ta_each_time">Ask recruiter each time</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Active Ingestion Sources */}
          <div className="flex flex-col gap-3 col-span-2 p-3 bg-surface border border-border rounded-lg mt-2">
            <div>
              <p className="text-sm font-medium text-text-primary">Active Ingestion Sources</p>
              <p className="text-xs text-text-secondary mt-0.5">Toggle a source ON to activate it. Channels requiring configuration will ask for details when enabled.</p>
            </div>
            <div className="grid grid-cols-3 gap-6 mt-2">
              {ALL_CHANNELS.map(channel => {
                const isActive = channelToggles[channel.id] ?? false;
                const cfgField = channel.configField;
                const cfgKey = cfgField ? `${channel.id}_${cfgField}` : null;
                const existingCfg = cfgKey ? channelConfig[cfgKey] : null;
                const isEditing = editingChannelKey === channel.id;
                // Show inline config input when: toggled ON AND has a required config field AND (no existing config yet OR user clicked edit)
                const showConfigInput = isActive && cfgField && (!existingCfg || isEditing);

                return (
                  <div key={channel.id} className="flex flex-col gap-2 p-2 rounded-lg border border-border/50 bg-surface/50">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm text-text-primary font-medium">{channel.label}</span>
                        {isActive && existingCfg && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-green-600 font-medium">✅ {existingCfg}</span>
                            <button
                              type="button"
                              onClick={() => setEditingChannelKey(isEditing ? null : channel.id)}
                              className="text-[11px] text-primary hover:underline font-medium ml-1 cursor-pointer"
                            >
                              {isEditing ? 'Done' : 'Change'}
                            </button>
                          </div>
                        )}
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={isActive}
                          onChange={() => {
                            setChannelToggles(prev => ({ ...prev, [channel.id]: !isActive }));
                          }}
                        />
                        <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1B5E20]"></div>
                      </label>
                    </div>
                    {/* Inline config input */}
                    {showConfigInput && channel.configLabel && channel.configPlaceholder && cfgKey && (
                      <div className="ml-1 pl-3 border-l-2 border-primary/30 animate-in slide-in-from-top-1 duration-200">
                        <label className="block text-[11px] font-semibold text-primary mb-1">{channel.configLabel} *</label>
                        {channel.id === 'linkedin' ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="relative">
                              <select
                                value={['linkedin@career141.com', 'cv@career141.com', 'job@career141.com'].includes(channelConfig[cfgKey] || '') ? (channelConfig[cfgKey] || 'linkedin@career141.com') : 'custom'}
                                onChange={e => {
                                  if (e.target.value === 'custom') {
                                    setChannelConfig(prev => ({ ...prev, [cfgKey]: '' }));
                                  } else {
                                    setChannelConfig(prev => ({ ...prev, [cfgKey]: e.target.value }));
                                  }
                                }}
                                className="w-full appearance-none bg-surface border border-primary/30 rounded-lg pl-3 pr-8 py-2 text-[12px] font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer hover:border-primary/50 transition-all"
                              >
                                <option value="linkedin@career141.com">linkedin@career141.com (Default)</option>
                                <option value="cv@career141.com">cv@career141.com</option>
                                <option value="job@career141.com">job@career141.com</option>
                                <option value="custom">+ Custom / Other Mailbox</option>
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-text-secondary">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </div>
                            </div>
                            {!['linkedin@career141.com', 'cv@career141.com', 'job@career141.com'].includes(channelConfig[cfgKey] || '') && (
                              <input
                                type="email"
                                value={channelConfig[cfgKey] || ''}
                                onChange={e => setChannelConfig(prev => ({ ...prev, [cfgKey]: e.target.value }))}
                                placeholder="e.g. applications@career141.com"
                                className="w-full px-2.5 py-1.5 border border-primary/30 rounded-lg text-[12px] bg-surface text-text-primary focus:outline-none focus:border-primary placeholder:text-text-secondary/50"
                              />
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={channelConfig[cfgKey] || ''}
                            onChange={e => setChannelConfig(prev => ({ ...prev, [cfgKey]: e.target.value }))}
                            placeholder={channel.configPlaceholder}
                            className="w-full px-2.5 py-1.5 border border-primary/30 rounded-lg text-[12px] bg-surface text-text-primary focus:outline-none focus:border-primary placeholder:text-text-secondary/50"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

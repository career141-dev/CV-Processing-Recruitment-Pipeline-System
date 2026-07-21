"use client";

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

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

  // Fetch actual configured channels from the database
  const jobChannels = useQuery(
    api.jobs.jobs.getJobChannels,
    job?._id ? { jobId: job._id } : 'skip'
  );

  // All possible channels — always shown in the Edit modal
  // Channels that were never configured appear as OFF; toggling ON creates them on save
  const ALL_CHANNELS = [
    { id: 'whatsapp',       label: 'WhatsApp' },
    { id: 'email_campaign', label: 'Email Campaign' },
    { id: 'linkedin',       label: 'LinkedIn Inbox' },
    { id: 'headhunting',    label: 'Headhunting' },
    { id: 'workable',       label: 'Workable API' },
    { id: 'meta_campaign',  label: 'Meta / Facebook Ads' },
  ] as const;

  // Local toggle state: channelType -> isEnabled (all default OFF)
  const [channelToggles, setChannelToggles] = useState<Record<string, boolean>>(
    Object.fromEntries((['whatsapp','email_campaign','linkedin','headhunting','workable','meta_campaign'] as const).map(c => [c, false]))
  );

  const [formData, setFormData] = useState({
    title: '',
    clientName: '',
    clientIndustry: '',
    recruitmentType: 'both',
    location: '',
    requiredSkills: '',
    niceToHaveSkills: '',
    seniorityLevel: 'mid_level',
    experienceMinYears: 0,
    jobDescription: '',
    muteDefaultWhatsappReply: false,
    pausedChannels: [] as string[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (job) {
      setFormData({
        title: job.title || '',
        clientName: job.clientName || '',
        clientIndustry: job.clientIndustry || '',
        recruitmentType: job.recruitmentType || 'both',
        location: job.location || '',
        requiredSkills: (job.requiredSkills || []).join(', '),
        niceToHaveSkills: (job.niceToHaveSkills || []).join(', '),
        seniorityLevel: job.seniorityLevel || 'mid_level',
        experienceMinYears: job.experienceMinYears || 0,
        jobDescription: job.jobDescription || '',
        muteDefaultWhatsappReply: job.muteDefaultWhatsappReply || false,
        pausedChannels: job.pausedChannels || [],
      });
    }
  }, [job, isOpen]);

  // Sync channel toggles when jobChannels data arrives
  // Start all OFF, then set ON for channels that exist and are enabled
  useEffect(() => {
    const defaults: Record<string, boolean> = Object.fromEntries(ALL_CHANNELS.map(c => [c.id, false]));
    if (jobChannels) {
      jobChannels.forEach(ch => {
        // Map whatsapp_campaign -> whatsapp for display purposes
        const key = ch.channelType === 'whatsapp_campaign' ? 'whatsapp' : ch.channelType;
        defaults[key] = ch.isEnabled;
      });
    }
    setChannelToggles(defaults);
  }, [jobChannels, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'experienceMinYears' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    setIsSubmitting(true);
    try {
      const requiredSkillsArr = formData.requiredSkills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const niceToHaveSkillsArr = formData.niceToHaveSkills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

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
        description: formData.jobDescription,
        muteDefaultWhatsappReply: formData.muteDefaultWhatsappReply,
      });

      // Save ALL channel states — creates new channels if toggled ON for the first time,
      // updates existing channels, disables ones toggled OFF
      const existingByType: Record<string, any> = {};
      (jobChannels || []).forEach(ch => {
        const key = ch.channelType === 'whatsapp_campaign' ? 'whatsapp' : ch.channelType;
        existingByType[key] = ch;
      });

      const channelsPayload = ALL_CHANNELS.map(ch => ({
        channelType: ch.id,
        isEnabled: channelToggles[ch.id] ?? false,
        whatsappNumber: existingByType[ch.id]?.whatsappNumber,
        emailInbox: existingByType[ch.id]?.emailInbox,
        workableJobId: existingByType[ch.id]?.workableJobId,
        metaCampaignId: existingByType[ch.id]?.metaCampaignId,
      }));
      await updateJobChannels({ jobId: job._id, channels: channelsPayload });

      toast.success('Job details updated successfully!');
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
      maxWidth="max-w-2xl"
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
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
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
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
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
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
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
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
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
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
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
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
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
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
            >
              {RECRUITMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Required Skills */}
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs font-semibold text-text-secondary">Required Skills (comma separated) *</label>
            <input
              type="text"
              name="requiredSkills"
              value={formData.requiredSkills}
              onChange={handleChange}
              required
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
            />
          </div>

          {/* Nice to Have Skills */}
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs font-semibold text-text-secondary">Nice to Have Skills (comma separated)</label>
            <input
              type="text"
              name="niceToHaveSkills"
              value={formData.niceToHaveSkills}
              onChange={handleChange}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container"
            />
          </div>

          {/* Job Description */}
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs font-semibold text-text-secondary">Job Description *</label>
            <textarea
              name="jobDescription"
              value={formData.jobDescription}
              onChange={handleChange}
              required
              rows={5}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text-primary focus:outline-none focus:border-primary-container resize-none"
            />
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

          {/* Active Ingestion Sources */}
          <div className="flex flex-col gap-3 col-span-2 p-3 bg-surface border border-border rounded-lg mt-2">
            <div>
              <p className="text-sm font-medium text-text-primary">Active Ingestion Sources</p>
              <p className="text-xs text-text-secondary mt-0.5">Toggle a source ON to start collecting CVs from that channel. Toggle OFF to pause it. New channels toggled ON here will be added to the job.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-1">
              {ALL_CHANNELS.map(channel => {
                const isActive = channelToggles[channel.id] ?? false;
                return (
                  <div key={channel.id} className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">{channel.label}</span>
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
                );
              })}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

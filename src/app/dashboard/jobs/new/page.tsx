"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateJobWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Job Details
    jobTitle: '',
    clientCompany: '',
    jobType: 'LinkedIn Post',
    jobStatus: 'Active',
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
    assignedRecruiters: '',
    primaryRecruiter: 'Shambra Ameen',
    hiringManager: '',

    // Step 2: Channel Setup
    jobKeyword: '',
    channels: {
      linkedin: true,
      whatsapp: false,
      metaCampaign: false,
      emailCampaign: false,
      workable: false,
      headhunting: false,
    },
    whatsappNumber: '',
    metaCampaignId: '',
    emailInbox: '',
    workableJobId: '',

    // Step 3: AI Configuration
    enableMatching: true,
    enableFollowUps: false,
    followUpOrder: 'Email -> WhatsApp -> SMS',
    enablePhoneScreening: false,
    callScript: 'Initial Screening',
    additionalQuestions: [''],
    reviewLevels: {
      directorReview: false,
      clientReview: false,
    },
    customFilters: [''],
  });

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  const handlePublish = () => {
    // Publish logic
    alert('Job created and candidate matching initiated!');
    router.push('/dashboard/jobs');
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
            <label className="block text-sm font-medium text-text-secondary mb-1">Client/Company *</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.clientCompany} onChange={e => updateFormData('clientCompany', e.target.value)} placeholder="e.g. Atlas Holdings" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Job Type</label>
            <select className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface" value={formData.jobType} onChange={e => updateFormData('jobType', e.target.value)}>
              <option>LinkedIn Post</option>
              <option>Campaign Position</option>
              <option>Talent Acquisition</option>
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
          <label className="block text-sm font-medium text-text-secondary mb-1">Job Description * (Feeds AI Matching)</label>
          <textarea rows={6} className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.jobDescription} onChange={e => updateFormData('jobDescription', e.target.value)} placeholder="Paste full job description here..."></textarea>
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
              <option>Senior</option>
              <option>Director</option>
              <option>Executive</option>
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
            <label className="block text-sm font-medium text-text-secondary mb-1">Assigned Recruiters</label>
            <input type="text" className="w-full border border-border rounded-md px-3 py-2 text-body" value={formData.assignedRecruiters} onChange={e => updateFormData('assignedRecruiters', e.target.value)} placeholder="Select team members..." />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
        <h3 className="font-card-header text-lg mb-4 text-text-primary">Global Routing</h3>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Job Keyword (Auto-generated address label)</label>
          <div className="flex gap-2">
            <input type="text" className="w-64 border border-border rounded-md px-3 py-2 text-body font-mono" value={formData.jobKeyword || 'BRAND24'} onChange={e => updateFormData('jobKeyword', e.target.value)} />
            <button className="bg-surface-variant text-text-secondary px-3 py-2 rounded-md text-sm hover:bg-border transition-colors">Regenerate</button>
          </div>
          <p className="text-xs text-text-secondary mt-1">Required for LinkedIn subject parsing and WhatsApp/Meta detection.</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
        <h3 className="font-card-header text-lg mb-4 text-text-primary">Channel Configuration</h3>
        <div className="space-y-4">
          
          {/* Manual/Bulk */}
          <div className="flex items-start gap-4 p-4 border border-border rounded-md bg-surface-container-low">
            <input type="checkbox" checked disabled className="mt-1" />
            <div className="flex-1">
              <div className="font-medium text-text-primary">Manual / Bulk Upload</div>
              <p className="text-xs text-text-secondary mt-1">Always on. Recruiter can manually upload CVs to this job.</p>
            </div>
          </div>

          {/* LinkedIn */}
          <div className="flex items-start gap-4 p-4 border border-border rounded-md">
            <input type="checkbox" checked={formData.channels.linkedin} onChange={e => updateFormData('channels', {...formData.channels, linkedin: e.target.checked})} className="mt-1" />
            <div className="flex-1">
              <div className="font-medium text-text-primary">LinkedIn</div>
              {formData.channels.linkedin && (
                <div className="mt-3 p-3 bg-blue-50 text-blue-800 rounded text-sm border border-blue-100 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  Routes via shared inbox <strong>linkedin@career141.com</strong> using keyword <strong>{formData.jobKeyword || 'BRAND24'}</strong> in subject line.
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp */}
          <div className="flex items-start gap-4 p-4 border border-border rounded-md">
            <input type="checkbox" checked={formData.channels.whatsapp} onChange={e => updateFormData('channels', {...formData.channels, whatsapp: e.target.checked})} className="mt-1" />
            <div className="flex-1">
              <div className="font-medium text-text-primary">WhatsApp</div>
              {formData.channels.whatsapp && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-text-secondary mb-1">Assign WhatsApp Number</label>
                  <div className="flex gap-2">
                    <select className="border border-border rounded-md px-3 py-2 text-sm w-64 bg-surface" value={formData.whatsappNumber} onChange={e => updateFormData('whatsappNumber', e.target.value)}>
                      <option value="">-- Select Dedicated Number --</option>
                      <option value="sandbox">Use Shared Sandbox Number</option>
                      <option value="+1234567890">+1 (234) 567-890</option>
                    </select>
                    <button className="border border-primary-container text-primary-container px-3 py-2 rounded-md text-sm hover:bg-primary-container hover:text-on-primary transition-colors" onClick={(e) => { e.preventDefault(); alert('Provisioning simulated success!'); updateFormData('whatsappNumber', '+19998887777'); }}>Provision New</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Meta Campaign */}
          <div className="flex items-start gap-4 p-4 border border-border rounded-md">
            <input type="checkbox" checked={formData.channels.metaCampaign} onChange={e => updateFormData('channels', {...formData.channels, metaCampaign: e.target.checked})} className="mt-1" />
            <div className="flex-1">
              <div className="font-medium text-text-primary">Meta Campaign</div>
              {formData.channels.metaCampaign && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-text-secondary mb-1">Ad Campaign ID</label>
                  <input type="text" className="w-64 border border-border rounded-md px-3 py-2 text-sm" value={formData.metaCampaignId} onChange={e => updateFormData('metaCampaignId', e.target.value)} placeholder="e.g. 1202029393" />
                  <p className="text-xs text-text-secondary mt-1">Driven by paid Facebook/Instagram ads to WhatsApp.</p>
                </div>
              )}
            </div>
          </div>

          {/* Email Campaign */}
          <div className="flex items-start gap-4 p-4 border border-border rounded-md">
            <input type="checkbox" checked={formData.channels.emailCampaign} onChange={e => updateFormData('channels', {...formData.channels, emailCampaign: e.target.checked})} className="mt-1" />
            <div className="flex-1">
              <div className="font-medium text-text-primary">Email Campaign</div>
              {formData.channels.emailCampaign && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-text-secondary mb-1">Dedicated Inbox</label>
                  <div className="flex gap-2">
                    <input type="text" className="w-64 border border-border rounded-md px-3 py-2 text-sm" value={formData.emailInbox || `${(formData.jobKeyword || 'brand24').toLowerCase()}@career141.com`} onChange={e => updateFormData('emailInbox', e.target.value)} />
                    <button className="border border-primary-container text-primary-container px-3 py-2 rounded-md text-sm hover:bg-primary-container hover:text-on-primary transition-colors" onClick={(e) => { e.preventDefault(); alert('Inbox created!'); }}>Provision New</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Workable ATS */}
          <div className="flex items-start gap-4 p-4 border border-border rounded-md">
            <input type="checkbox" checked={formData.channels.workable} onChange={e => updateFormData('channels', {...formData.channels, workable: e.target.checked})} className="mt-1" />
            <div className="flex-1">
              <div className="font-medium text-text-primary">Workable ATS</div>
              {formData.channels.workable && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-text-secondary mb-1">Map to Workable Job</label>
                  <select className="w-64 border border-border rounded-md px-3 py-2 text-sm bg-surface" value={formData.workableJobId} onChange={e => updateFormData('workableJobId', e.target.value)}>
                    <option value="">-- Select Workable Job --</option>
                    <option value="wk-brand-mgr">Brand Manager (W-982)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Headhunting */}
          <div className="flex items-start gap-4 p-4 border border-border rounded-md">
            <input type="checkbox" checked={formData.channels.headhunting} onChange={e => updateFormData('channels', {...formData.channels, headhunting: e.target.checked})} className="mt-1" />
            <div className="flex-1">
              <div className="font-medium text-text-primary">Headhunting</div>
              <p className="text-xs text-text-secondary mt-1">Marks this job as open to TA-sourced passive candidates.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
        <h3 className="font-card-header text-lg mb-4 text-text-primary">AI Agents Configuration</h3>
        <div className="space-y-6">
          
          <div className="flex items-start justify-between border-b border-border pb-4">
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

          <div className="flex items-start justify-between border-b border-border pb-4">
            <div className="flex-1">
              <div className="font-medium text-text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary-container">schedule_send</span>
                Enable Automated Follow-ups (Agent 3)
              </div>
              <p className="text-sm text-text-secondary mt-1 mb-3">Chases non-responsive candidates automatically.</p>
              {formData.enableFollowUps && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Follow-up Sequence</label>
                  <select className="w-64 border border-border rounded-md px-3 py-2 text-sm bg-surface" value={formData.followUpOrder} onChange={e => updateFormData('followUpOrder', e.target.value)}>
                    <option>Email -&gt; WhatsApp -&gt; SMS</option>
                    <option>WhatsApp -&gt; Email -&gt; SMS</option>
                  </select>
                </div>
              )}
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={formData.enableFollowUps} onChange={e => updateFormData('enableFollowUps', e.target.checked)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
            </label>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-medium text-text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary-container">call</span>
                Enable AI Phone Screening (Agent 5)
              </div>
              <p className="text-sm text-text-secondary mt-1 mb-3">Fires only after TA triggers call. Conducts initial screening interview.</p>
              {formData.enablePhoneScreening && (
                <div className="space-y-4 bg-surface-container-low p-4 rounded-md border border-border mr-8">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Call Script</label>
                    <div className="flex gap-2 items-center">
                      <select className="w-64 border border-border rounded-md px-3 py-2 text-sm bg-surface" value={formData.callScript} onChange={e => updateFormData('callScript', e.target.value)}>
                        <option>Initial Screening</option>
                        <option>Technical Pre-screen</option>
                      </select>
                      <button className="text-primary-container text-sm font-medium hover:underline">Edit Script</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Additional Screening Questions (Dynamic)</label>
                    {formData.additionalQuestions.map((q, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <input type="text" className="flex-1 border border-border rounded-md px-3 py-2 text-sm" value={q} onChange={(e) => {
                          const newQ = [...formData.additionalQuestions];
                          newQ[idx] = e.target.value;
                          updateFormData('additionalQuestions', newQ);
                        }} placeholder="e.g. Do you have experience with enterprise deployments?" />
                        <button className="text-text-secondary hover:text-error" onClick={() => {
                          const newQ = formData.additionalQuestions.filter((_, i) => i !== idx);
                          updateFormData('additionalQuestions', newQ);
                        }}><span className="material-symbols-outlined">delete</span></button>
                      </div>
                    ))}
                    <button className="text-primary-container text-sm font-medium flex items-center gap-1 mt-2 hover:underline" onClick={() => updateFormData('additionalQuestions', [...formData.additionalQuestions, ''])}>
                      <span className="material-symbols-outlined text-[16px]">add</span> Add Question
                    </button>
                  </div>
                </div>
              )}
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={formData.enablePhoneScreening} onChange={e => updateFormData('enablePhoneScreening', e.target.checked)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
            </label>
          </div>

        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
        <h3 className="font-card-header text-lg mb-4 text-text-primary">Pipeline Configuration</h3>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-secondary mb-3">Review Levels (Gates)</label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked disabled className="rounded text-primary-container" />
              <span className="text-text-secondary">TA Shortlist (Required)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={formData.reviewLevels.directorReview} onChange={e => updateFormData('reviewLevels', {...formData.reviewLevels, directorReview: e.target.checked})} className="rounded text-primary-container focus:ring-primary-container" />
              <span>Director Review</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={formData.reviewLevels.clientReview} onChange={e => updateFormData('reviewLevels', {...formData.reviewLevels, clientReview: e.target.checked})} className="rounded text-primary-container focus:ring-primary-container" />
              <span>Client Review</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Job-Specific Custom Filters</label>
          <p className="text-xs text-text-secondary mb-3">Pre-load niche requirements for the Advanced Filter Search.</p>
          {formData.customFilters.map((f, idx) => (
            <div key={idx} className="flex gap-2 mb-2 w-1/2">
              <input type="text" className="flex-1 border border-border rounded-md px-3 py-2 text-sm" value={f} onChange={(e) => {
                const newF = [...formData.customFilters];
                newF[idx] = e.target.value;
                updateFormData('customFilters', newF);
              }} placeholder="e.g. ISO 27001 Lead Auditor" />
              <button className="text-text-secondary hover:text-error" onClick={() => {
                const newF = formData.customFilters.filter((_, i) => i !== idx);
                updateFormData('customFilters', newF);
              }}><span className="material-symbols-outlined">delete</span></button>
            </div>
          ))}
          <button className="text-primary-container text-sm font-medium flex items-center gap-1 mt-2 hover:underline" onClick={() => updateFormData('customFilters', [...formData.customFilters, ''])}>
            <span className="material-symbols-outlined text-[16px]">add</span> Add Filter
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => {
    // Basic validation warning logic
    const warnings = [];
    if (!formData.jobTitle) warnings.push("Job Title is missing.");
    if (!formData.requiredSkills) warnings.push("Required Skills are missing.");
    if (formData.channels.whatsapp && !formData.whatsappNumber) warnings.push("WhatsApp is enabled but no number is assigned.");
    
    return (
      <div className="space-y-6">
        {warnings.length > 0 && (
          <div className="bg-[#FFF9C4] border border-[#FBC02D] p-4 rounded-lg flex items-start gap-3 text-[#F57F17]">
            <span className="material-symbols-outlined text-[20px]">warning</span>
            <div>
              <h4 className="font-bold text-sm">Please review the following before publishing:</h4>
              <ul className="list-disc ml-5 text-sm mt-1">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Summary Step 1 */}
          <div className="bg-surface border border-border rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-card-header text-primary-container">Job Details</h3>
              <button className="text-text-secondary hover:text-primary-container text-sm underline" onClick={() => setCurrentStep(1)}>Edit</button>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
              <p><strong className="text-text-primary">Title:</strong> {formData.jobTitle || '—'}</p>
              <p><strong className="text-text-primary">Company:</strong> {formData.clientCompany || '—'}</p>
              <p><strong className="text-text-primary">Recruiter:</strong> {formData.primaryRecruiter}</p>
              <p><strong className="text-text-primary">Req Skills:</strong> {formData.requiredSkills || '—'}</p>
            </div>
          </div>

          {/* Summary Step 2 */}
          <div className="bg-surface border border-border rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-card-header text-primary-container">Channels</h3>
              <button className="text-text-secondary hover:text-primary-container text-sm underline" onClick={() => setCurrentStep(2)}>Edit</button>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
              <p><strong className="text-text-primary">Keyword:</strong> {formData.jobKeyword || 'BRAND24'}</p>
              <p><strong className="text-text-primary">LinkedIn:</strong> {formData.channels.linkedin ? 'Enabled' : 'Disabled'}</p>
              <p><strong className="text-text-primary">WhatsApp:</strong> {formData.channels.whatsapp ? formData.whatsappNumber || 'Not Configured' : 'Disabled'}</p>
              <p><strong className="text-text-primary">Email:</strong> {formData.channels.emailCampaign ? formData.emailInbox || 'Set up' : 'Disabled'}</p>
            </div>
          </div>

          {/* Summary Step 3 */}
          <div className="bg-surface border border-border rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-card-header text-primary-container">AI Config</h3>
              <button className="text-text-secondary hover:text-primary-container text-sm underline" onClick={() => setCurrentStep(3)}>Edit</button>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
              <p><strong className="text-text-primary">Matching:</strong> {formData.enableMatching ? 'On' : 'Off'}</p>
              <p><strong className="text-text-primary">Follow-ups:</strong> {formData.enableFollowUps ? 'On' : 'Off'}</p>
              <p><strong className="text-text-primary">Phone Screen:</strong> {formData.enablePhoneScreening ? 'On' : 'Off'}</p>
              <p><strong className="text-text-primary">Director Review:</strong> {formData.reviewLevels.directorReview ? 'Required' : 'Skip'}</p>
            </div>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-background p-8 min-h-screen font-body max-w-5xl mx-auto">
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

      <div className="flex justify-between border-t border-border pt-6 pb-24">
        <div>
          {currentStep > 1 && (
            <button className="px-6 py-2 border border-border text-text-secondary rounded-md hover:bg-surface transition-colors" onClick={handleBack}>
              Back
            </button>
          )}
        </div>
        <div className="flex gap-4">
          <button className="px-6 py-2 border border-border text-text-primary rounded-md hover:bg-surface transition-colors bg-surface">
            Save as Draft
          </button>
          {currentStep < 4 ? (
            <button className="px-6 py-2 bg-primary-container text-on-primary rounded-md hover:bg-primary transition-colors font-medium shadow-sm" onClick={handleNext}>
              Next Step
            </button>
          ) : (
            <button className="px-6 py-2 bg-primary-container text-on-primary rounded-md hover:bg-primary transition-colors font-medium shadow-sm" onClick={handlePublish}>
              Create Job &amp; Find Candidates
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

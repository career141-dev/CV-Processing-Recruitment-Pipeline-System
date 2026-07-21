"use client";

import React, { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Mail, MessageSquare, Sparkles, Send, Users, Clock, Eye, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

interface CandidateAppItem {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  followUpCvReceived?: boolean;
  followUpCurrentSalary?: boolean;
  followUpExpectedSalary?: boolean;
  followUpNoticePeriod?: boolean;
}

interface SendBulkFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobTitle?: string;
  applications: CandidateAppItem[];
  onSend?: (data: {
    emailSubject: string;
    emailBody: string;
    whatsappBody: string;
    selectedAppIds: string[];
  }) => void;
}

const DEFAULT_EMAIL_SUBJECT = "Action Required: Missing info for your {job_title} application";

const DEFAULT_EMAIL_BODY = `Hi {candidate_name},

We are reviewing your application for the {job_title} role!

To progress your application to the next stage, we kindly request you to provide the following missing details:

{missing_fields}

Please reply directly to this email at your earliest convenience so our recruitment team can finalize your evaluation.

Best regards,
Talent Acquisition Team`;

const DEFAULT_WHATSAPP_BODY = `Hi *{candidate_name}*,

We're reviewing your application for *{job_title}*!

To proceed with your application, please reply with the following missing details:
{missing_fields}

Thank you!`;

export function SendBulkFollowUpModal({
  isOpen,
  onClose,
  jobTitle = "the position",
  applications = [],
  onSend,
}: SendBulkFollowUpModalProps) {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('email');
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');

  const [emailSubject, setEmailSubject] = useState(DEFAULT_EMAIL_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_BODY);
  const [whatsappBody, setWhatsappBody] = useState(DEFAULT_WHATSAPP_BODY);

  // Candidate selection state (default: all selected)
  const [selectedIds, setSelectedIds] = useState<string[]>(() => applications.map(a => a.id));
  const [showCandidateList, setShowCandidateList] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync selectedIds if applications prop updates when modal opens
  React.useEffect(() => {
    if (isOpen && applications.length > 0) {
      setSelectedIds(applications.map(a => a.id));
    }
  }, [isOpen, applications]);

  const toggleSelectAll = () => {
    if (selectedIds.length === applications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(applications.map(a => a.id));
    }
  };

  const toggleSelectCandidate = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Compute missing fields helper function for a candidate
  const getMissingFieldsList = (app: CandidateAppItem) => {
    const list: string[] = [];
    if (!app.followUpCvReceived) list.push("CV / Resume");
    if (!app.followUpCurrentSalary) list.push("Current Salary");
    if (!app.followUpExpectedSalary) list.push("Expected Salary");
    if (!app.followUpNoticePeriod) list.push("Notice Period");
    if (list.length === 0) list.push("Profile Details Confirmation");
    return list;
  };

  // Sample preview rendering
  const sampleCandidate = useMemo(() => {
    const selectedApps = applications.filter(a => selectedIds.includes(a.id));
    return selectedApps[0] || applications[0] || {
      id: 'sample',
      name: 'Jane Doe',
      followUpCvReceived: false,
      followUpCurrentSalary: false,
      followUpExpectedSalary: true,
      followUpNoticePeriod: false,
    };
  }, [applications, selectedIds]);

  const renderedPreview = useMemo(() => {
    const candidateName = sampleCandidate.name || 'Candidate Name';
    const missingItems = getMissingFieldsList(sampleCandidate);
    const missingFormatted = missingItems.map(item => `• ${item}`).join('\n');

    if (activeTab === 'email') {
      const subject = emailSubject
        .replace(/\{job_title\}/g, jobTitle)
        .replace(/\{candidate_name\}/g, candidateName);

      const body = emailBody
        .replace(/\{job_title\}/g, jobTitle)
        .replace(/\{candidate_name\}/g, candidateName)
        .replace(/\{missing_fields\}/g, missingFormatted);

      return { subject, body };
    } else {
      const body = whatsappBody
        .replace(/\{job_title\}/g, jobTitle)
        .replace(/\{candidate_name\}/g, candidateName)
        .replace(/\{missing_fields\}/g, missingFormatted);

      return { subject: null, body };
    }
  }, [activeTab, emailSubject, emailBody, whatsappBody, jobTitle, sampleCandidate]);

  const handleInsertPlaceholder = (placeholder: string) => {
    if (activeTab === 'email') {
      setEmailBody(prev => prev + ` ${placeholder}`);
    } else {
      setWhatsappBody(prev => prev + ` ${placeholder}`);
    }
  };

  const handleSend = () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one candidate to send follow-up outreach.");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate sending UI action (or call prop handler)
    setTimeout(() => {
      if (onSend) {
        onSend({
          emailSubject,
          emailBody,
          whatsappBody,
          selectedAppIds: selectedIds,
        });
      }

      toast.success(
        `Bulk follow-up sent to ${selectedIds.length} candidate(s)! Email & WhatsApp messages dispatched and 7-day timer started.`,
        { duration: 4000 }
      );

      setIsSubmitting(false);
      onClose();
    }, 600);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Send Bulk Follow-ups (${selectedIds.length} Targeted)`}
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={selectedIds.length === 0 || isSubmitting}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-medium"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? "Dispatching..." : `Send to ${selectedIds.length} Candidate${selectedIds.length !== 1 ? 's' : ''}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        
        {/* Banner Notice */}
        <div className="flex items-start gap-3 p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-900 dark:text-blue-200 text-xs leading-relaxed">
          <Clock className="w-5 h-5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <div>
            <span className="font-semibold block text-sm mb-0.5">Dual-Channel Outreach & 7-Day Tracking</span>
            <span>
              This will send customized messages via <strong>Email</strong> and <strong>WhatsApp</strong>. The 7-day follow-up response timer will officially start for selected candidates once dispatched.
            </span>
          </div>
        </div>

        {/* Candidate Selector Bar */}
        <div className="flex items-center justify-between p-3 bg-surface-bright border border-border rounded-xl">
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-text-primary">
              Target Candidates: {selectedIds.length} of {applications.length} selected
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowCandidateList(prev => !prev)}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            {showCandidateList ? 'Hide candidate list' : 'View / Edit candidate list'}
          </button>
        </div>

        {/* Collapsible Candidate Selection List */}
        {showCandidateList && (
          <div className="border border-border rounded-xl p-3 bg-surface max-h-48 overflow-y-auto flex flex-col gap-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Select Candidates</span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-primary font-medium hover:underline"
              >
                {selectedIds.length === applications.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            {applications.length === 0 ? (
              <p className="text-xs text-text-secondary py-2">No candidates in follow-up stage.</p>
            ) : (
              applications.map(app => {
                const missing = getMissingFieldsList(app);
                const isSelected = selectedIds.includes(app.id);
                return (
                  <label
                    key={app.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border text-xs transition-colors ${
                      isSelected
                        ? 'border-primary/40 bg-primary/5 text-text-primary'
                        : 'border-border bg-surface text-text-secondary hover:bg-surface-bright'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectCandidate(app.id)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="font-semibold text-text-primary">{app.name}</span>
                    </div>
                    <span className="text-[11px] text-text-secondary">
                      Missing: {missing.join(', ')}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        )}

        {/* Header Tabs: Channel Selector & Editor/Preview Toggle */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          {/* Channel Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                activeTab === 'email'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-surface border-border text-text-secondary hover:bg-surface-bright hover:text-text-primary'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Email Template
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                activeTab === 'whatsapp'
                  ? 'bg-[#25D366] text-white border-[#25D366] shadow-sm'
                  : 'bg-surface border-border text-text-secondary hover:bg-surface-bright hover:text-text-primary'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp Template
            </button>
          </div>

          {/* Mode Toggle (Edit vs Preview) */}
          <div className="flex items-center bg-surface-bright border border-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'editor' ? 'bg-surface text-text-primary shadow-xs' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Edit3 className="w-3 h-3" /> Edit Template
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'preview' ? 'bg-surface text-text-primary shadow-xs' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Eye className="w-3 h-3" /> Sample Preview
            </button>
          </div>
        </div>

        {/* Editor or Preview Area */}
        {viewMode === 'editor' ? (
          <div className="flex flex-col gap-4">
            
            {/* Email Subject Line (Only shown in Email tab) */}
            {activeTab === 'email' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Subject line..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-surface text-text-primary"
                />
              </div>
            )}

            {/* Template Body Editor */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  {activeTab === 'email' ? 'Email Body Message' : 'WhatsApp Body Message'}
                </label>
                {activeTab === 'whatsapp' && (
                  <span className="text-[11px] text-text-secondary">
                    Supports WhatsApp formatting: <code>*bold*</code>, <code>_italic_</code>
                  </span>
                )}
              </div>
              <textarea
                rows={8}
                value={activeTab === 'email' ? emailBody : whatsappBody}
                onChange={e =>
                  activeTab === 'email'
                    ? setEmailBody(e.target.value)
                    : setWhatsappBody(e.target.value)
                }
                className="w-full px-3 py-2.5 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-surface text-text-primary font-mono leading-relaxed resize-y"
              />
            </div>

            {/* Placeholder Quick Injectors */}
            <div className="flex flex-wrap items-center gap-2 bg-surface-bright p-3 rounded-lg border border-border">
              <span className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> Click tag to insert placeholder:
              </span>
              <button
                type="button"
                onClick={() => handleInsertPlaceholder('{candidate_name}')}
                className="text-[11px] px-2 py-1 bg-surface hover:bg-primary/10 hover:text-primary border border-border rounded-md font-mono text-text-primary transition-colors"
              >
                {'{candidate_name}'}
              </button>
              <button
                type="button"
                onClick={() => handleInsertPlaceholder('{job_title}')}
                className="text-[11px] px-2 py-1 bg-surface hover:bg-primary/10 hover:text-primary border border-border rounded-md font-mono text-text-primary transition-colors"
              >
                {'{job_title}'}
              </button>
              <button
                type="button"
                onClick={() => handleInsertPlaceholder('{missing_fields}')}
                className="text-[11px] px-2 py-1 bg-surface hover:bg-primary/10 hover:text-primary border border-border rounded-md font-mono text-text-primary transition-colors"
              >
                {'{missing_fields}'}
              </button>
            </div>
          </div>
        ) : (
          /* Live Preview Mode */
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-text-secondary border-b border-border pb-2">
              <span>Sample Candidate: <strong className="text-text-primary">{sampleCandidate.name}</strong></span>
              <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {activeTab === 'email' ? 'Email Live Preview' : 'WhatsApp Live Preview'}
              </span>
            </div>

            <div className="bg-surface-bright border border-border rounded-xl p-4 flex flex-col gap-3">
              {renderedPreview.subject && (
                <div className="border-b border-border/70 pb-2">
                  <span className="text-[11px] uppercase tracking-wider text-text-secondary font-bold block mb-1">Subject</span>
                  <div className="text-xs font-semibold text-text-primary">{renderedPreview.subject}</div>
                </div>
              )}
              <div>
                <span className="text-[11px] uppercase tracking-wider text-text-secondary font-bold block mb-1">Message Content</span>
                <div className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed font-sans bg-surface p-3.5 rounded-lg border border-border">
                  {renderedPreview.body}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}

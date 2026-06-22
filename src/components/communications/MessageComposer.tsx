"use client";

import React, { useState, useEffect } from 'react';
import { Mail, MessageCircle, Smartphone, AlertTriangle, ChevronDown, Calendar, X, Paperclip, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { TemplateManagerModal, Template } from './TemplateManagerModal';
import { ScheduleMessageModal } from './ScheduleMessageModal';

interface MessageComposerProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  candidateInitials: string;
  candidateTitle: string;
}

export function MessageComposer({
  isOpen,
  onClose,
  candidateName,
  candidateInitials,
  candidateTitle,
}: MessageComposerProps) {
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [subject, setSubject] = useState('New Career Opportunity - Data Analyst Roles');
  const [message, setMessage] = useState(
    "Hi Priya Nair,\n\nI came across your profile and wanted to reach out about an exciting Senior Data Analyst opportunity with one of our clients.\n\nWould you be open to learning more?\n\nBest regards,\nSarah K."
  );
  const [isFollowupOn, setIsFollowupOn] = useState(true);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('1');
  
  const [templates, setTemplates] = useState<Template[]>([
    { id: '1', name: 'Job Introduction', content: 'Hi [Name],\n\nI came across your profile and wanted to reach out about an exciting [Job Title] opportunity with [Company].\n\nWould you be open to learning more?\n\nBest regards,\n[Recruiter]' },
    { id: '2', name: 'CV Request', content: "Hello [Name],\n\nI'm reviewing your application for the [Job Title] role. Could you please share an updated version of your CV?\n\nThanks,\n[Recruiter]" },
    { id: '3', name: 'Interview Invitation', content: "Hi [Name],\n\nThe team was impressed with your profile. We'd love to schedule a 30-minute introductory call this week.\n\nBest,\n[Recruiter]" },
  ]);

  const [attachments, setAttachments] = useState<string[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Hardcoded duplicate warning for now
  const duplicateWarning = "Priya Nair was contacted 3 days ago by Mike J. via Email. Review before sending.";

  const handleChannelSelect = (ch: 'email' | 'whatsapp' | 'sms') => {
    setChannel(ch);
    if (ch !== 'email') {
      setSubject('');
    }
  };

  const handleSendNow = () => {
    if (!duplicateAcknowledged) {
      toast.error('Please acknowledge the duplicate warning before sending.');
      return;
    }
    
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 2000);
  };

  const handleSchedule = (date: Date) => {
    if (!duplicateAcknowledged) {
      toast.error('Please acknowledge the duplicate warning before scheduling.');
      return;
    }
    toast.success(`Message scheduled for ${date.toLocaleString()} via ${channel === 'email' ? 'Email' : channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}.`);
    setIsScheduleModalOpen(false);
    onClose();
  };

  const insertToken = (token: string) => {
    setMessage(prev => prev + token);
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedTemplate(val);
    if (val === 'manage') {
      setIsTemplateModalOpen(true);
      setSelectedTemplate(templates[0]?.id || ''); 
      return;
    }
    
    const t = templates.find(t => t.id === val);
    if (t) {
      setMessage(t.content);
    }
  };

  const computedMessage = isPreviewMode ? message
    .replace(/\[Name\]/gi, candidateName || 'Candidate')
    .replace(/\[Job Title\]/gi, candidateTitle || 'the role')
    .replace(/\[Company\]/gi, 'Career141')
    .replace(/\[Recruiter\]/gi, 'Sarah K.')
    : message;

  const maxLength = channel === 'sms' ? 160 : 1000;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/15 z-[49] transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div 
        className={`fixed top-0 right-0 h-screen w-[420px] bg-surface border-l border-border shadow-[0_8px_16px_rgba(0,0,0,0.10)] z-[50] flex flex-col transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          <h3 className="text-[16px] font-semibold text-text-primary">Send Message</h3>
          <button 
            className="text-text-secondary hover:text-text-primary transition-colors bg-transparent border-0 p-1 cursor-pointer" 
            onClick={() => {
              setIsSuccess(false);
              onClose();
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {isSuccess ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">Message Sent</h3>
            <p className="text-sm text-text-secondary">
              Successfully sent to {candidateName} via {channel}.
            </p>
          </div>
        ) : (
          <>
        <div className="flex-1 overflow-y-auto">
          {/* Recipient Section */}
          <div className="p-4 bg-surface-container-low border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-[12px] font-semibold text-text-primary">
                {candidateInitials}
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-text-primary">{candidateName}</span>
                <span className="text-[12px] text-text-secondary">{candidateTitle}</span>
              </div>
            </div>

            {/* Duplicate Warning */}
            <div className="mt-3 bg-[#FFF8E1] border-l-[3px] border-[#E65100] p-3 rounded-lg flex flex-col gap-2">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-[#E65100] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#E65100] leading-tight">
                  {duplicateWarning}
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer ml-6">
                <input 
                  type="checkbox" 
                  checked={duplicateAcknowledged}
                  onChange={(e) => setDuplicateAcknowledged(e.target.checked)}
                  className="rounded border-[#E65100] text-[#E65100] focus:ring-[#E65100]"
                />
                <span className="text-[11px] text-[#E65100] font-medium">I acknowledge and want to proceed</span>
              </label>
            </div>
          </div>

          {/* Channel Selector */}
          <div className="p-4 border-b border-border">
            <span className="font-label-caps text-label-caps text-text-secondary mb-3 block">SEND VIA</span>
            <div className="flex gap-2">
              <button 
                onClick={() => handleChannelSelect('email')}
                className={`flex-1 flex flex-col items-center py-2.5 px-0 rounded-[10px] cursor-pointer transition-all ${channel === 'email' ? 'border-2 border-secondary bg-[#F0FFF0] text-secondary' : 'border border-border bg-surface text-text-secondary hover:bg-surface-container-low'}`}
              >
                <Mail className="w-4 h-4 mb-1" />
                <span className="text-[13px] font-semibold">Email</span>
              </button>
              <button 
                onClick={() => handleChannelSelect('whatsapp')}
                className={`flex-1 flex flex-col items-center py-2.5 px-0 rounded-[10px] cursor-pointer transition-all ${channel === 'whatsapp' ? 'border-2 border-secondary bg-[#F0FFF0] text-secondary' : 'border border-border bg-surface text-text-secondary hover:bg-surface-container-low'}`}
              >
                <MessageCircle className="w-4 h-4 mb-1" />
                <span className="text-[13px] font-semibold">WhatsApp</span>
              </button>
              <button 
                onClick={() => handleChannelSelect('sms')}
                className={`flex-1 flex flex-col items-center py-2.5 px-0 rounded-[10px] cursor-pointer transition-all ${channel === 'sms' ? 'border-2 border-secondary bg-[#F0FFF0] text-secondary' : 'border border-border bg-surface text-text-secondary hover:bg-surface-container-low'}`}
              >
                <Smartphone className="w-4 h-4 mb-1" />
                <span className="text-[13px] font-semibold">SMS</span>
              </button>
            </div>

            {channel === 'email' && (
              <div className="mt-4">
                <span className="text-[11px] text-text-disabled block mb-2">From: sarah.k@career141.com</span>
                <div className="flex flex-col gap-1">
                  <label className="font-label-caps text-label-caps text-text-secondary">SUBJECT</label>
                  <input 
                    type="text" 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-[13px] focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all" 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Template Picker */}
          <div className="p-4 border-b border-border">
            <label className="font-label-caps text-label-caps text-text-secondary mb-2 block">TEMPLATE</label>
            <div className="relative">
              <select 
                value={selectedTemplate}
                onChange={handleTemplateChange}
                className="w-full appearance-none px-3 py-2 border border-border rounded-lg text-[13px] text-text-primary focus:outline-none focus:border-secondary cursor-pointer"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                <option disabled>──────────</option>
                <option value="manage">Manage Templates...</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary" />
            </div>
          </div>

          {/* Message Body */}
          <div className="p-4 border-b border-border relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => insertToken('[Name]')} disabled={isPreviewMode} className="bg-surface-container-low text-on-surface-variant text-[11px] font-semibold py-1 px-2.5 rounded hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed">[Name]</button>
                <button onClick={() => insertToken('[Job Title]')} disabled={isPreviewMode} className="bg-surface-container-low text-on-surface-variant text-[11px] font-semibold py-1 px-2.5 rounded hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed">[Job Title]</button>
                <button onClick={() => insertToken('[Recruiter]')} disabled={isPreviewMode} className="bg-surface-container-low text-on-surface-variant text-[11px] font-semibold py-1 px-2.5 rounded hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed">[Recruiter]</button>
                <button onClick={() => insertToken('[Company]')} disabled={isPreviewMode} className="bg-surface-container-low text-on-surface-variant text-[11px] font-semibold py-1 px-2.5 rounded hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed">[Company]</button>
              </div>
              <button 
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${isPreviewMode ? 'bg-secondary text-on-primary' : 'bg-surface-container-low text-text-secondary hover:bg-surface-container-high'}`}
              >
                {isPreviewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                Preview
              </button>
            </div>
            
            <textarea 
              value={computedMessage}
              onChange={(e) => !isPreviewMode && setMessage(e.target.value)}
              disabled={isPreviewMode}
              className={`w-full p-3 border rounded-lg text-[13px] text-text-primary leading-relaxed focus:outline-none focus:ring-1 transition-all resize-none ${isPreviewMode ? 'bg-gray-50' : ''} ${message.length > maxLength ? 'border-error focus:border-error focus:ring-error' : 'border-border focus:border-secondary focus:ring-secondary'}`}
              rows={8}
            />
            
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setAttachments(prev => [...prev, 'Job_Description.pdf'])}
                  disabled={channel === 'sms' || isPreviewMode}
                  className="p-1.5 text-text-secondary hover:text-secondary hover:bg-surface-container-low rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Add Attachment"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1 bg-surface-container-low px-2 py-1 rounded text-[11px] text-text-secondary">
                    {att}
                    <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-error">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <span className={`text-[11px] ${message.length > maxLength ? 'text-error font-medium' : 'text-text-disabled'}`}>
                {message.length} / {maxLength} {channel === 'sms' ? `(${(Math.ceil(message.length / 160) || 1)} segment${Math.ceil(message.length / 160) > 1 ? 's' : ''})` : ''}
              </span>
            </div>
          </div>

          {/* Follow-up Section */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-text-primary">Automated follow-ups</span>
              <button 
                type="button"
                onClick={() => setIsFollowupOn(!isFollowupOn)}
                className="relative inline-flex items-center cursor-pointer bg-transparent border-0 p-0"
              >
                <div className={`w-8 h-[18px] rounded-full transition-colors ${isFollowupOn ? 'bg-secondary' : 'bg-text-disabled'}`} />
                <div className={`absolute w-[14px] h-[14px] bg-surface rounded-full transition-all top-[2px] ${isFollowupOn ? 'left-[16px]' : 'left-[2px]'}`} />
              </button>
            </div>

            {isFollowupOn && (
              <div className="mt-3 bg-surface-container-low p-2.5 rounded-[10px]">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[12px] text-text-secondary">
                    <span className="flex items-center gap-2">Day 2 <span className="mx-1">→</span> <MessageCircle className="w-3.5 h-3.5" /> WhatsApp</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px] text-text-secondary">
                    <span className="flex items-center gap-2">Day 4 <span className="mx-1">→</span> <Mail className="w-3.5 h-3.5" /> Email</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px] text-text-secondary">
                    <span className="flex items-center gap-2">Day 7 <span className="mx-1">→</span> <Smartphone className="w-3.5 h-3.5" /> SMS</span>
                  </div>
                </div>
                <button className="mt-2 text-[12px] text-secondary font-semibold bg-transparent border-0 p-0 hover:underline cursor-pointer">
                  Edit schedule
                </button>
              </div>
            )}
          </div>
        </div>
          </>
        )}

        {/* Footer */}
        {!isSuccess && (
          <footer className="p-4 border-t border-border bg-surface flex items-center justify-between sticky bottom-0 z-20">
            <button 
              className="text-[13px] text-text-secondary hover:text-text-primary transition-colors bg-transparent border-0 cursor-pointer"
              onClick={onClose}
            >
              Cancel
            </button>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsScheduleModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-[13px] text-text-primary font-semibold hover:bg-surface-container-low transition-all bg-surface"
              >
                <Calendar className="w-4 h-4" />
                Schedule
              </button>
              <button 
                onClick={handleSendNow}
                className="px-5 py-2 bg-secondary text-on-primary rounded-lg text-[13px] font-semibold hover:opacity-90 transition-all shadow-sm"
              >
                Send Now
              </button>
            </div>
          </footer>
        )}
      </div>

      <TemplateManagerModal 
        isOpen={isTemplateModalOpen} 
        onClose={() => setIsTemplateModalOpen(false)} 
        templates={templates}
        setTemplates={setTemplates}
      />
      <ScheduleMessageModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => setIsScheduleModalOpen(false)} 
        onSchedule={handleSchedule}
      />
    </>
  );
}

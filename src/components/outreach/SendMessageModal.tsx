"use client";

import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

interface SendMessageModalProps {
  onClose: () => void;
  candidateId?: Id<"candidates">;
  jobId?: Id<"jobs">;
}

export function SendMessageModal({ onClose, candidateId, jobId }: SendMessageModalProps) {
  const sendMessage = useMutation(api.pipeline.outreach.sendMessage);
  
  const [channel, setChannel] = useState<"email" | "whatsapp" | "sms">("email");
  const [subject, setSubject] = useState("New Career Opportunity");
  const [body, setBody] = useState("");
  const [bodyInitialized, setBodyInitialized] = useState(false);
  const [setupFollowUps, setSetupFollowUps] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const candidate = useQuery(api.candidates.getCandidate, candidateId ? { id: candidateId } : "skip");
  const job = useQuery(api.jobs.getJob, jobId ? { jobId } : "skip");
  const candidateName = candidate?.fullName || "Candidate";

  useEffect(() => {
    if (candidate && (job || !jobId) && !bodyInitialized) {
      const name = candidate.fullName || "Candidate";
      const jobTitle = job?.title || "our open";
      
      const initialSubject = `New Career Opportunity - ${jobTitle}`;
      const initialBody = `Hi ${name},\n\nI came across your profile and wanted to reach out about an exciting ${jobTitle} opportunity with one of our clients.\n\nWould you be open to learning more?\n\nBest regards,\nSarah K.`;
      
      setSubject(initialSubject);
      setBody(initialBody);
      setBodyInitialized(true);
    }
  }, [candidate, job, jobId, bodyInitialized]);

  const handleSend = async () => {
    if (!candidateId) {
      alert("No candidate selected");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await sendMessage({
        candidateId,
        jobId,
        channel,
        subject: channel === "email" ? subject : undefined,
        body,
        setupFollowUps,
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to send message");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose}></div>
      <div className="fixed top-0 right-0 bottom-0 w-[500px] bg-surface shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200 border-l border-border">
        {/* Header */}
        <div className="p-4 border-b border-border flex justify-between items-center bg-surface-container-low/30">
          <div>
            <h3 className="font-card-header text-lg text-text-primary">Send Message</h3>
            <p className="text-sm text-text-secondary">{candidateName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-variant rounded-full text-text-secondary">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Warning Banner */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 m-4 rounded shadow-sm">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-yellow-600">warning</span>
            <div>
              <p className="text-sm text-yellow-800 font-medium">{candidateName} was contacted 3 days ago by Mike J. via Email. Review before sending.</p>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={acknowledged}
                  onChange={e => setAcknowledged(e.target.checked)}
                  className="rounded text-yellow-600 focus:ring-yellow-500"
                />
                <span className="text-sm text-yellow-700">I acknowledge and want to proceed</span>
              </label>
            </div>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto p-6 pt-0 ${!acknowledged ? 'opacity-50 pointer-events-none' : ''}`}>
          
          <div className="mb-6">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Send Via</label>
            <div className="flex bg-surface-variant p-1 rounded-lg">
              {(["email", "whatsapp", "sms"] as const).map(ch => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md capitalize ${
                    channel === ch ? "bg-surface shadow-sm text-text-primary" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {channel === "email" && (
            <>
              <div className="mb-4">
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">From</label>
                <input type="text" disabled value="sarah.k@career141.com" className="w-full bg-surface-container-low border border-border rounded px-3 py-2 text-sm text-text-secondary cursor-not-allowed" />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Subject</label>
                <input 
                  type="text" 
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" 
                />
              </div>
            </>
          )}

          <div className="mb-4">
            <div className="flex justify-between items-end mb-1">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Template</label>
              <select className="text-sm border-none bg-transparent text-primary-container font-medium focus:ring-0 cursor-pointer pb-0">
                <option>Job Introduction</option>
                <option>Follow Up</option>
                <option>Interview Request</option>
              </select>
            </div>
            
            <div className="border border-border rounded-md overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <div className="bg-surface-container-low p-2 border-b border-border flex gap-2 flex-wrap">
                <button className="text-[10px] bg-white border border-border px-2 py-0.5 rounded shadow-sm hover:bg-surface-variant">[Name]</button>
                <button className="text-[10px] bg-white border border-border px-2 py-0.5 rounded shadow-sm hover:bg-surface-variant">[Job Title]</button>
                <button className="text-[10px] bg-white border border-border px-2 py-0.5 rounded shadow-sm hover:bg-surface-variant">[Recruiter]</button>
                <button className="text-[10px] bg-white border border-border px-2 py-0.5 rounded shadow-sm hover:bg-surface-variant">[Company]</button>
              </div>
              <textarea 
                rows={8}
                value={body}
                onChange={e => setBody(e.target.value)}
                className="w-full p-3 text-sm resize-none outline-none"
              />
            </div>
            <div className="text-right text-xs text-text-secondary mt-1">{body.length} / 1000</div>
          </div>

          <div className="border-t border-border pt-4 mt-6">
            <div className="flex justify-between items-center mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={setupFollowUps}
                  onChange={e => setSetupFollowUps(e.target.checked)}
                  className="rounded text-primary-container focus:ring-primary-container"
                />
                <span className="text-sm font-bold text-text-primary">Automated follow-ups</span>
              </label>
              <button className="text-xs text-primary-container font-medium hover:underline">Edit schedule</button>
            </div>
            
            {setupFollowUps && (
              <div className="flex items-center gap-2 bg-surface-container-low p-3 rounded-lg border border-border text-sm">
                <div className="flex flex-col items-center flex-1">
                  <span className="text-xs text-text-secondary font-medium">Day 2</span>
                  <span className="material-symbols-outlined text-[18px] text-green-600 mt-1">whatshot</span>
                </div>
                <span className="material-symbols-outlined text-text-secondary opacity-50">arrow_right_alt</span>
                <div className="flex flex-col items-center flex-1">
                  <span className="text-xs text-text-secondary font-medium">Day 4</span>
                  <span className="material-symbols-outlined text-[18px] text-blue-600 mt-1">mail</span>
                </div>
                <span className="material-symbols-outlined text-text-secondary opacity-50">arrow_right_alt</span>
                <div className="flex flex-col items-center flex-1">
                  <span className="text-xs text-text-secondary font-medium">Day 7</span>
                  <span className="material-symbols-outlined text-[18px] text-purple-600 mt-1">sms</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-container-low/50 flex justify-between items-center">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-border bg-white rounded-md text-sm font-medium hover:bg-surface-variant transition-colors">
              Schedule
            </button>
            <button 
              disabled={!acknowledged || isSubmitting}
              onClick={handleSend}
              className="bg-primary-container text-on-primary px-6 py-2 rounded-md text-sm font-semibold hover:bg-primary transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {isSubmitting ? "Sending..." : "Send Now"}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

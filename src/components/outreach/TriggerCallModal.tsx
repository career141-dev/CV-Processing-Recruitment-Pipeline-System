"use client";

import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

interface TriggerCallModalProps {
  onClose: () => void;
  candidateId?: Id<"candidates">;
  jobId?: Id<"jobs">;
}

export function TriggerCallModal({ onClose, candidateId, jobId }: TriggerCallModalProps) {
  const triggerAiCall = useMutation(api.outreach.triggerAiCall);
  const candidates = useQuery(api.search.searchCandidates, { query: "" }); // Simple query to get all or search
  const jobs = useQuery(api.jobs.list);

  const [selectedCandidate, setSelectedCandidate] = useState<Id<"candidates"> | "">(candidateId || "");
  const [selectedJob, setSelectedJob] = useState<Id<"jobs"> | "">(jobId || "");
  const [script, setScript] = useState<"default" | "initial_screening" | "technical_prescreen">("default");
  const [hideCompany, setHideCompany] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTrigger = async () => {
    if (!selectedCandidate || !selectedJob) return;
    setIsSubmitting(true);
    try {
      await triggerAiCall({
        candidateId: selectedCandidate as Id<"candidates">,
        jobId: selectedJob as Id<"jobs">,
        callScriptUsed: script,
        companyHidden: hideCompany,
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to trigger call");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="font-card-header text-lg text-text-primary">Trigger AI Call</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Candidate</label>
            <select 
              className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface"
              value={selectedCandidate}
              onChange={e => setSelectedCandidate(e.target.value as Id<"candidates">)}
            >
              <option value="">Select Candidate...</option>
              {candidates?.map((c: any) => (
                <option key={c._id} value={c._id}>{c.fullName || "Unknown"} - {c.currentTitle || "No Title"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Job</label>
            <select 
              className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface"
              value={selectedJob}
              onChange={e => setSelectedJob(e.target.value as Id<"jobs">)}
            >
              <option value="">Select Job...</option>
              {jobs?.map((j: any) => (
                <option key={j._id} value={j._id}>{j.title} - {j.clientName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Call Script</label>
            <select 
              className="w-full border border-border rounded-md px-3 py-2 text-body bg-surface"
              value={script}
              onChange={e => setScript(e.target.value as any)}
            >
              <option value="default">Default Script</option>
              <option value="initial_screening">Initial Screening</option>
              <option value="technical_prescreen">Technical Pre-screen</option>
            </select>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={hideCompany}
                onChange={e => setHideCompany(e.target.checked)}
                className="rounded text-primary-container focus:ring-primary-container"
              />
              <span className="text-sm font-medium text-text-primary">Hide company name (Confidential)</span>
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 bg-surface-container-low/30">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button 
            onClick={handleTrigger}
            disabled={!selectedCandidate || !selectedJob || isSubmitting}
            className="bg-primary-container text-on-primary px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? "Triggering..." : "Trigger Call"}
          </button>
        </div>
      </div>
    </div>
  );
}

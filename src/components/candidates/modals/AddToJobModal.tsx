"use client";

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Search, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

interface AddToJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onSuccess?: () => void;
  onConfirm?: (jobId: string) => Promise<void> | void;
}

export function AddToJobModal({ isOpen, onClose, selectedCount, onSuccess, onConfirm }: AddToJobModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  const dbJobs = useQuery(api.jobs.jobs.list);

  const jobs = dbJobs ? dbJobs.map((j: any) => ({
    id: j._id,
    title: j.title,
    client: j.clientName,
    status: j.status === 'active' ? 'Active' : (j.status === 'on_hold' ? 'On Hold' : j.status),
  })) : [];

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    job.client.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!selectedJob) return;
    setIsSubmitting(true);
    try {
      if (onConfirm) {
        await onConfirm(selectedJob);
      }
      toast.success(`Successfully added ${selectedCount} candidate(s) to job at "TA Shortlisted" stage.`);
      if (onSuccess) onSuccess();
      onClose();
      setSelectedJob(null);
      setSearchQuery('');
    } catch (error: any) {
      toast.error(error.message || "Failed to add to job");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add to Job"
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button variant="primary" disabled={!selectedJob || isSubmitting} onClick={handleAdd}>
            {isSubmitting ? 'Adding...' : `Add ${selectedCount} Candidate${selectedCount !== 1 ? 's' : ''}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          Select an active job to add the {selectedCount} selected candidate{selectedCount !== 1 ? 's' : ''}. They will be placed in the "TA Shortlisted" stage.
        </p>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search active jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-[#1B5E20]"
          />
        </div>

        {/* Job List */}
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              No jobs found matching "{searchQuery}"
            </div>
          ) : (
            filteredJobs.map(job => (
              <button
                key={job.id}
                onClick={() => setSelectedJob(job.id)}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                  selectedJob === job.id 
                    ? 'border-primary-container bg-primary-container/5 ring-1 ring-[#1B5E20]' 
                    : 'border-gray-200 hover:border-primary-container/30 hover:bg-surface-container-high transition-colors'
                }`}
              >
                <div className={`mt-0.5 p-2 rounded-md ${selectedJob === job.id ? 'bg-primary-container/10 text-primary-container' : 'bg-gray-100 text-gray-500'}`}>
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-sm font-bold text-gray-900">{job.title}</span>
                  <span className="text-xs text-gray-500">{job.client} • {job.status}</span>
                </div>
                {selectedJob === job.id && (
                  <div className="w-4 h-4 rounded-full border-4 border-primary-container self-center" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

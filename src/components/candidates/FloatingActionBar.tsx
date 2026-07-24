import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AddToJobModal } from './modals/AddToJobModal';
import { BulkMessageModal } from './modals/BulkMessageModal';
import { DeleteCandidateModal } from './modals/DeleteCandidateModal';
import { Trash2, UserPlus, MessageSquare } from 'lucide-react';

interface FloatingActionBarProps {
  selectedCandidates: string[];
  onClear: () => void;
}

export function FloatingActionBar({ selectedCandidates, onClear }: FloatingActionBarProps) {
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const bulkAddToJob = useMutation(api.matching.search.bulkAddToPipeline);

  const selectedCount = selectedCandidates.length;

  if (selectedCount === 0) return null;

  const handleConfirmAddToJob = async (jobId: string) => {
    await bulkAddToJob({
      candidateIds: selectedCandidates as any[],
      jobId: jobId as any,
      sourceChannel: "manual_upload",
      stage: "ta_shortlist",
    });
  };

  return (
    <>
      <div className="fixed bottom-[40px] right-6 flex items-center bg-[#212121] py-3 px-6 rounded-xl shadow-2xl z-50">
        <span className="text-on-primary text-base font-bold mr-8">
          {selectedCount} candidate{selectedCount > 1 ? 's' : ''} selected
        </span>
        <button 
          className="flex items-center bg-[#FFFFFF1A] hover:bg-[#FFFFFF33] transition-colors py-1.5 px-3 mr-3 gap-2 rounded-lg border-0 cursor-pointer text-on-primary"
          onClick={() => setIsJobModalOpen(true)}
        >
          <UserPlus className="w-4 h-4 text-white" />
          <span className="text-sm font-bold">Add to Job</span>
        </button>
        <button 
          className="flex items-center bg-[#FFFFFF1A] hover:bg-[#FFFFFF33] transition-colors py-1.5 px-3 mr-3 gap-2 rounded-lg border-0 cursor-pointer text-on-primary"
          onClick={() => setIsMsgModalOpen(true)}
        >
          <MessageSquare className="w-4 h-4 text-white" />
          <span className="text-sm font-bold">Send Message</span>
        </button>
        <button 
          className="flex items-center bg-red-600/80 hover:bg-red-600 transition-colors py-1.5 px-3 mr-4 gap-2 rounded-lg border-0 cursor-pointer text-on-primary font-bold text-sm h-8"
          onClick={() => setIsDeleteModalOpen(true)}
        >
          <Trash2 className="w-4 h-4 text-white" />
          <span>Delete</span>
        </button>
        <button 
          className="bg-transparent border-0 cursor-pointer text-on-primary text-sm font-bold underline hover:text-gray-300 ml-2"
          onClick={onClear}
        >
          Clear
        </button>
      </div>

      <AddToJobModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        selectedCount={selectedCount}
        onSuccess={onClear}
        onConfirm={handleConfirmAddToJob}
      />

      <BulkMessageModal
        isOpen={isMsgModalOpen}
        onClose={() => setIsMsgModalOpen(false)}
        selectedCount={selectedCount}
        onSuccess={onClear}
      />

      <DeleteCandidateModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        candidateIds={selectedCandidates}
        onSuccess={onClear}
      />
    </>
  );
}

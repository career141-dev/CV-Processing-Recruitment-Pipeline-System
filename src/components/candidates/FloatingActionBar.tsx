import React, { useState } from 'react';
import { AddToJobModal } from './modals/AddToJobModal';
import { BulkMessageModal } from './modals/BulkMessageModal';

interface FloatingActionBarProps {
  selectedCount: number;
  onClear: () => void;
}

export function FloatingActionBar({ selectedCount, onClear }: FloatingActionBarProps) {
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="fixed bottom-[40px] right-6 flex items-center bg-[#212121] py-3 px-6 rounded-xl shadow-2xl z-50">
        <span className="text-white text-base font-bold mr-8">
          {selectedCount} candidate{selectedCount > 1 ? 's' : ''} selected
        </span>
        <button 
          className="flex items-center bg-[#FFFFFF1A] hover:bg-[#FFFFFF33] transition-colors py-1.5 px-3 mr-3 gap-2 rounded-lg border-0 cursor-pointer text-white"
          onClick={() => setIsJobModalOpen(true)}
        >
          <img
            src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/ofk4cqe2_expires_30_days.png" 
            className="w-4 h-4 object-fill"
            alt="add"
          />
          <span className="text-sm font-bold">Add to Job</span>
        </button>
        <button 
          className="flex items-center bg-[#FFFFFF1A] hover:bg-[#FFFFFF33] transition-colors py-1.5 px-3 mr-4 gap-2 rounded-lg border-0 cursor-pointer text-white"
          onClick={() => setIsMsgModalOpen(true)}
        >
          <img
            src="https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/lqnahwv7_expires_30_days.png" 
            className="w-4 h-3 object-fill"
            alt="msg"
          />
          <span className="text-sm font-bold">Send Message</span>
        </button>
        <button 
          className="bg-transparent border-0 cursor-pointer text-white text-sm font-bold underline hover:text-gray-300"
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
      />

      <BulkMessageModal
        isOpen={isMsgModalOpen}
        onClose={() => setIsMsgModalOpen(false)}
        selectedCount={selectedCount}
        onSuccess={onClear}
      />
    </>
  );
}

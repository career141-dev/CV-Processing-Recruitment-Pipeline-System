'use client';

import React, { useState, useMemo } from 'react';
import { MockCandidate } from '../types';
import { INITIAL_CANDIDATES } from '../mock-data';
import { CandidateTableCard } from './CandidateTableCard';
import { AiChatWidget } from './AiChatWidget';
import { AiBotIcon } from './AiBotIcon';

interface DatabaseCvStageViewProps {
  candidates?: MockCandidate[];
  setCandidates?: React.Dispatch<React.SetStateAction<MockCandidate[]>>;
  onProfileClick?: (candidate: MockCandidate) => void;
}

export const DatabaseCvStageView: React.FC<DatabaseCvStageViewProps> = ({
  candidates: externalCandidates,
  setCandidates: externalSetCandidates,
  onProfileClick,
}) => {
  const [internalCandidates, setInternalCandidates] = useState<MockCandidate[]>(() =>
    INITIAL_CANDIDATES.filter((c) => c.stage === 'database_cv')
  );

  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  const allCandidates = externalCandidates || internalCandidates;
  const updateCandidates = externalSetCandidates || setInternalCandidates;

  const stageCandidates = useMemo(() => {
    const list = allCandidates.filter((c) => c.stage === 'database_cv');
    return list.length > 0 ? list : allCandidates.slice(0, 4);
  }, [allCandidates]);

  return (
    <div className="space-y-6 w-full relative min-h-[600px]">
      {/* ── SHARED CANDIDATE TABLE CARD ── */}
      <CandidateTableCard
        candidates={stageCandidates}
        updateCandidates={updateCandidates}
        onProfileClick={onProfileClick}
        emptyMessage="No candidates found in Database CV matching your filter criteria."
      />

      {/* ── AI CHAT WIDGET POPUP (MATCHING IPHONE 13/14 DESIGN) ── */}
      <AiChatWidget
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        title="Main Title"
      />

      {/* ── FLOATING BOTTOM RIGHT AI BOT ICON BUTTON (ALWAYS VISIBLE ANCHOR) ── */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`w-[54px] h-[54px] sm:w-[58px] sm:h-[58px] bg-[#165B42] hover:bg-[#114934] active:scale-95 text-white rounded-[20px] shadow-lg hover:shadow-xl flex items-center justify-center transition-all cursor-pointer group hover:-translate-y-0.5 ${
            isChatOpen ? 'ring-4 ring-emerald-400/50 shadow-[#165B42]/30 scale-105' : ''
          }`}
          title={isChatOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
        >
          <AiBotIcon className="w-10 h-10 sm:w-11 sm:h-11 transition-transform group-hover:scale-105" />
        </button>
      </div>
    </div>
  );
};



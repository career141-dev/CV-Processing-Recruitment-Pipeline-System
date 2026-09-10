'use client';

import React, { useState, useMemo } from 'react';
import { Info } from 'lucide-react';
import { MockCandidate } from '../types';
import { INITIAL_CANDIDATES } from '../mock-data';
import { CandidateTableCard } from './CandidateTableCard';

interface DirectorReviewStageViewProps {
  candidates?: MockCandidate[];
  setCandidates?: React.Dispatch<React.SetStateAction<MockCandidate[]>>;
  onProfileClick?: (candidate: MockCandidate) => void;
}

export const DirectorReviewStageView: React.FC<DirectorReviewStageViewProps> = ({
  candidates: externalCandidates,
  setCandidates: externalSetCandidates,
  onProfileClick,
}) => {
  const [internalCandidates, setInternalCandidates] = useState<MockCandidate[]>(INITIAL_CANDIDATES);

  const allCandidates = externalCandidates || internalCandidates;
  const updateCandidates = externalSetCandidates || setInternalCandidates;

  const stageCandidates = useMemo(() => {
    return allCandidates.filter((c) => c.stage === 'director_review');
  }, [allCandidates]);

  return (
    <div className="space-y-6 w-full">
      {/* ── 1ST BOX: SPOTLIGHTS (3 WIDGETS) ── */}
      <div className="bg-white rounded-[8px] border border-[#DBDEE0] p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-[14px]">
          <span>Spotlights</span>
          <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
        </div>

        <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-3 sm:gap-4">
          {/* Card 1: Sent CV */}
          <div className="w-full lg:w-[233px] h-[78px] rounded-[9px] border border-[#DBDEE0] bg-white px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col justify-center hover:border-slate-400 transition-all cursor-pointer">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-none">
              {stageCandidates.length}
            </div>
            <div className="text-[12px] sm:text-[13px] text-slate-600 font-medium mt-1.5 leading-tight truncate">
              Sent CV
            </div>
          </div>

          {/* Card 2: Set Send */}
          <div className="w-full lg:w-[233px] h-[78px] rounded-[9px] border border-[#DBDEE0] bg-white px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col justify-center hover:border-slate-400 transition-all cursor-pointer">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-none">
              0
            </div>
            <div className="text-[12px] sm:text-[13px] text-slate-600 font-medium mt-1.5 leading-tight truncate">
              Set Send
            </div>
          </div>

          {/* Card 3: Days Worked */}
          <div className="w-full lg:w-[233px] h-[78px] rounded-[9px] border border-[#DBDEE0] bg-white px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col justify-center hover:border-slate-400 transition-all cursor-pointer">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-none">
              0
            </div>
            <div className="text-[12px] sm:text-[13px] text-slate-600 font-medium mt-1.5 leading-tight truncate">
              Days Worked
            </div>
          </div>
        </div>
      </div>

      {/* ── 2ND BOX: COMMON CANDIDATE TABLE CARD ── */}
      <CandidateTableCard
        candidates={stageCandidates}
        updateCandidates={updateCandidates}
        onProfileClick={onProfileClick}
        emptyMessage="No candidates currently in the Director Review stage matching your filter."
      />
    </div>
  );
};

'use client';

import React, { useState, useMemo } from 'react';
import { Info } from 'lucide-react';
import { MockCandidate } from '../types';
import { INITIAL_CANDIDATES } from '../mock-data';
import { CandidateTableCard } from './CandidateTableCard';

interface FollowUpStageViewProps {
  candidates?: MockCandidate[];
  setCandidates?: React.Dispatch<React.SetStateAction<MockCandidate[]>>;
  onProfileClick?: (candidate: MockCandidate) => void;
}

export const FollowUpStageView: React.FC<FollowUpStageViewProps> = ({
  candidates: externalCandidates,
  setCandidates: externalSetCandidates,
  onProfileClick,
}) => {
  // ── INTERNAL OR SHARED CANDIDATE STATE ──
  const [internalCandidates, setInternalCandidates] = useState<MockCandidate[]>(() =>
    INITIAL_CANDIDATES.filter((c) => c.stage === 'follow_up')
  );

  const allCandidates = externalCandidates || internalCandidates;
  const updateCandidates = externalSetCandidates || setInternalCandidates;

  const stageCandidates = useMemo(() => {
    return allCandidates.filter((c) => c.stage === 'follow_up');
  }, [allCandidates]);

  // ── FILTERING BY SPOTLIGHT ──
  const [selectedSpotlight, setSelectedSpotlight] = useState<string | null>(null);

  // ── SPOTLIGHT COUNTS ──
  const spotlights = useMemo(() => {
    return {
      currentSalary: stageCandidates.filter((c) => !!c.currentSalary).length,
      expectedSalary: stageCandidates.filter((c) => !!c.expectedSalary).length,
      noticePeriod: stageCandidates.filter((c) => !!c.noticePeriod).length,
      toBeReviewed: stageCandidates.filter(
        (c) => c.stageStatus === 'Pending Review' || c.stageStatus === 'In contacted'
      ).length,
    };
  }, [stageCandidates]);

  // ── SPOTLIGHT FILTERED CANDIDATES ──
  const spotlightFilteredCandidates = useMemo(() => {
    return stageCandidates.filter((c) => {
      if (selectedSpotlight === 'currentSalary' && !c.currentSalary) return false;
      if (selectedSpotlight === 'expectedSalary' && !c.expectedSalary) return false;
      if (selectedSpotlight === 'noticePeriod' && !c.noticePeriod) return false;
      if (
        selectedSpotlight === 'toBeReviewed' &&
        c.stageStatus !== 'Pending Review' &&
        c.stageStatus !== 'In contacted'
      )
        return false;

      return true;
    });
  }, [stageCandidates, selectedSpotlight]);

  return (
    <div className="space-y-6 w-full">
      {/* ── 1ST BOX: SPOTLIGHTS ── */}
      <div className="bg-white rounded-[8px] border border-[#DBDEE0] p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-[14px]">
          <span>Spotlights</span>
          <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
        </div>

        <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-3 sm:gap-4">
          {/* Card 1: Current Salary */}
          <div
            onClick={() =>
              setSelectedSpotlight(selectedSpotlight === 'currentSalary' ? null : 'currentSalary')
            }
            className={`w-full lg:w-[233px] h-[78px] rounded-[9px] border px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col justify-center transition-all cursor-pointer hover:border-slate-400 ${
              selectedSpotlight === 'currentSalary'
                ? 'border-[#165B42] ring-2 ring-[#165B42]/10 bg-emerald-50/30'
                : 'border-[#DBDEE0] bg-white'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-none">
              {spotlights.currentSalary}
            </div>
            <div className="text-[12px] sm:text-[13px] text-slate-600 font-medium mt-1.5 leading-tight truncate">
              Current Salary
            </div>
          </div>

          {/* Card 2: Expected Salary */}
          <div
            onClick={() =>
              setSelectedSpotlight(selectedSpotlight === 'expectedSalary' ? null : 'expectedSalary')
            }
            className={`w-full lg:w-[233px] h-[78px] rounded-[9px] border px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col justify-center transition-all cursor-pointer hover:border-slate-400 ${
              selectedSpotlight === 'expectedSalary'
                ? 'border-[#165B42] ring-2 ring-[#165B42]/10 bg-emerald-50/30'
                : 'border-[#DBDEE0] bg-white'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-none">
              {spotlights.expectedSalary}
            </div>
            <div className="text-[12px] sm:text-[13px] text-slate-600 font-medium mt-1.5 leading-tight truncate">
              Expected salary
            </div>
          </div>

          {/* Card 3: Notice Period */}
          <div
            onClick={() =>
              setSelectedSpotlight(selectedSpotlight === 'noticePeriod' ? null : 'noticePeriod')
            }
            className={`w-full lg:w-[233px] h-[78px] rounded-[9px] border px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col justify-center transition-all cursor-pointer hover:border-slate-400 ${
              selectedSpotlight === 'noticePeriod'
                ? 'border-[#165B42] ring-2 ring-[#165B42]/10 bg-emerald-50/30'
                : 'border-[#DBDEE0] bg-white'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-none">
              {spotlights.noticePeriod}
            </div>
            <div className="text-[12px] sm:text-[13px] text-slate-600 font-medium mt-1.5 leading-tight truncate">
              Notice period
            </div>
          </div>

          {/* Card 4: To Be Reviewed */}
          <div
            onClick={() =>
              setSelectedSpotlight(selectedSpotlight === 'toBeReviewed' ? null : 'toBeReviewed')
            }
            className={`w-full lg:w-[233px] h-[78px] rounded-[9px] border px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col justify-center transition-all cursor-pointer hover:border-slate-400 ${
              selectedSpotlight === 'toBeReviewed'
                ? 'border-[#165B42] ring-2 ring-[#165B42]/10 bg-emerald-50/30'
                : 'border-[#DBDEE0] bg-white'
            }`}
          >
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-none">
              {spotlights.toBeReviewed}
            </div>
            <div className="text-[12px] sm:text-[13px] text-slate-600 font-medium mt-1.5 leading-tight truncate">
              To be reviewed
            </div>
          </div>
        </div>
      </div>

      {/* ── 2ND BOX: COMMON CANDIDATE TABLE CARD ── */}
      <CandidateTableCard
        candidates={spotlightFilteredCandidates}
        updateCandidates={updateCandidates}
        onProfileClick={onProfileClick}
        emptyMessage="No candidates found in Follow Up matching your filter criteria."
      />
    </div>
  );
};

'use client';

import React, { useState, useMemo } from 'react';
import { Info } from 'lucide-react';
import { MockCandidate } from '../types';
import { INITIAL_CANDIDATES, PIPELINE_SUB_STAGES } from '../mock-data';
import { CandidateTableCard } from './CandidateTableCard';

interface PipelineStageViewProps {
  activeStageId: string;
  candidates?: MockCandidate[];
  setCandidates?: React.Dispatch<React.SetStateAction<MockCandidate[]>>;
  onProfileClick?: (candidate: MockCandidate) => void;
}

export const PipelineStageView: React.FC<PipelineStageViewProps> = ({
  activeStageId,
  candidates: externalCandidates,
  setCandidates: externalSetCandidates,
  onProfileClick,
}) => {
  const [internalCandidates, setInternalCandidates] = useState<MockCandidate[]>(INITIAL_CANDIDATES);

  const allCandidates = externalCandidates || internalCandidates;
  const updateCandidates = externalSetCandidates || setInternalCandidates;

  const currentSubStage = PIPELINE_SUB_STAGES.find((s) => s.id === activeStageId);
  const stageTitle = currentSubStage ? currentSubStage.label : 'Pipeline';

  const stageCandidates = useMemo(() => {
    return allCandidates.filter((c) => c.stage === activeStageId);
  }, [allCandidates, activeStageId]);

  // Dynamic Spotlights based on Stage
  const spotlights = useMemo(() => {
    switch (activeStageId) {
      case 'director_shortlist':
        return [
          {
            label: 'Shortlist percentage (%)',
            value: stageCandidates.length,
          },
          {
            label: 'Interview Schedule',
            value: 0,
          },
        ];
      case 'director_review':
        return [
          {
            label: 'Sent CV',
            value: stageCandidates.length,
          },
          {
            label: 'Set Send',
            value: 0,
          },
          {
            label: 'Days Worked',
            value: 0,
          },
        ];
      case 'client_shortlist':
        return [
          {
            label: 'Client Shortlist',
            value: stageCandidates.length,
          },
          {
            label: 'Interview Schedule',
            value: 0,
          },
        ];
      case 'interview':
        return [
          {
            label: 'Schedule',
            value: stageCandidates.length,
          },
          {
            label: 'Attended',
            value: 0,
          },
        ];
      case 'offer':
        return [];
      default:
        return [
          {
            label: 'Candidates',
            value: stageCandidates.length,
          },
        ];
    }
  }, [activeStageId, stageCandidates.length]);

  return (
    <div className="space-y-6 w-full">
      {/* ── 1ST BOX: SPOTLIGHTS (OMITTED WHEN EMPTY / IN OFFER STAGE) ── */}
      {spotlights.length > 0 && (
        <div className="bg-white rounded-[8px] border border-[#DBDEE0] p-4 sm:p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-[14px]">
            <span>Spotlights</span>
            <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
          </div>

          <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-3 sm:gap-4">
            {spotlights.map((spotlight, idx) => (
              <div
                key={idx}
                className="w-full lg:w-[233px] h-[78px] rounded-[9px] border border-[#DBDEE0] bg-white px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col justify-center hover:border-slate-400 transition-all cursor-pointer"
              >
                <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-none">
                  {spotlight.value}
                </div>
                <div className="text-[12px] sm:text-[13px] text-slate-600 font-medium mt-1.5 leading-tight truncate">
                  {spotlight.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 2ND BOX: COMMON CANDIDATE TABLE CARD ── */}
      <CandidateTableCard
        candidates={stageCandidates}
        updateCandidates={updateCandidates}
        onProfileClick={onProfileClick}
        emptyMessage={`No candidates currently in the ${stageTitle} stage matching your filter.`}
      />
    </div>
  );
};

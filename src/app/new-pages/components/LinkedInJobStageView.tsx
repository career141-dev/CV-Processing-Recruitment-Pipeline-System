'use client';

import React, { useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { MockCandidate } from '../types';
import { INITIAL_CANDIDATES } from '../mock-data';
import { CandidateTableCard } from './CandidateTableCard';

interface LinkedInJobStageViewProps {
  candidates?: MockCandidate[];
  setCandidates?: React.Dispatch<React.SetStateAction<MockCandidate[]>>;
  onProfileClick?: (candidate: MockCandidate) => void;
}

interface SpotlightItem {
  id: string;
  line1: string;
  line2: string;
  count: number;
}

const SPOTLIGHT_ITEMS: SpotlightItem[] = [
  { id: 'graphic_1', line1: 'Graphic', line2: 'Design', count: 2 },
  { id: 'team_hr', line1: 'Team', line2: 'HR', count: 2 },
  { id: 'graphic_2', line1: 'Graphic', line2: 'Design', count: 2 },
  { id: 'graphic_3', line1: 'Graphic', line2: 'Design', count: 2 },
  { id: 'graphic_4', line1: 'Graphic', line2: 'Design', count: 2 },
  { id: 'graphic_5', line1: 'Graphic', line2: 'Design', count: 2 },
  { id: 'graphic_6', line1: 'Graphic', line2: 'Design', count: 2 },
];

export const LinkedInJobStageView: React.FC<LinkedInJobStageViewProps> = ({
  candidates: externalCandidates,
  setCandidates: externalSetCandidates,
  onProfileClick,
}) => {
  // ── INTERNAL OR SHARED CANDIDATE STATE ──
  const [internalCandidates, setInternalCandidates] = useState<MockCandidate[]>(() =>
    INITIAL_CANDIDATES.filter((c) => c.stage === 'linkedin_job')
  );

  const allCandidates = externalCandidates || internalCandidates;
  const updateCandidates = externalSetCandidates || setInternalCandidates;

  const stageCandidates = useMemo(() => {
    const list = allCandidates.filter((c) => c.stage === 'linkedin_job');
    return list.length > 0 ? list : allCandidates.slice(0, 2);
  }, [allCandidates]);

  const [selectedSpotlight, setSelectedSpotlight] = useState<string>('team_hr');

  // ── SPOTLIGHTS CAROUSEL REF ──
  const spotlightsScrollRef = useRef<HTMLDivElement>(null);

  const scrollSpotlights = (direction: 'left' | 'right') => {
    if (spotlightsScrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      spotlightsScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* ── 1. SPOTLIGHTS SECTION (CAROUSEL WITH ARROWS) ── */}
      <div className="bg-white rounded-[8px] border border-[#DBDEE0] p-4 sm:p-5 shadow-2xs space-y-3.5">
        {/* Spotlights Header with Navigation Arrows */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-[14px]">
            <span>Spotlights</span>
            <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <button
              onClick={() => scrollSpotlights('left')}
              className="p-1 hover:bg-slate-100 rounded-full cursor-pointer transition-colors border border-slate-200"
              title="Previous spotlights"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
            </button>
            <button
              onClick={() => scrollSpotlights('right')}
              className="p-1 hover:bg-slate-100 rounded-full cursor-pointer transition-colors border border-slate-200"
              title="Next spotlights"
            >
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Spotlights Carousel Cards */}
        <div
          ref={spotlightsScrollRef}
          className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none"
        >
          {SPOTLIGHT_ITEMS.map((item) => {
            const isSelected = selectedSpotlight === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedSpotlight(item.id)}
                className={`min-w-[130px] sm:min-w-[145px] p-2.5 sm:p-3 rounded-[6px] border text-left flex items-center justify-between transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-[#057642] text-white border-[#057642] shadow-xs'
                    : 'bg-white text-slate-700 border-[#DBDEE0] hover:border-slate-400 hover:bg-slate-50/50'
                }`}
              >
                <div className="leading-tight">
                  <p className="text-[11px] opacity-80">{item.line1}</p>
                  <p className="text-[14px] font-bold">{item.line2}</p>
                </div>
                <span
                  className={`text-[18px] sm:text-[20px] font-bold ${
                    isSelected ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {String(item.count).padStart(2, '0')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. SHARED CANDIDATE TABLE CARD (COMMON REUSABLE COMPONENT) ── */}
      <CandidateTableCard
        candidates={stageCandidates}
        updateCandidates={updateCandidates}
        onProfileClick={onProfileClick}
        emptyMessage="No candidates found in LinkedIn Job matching your filter criteria."
      />
    </div>
  );
};

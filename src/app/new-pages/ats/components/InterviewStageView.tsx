'use client';

import React, { useState, useMemo } from 'react';
import { MockCandidate } from '../types';
import { INITIAL_CANDIDATES } from '../mock-data';
import { CandidateTableCard } from './CandidateTableCard';
import { SpotlightsSection, SpotlightCard } from '../../components/common';

interface InterviewStageViewProps {
  candidates?: MockCandidate[];
  setCandidates?: React.Dispatch<React.SetStateAction<MockCandidate[]>>;
  onProfileClick?: (candidate: MockCandidate) => void;
}

export const InterviewStageView: React.FC<InterviewStageViewProps> = ({
  candidates: externalCandidates,
  setCandidates: externalSetCandidates,
  onProfileClick,
}) => {
  const [internalCandidates, setInternalCandidates] = useState<MockCandidate[]>(INITIAL_CANDIDATES);

  const allCandidates = externalCandidates || internalCandidates;
  const updateCandidates = externalSetCandidates || setInternalCandidates;

  const stageCandidates = useMemo(() => {
    return allCandidates.filter((c) => c.stage === 'interview');
  }, [allCandidates]);

  return (
    <div className="space-y-6 w-full">
      {/* ── 1ST BOX: SPOTLIGHTS (2 WIDGETS) ── */}
      <SpotlightsSection>
        <SpotlightCard label="Schedule" value={stageCandidates.length} />
        <SpotlightCard label="Attended" value={0} />
      </SpotlightsSection>

      {/* ── 2ND BOX: COMMON CANDIDATE TABLE CARD ── */}
      <CandidateTableCard
        candidates={stageCandidates}
        updateCandidates={updateCandidates}
        onProfileClick={onProfileClick}
        emptyMessage="No candidates currently in the Interview stage matching your filter."
      />
    </div>
  );
};

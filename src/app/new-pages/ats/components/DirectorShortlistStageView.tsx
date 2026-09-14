'use client';

import React, { useState, useMemo } from 'react';
import { MockCandidate } from '../types';
import { INITIAL_CANDIDATES } from '../mock-data';
import { CandidateTableCard } from './CandidateTableCard';
import { SpotlightsSection, SpotlightCard } from '../../components/common';

interface DirectorShortlistStageViewProps {
  candidates?: MockCandidate[];
  setCandidates?: React.Dispatch<React.SetStateAction<MockCandidate[]>>;
  onProfileClick?: (candidate: MockCandidate) => void;
}

export const DirectorShortlistStageView: React.FC<DirectorShortlistStageViewProps> = ({
  candidates: externalCandidates,
  setCandidates: externalSetCandidates,
  onProfileClick,
}) => {
  const [internalCandidates, setInternalCandidates] = useState<MockCandidate[]>(INITIAL_CANDIDATES);

  const allCandidates = externalCandidates || internalCandidates;
  const updateCandidates = externalSetCandidates || setInternalCandidates;

  const stageCandidates = useMemo(() => {
    return allCandidates.filter((c) => c.stage === 'director_shortlist');
  }, [allCandidates]);

  return (
    <div className="space-y-6 w-full">
      {/* ── 1ST BOX: SPOTLIGHTS (2 WIDGETS) ── */}
      <SpotlightsSection>
        <SpotlightCard label="Shortlist percentage (%)" value={stageCandidates.length} />
        <SpotlightCard label="Interview Schedule" value={0} />
      </SpotlightsSection>

      {/* ── 2ND BOX: COMMON CANDIDATE TABLE CARD ── */}
      <CandidateTableCard
        candidates={stageCandidates}
        updateCandidates={updateCandidates}
        onProfileClick={onProfileClick}
        emptyMessage="No candidates currently in the Director Shortlist stage matching your filter."
      />
    </div>
  );
};

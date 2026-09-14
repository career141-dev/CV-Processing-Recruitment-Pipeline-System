'use client';

import React, { useState, useMemo } from 'react';
import { MockCandidate } from '../types';
import { INITIAL_CANDIDATES } from '../mock-data';
import { CandidateTableCard } from './CandidateTableCard';
import { SpotlightsSection, SpotlightCard } from '../../components/common';

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

  return (
    <div className="space-y-6 w-full">
      {/* ── 1. SPOTLIGHTS SECTION (CAROUSEL WITH ARROWS) ── */}
      <SpotlightsSection isCarousel={true}>
        {SPOTLIGHT_ITEMS.map((item) => (
          <SpotlightCard
            key={item.id}
            variant="compact"
            label={item.line2}
            subLabel={item.line1}
            value={item.count}
            isSelected={selectedSpotlight === item.id}
            onClick={() => setSelectedSpotlight(item.id)}
          />
        ))}
      </SpotlightsSection>

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

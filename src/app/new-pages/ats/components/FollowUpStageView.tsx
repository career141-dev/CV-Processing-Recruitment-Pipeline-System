'use client';

import React, { useState, useMemo } from 'react';
import { MockCandidate } from '../types';
import { INITIAL_CANDIDATES } from '../mock-data';
import { CandidateTableCard } from './CandidateTableCard';
import { SpotlightsSection, SpotlightCard } from '../../components/common';

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
      <SpotlightsSection>
        <SpotlightCard
          label="Current Salary"
          value={spotlights.currentSalary}
          isSelected={selectedSpotlight === 'currentSalary'}
          onClick={() =>
            setSelectedSpotlight(selectedSpotlight === 'currentSalary' ? null : 'currentSalary')
          }
        />
        <SpotlightCard
          label="Expected salary"
          value={spotlights.expectedSalary}
          isSelected={selectedSpotlight === 'expectedSalary'}
          onClick={() =>
            setSelectedSpotlight(selectedSpotlight === 'expectedSalary' ? null : 'expectedSalary')
          }
        />
        <SpotlightCard
          label="Notice period"
          value={spotlights.noticePeriod}
          isSelected={selectedSpotlight === 'noticePeriod'}
          onClick={() =>
            setSelectedSpotlight(selectedSpotlight === 'noticePeriod' ? null : 'noticePeriod')
          }
        />
        <SpotlightCard
          label="To be reviewed"
          value={spotlights.toBeReviewed}
          isSelected={selectedSpotlight === 'toBeReviewed'}
          onClick={() =>
            setSelectedSpotlight(selectedSpotlight === 'toBeReviewed' ? null : 'toBeReviewed')
          }
        />
      </SpotlightsSection>

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

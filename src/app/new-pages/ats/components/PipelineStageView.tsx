'use client';

import React, { useState, useMemo } from 'react';
import { MockCandidate } from '../types';
import { INITIAL_CANDIDATES, PIPELINE_SUB_STAGES } from '../mock-data';
import { CandidateTableCard } from './CandidateTableCard';
import { SpotlightsSection, SpotlightCard } from '../../components/common';

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
        <SpotlightsSection>
          {spotlights.map((spotlight, idx) => (
            <SpotlightCard
              key={idx}
              label={spotlight.label}
              value={spotlight.value}
            />
          ))}
        </SpotlightsSection>
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

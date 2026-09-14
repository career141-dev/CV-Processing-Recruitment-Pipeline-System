'use client';

import React, { useState, useMemo } from 'react';
import { MockCandidate } from '../types';
import { INITIAL_CANDIDATES } from '../mock-data';
import { ChangeStageModal } from './Modals';
import { CandidateCard } from './CandidateCard';
import { DeskCard } from '../../components/common';

interface ReferenceStageViewProps {
  candidates?: MockCandidate[];
  setCandidates?: React.Dispatch<React.SetStateAction<MockCandidate[]>>;
  onProfileClick?: (candidate: MockCandidate) => void;
}

export const ReferenceStageView: React.FC<ReferenceStageViewProps> = ({
  candidates: externalCandidates,
  setCandidates: externalSetCandidates,
  onProfileClick,
}) => {
  // ── INTERNAL OR SHARED CANDIDATE STATE ──
  const [internalCandidates, setInternalCandidates] = useState<MockCandidate[]>(() =>
    INITIAL_CANDIDATES.filter((c) => c.stage === 'reference')
  );

  const allCandidates = externalCandidates || internalCandidates;
  const updateCandidates = externalSetCandidates || setInternalCandidates;

  const stageCandidates = useMemo(() => {
    return allCandidates.filter((c) => c.stage === 'reference');
  }, [allCandidates]);

  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [expandedEducations, setExpandedEducations] = useState<Record<string, boolean>>({});
  const [stageModalCandidate, setStageModalCandidate] = useState<MockCandidate | null>(null);

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedCandidateIds((prev) => [...prev, id]);
    } else {
      setSelectedCandidateIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleToggleEducation = (id: string) => {
    setExpandedEducations((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleChangeStage = (
    candidateId: string,
    newStageKey: MockCandidate['stage'],
    newStatusLabel: string
  ) => {
    updateCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? {
              ...c,
              stage: newStageKey,
              stageStatus: newStatusLabel,
              stageChangedDate: new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
            }
          : c
      )
    );
    setStageModalCandidate(null);
  };

  const handleRejectCandidate = (candidateId: string) => {
    updateCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? {
              ...c,
              stageStatus: 'Rejected',
              stageChangedDate: new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
            }
          : c
      )
    );
  };

  return (
    <DeskCard rounded="lg" className="p-6 sm:p-8 w-full">
      {/* ── TITLE ── */}
      <h2 className="text-[20px] font-semibold text-slate-800 tracking-tight mb-6">
        Reference
      </h2>

      {/* ── CANDIDATE LIST ── */}
      <div className="divide-y divide-[#DBDEE0]">
        {stageCandidates.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <p className="text-sm font-medium">No candidates in Reference stage.</p>
          </div>
        ) : (
          stageCandidates.map((candidate) => (
            <div key={candidate.id} className="py-2 first:pt-0 last:pb-0">
              <CandidateCard
                candidate={candidate}
                isSelected={selectedCandidateIds.includes(candidate.id)}
                onSelect={handleSelectOne}
                isExpandedEducation={!!expandedEducations[candidate.id]}
                onToggleEducation={handleToggleEducation}
                onChangeStageClick={(c) => setStageModalCandidate(c)}
                onRejectClick={handleRejectCandidate}
                onProfileClick={onProfileClick}
              />
            </div>
          ))
        )}
      </div>

      {/* ── CHANGE STAGE MODAL ── */}
      <ChangeStageModal
        candidate={stageModalCandidate}
        onClose={() => setStageModalCandidate(null)}
        onChangeStage={handleChangeStage}
      />
    </DeskCard>
  );
};

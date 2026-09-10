'use client';

import React, { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, Plus, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { MockCandidate } from '../types';
import { ChangeStageModal } from './Modals';
import { CandidateCard } from './CandidateCard';

interface CandidateTableCardProps {
  candidates: MockCandidate[];
  updateCandidates: React.Dispatch<React.SetStateAction<MockCandidate[]>>;
  onProfileClick?: (candidate: MockCandidate) => void;
  emptyMessage?: string;
  onAddCandidateClick?: () => void;
  onAllFiltersClick?: () => void;
}

export const CandidateTableCard: React.FC<CandidateTableCardProps> = ({
  candidates,
  updateCandidates,
  onProfileClick,
  emptyMessage = 'No candidates found matching your criteria.',
  onAddCandidateClick,
  onAllFiltersClick,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [expandedEducations, setExpandedEducations] = useState<Record<string, boolean>>({});
  const [stageModalCandidate, setStageModalCandidate] = useState<MockCandidate | null>(null);

  // ── FILTER CANDIDATES BY SEARCH QUERY ──
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.skillsMatch.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [candidates, searchQuery]);

  // ── BULK SELECTION HANDLERS ──
  const isAllSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((c) => selectedCandidateIds.includes(c.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCandidateIds(filteredCandidates.map((c) => c.id));
    } else {
      setSelectedCandidateIds([]);
    }
  };

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

  // ── STAGE CHANGE & REJECT HANDLERS ──
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
    <div className="bg-white rounded-[8px] border border-[#DBDEE0] overflow-hidden shadow-2xs w-full">
      {/* ── 1. SEARCH, FILTERS & ADD CANDIDATE TOOLBAR ── */}
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#DBDEE0]">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-full sm:w-[309px] h-[31px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pipeline"
              className="w-full h-full pl-8 pr-7 bg-white border border-[#8B9399] rounded-[5px] text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={onAllFiltersClick || (() => toast.info('All filters options'))}
            className="h-[31px] flex items-center gap-1.5 px-3 rounded-[5px] border border-[#DBDEE0] text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>All filters</span>
          </button>
        </div>

        <button
          onClick={onAddCandidateClick || (() => toast.info('Add a new candidate'))}
          className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-slate-500" />
          <span>Add a candidate</span>
        </button>
      </div>

      {/* ── 2. RESULTS HEADER & SORTING BAR ── */}
      <div className="px-5 py-3 flex items-center justify-between text-xs text-slate-600 border-b border-[#DBDEE0] bg-white">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#165B42] focus:ring-[#165B42] cursor-pointer"
          />
          <span className="font-bold text-[#165B42] tracking-wider uppercase cursor-pointer hover:underline">
            {filteredCandidates.length} RESULTS
          </span>
        </div>

        <div className="flex items-center gap-5 text-slate-600 text-[13px]">
          <div className="flex items-center gap-1 cursor-pointer hover:text-slate-900">
            <span className="text-slate-600">Sort by:</span>
            <span className="text-slate-600">Last modified</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
          </div>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600">1 – {filteredCandidates.length}</span>
        </div>
      </div>

      {/* ── 3. CANDIDATE ROWS LIST ── */}
      <div className="divide-y divide-[#DBDEE0]">
        {filteredCandidates.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <p className="text-sm font-medium">{emptyMessage}</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-[#165B42] hover:underline font-semibold cursor-pointer"
              >
                Clear search query
              </button>
            )}
          </div>
        ) : (
          filteredCandidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              isSelected={selectedCandidateIds.includes(candidate.id)}
              onSelect={handleSelectOne}
              isExpandedEducation={!!expandedEducations[candidate.id]}
              onToggleEducation={handleToggleEducation}
              onChangeStageClick={(c) => setStageModalCandidate(c)}
              onRejectClick={handleRejectCandidate}
              onProfileClick={onProfileClick}
            />
          ))
        )}
      </div>

      {/* ── CHANGE STAGE MODAL ── */}
      <ChangeStageModal
        candidate={stageModalCandidate}
        onClose={() => setStageModalCandidate(null)}
        onChangeStage={handleChangeStage}
      />
    </div>
  );
};

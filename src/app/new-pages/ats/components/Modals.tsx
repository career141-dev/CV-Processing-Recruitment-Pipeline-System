'use client';

import React from 'react';
import { X } from 'lucide-react';
import { MockCandidate } from '../types';

interface ChangeStageModalProps {
  candidate: MockCandidate | null;
  onClose: () => void;
  onChangeStage: (candidateId: string, newStageKey: MockCandidate['stage'], newStatusLabel: string) => void;
}

export const ChangeStageModal: React.FC<ChangeStageModalProps> = ({
  candidate,
  onClose,
  onChangeStage,
}) => {
  if (!candidate) return null;

  const stageOptions = [
    { stageKey: 'follow_up' as const, label: 'Follow-up (In Contacted)' },
    { stageKey: 'director_review' as const, label: 'Director Review' },
    { stageKey: 'director_shortlist' as const, label: 'Director Shortlist' },
    { stageKey: 'client_shortlist' as const, label: 'Client Shortlist' },
    { stageKey: 'interview' as const, label: 'Interview Scheduled' },
    { stageKey: 'offer' as const, label: 'Offer Extended' },
    { stageKey: 'placed' as const, label: 'Mark as Placed' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DDDFE2] space-y-5">
        <div className="flex items-center justify-between border-b border-[#DDDFE2] pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Change Pipeline Stage</h3>
            <p className="text-xs text-slate-500">Candidate: {candidate.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 block">Select Destination Stage:</label>
          {stageOptions.map((stg) => (
            <button
              key={stg.stageKey}
              onClick={() => onChangeStage(candidate.id, stg.stageKey, stg.label)}
              className="w-full text-left px-4 py-2.5 rounded-lg border border-[#DDDFE2] hover:border-[#165B42] hover:bg-emerald-50 text-sm font-medium text-slate-800 flex items-center justify-between group transition-all cursor-pointer"
            >
              <span>{stg.label}</span>
              <span className="text-xs text-[#165B42] opacity-0 group-hover:opacity-100 transition-opacity">
                Move →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

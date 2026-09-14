'use client';

import React, { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Mail,
  MoreHorizontal,
  Plus,
  Trash2,
  Phone,
  Pencil,
  Reply,
} from 'lucide-react';
import { toast } from 'sonner';
import { MockCandidate } from '../types';
import {
  CvTab,
  HistoryTab,
  ChatLogTab,
  CallLogTab,
  ReferenceTab,
} from './profile-tabs';

interface CandidateProfileDrawerProps {
  candidate: MockCandidate | null;
  candidatesList: MockCandidate[];
  onClose: () => void;
  onSelectCandidate: (candidate: MockCandidate) => void;
  onChangeStageClick: (candidate: MockCandidate) => void;
  onRejectClick: (candidateId: string) => void;
}

export const CandidateProfileDrawer: React.FC<CandidateProfileDrawerProps> = ({
  candidate,
  candidatesList,
  onClose,
  onSelectCandidate,
  onChangeStageClick,
  onRejectClick,
}) => {
  const [activeTab, setActiveTab] = useState<
    'CV' | 'History' | 'Chat Log' | 'Call Log' | 'Reference'
  >('CV');

  if (!candidate) return null;

  const currentIndex = candidatesList.findIndex((c) => c.id === candidate.id);
  const totalCandidates = candidatesList.length;

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectCandidate(candidatesList[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalCandidates - 1) {
      onSelectCandidate(candidatesList[currentIndex + 1]);
    }
  };

  const initials = candidate.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 z-50">
        <div className="w-full sm:w-[700px] shrink-0 bg-[#F7F7F7] shadow-2xl border-l border-[#DBDEE0] flex flex-col h-full">
          {/* ── 1. TOP NAV / HEADER BAR ── */}
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-[#DBDEE0] flex items-center justify-between bg-white shrink-0 select-none">
            <div className="text-[12px] sm:text-[13px] font-semibold text-slate-800 truncate pr-2 sm:pr-4">
              From {candidate.projectContext || 'DELMO - General Manager - Sales - THUSHINI'}
            </div>

            <div className="flex items-center gap-1 sm:gap-2 text-slate-500 text-xs shrink-0">
              <button
                onClick={handlePrev}
                disabled={currentIndex <= 0}
                className="p-1 hover:bg-slate-100 rounded text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Previous Candidate"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-medium text-slate-700 min-w-[44px] sm:min-w-[50px] text-center text-[11.5px] sm:text-xs">
                {currentIndex + 1} of {totalCandidates}
              </span>

              <button
                onClick={handleNext}
                disabled={currentIndex >= totalCandidates - 1}
                className="p-1 hover:bg-slate-100 rounded text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Next Candidate"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-4 bg-[#DBDEE0] mx-0.5 sm:mx-1" />

              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer transition-colors"
                title="Close Profile (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── 2. SCROLLABLE DRAWER BODY (STABLE GUTTER PREVENTS TAB JUMPING) ── */}
          <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable] p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4 bg-[#F7F7F7]">
            {/* ── 1. TOP CANDIDATE SUMMARY PROFILE BOX + TABS BAR ── */}
            <div className="rounded-[8px] overflow-hidden w-full shrink-0">
              {/* Profile Box (White, No bottom border) */}
              <div className="bg-white border-t border-l border-r border-[#DBDEE0] border-b-0 p-4 sm:p-6 rounded-t-[8px] w-full">
                <div className="flex flex-col sm:flex-row items-start gap-3.5 sm:gap-5">
                  {/* Circular Avatar */}
                  <div className="w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-full bg-[#B59163] text-white font-semibold text-lg sm:text-2xl flex items-center justify-center shrink-0">
                    {initials}
                  </div>

                  {/* All Candidate Details */}
                  <div className="flex-1 min-w-0 w-full space-y-2.5 sm:space-y-3">
                    {/* Name, Rank, Badges */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-[19px] sm:text-[22px] font-bold text-slate-900 tracking-tight leading-tight">
                          {candidate.name}
                        </h1>

                        {/* Degree Rank / Connection dot */}
                        <span className="inline-flex items-center text-slate-500">
                          <svg
                            className="w-3.5 h-3.5 text-slate-500"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <circle cx="12" cy="12" r="9" />
                            <circle cx="12" cy="12" r="4" fill="currentColor" />
                          </svg>
                        </span>
                        <span className="text-[12.5px] sm:text-[13px] text-slate-500 font-normal">
                          {candidate.degreeRank || '2nd'}
                        </span>

                        {/* Applicant Badge */}
                        {candidate.isApplicant && (
                          <span className="px-2 sm:px-2.5 py-0.5 rounded-[4px] text-[11.5px] sm:text-[12px] font-normal bg-[#ECEEF1] text-slate-700">
                            Applicant
                          </span>
                        )}
                      </div>

                      <p className="text-[13px] sm:text-[13.5px] text-slate-800 font-normal leading-snug mt-1 break-words">
                        {candidate.headline ||
                          'Business Development Manager - Maldives and 1st World Countries | Driving global growth in premium beverages'}
                      </p>

                      <p className="text-[11.5px] sm:text-[12px] text-slate-500 mt-1 break-words">
                        {candidate.companySummary ||
                          'Lion Brewery (Ceylon) PLC · Cardiff Metropolitan University · Sri Lanka · 500+'}
                      </p>
                    </div>

                    {/* Contact Information Rows */}
                    <div className="space-y-1.5 pt-0.5 text-[12.5px] sm:text-[13px] text-slate-800">
                      {/* Email */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <span className="font-bold text-slate-900 text-sm shrink-0">@</span>
                        <span className="font-bold text-slate-900 truncate">
                          {candidate.email || 'ashvinvgithimal@gmail.com'}
                        </span>
                        <div className="flex items-center gap-2 ml-auto sm:ml-2 text-slate-400 shrink-0">
                          <button
                            className="hover:text-slate-700 cursor-pointer p-0.5"
                            title="Edit Email"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="hover:text-slate-700 cursor-pointer p-0.5"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="hover:text-slate-700 cursor-pointer p-0.5"
                            title="Add"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <Phone className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span className="font-normal text-slate-800 truncate">
                          {candidate.phone || '+94712798490'} (Cell)
                        </span>
                        <div className="flex items-center gap-2 ml-auto sm:ml-2 text-slate-400 shrink-0">
                          <button
                            className="hover:text-slate-700 cursor-pointer p-0.5"
                            title="Edit Phone"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="hover:text-slate-700 cursor-pointer p-0.5"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="hover:text-slate-700 cursor-pointer p-0.5"
                            title="Add"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Public Profile Link */}
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="w-4 h-4 rounded-[2px] bg-[#0a66c2] text-white font-bold text-[10px] flex items-center justify-center leading-none shrink-0">
                          in
                        </span>
                        <a
                          href={`https://linkedin.com/in/${candidate.name.toLowerCase().replace(/\s+/g, '-')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#0a66c2] font-semibold hover:underline cursor-pointer text-[12.5px] sm:text-[13px] truncate"
                        >
                          Public profile
                        </a>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-2 sm:gap-3 pt-1.5 flex-wrap">
                      <button
                        onClick={() => onChangeStageClick(candidate)}
                        className="px-3 sm:px-4 py-1.5 bg-white border border-[#165B42] text-[#165B42] hover:bg-emerald-50 font-semibold rounded-full text-[12px] sm:text-[13px] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <span>Save to pipeline</span>
                        <ChevronDown className="w-3.5 h-3.5 text-[#165B42]" />
                      </button>

                      <button
                        onClick={() => onRejectClick(candidate.id)}
                        className="px-4 sm:px-5 py-1.5 bg-white border border-[#165B42] hover:bg-emerald-50 text-[#165B42] font-semibold rounded-full text-[12px] sm:text-[13px] transition-colors cursor-pointer"
                      >
                        Reject
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toast.info(`Message candidate: ${candidate.name}`)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="Send Message"
                        >
                          <Mail className="w-4 sm:w-5 h-4 sm:h-5" />
                        </button>

                        <button
                          onClick={() => toast.info('Forward candidate')}
                          className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="Forward Profile"
                        >
                          <Reply className="w-4 sm:w-5 h-4 sm:h-5" />
                        </button>

                        <button
                          className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="More Options"
                        >
                          <MoreHorizontal className="w-4 sm:w-5 h-4 sm:h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Tabs Bar (bg #F5F7FA, Horizontal scroll on mobile, No container border, Active green underline) ── */}
              <div className="bg-[#F5F7FA] px-4 sm:px-6 flex items-center gap-5 sm:gap-8 text-[13px] sm:text-[13.5px] font-semibold text-slate-600 overflow-x-auto whitespace-nowrap scrollbar-none w-full">
                {(['CV', 'History', 'Chat Log', 'Call Log', 'Reference'] as const).map(
                  (tab) => {
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-2.5 relative transition-colors cursor-pointer shrink-0 ${
                          isActive
                            ? 'text-[#057642] font-bold border-b-2 border-[#057642]'
                            : 'hover:text-slate-900 font-semibold'
                        }`}
                      >
                        {tab}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* ── 2. TAB CONTENT PANELS (MODULAR COMPONENTS) ── */}
            <div className="space-y-3 sm:space-y-4 w-full">
              {activeTab === 'CV' && <CvTab candidate={candidate} />}
              {activeTab === 'History' && <HistoryTab candidate={candidate} />}
              {activeTab === 'Chat Log' && <ChatLogTab candidate={candidate} />}
              {activeTab === 'Call Log' && (
                <CallLogTab candidate={candidate} initials={initials} />
              )}
              {activeTab === 'Reference' && <ReferenceTab candidate={candidate} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

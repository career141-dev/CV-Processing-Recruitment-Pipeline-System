'use client';

import React from 'react';
import { ChevronDown, Mail, MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { MockCandidate } from '../types';

interface CandidateCardProps {
  candidate: MockCandidate;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  isExpandedEducation: boolean;
  onToggleEducation: (id: string) => void;
  onChangeStageClick: (candidate: MockCandidate) => void;
  onRejectClick: (id: string) => void;
  onProfileClick?: (candidate: MockCandidate) => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({
  candidate,
  isSelected,
  onSelect,
  isExpandedEducation,
  onToggleEducation,
  onChangeStageClick,
  onRejectClick,
  onProfileClick,
}) => {
  return (
    <div
      className={`p-4 sm:p-6 transition-colors hover:bg-slate-50/40 ${
        isSelected ? 'bg-sky-50/30' : ''
      }`}
    >
      <div className="flex flex-col lg:flex-row items-start gap-4">
        {/* Left Checkbox + Candidate Info */}
        <div className="flex items-start gap-2.5 sm:gap-4 flex-1 min-w-0 w-full">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(candidate.id, e.target.checked)}
            className="w-4 h-4 mt-1.5 rounded border-slate-300 text-[#165B42] focus:ring-[#165B42] cursor-pointer shrink-0"
          />

          {/* Main Candidate Details Column */}
          <div className="flex-1 space-y-3 min-w-0">
            {/* Header: Name, Rank, Badges */}
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3
                  onClick={() => onProfileClick?.(candidate)}
                  className="font-bold text-[16px] text-[#165B42] hover:underline cursor-pointer tracking-normal leading-[100%]"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: '16px',
                    lineHeight: '100%',
                    letterSpacing: '0%',
                  }}
                >
                  {candidate.name}
                </h3>
                <span className="text-[12px] text-slate-500 font-normal">
                  in · {candidate.degreeRank}
                </span>
                {candidate.isApplicant && (
                  <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[#EBEBEB] text-slate-700">
                    Applicant
                  </span>
                )}
              </div>

              <p className="text-[13px] font-semibold text-slate-800 mt-1">
                {candidate.role}
              </p>
              <p className="text-[13px] text-slate-500 mt-0.5 break-words">
                {candidate.location} · {candidate.industry}
              </p>
            </div>

            {/* Structured Metadata */}
            <div className="space-y-3 text-[13px] pt-1">
              {/* Experience */}
              <div className="flex items-start gap-2.5 sm:gap-4">
                <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                  Experience
                </span>
                <div className="flex-1 min-w-0 space-y-1 text-slate-800 break-words">
                  {candidate.experiences.map((exp, idx) => (
                    <p key={idx}>
                      {exp.title} at {exp.company} · {exp.period}
                    </p>
                  ))}
                </div>
              </div>

              {/* Education */}
              <div className="flex items-start gap-2.5 sm:gap-4">
                <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                  Education
                </span>
                <div className="flex-1 min-w-0 space-y-1 text-slate-800 break-words">
                  {candidate.educations.map((edu, idx) => (
                    <p key={idx}>
                      {edu.institution}
                      {edu.degree ? `, ${edu.degree}` : ''} · {edu.period}
                    </p>
                  ))}
                  {candidate.moreEducationsCount && !isExpandedEducation && (
                    <button
                      onClick={() => onToggleEducation(candidate.id)}
                      className="text-slate-500 hover:text-slate-800 font-normal inline-flex items-center gap-1 cursor-pointer"
                    >
                      Show all ({candidate.moreEducationsCount}){' '}
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isExpandedEducation && (
                    <p className="text-slate-500 italic text-[11px] pt-0.5">
                      Additional certifications, diplomas & G.C.E. Advanced Level
                    </p>
                  )}
                </div>
              </div>

              {/* Highlight */}
              <div className="flex items-start gap-2.5 sm:gap-4">
                <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                  Highlight
                </span>
                <p className="flex-1 min-w-0 text-slate-800 break-words">
                  {candidate.highlight}
                </p>
              </div>

              {/* Skills Match */}
              <div className="flex items-start gap-2.5 sm:gap-4">
                <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                  Skills Match
                </span>
                <div className="flex-1 min-w-0 space-y-1 break-words">
                  <p className="text-slate-500">
                    {candidate.skillsMatch.matched} of {candidate.skillsMatch.total} match your job post
                  </p>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[#165B42]">
                    {candidate.skillsMatch.tags.map((tag, idx) => (
                      <span key={idx} className="inline-flex items-center">
                        <span className="hover:underline cursor-pointer">{tag}</span>
                        {idx < candidate.skillsMatch.tags.length - 1 && (
                          <span className="text-slate-400 ml-1.5">·</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interest */}
              <div className="flex items-start gap-2.5 sm:gap-4">
                <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                  Interest
                </span>
                <p className="flex-1 min-w-0 text-[#165B42] hover:underline cursor-pointer break-words">
                  {candidate.interest}
                </p>
              </div>

              {/* Activity */}
              <div className="flex items-start gap-2.5 sm:gap-4">
                <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                  Activity
                </span>
                <p className="flex-1 min-w-0 text-[#165B42] break-words">
                  {candidate.activity.split(' · ').map((part, idx, arr) => (
                    <React.Fragment key={idx}>
                      <span className="hover:underline cursor-pointer">{part}</span>
                      {idx < arr.length - 1 && <span className="text-slate-400 mx-1.5">·</span>}
                    </React.Fragment>
                  ))}
                </p>
              </div>

              {/* Saved by */}
              <div className="flex items-start gap-2.5 sm:gap-4">
                <span className="w-[95px] sm:w-[105px] min-w-[95px] sm:min-w-[105px] font-bold text-slate-900 shrink-0">
                  Saved by
                </span>
                <p className="flex-1 min-w-0 text-slate-800 break-words">
                  <span className="font-semibold text-slate-800">{candidate.savedBy}</span>{' '}
                  <span className="text-slate-500">{candidate.savedDate}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Action Column */}
        <div className="w-full lg:w-auto shrink-0 flex flex-col items-start lg:items-end justify-between lg:justify-start gap-2.5 text-left lg:text-right pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          {/* Top Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => onChangeStageClick(candidate)}
              className="px-4 py-1.5 bg-[#165B42] hover:bg-[#114934] text-white font-semibold rounded-full text-[13px] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>Change stage</span>
              <ArrowUpDown className="w-3.5 h-3.5 text-white" />
            </button>

            <button
              onClick={() => onRejectClick(candidate.id)}
              className="px-4 py-1.5 bg-white border border-[#165B42] hover:bg-emerald-50 text-[#165B42] font-semibold rounded-full text-[13px] transition-colors cursor-pointer"
            >
              Reject
            </button>

            <button
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Message Candidate"
            >
              <Mail className="w-4 h-4" />
            </button>

            <button
              className="p-1 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              title="More Options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Status Text */}
          <div className="space-y-0.5 pt-0.5 text-left lg:text-right">
            <div className="text-[14px] font-medium text-slate-800">
              {candidate.stageStatus}
            </div>
            <p className="text-[12px] text-slate-500 leading-tight">
              Stage changed on {candidate.stageChangedDate}
            </p>
            <p className="text-[12px] text-slate-500 leading-tight">
              by {candidate.stageChangedBy}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { toast } from 'sonner';
import { MockCandidate } from '../../types';

interface CvTabProps {
  candidate: MockCandidate;
}

export const CvTab: React.FC<CvTabProps> = ({ candidate }) => {
  return (
    <div className="bg-white rounded-[8px] border border-[#DBDEE0] p-4 sm:p-5 shadow-2xs space-y-3 sm:space-y-4 w-full">
      <div>
        <h2 className="font-bold text-[15px] text-slate-900 tracking-tight">
          Highlights for this project
        </h2>
        <p className="text-[12.5px] text-slate-500 mt-0.5">
          Candidate highlights and project-specific insights
        </p>
      </div>

      {/* Inner PDF Attachment Card */}
      <div className="border border-[#DBDEE0] rounded-[6px] p-3 flex items-center justify-between bg-white hover:border-slate-400 transition-all">
        {/* Left: PDF Icon + Name/Date */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[4px] bg-[#D9383A] text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
            PDF
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900 truncate">
              {candidate.cvFileName || `${candidate.name} - CV.pdf`}{' '}
              <span className="text-slate-500 font-normal">(Resume)</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {candidate.cvUploadedDate || 'March 10,2026'}
            </p>
          </div>
        </div>

        {/* Right: Preview ∨ | Download Icon */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => toast.info(`Previewing ${candidate.name}'s CV`)}
            className="text-[12px] text-slate-700 hover:text-slate-900 font-normal px-2 py-1 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Preview</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
          </button>

          <div className="w-[1px] h-5 bg-[#DBDEE0] mx-2.5" />

          <button
            onClick={() => toast.success(`Downloading ${candidate.name}'s CV`)}
            className="p-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer transition-colors"
            title="Download CV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { MockCandidate } from '../../types';

interface CallLogTabProps {
  candidate: MockCandidate;
  initials: string;
}

export const CallLogTab: React.FC<CallLogTabProps> = ({ candidate, initials }) => {
  return (
    <div className="bg-white rounded-[8px] border border-[#DBDEE0] p-4 sm:p-6 shadow-2xs w-full">
      {/* Inner Call Record Box */}
      <div className="border border-[#DBDEE0] rounded-[6px] p-4 sm:p-5 bg-white min-h-[160px] sm:min-h-[170px] flex flex-col justify-between">
        {/* Top row: Avatar + Name Calling + Timestamp */}
        <div>
          <div className="flex items-center justify-between gap-2.5 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#B59163] text-white font-semibold text-xs flex items-center justify-center shrink-0">
                {initials}
              </div>
              <span className="font-bold text-[14.5px] text-slate-900 truncate">
                {candidate.name} calling
              </span>
            </div>
            <span className="text-[13px] text-slate-500 font-normal shrink-0">
              9/9/2026 &nbsp;&nbsp; 5.24 AM
            </span>
          </div>

          {/* Divider line */}
          <div className="border-b border-[#DBDEE0]/80 mt-3.5" />
        </div>

        {/* Bottom right: Circular Green AI badge */}
        <div className="flex justify-end pt-6">
          <div
            className="w-8 h-8 rounded-full bg-[#00A859] text-white font-bold text-[12px] flex items-center justify-center select-none shadow-xs cursor-pointer hover:bg-[#00924e] transition-colors"
            title="AI Voice Agent Call Log"
          >
            AI
          </div>
        </div>
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { MockCandidate } from '../../types';

interface HistoryTabProps {
  candidate: MockCandidate;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ candidate }) => {
  return (
    <div className="bg-white rounded-[8px] border border-[#DBDEE0] p-4 sm:p-6 space-y-3 w-full">
      <div>
        <h2 className="font-bold text-[16px] sm:text-[18px] text-slate-900 tracking-tight">
          Recruiting activity
        </h2>
        <p className="text-[12.5px] sm:text-[13px] text-slate-500 mt-0.5">
          Horem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
      </div>

      {/* Activity Rows List */}
      <div className="divide-y divide-[#F0F2F5] pt-1">
        {/* Row 1 */}
        <div className="py-3 sm:py-3.5 flex items-start sm:items-center justify-between gap-2.5 sm:gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
              alt="Chathura Sampath"
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200"
            />
            <p className="text-[13.5px] text-slate-600 truncate">
              Viewed by <span className="font-bold text-slate-900">Chathura Sampath</span>
            </p>
          </div>
          <span className="text-[12.5px] text-slate-500 font-normal shrink-0">
            9/9/2026 &nbsp;&nbsp; 5.24 AM
          </span>
        </div>

        {/* Row */}
        <div className="py-3 sm:py-3.5 flex items-start sm:items-center justify-between gap-2.5 sm:gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
              alt="Chathura Sampath"
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200"
            />
            <p className="text-[13.5px] text-slate-600 truncate">
              Viewed by <span className="font-bold text-slate-900">Chathura Sampath</span>{' '}
              <span className="font-bold text-[#165B42]">
                {candidate.projectContext || 'DELMO - General Manager - Sales - THUSHINI'}
              </span>
            </p>
          </div>
          <span className="text-[12.5px] text-slate-500 font-normal shrink-0">
            9/9/2026 &nbsp;&nbsp; 5.24 AM
          </span>
        </div>

        {/* Row */}
        <div className="py-3 sm:py-3.5 flex items-start sm:items-center justify-between gap-2.5 sm:gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
              alt="Chathura Sampath"
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200"
            />
            <p className="text-[13.5px] text-slate-600 truncate">
              Viewed by <span className="font-bold text-slate-900">Chathura Sampath</span>{' '}
              <span className="font-bold text-[#165B42]">
                {candidate.projectContext || 'DELMO - General Manager - Sales - THUSHINI'}
              </span>
            </p>
          </div>
          <span className="text-[12.5px] text-slate-500 font-normal shrink-0">
            9/9/2026 &nbsp;&nbsp; 5.24 AM
          </span>
        </div>

        {/* Row 4 */}
        <div className="py-3 sm:py-3.5 flex items-start sm:items-center justify-between gap-2.5 sm:gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
              alt="Chathura Sampath"
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200"
            />
            <p className="text-[13.5px] text-slate-600 truncate">
              Viewed by <span className="font-bold text-slate-900">Chathura Sampath</span>{' '}
              <span className="font-bold text-[#165B42]">
                {candidate.projectContext || 'DELMO - General Manager - Sales - THUSHINI'}
              </span>
            </p>
          </div>
          <span className="text-[12.5px] text-slate-500 font-normal shrink-0">
            9/9/2026 &nbsp;&nbsp; 5.24 AM
          </span>
        </div>
      </div>
    </div>
  );
};

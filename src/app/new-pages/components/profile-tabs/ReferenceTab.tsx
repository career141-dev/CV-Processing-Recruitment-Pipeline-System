'use client';

import React from 'react';
import { MockCandidate } from '../../types';

interface ReferenceTabProps {
  candidate?: MockCandidate;
}

export const ReferenceTab: React.FC<ReferenceTabProps> = () => {
  return (
    <div className="bg-white rounded-[8px] border border-[#DBDEE0] p-4 sm:p-7 shadow-2xs w-full">
      {/* Header */}
      <h2 className="font-bold text-[16px] sm:text-[18px] text-slate-900 leading-tight">
        Reference
      </h2>
      <p className="text-[12.5px] sm:text-[13.5px] text-slate-500 mt-1 mb-4 sm:mb-5">
        Horem ipsum dolor sit amet, consectetur adipiscing elit.
      </p>

      {/* Inner Reference Box */}
      <div className="border border-[#DBDEE0] rounded-[6px] p-4 sm:p-6 bg-white space-y-3.5 sm:space-y-4">
        {/* Item 1 */}
        <div>
          <h3 className="font-bold text-[14px] text-slate-900">
            Borem ipsum dolor sit amet,
          </h3>
          <p className="text-[13px] text-slate-500 leading-relaxed mt-1.5">
            Torem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.
          </p>
        </div>

        {/* Divider */}
        <div className="border-b border-[#DBDEE0]/70 my-4" />

        {/* Item 2 */}
        <div>
          <h3 className="font-bold text-[14px] text-slate-900">
            Borem ipsum dolor sit amet,
          </h3>
          <p className="text-[13px] text-slate-500 leading-relaxed mt-1.5">
            Torem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero et velit interdum, ac aliquet odio mattis. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.
          </p>
        </div>
      </div>
    </div>
  );
};

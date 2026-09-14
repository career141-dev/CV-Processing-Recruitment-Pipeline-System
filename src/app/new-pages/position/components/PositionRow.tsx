'use client';

import React from 'react';
import { Eye, Users, Pencil, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { PositionItem } from '../types';

interface PositionRowProps {
  position: PositionItem;
  isSelected: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
}

export const PositionRow: React.FC<PositionRowProps> = ({
  position,
  isSelected,
  onToggleSelect,
}) => {
  return (
    <div
      className={`px-4 sm:px-6 py-4 sm:py-5 transition-colors hover:bg-slate-50/50 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 ${
        isSelected ? 'bg-sky-50/20' : ''
      }`}
    >
      {/* ── LEFT: CHECKBOX + POSITION METADATA ── */}
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onToggleSelect(position.id, e.target.checked)}
          className="w-4 h-4 mt-1 rounded border-slate-300 text-[#165B42] focus:ring-[#165B42] cursor-pointer shrink-0"
        />

        <div className="space-y-1 min-w-0 flex-1">
          {/* Title */}
          <h4
            onClick={() => toast.info(`Viewing ${position.title}`)}
            className="text-[14.5px] font-bold text-[#165B42] hover:underline cursor-pointer tracking-tight"
          >
            {position.title}
          </h4>

          {/* Company, Location, Workplace & Recruiter */}
          <p className="text-[12.5px] text-slate-500 leading-normal">
            <span className="font-semibold text-slate-600">{position.company}</span> ·{' '}
            {position.location} ({position.workplaceType}) · {position.recruiterName}
          </p>

          {/* Posted & Expiry */}
          <p className="text-[12px] text-slate-500">
            Posted: {position.postedDate} (Expiring in {position.expiryDays} days) · Job post type:{' '}
            {position.postType}
          </p>

          {/* Project Reference */}
          <p className="text-[12px] text-slate-500 pt-0.5">
            Project:{' '}
            <span
              onClick={() => toast.info(`Opening Project: ${position.projectTitle}`)}
              className="font-semibold text-[#165B42] hover:underline cursor-pointer"
            >
              {position.projectTitle}
            </span>
          </p>
        </div>
      </div>

      {/* ── RIGHT: STATUS, METRICS & ACTION BUTTONS ── */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 self-end xl:self-center shrink-0 text-xs text-slate-600">
        {/* Status Indicator */}
        <div className="flex items-center gap-1.5 font-medium text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
          <span>{position.status}</span>
        </div>

        {/* Views Metric */}
        <div className="flex items-center gap-1.5 text-slate-600 min-w-[80px]">
          <Eye className="w-3.5 h-3.5 text-slate-400" />
          <span>{position.viewsCount} views</span>
        </div>

        {/* Applicants Metric */}
        <div className="flex items-center gap-1.5 text-slate-600 min-w-[130px]">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {position.applicantsCount} applicants{' '}
            {position.newApplicantsCount > 0 && (
              <span className="font-bold text-[#165B42]">
                ({position.newApplicantsCount} new)
              </span>
            )}
          </span>
        </div>

        {/* Action: See more */}
        <button
          type="button"
          onClick={() => toast.info(`See more for ${position.title}`)}
          className="text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors cursor-pointer"
        >
          See more
        </button>

        {/* Action: Optimize */}
        <button
          type="button"
          onClick={() => toast.info(`Optimizing ${position.title}`)}
          className="px-3.5 py-1 rounded-full border border-[#165B42] text-[#165B42] font-semibold text-xs hover:bg-emerald-50/70 transition-colors cursor-pointer"
        >
          Optimize
        </button>

        {/* Edit Pencil Icon */}
        <button
          type="button"
          onClick={() => toast.info(`Edit position ${position.title}`)}
          className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          title="Edit position"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        {/* More Menu Icon */}
        <button
          type="button"
          onClick={() => toast.info('More options')}
          className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          title="More options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

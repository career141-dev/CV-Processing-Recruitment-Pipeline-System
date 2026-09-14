'use client';

import React from 'react';

export interface SpotlightCardProps {
  label: string;
  value: number | string;
  subLabel?: string;
  isSelected?: boolean;
  onClick?: () => void;
  variant?: 'standard' | 'compact';
  className?: string;
}

/**
 * SpotlightCard: Metric card used in stage spotlights sections.
 * Supports standard fixed box and compact carousel variants.
 */
export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  label,
  value,
  subLabel,
  isSelected = false,
  onClick,
  variant = 'standard',
  className = '',
}) => {
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`min-w-[130px] sm:min-w-[145px] p-2.5 sm:p-3 rounded-[6px] border text-left flex items-center justify-between transition-all cursor-pointer shrink-0 ${
          isSelected
            ? 'bg-[#057642] text-white border-[#057642] shadow-xs'
            : 'bg-white text-slate-700 border-[#DBDEE0] hover:border-slate-400 hover:bg-slate-50/50'
        } ${className}`}
      >
        <div className="leading-tight">
          {subLabel && <p className="text-[11px] opacity-80">{subLabel}</p>}
          <p className="text-[14px] font-bold">{label}</p>
        </div>
        <span
          className={`text-[18px] sm:text-[20px] font-bold ${
            isSelected ? 'text-white' : 'text-slate-900'
          }`}
        >
          {typeof value === 'number' ? String(value).padStart(2, '0') : value}
        </span>
      </button>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`w-full lg:w-[233px] h-[78px] rounded-[9px] border px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col justify-center transition-all cursor-pointer hover:border-slate-400 ${
        isSelected
          ? 'border-[#165B42] ring-2 ring-[#165B42]/10 bg-emerald-50/30'
          : 'border-[#DBDEE0] bg-white'
      } ${className}`}
    >
      <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-none">
        {value}
      </div>
      <div className="text-[12px] sm:text-[13px] text-slate-600 font-medium mt-1.5 leading-tight truncate">
        {label}
      </div>
    </div>
  );
};

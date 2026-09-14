'use client';

import React from 'react';

export interface DeskButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'toolbar' | 'ghost';
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * DeskButton: Standard button styles across Career141 Recruiter Desk.
 * - `primary`: Dark emerald rounded-full button (`#165B42`)
 * - `outline`: Green outline rounded-full button (e.g. Reject)
 * - `toolbar`: Gray border button for toolbars (`#DBDEE0`)
 * - `ghost`: Borderless icon/text action button
 */
export const DeskButton: React.FC<DeskButtonProps> = ({
  variant = 'primary',
  icon,
  children,
  className = '',
  type = 'button',
  ...rest
}) => {
  let baseStyles = 'cursor-pointer transition-colors inline-flex items-center justify-center';

  if (variant === 'primary') {
    baseStyles =
      'px-4 py-1.5 bg-[#165B42] hover:bg-[#114934] active:scale-95 text-white font-semibold rounded-full text-[13px] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-40';
  } else if (variant === 'outline') {
    baseStyles =
      'px-4 py-1.5 bg-white border border-[#165B42] hover:bg-emerald-50 text-[#165B42] font-semibold rounded-full text-[13px] transition-colors cursor-pointer';
  } else if (variant === 'toolbar') {
    baseStyles =
      'h-[31px] flex items-center gap-1.5 px-3 rounded-[5px] border border-[#DBDEE0] text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer shrink-0';
  } else if (variant === 'ghost') {
    baseStyles =
      'p-1 text-slate-500 hover:text-slate-700 rounded transition-colors cursor-pointer';
  }

  return (
    <button type={type} className={`${baseStyles} ${className}`} {...rest}>
      {children}
      {icon && <span className="shrink-0">{icon}</span>}
    </button>
  );
};

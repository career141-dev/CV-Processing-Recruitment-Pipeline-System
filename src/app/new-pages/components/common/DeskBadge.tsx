'use client';

import React from 'react';

export interface DeskBadgeProps {
  variant?: 'applicant' | 'tag' | 'pill';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * DeskBadge: Standard badges and tags.
 * - `applicant`: Gray "Applicant" badge (`#EBEBEB`)
 * - `tag`: Clickable green skill match tag (`#165B42`)
 * - `pill`: General pill badge
 */
export const DeskBadge: React.FC<DeskBadgeProps> = ({
  variant = 'applicant',
  children,
  className = '',
  onClick,
}) => {
  if (variant === 'applicant') {
    return (
      <span
        className={`px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[#EBEBEB] text-slate-700 select-none ${className}`}
      >
        {children}
      </span>
    );
  }

  if (variant === 'tag') {
    return (
      <span
        onClick={onClick}
        className={`text-[#165B42] hover:underline cursor-pointer ${className}`}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      onClick={onClick}
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
};

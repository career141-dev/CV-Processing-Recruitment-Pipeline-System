'use client';

import React from 'react';

export interface DeskCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  rounded?: 'sm' | 'md' | 'lg';
  noPadding?: boolean;
}

/**
 * DeskCard: Standard white container card with border `#DBDEE0` and shadow-2xs.
 */
export const DeskCard: React.FC<DeskCardProps> = ({
  children,
  className = '',
  rounded = 'md',
  noPadding = false,
  style,
  ...rest
}) => {
  const roundedClass =
    rounded === 'sm'
      ? 'rounded-[6px]'
      : rounded === 'lg'
        ? 'rounded-[10px]'
        : 'rounded-[8px]';

  return (
    <div
      className={`bg-white border border-[#DBDEE0] shadow-2xs overflow-hidden w-full ${roundedClass} ${
        noPadding ? '' : 'p-4 sm:p-5'
      } ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
};

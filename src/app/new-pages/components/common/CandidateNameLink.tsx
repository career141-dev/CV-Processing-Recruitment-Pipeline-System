'use client';

import React from 'react';

export interface CandidateNameLinkProps {
  name: string;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * CandidateNameLink: Standard candidate name link with 16px Inter bold green typography.
 */
export const CandidateNameLink: React.FC<CandidateNameLinkProps> = ({
  name,
  onClick,
  className = '',
  style,
}) => {
  return (
    <h3
      onClick={onClick}
      className={`font-bold text-[16px] text-[#165B42] hover:underline cursor-pointer tracking-normal leading-[100%] ${className}`}
      style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        fontSize: '16px',
        lineHeight: '100%',
        letterSpacing: '0%',
        ...style,
      }}
    >
      {name}
    </h3>
  );
};

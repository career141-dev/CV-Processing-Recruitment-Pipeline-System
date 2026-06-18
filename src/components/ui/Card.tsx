import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ children, className = '', noPadding = false, ...props }: CardProps) {
  const hasBgClass = className.includes('bg-');
  return (
    <div 
      className={`${hasBgClass ? '' : 'bg-white'} rounded-[10px] border border-solid border-[#E0E0E0] flex flex-col ${noPadding ? '' : 'p-5'} ${className}`} 
      style={{ boxShadow: '0px 2px 4px #0000000D' }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`flex flex-col items-start bg-[#F2F5EC4D] py-4 px-5 w-full border-b border-solid border-b-[#E0E0E0] ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`text-[#212121] text-sm font-bold ${className}`}>
      {children}
    </span>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`flex flex-col items-start w-full ${className}`}>
      {children}
    </div>
  );
}

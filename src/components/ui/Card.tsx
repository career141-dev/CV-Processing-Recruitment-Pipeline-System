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
      className={`${hasBgClass ? '' : 'bg-surface'} rounded-[10px] border border-solid border-border shadow-[0px_2px_4px_#0000000D] dark:shadow-[0px_2px_4px_rgba(0,0,0,0.5)] flex flex-col ${noPadding ? '' : 'p-5'} ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`flex flex-col items-start bg-surface-container-high/30 py-4 px-5 w-full border-b border-solid border-b-border ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`text-text-primary text-sm font-bold ${className}`}>
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

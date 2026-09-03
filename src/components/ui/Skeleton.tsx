import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
}

export function Skeleton({ className = '', width, height, borderRadius }: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = width;
  if (height !== undefined) style.height = height;
  if (borderRadius !== undefined) style.borderRadius = borderRadius;

  return (
    <div
      style={style}
      className={`animate-pulse bg-surface-container-high dark:bg-slate-800/80 rounded-md ${className}`}
    />
  );
}

export function SkeletonTableRows({ rows = 5, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="border-b border-border/50 animate-pulse">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="px-5 py-3.5">
              <Skeleton 
                className={`h-4 ${
                  cIdx === 0 
                    ? 'w-4' 
                    : cIdx === 1 
                    ? 'w-36 h-4' 
                    : cIdx === 2 
                    ? 'w-24 h-4' 
                    : 'w-16 h-4'
                }`} 
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`p-5 border border-border rounded-xl bg-surface animate-pulse space-y-3 ${className}`}>
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-2/3" />
      <div className="pt-2 flex gap-2">
        <Skeleton className="h-6 w-14 rounded-md" />
        <Skeleton className="h-6 w-14 rounded-md" />
      </div>
    </div>
  );
}

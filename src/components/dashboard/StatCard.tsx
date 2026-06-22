import React from 'react';
import Link from 'next/link';
import AnimatedCounter from '@/components/AnimatedCounter';
import { Card } from '@/components/ui/Card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  trendText: string;
  trendUp?: boolean;
  trendType?: 'up' | 'down' | 'neutral';
  bgColorClass?: string;
  href?: string;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, trendText, trendUp, trendType, bgColorClass = 'bg-surface', href, icon }: StatCardProps) {
  // Determine actual trend based on new trendType or fallback to old trendUp
  const actualTrend = trendType || (trendUp === false ? 'down' : 'up');
  const content = (
    <Card className={`flex-1 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] transform shadow-[0_10px_20px_rgba(0,0,0,0.04),0_2px_6px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.4)] border-b-[6px] border-black/5 dark:border-white/10 hover:-translate-y-3 hover:scale-[1.02] hover:border-b-[2px] hover:shadow-[0_30px_60px_rgba(0,0,0,0.12),0_15px_25px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_30px_60px_rgba(0,0,0,0.6),0_15px_25px_rgba(0,0,0,0.4)] relative group ${bgColorClass}`}>
      <div className="flex items-center justify-between self-stretch mb-1">
        <span className="text-text-secondary dark:text-text-primary text-[11px] font-bold">
          {title}
        </span>
        {icon && <div className="text-text-secondary/60 dark:text-text-primary/60">{icon}</div>}
      </div>
      <div className="flex flex-col items-start self-stretch pt-1 mb-[3px]">
        <span className="text-text-primary text-[28px] font-bold">
          <AnimatedCounter end={value} />
        </span>
      </div>
      <div className="flex items-center self-stretch gap-1">
        {actualTrend !== 'neutral' && (
          actualTrend === 'up' 
            ? <TrendingUp size={18} className="text-primary-container" />
            : <TrendingDown size={18} className="text-red-600" />
        )}
        <span className={`text-xs ${actualTrend === 'down' ? 'text-red-600' : actualTrend === 'neutral' ? 'text-gray-500' : 'text-primary-container'}`}>
          {trendText}
        </span>
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="flex-1 flex w-full no-underline">
        {content}
      </Link>
    );
  }

  return content;
}

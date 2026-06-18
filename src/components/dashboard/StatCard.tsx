import React from 'react';
import AnimatedCounter from '@/components/AnimatedCounter';
import { Card } from '@/components/ui/Card';

interface StatCardProps {
  title: string;
  value: number;
  trendText: string;
  trendUp?: boolean;
  bgColorClass?: string;
}

export function StatCard({ title, value, trendText, trendUp = true, bgColorClass = 'bg-white' }: StatCardProps) {
  return (
    <Card className={`flex-1 ${bgColorClass}`}>
      <div className="flex flex-col items-start self-stretch mb-1">
        <span className="text-[#616161] text-[11px] font-bold">
          {title}
        </span>
      </div>
      <div className="flex flex-col items-start self-stretch pt-1 mb-[3px]">
        <span className="text-[#212121] text-[28px] font-bold">
          <AnimatedCounter end={value} />
        </span>
      </div>
      <div className="flex items-center self-stretch gap-1">
        <img
          src={trendUp ? "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/4847c4ae-2af3-489e-9a45-869fb5536899" : "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/RSsjzjm7bY/3f7mjel6_expires_30_days.png"} // fallback icon for trend down
          className="w-[11px] h-[7px] object-fill"
          alt={trendUp ? "Arrow Up" : "Arrow Down"}
        />
        <span className="text-[#1B5E20] text-xs">
          {trendText}
        </span>
      </div>
    </Card>
  );
}

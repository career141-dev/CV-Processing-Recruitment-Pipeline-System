import React from 'react';
import { Card } from '@/components/ui/Card';

interface ChannelStatusCardProps {
  title: string;
  status: string;
  statusColor: string;
  icon: React.ReactNode;
  stats: { label: string; value: string | React.ReactNode }[];
  borderClass?: string;
  pulse?: boolean;
  actionButton?: React.ReactNode;
}

export function ChannelStatusCard({
  title,
  status,
  statusColor,
  icon,
  stats,
  borderClass = 'border-border',
  pulse = false,
  actionButton
}: ChannelStatusCardProps) {
  const isCustomBorder = borderClass !== 'border-border';

  return (
    <Card className={`relative overflow-hidden hover:shadow-md transition-shadow ${isCustomBorder ? borderClass : ''}`}>
      {isCustomBorder && (
        <div className={`absolute top-0 left-0 w-full h-1 ${statusColor.replace('text-', 'bg-')}`}></div>
      )}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColor.replace('text-', 'bg-')} ${pulse ? 'animate-pulse' : ''}`}></div>
          <span className={`text-[14px] font-semibold ${statusColor}`}>{status}</span>
        </div>
        <div className="text-text-secondary opacity-40">
          {icon}
        </div>
      </div>
      <h3 className="text-[14px] font-semibold text-text-primary mb-3">{title}</h3>
      <div className={`space-y-2 pt-2 border-t border-border ${actionButton ? 'mb-3' : ''}`}>
        {stats.map((stat, i) => (
          <div key={i} className={`flex justify-between items-center ${typeof stat.value === 'string' && stat.value.includes('@') ? 'overflow-hidden' : ''}`}>
            <span className="text-[13px] text-text-secondary whitespace-nowrap">{stat.label}</span>
            {typeof stat.value === 'string' ? (
              <span className={`text-[14px] font-semibold ${stat.value.includes('@') ? 'text-[11px] truncate ml-2' : ''}`}>
                {stat.value}
              </span>
            ) : (
              stat.value
            )}
          </div>
        ))}
      </div>
      {actionButton}
    </Card>
  );
}

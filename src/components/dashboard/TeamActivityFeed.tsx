"use client";

import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { UserCheck, Send, FileText, Loader2, Inbox } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

/** Returns a human-readable relative time string (e.g. "2 mins ago") */
function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

type ActivityType = 'stage_move' | 'cv_received' | 'follow_up';

const CONFIG: Record<ActivityType, { iconBg: string; Icon: React.ElementType }> = {
  stage_move: {
    iconBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    Icon: UserCheck,
  },
  cv_received: {
    iconBg: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    Icon: FileText,
  },
  follow_up: {
    iconBg: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
    Icon: Send,
  },
};

export function TeamActivityFeed() {
  const activities = useQuery(api.stats.stats.getRecentActivity);

  return (
    <Card noPadding className="p-[1px]">
      <CardHeader>
        <span className="text-text-primary text-sm font-bold">Team Activity</span>
        {activities && activities.length > 0 && (
          <span className="text-[11px] text-text-secondary font-normal ml-auto">Live</span>
        )}
      </CardHeader>

      <div className="flex flex-col items-start p-5 gap-4 w-full">
        {/* Loading */}
        {activities === undefined && (
          <div className="flex items-center justify-center w-full py-8 text-text-secondary gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[13px]">Loading activity…</span>
          </div>
        )}

        {/* Empty state */}
        {activities !== undefined && activities.length === 0 && (
          <div className="flex flex-col items-center justify-center w-full py-8 text-center bg-surface-container-lowest rounded-md">
            <div className="w-10 h-10 bg-surface-container-low rounded-full flex items-center justify-center mb-3">
              <Inbox className="text-text-secondary w-5 h-5" />
            </div>
            <span className="text-text-primary font-medium text-[13px]">No recent activity</span>
            <span className="text-text-secondary text-xs mt-1 max-w-[200px]">
              When your team takes action, it will show up here.
            </span>
          </div>
        )}

        {/* Activity list */}
        {activities && activities.map((activity) => {
          const type = activity.type as ActivityType;
          const { iconBg, Icon } = CONFIG[type] ?? CONFIG.cv_received;
          return (
            <div key={activity.id} className="flex items-start gap-3 w-full">
              <div className={`flex shrink-0 items-center justify-center ${iconBg} rounded-full w-8 h-8`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-text-primary text-[13px] leading-tight mb-1 font-medium truncate">
                  {activity.text}
                </span>
                <span className="text-text-disabled text-xs">{timeAgo(activity.timestamp)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

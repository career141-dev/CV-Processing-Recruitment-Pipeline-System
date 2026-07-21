"use client";

import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Loader2, Inbox } from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import Image from 'next/image';

export function TeamActivityFeed() {
  const activities = useQuery((api.stats.stats as any).getTeamActivity);

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
          return (
            <div key={activity.id} className="flex items-start gap-3 w-full">
              <div className={`flex shrink-0 items-center justify-center ${activity.iconBg} rounded-full w-8 h-8`}>
                <img src={activity.iconUrl} alt="icon" className="w-4 h-4" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className={`text-text-primary text-[13px] leading-tight mb-1 truncate ${activity.isBold ? 'font-medium' : 'font-normal'}`}>
                  {activity.text}
                </span>
                <span className="text-text-disabled text-xs">{activity.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

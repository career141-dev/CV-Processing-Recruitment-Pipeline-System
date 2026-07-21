"use client";

import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Mail, Briefcase, Users, MessageCircle, Upload, Activity } from 'lucide-react';

export function InboxActivityWidget() {
  const data = useQuery(api.stats.stats.getTodayInboxActivity);

  const sources = [
    { key: "email", label: "General CV Inbox", icon: Mail, color: "bg-[#0A66C2]", textColor: "text-[#0A66C2]" },
    { key: "email_campaign", label: "Job Applications", icon: Briefcase, color: "bg-[#006763]", textColor: "text-[#006763]" },
    { key: "linkedin", label: "LinkedIn Inbox", icon: Users, color: "bg-[#0A66C2]", textColor: "text-[#0A66C2]" },
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "bg-[#25D366]", textColor: "text-[#25D366]" },
    { key: "database", label: "Manual Uploads", icon: Upload, color: "bg-[#883454]", textColor: "text-[#883454]" },
  ];

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-text-secondary" />
            <h3 className="text-text-primary text-sm font-bold">Today's Inbox Activity</h3>
          </div>
        </CardHeader>
        <div className="p-4 text-center text-text-secondary text-sm animate-pulse">Loading real-time stats...</div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col shadow-sm border border-border">
      <CardHeader className="border-b border-border bg-surface-bright/30 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary-container" />
            </div>
            <div>
              <h3 className="text-text-primary text-[15px] font-bold">Today's Inbox Activity</h3>
              <p className="text-[11px] text-text-secondary">Live incoming CV flow</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold text-text-primary leading-none">{data.total}</span>
            <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Total CVs</span>
          </div>
        </div>
      </CardHeader>
      
      <div className="p-5 flex-1 flex flex-col justify-center gap-4">
        {data.total === 0 ? (
          <div className="text-center text-text-secondary text-sm py-4">No CVs arrived today yet.</div>
        ) : (
          <div className="space-y-4">
            {sources.map((source) => {
              const count = data.counts[source.key] || 0;
              const percentage = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
              const Icon = source.icon;
              
              if (count === 0 && data.total > 0) return null; // Hide empty sources if there's data

              return (
                <div key={source.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-text-primary">
                      <Icon className={`w-3.5 h-3.5 ${source.textColor}`} />
                      {source.label}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-secondary">{percentage}%</span>
                      <span className="font-bold w-6 text-right tabular-nums">{count}</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${source.color}`} 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

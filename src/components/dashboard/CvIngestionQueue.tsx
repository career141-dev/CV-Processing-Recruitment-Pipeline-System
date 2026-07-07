import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

export function CvIngestionQueue() {
  const stats = useQuery(api.stats.stats.getIngestionStats);
  
  let queueCount = 0;
  let processedCount = 0;
  let sources = [];
  
  if (stats) {
    queueCount = stats.activeUploads.length;
    processedCount = Object.values(stats.statsBySource).reduce((acc: number, curr: any) => acc + curr.todayCount, 0);
    
    // Sort sources by count descending
    const sortedSources = Object.entries(stats.statsBySource)
      .sort((a: any, b: any) => b[1].todayCount - a[1].todayCount)
      .filter(([name, data]: [string, any]) => data.todayCount > 0);
      
    sources = sortedSources.map(([name, data]: [string, any]) => {
      const percentage = processedCount > 0 ? Math.round((data.todayCount / processedCount) * 100) : 0;
      return {
        name: name,
        percentage: `${percentage}%`,
        width: `${percentage}%`
      };
    });
    
    if (sources.length === 0) {
      sources = [
        { name: "WhatsApp", percentage: "0%", width: "0%" },
        { name: "Email", percentage: "0%", width: "0%" },
        { name: "LinkedIn", percentage: "0%", width: "0%" },
      ];
    }
  } else {
    // Loading state fallback
    sources = [
      { name: "WhatsApp", percentage: "...", width: "0%" },
      { name: "Email", percentage: "...", width: "0%" },
      { name: "LinkedIn", percentage: "...", width: "0%" },
    ];
  }

  return (
    <Card noPadding className="p-[1px]">
      <CardHeader>
        <span className="text-text-primary text-sm font-bold">
          CV Ingestion — Today
        </span>
      </CardHeader>
      <div className="flex flex-col items-start p-5 gap-6 w-full">
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col items-center">
            <span className="text-text-secondary text-[11px] font-bold mb-1">QUEUE</span>
            <span className="text-text-primary text-xl font-bold">{queueCount}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-text-secondary text-[11px] font-bold mb-1">PROCESSED</span>
            <span className="text-primary-container text-xl font-bold">{processedCount}</span>
          </div>
        </div>
        <div className="flex flex-col w-full gap-4">
          {sources.map((source, idx) => (
            <div key={idx} className="flex flex-col gap-1 w-full">
              <div className="flex items-center justify-between w-full">
                <span className="text-text-primary text-xs">{source.name}</span>
                <span className="text-text-primary text-xs font-bold">{source.percentage}</span>
              </div>
              <div className="bg-surface-container h-1.5 rounded-full w-full">
                <div className="bg-primary-container h-full rounded-full" style={{ width: source.width }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

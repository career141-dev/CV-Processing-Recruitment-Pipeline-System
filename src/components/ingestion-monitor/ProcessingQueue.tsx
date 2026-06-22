import React from 'react';
import { Card } from '@/components/ui/Card';

interface ProcessingQueueProps {
  queueCount: number;
  rate: string;
  estClear: string;
  progress: number;
}

export function ProcessingQueue({ queueCount, rate, estClear, progress }: ProcessingQueueProps) {
  return (
    <Card className="mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-[14px] font-semibold text-text-primary">Processing Queue</h2>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider transition-colors duration-300 ${queueCount > 0 ? 'bg-[#96F592] text-[#0A7320]' : 'bg-[#E6E9E1] text-text-secondary'}`}>
            {queueCount} IN QUEUE
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[12px] text-text-secondary">Rate</span>
            <span className="text-[14px] font-semibold text-text-primary">{rate}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] text-text-secondary">Est. clear</span>
            <span className="text-[14px] font-semibold text-text-primary">{estClear}</span>
          </div>
        </div>
      </div>
      <div className="w-full bg-[#E6E9E1] rounded-full h-2">
        <div className="bg-[#006E1C] h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
      </div>
    </Card>
  );
}

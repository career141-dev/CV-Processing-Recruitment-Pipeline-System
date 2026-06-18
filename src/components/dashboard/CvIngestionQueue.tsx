import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';

export function CvIngestionQueue() {
  const sources = [
    { name: "WhatsApp", percentage: "35%", width: "35%" },
    { name: "Email", percentage: "28%", width: "28%" },
    { name: "LinkedIn", percentage: "20%", width: "20%" },
  ];

  return (
    <Card noPadding className="p-[1px]">
      <CardHeader>
        <span className="text-[#212121] text-sm font-bold">
          CV Ingestion — Today
        </span>
      </CardHeader>
      <div className="flex flex-col items-start p-5 gap-6 w-full">
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col items-center">
            <span className="text-[#616161] text-[11px] font-bold mb-1">QUEUE</span>
            <span className="text-[#212121] text-xl font-bold">0</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[#616161] text-[11px] font-bold mb-1">PROCESSED</span>
            <span className="text-[#1B5E20] text-xl font-bold">43</span>
          </div>
        </div>
        <div className="flex flex-col w-full gap-4">
          {sources.map((source, idx) => (
            <div key={idx} className="flex flex-col gap-1 w-full">
              <div className="flex items-center justify-between w-full">
                <span className="text-[#212121] text-xs">{source.name}</span>
                <span className="text-[#212121] text-xs font-bold">{source.percentage}</span>
              </div>
              <div className="bg-[#ECEFE6] h-1.5 rounded-full w-full">
                <div className="bg-[#1B5E20] h-full rounded-full" style={{ width: source.width }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

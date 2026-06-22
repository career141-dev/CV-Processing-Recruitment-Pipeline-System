import React from 'react';
import { Card } from '@/components/ui/Card';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

export interface LogEntry {
  id: number | string;
  time: string;
  source: { name: string; bgColor: string; textColor: string };
  candidate: string;
  status: 'parsing' | 'parsed';
}

interface IngestionLogProps {
  logs: LogEntry[];
}

export function IngestionLog({ logs }: IngestionLogProps) {
  return (
    <Card className="mb-6 overflow-hidden flex flex-col" noPadding>
      <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-surface">
        <h2 className="text-[14px] font-semibold text-text-primary">Real-time Ingestion Log</h2>
        <div className="text-[12px] text-text-secondary">Showing last 15 activities</div>
      </div>
      <div className="overflow-x-auto bg-surface rounded-b-[10px]">
        <table className="w-full text-left">
          <thead className="bg-surface-container-high border-b border-border">
            <tr>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Time</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Source</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Candidate</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0]">
            {logs.map((log) => (
              <tr key={log.id} className="transition-colors duration-1000 ease-out animate-in slide-in-from-top-2" style={{ backgroundColor: log.status === 'parsing' ? '#F0FFF0' : 'transparent' }}>
                <td className="px-6 py-4 text-[13px] text-text-secondary">{log.time}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 ${log.source.bgColor} ${log.source.textColor} rounded-lg text-[11px] font-bold`}>
                    {log.source.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-[14px] font-semibold">{log.candidate}</td>
                <td className="px-6 py-4 flex items-center gap-2">
                  {log.status === 'parsing' ? (
                    <div className="flex items-center gap-2 text-text-secondary font-bold">
                      <RefreshCw className="animate-spin" size={18} /> Parsing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[#006E1C] font-bold">
                      <CheckCircle2 size={18} /> Parsed
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

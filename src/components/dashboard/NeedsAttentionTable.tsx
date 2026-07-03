import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AvatarBadge } from '@/components/ui/Badge';
import Link from 'next/link';

export function NeedsAttentionTable({ jobFilter = 'All Jobs' }: { jobFilter?: string }) {
  // Placeholder for real backend query (e.g., api.applications.getNeedsAttention)
  const data: any[] = [];

  return (
    <Card noPadding className="p-[1px]">
      <CardHeader>
        <div className="flex flex-col items-start self-stretch">
          <span className="text-text-primary text-sm font-bold">Needs Attention</span>
        </div>
        <div className="flex flex-col items-start self-stretch">
          <span className="text-text-secondary text-xs">Candidates stalled or awaiting action</span>
        </div>
      </CardHeader>
      <div className="w-full overflow-x-auto pb-[1px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-solid border-border bg-surface">
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px]">Candidate</th>
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px]">Job</th>
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px]">Stage</th>
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px] text-center">Days</th>
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px] text-center">Assigned</th>
              <th className="py-3 px-5 text-text-secondary font-bold text-[13px] text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((row, idx) => (
                <tr key={row.id} className={`${idx !== data.length - 1 ? 'border-b border-border' : ''} hover:bg-surface-container-high transition-colors`}>
                  <td className="py-4 px-5 text-text-primary text-[13px] whitespace-pre-line">{row.candidate}</td>
                  <td className="py-4 px-5 text-text-secondary text-[13px] whitespace-pre-line">{row.job}</td>
                  <td className="py-4 px-5 text-text-primary text-[13px] whitespace-pre-line">{row.stage}</td>
                  <td className={`py-4 px-5 ${row.daysColor} text-[13px] font-bold text-center`}>{row.days}</td>
                  <td className="py-4 px-5">
                    <AvatarBadge initials={row.initials} colorClass={row.avatarColor} size="w-6 h-6 text-[10px] mx-auto" />
                  </td>
                  <td className="py-4 px-5 text-center">
                    <Link href={`/dashboard/candidates/${row.id}`}>
                      <Button variant="secondary" size="sm">View</Button>
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-12 px-5 text-center bg-surface-container-lowest">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center mb-2">
                      <span className="text-primary-container text-lg">✓</span>
                    </div>
                    <span className="text-text-primary font-medium text-[13px]">All caught up</span>
                    <span className="text-text-secondary text-xs">No candidates currently stalled or needing attention.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AvatarBadge } from '@/components/ui/Badge';
import Link from 'next/link';

export function NeedsAttentionTable({ jobFilter = 'All Jobs' }: { jobFilter?: string }) {
  const allData = [
    { id: 1, candidate: "Priya Nair", job: "Fullstack\nEngineer", stage: "Technical\nTest", days: "8 days", daysColor: "text-[#BA1A1A]", initials: "SK", avatarColor: "bg-[#96F592] text-[#0A7320]" },
    { id: 2, candidate: "James Chen", job: "Sales Manager", stage: "Final Round", days: "5 days", daysColor: "text-[#E65100]", initials: "MK", avatarColor: "bg-[#006763] text-white" },
    { id: 3, candidate: "Fatima Al\nRashid", job: "HR Lead", stage: "Initial Screen", days: "4 days", daysColor: "text-[#E65100]", initials: "SK", avatarColor: "bg-[#96F592] text-[#0A7320]" },
  ];

  // Dummy logic: if Active Jobs is selected, let's just show fewer items to simulate filtering
  const data = jobFilter === 'Active Jobs' ? allData.slice(0, 2) : jobFilter === 'My Jobs' ? allData.slice(1, 2) : allData;

  return (
    <Card noPadding className="p-[1px]">
      <CardHeader>
        <div className="flex flex-col items-start self-stretch">
          <span className="text-[#212121] text-sm font-bold">Needs Attention</span>
        </div>
        <div className="flex flex-col items-start self-stretch">
          <span className="text-[#616161] text-xs">Candidates stalled or awaiting action</span>
        </div>
      </CardHeader>
      <div className="w-full overflow-x-auto pb-[1px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-solid border-[#E0E0E0] bg-white">
              <th className="py-3 px-5 text-[#616161] font-normal text-[13px]">Candidate</th>
              <th className="py-3 px-5 text-[#616161] font-normal text-[13px]">Job</th>
              <th className="py-3 px-5 text-[#616161] font-normal text-[13px]">Stage</th>
              <th className="py-3 px-5 text-[#616161] font-normal text-[13px] text-center">Days</th>
              <th className="py-3 px-5 text-[#616161] font-normal text-[13px] text-center">Assigned</th>
              <th className="py-3 px-5 text-[#616161] font-normal text-[13px] text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((row, idx) => (
                <tr key={row.id} className={`${idx !== data.length - 1 ? 'border-b border-gray-100' : ''} hover:bg-gray-50`}>
                  <td className="py-4 px-5 text-[#212121] text-[13px] whitespace-pre-line">{row.candidate}</td>
                  <td className="py-4 px-5 text-[#616161] text-[13px] whitespace-pre-line">{row.job}</td>
                  <td className="py-4 px-5 text-[#212121] text-[13px] whitespace-pre-line">{row.stage}</td>
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
                <td colSpan={6} className="py-12 px-5 text-center bg-[#FAFAFA]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center mb-2">
                      <span className="text-[#1B5E20] text-lg">✓</span>
                    </div>
                    <span className="text-[#212121] font-medium text-[13px]">All caught up</span>
                    <span className="text-[#616161] text-xs">No candidates currently stalled or needing attention.</span>
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

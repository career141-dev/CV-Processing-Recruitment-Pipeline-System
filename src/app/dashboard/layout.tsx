"use client";

import React from 'react';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col bg-background min-h-screen">
      <div className="self-stretch bg-background pb-[25px]">
        <div className="flex items-start self-stretch gap-[21px]">
          <Sidebar />
          <div className="flex flex-1 flex-col items-start relative pb-10 min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

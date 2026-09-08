"use client";

import React from 'react';
import TopNavbar from '@/components/TopNavbar';
import { AccessGate } from '@/components/AccessGate';
import { RouteGuard } from '@/components/RouteGuard';
import { AccessDeniedModal } from '@/components/AccessDeniedModal';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate>
      <AccessDeniedModal />
      <div className="flex flex-col h-screen w-screen bg-background overflow-hidden">
        {/* Top Navigation Bar (LinkedIn Recruiter Style) */}
        <TopNavbar />

        {/* Main Content Area: Full width fluid container */}
        <main className="flex-1 h-[calc(100vh-56px)] overflow-y-auto overflow-x-hidden pb-12 pt-4 md:pt-6 min-w-0 px-3.5 sm:px-8 relative">
          <RouteGuard>{children}</RouteGuard>
        </main>
      </div>
    </AccessGate>
  );
}


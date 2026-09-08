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
      <div className="flex flex-col min-h-screen w-full bg-background overflow-x-hidden">
        {/* Top Navigation Bar (LinkedIn Recruiter Style) */}
        <TopNavbar />

        {/* Main Content Area: Full width fluid container */}
        <main className="flex-1 pb-12 pt-4 md:pt-6 min-w-0 px-3.5 sm:px-8 relative">
          <RouteGuard>{children}</RouteGuard>
        </main>
      </div>
    </AccessGate>
  );
}

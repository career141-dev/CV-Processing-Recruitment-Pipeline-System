"use client";

import React from 'react';
import TopHeader from '@/components/TopHeader';
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
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        {/* Unified Top Navigation Header */}
        <TopHeader />

        {/* Main Content Area: 100% full width fluid container */}
        <main className="flex-1 w-full min-w-0 px-4 sm:px-6 lg:px-8 py-6 relative">
          <RouteGuard>{children}</RouteGuard>
        </main>
      </div>
    </AccessGate>
  );
}


"use client";

import React from 'react';
import Sidebar from '@/components/Sidebar';
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
      <div className="flex h-screen w-screen bg-background overflow-hidden">
        <Sidebar />
        <main className="flex-1 h-screen overflow-y-auto pb-10 min-w-0 pr-6 pl-5 pt-5 relative">
          <RouteGuard>{children}</RouteGuard>
        </main>
      </div>
    </AccessGate>
  );
}

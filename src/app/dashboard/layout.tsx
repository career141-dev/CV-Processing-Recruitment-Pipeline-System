"use client";

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { AccessGate } from '@/components/AccessGate';
import { RouteGuard } from '@/components/RouteGuard';
import { AccessDeniedModal } from '@/components/AccessDeniedModal';
import { Menu } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <AccessGate>
      <AccessDeniedModal />
      <div className="flex h-screen w-screen bg-background overflow-hidden flex-col md:flex-row">
        {/* Mobile Top App Bar (Hidden on md and up) */}
        <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border shrink-0 z-30 shadow-xs">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="p-1.5 -ml-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container-high transition-colors focus:outline-hidden"
              aria-label="Open navigation menu"
            >
              <Menu size={22} />
            </button>
            <Link href="/dashboard" className="flex items-center">
              <img
                src="/logo.png"
                alt="Career141"
                className="h-8 w-auto object-contain dark:brightness-110"
              />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8',
                },
              }}
            />
          </div>
        </header>

        {/* Mobile Drawer Backdrop */}
        {mobileDrawerOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Container: Slide-over Drawer on mobile, Persistent on Desktop */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
            mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <Sidebar
            onMobileClose={() => setMobileDrawerOpen(false)}
            isMobileDrawer={mobileDrawerOpen}
          />
        </div>

        {/* Main Content Area: Full width fluid container */}
        <main className="flex-1 h-[calc(100vh-53px)] md:h-screen overflow-y-auto pb-12 pt-4 md:pt-5 min-w-0 px-3.5 sm:px-6 relative">
          <RouteGuard>{children}</RouteGuard>
        </main>
      </div>
    </AccessGate>
  );
}

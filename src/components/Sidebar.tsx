"use client";

import React from 'react';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { useRole } from '@/hooks/useRole';

export default function Sidebar() {
  const { user } = useUser();
  const userName = user?.fullName || user?.firstName || 'User';
  const imageUrl = user?.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 24 24' fill='%231b5e20'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-.85-5.05-2.2.03-1.68 3.37-2.6 5.05-2.6s5.02.92 5.05 2.6C15.8 19.15 14.03 20 12 20z'/%3E%3C/svg%3E";
  const pathname = usePathname();
  const { isAdmin, isTAManager, hasFullAccess } = useRole();
  const showAdminSettings = isAdmin || isTAManager;

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path !== '/dashboard' && pathname.startsWith(path)) return true;
    return false;
  };

  const linkClass = (path: string) =>
    `flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${
      isActive(path)
        ? 'bg-[#0f5229]/15 dark:bg-emerald-500/25 border-l-4 border-[#0f5229] dark:border-emerald-400 font-bold text-[#052612] dark:text-white shadow-sm'
        : 'text-[#0f5229]/90 dark:text-emerald-100/80 hover:bg-[#0f5229]/10 dark:hover:bg-emerald-500/15 hover:text-[#052612] dark:hover:text-white'
    }`;

  const iconClass = (path: string) =>
    `material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${
      isActive(path) ? 'text-[#0f5229] dark:text-emerald-300 font-bold' : 'text-[#0f5229] dark:text-emerald-400'
    }`;

  return (
    <div className="flex flex-col shrink-0 items-center bg-[#ebf6ed] dark:bg-[#062615] text-[#0a3d1e] dark:text-white pb-3 w-64 border-r border-[#c2e5ca] dark:border-emerald-900/60 h-screen sticky top-0 overflow-y-auto shadow-md transition-colors duration-200">
      <div className="flex items-center py-4 border-b border-solid border-[#c2e5ca] dark:border-emerald-900/60 w-full">
        <Link href="/dashboard" className="flex items-center cursor-pointer">
          <span className="flex flex-col shrink-0 items-center bg-[#0f5229] dark:bg-emerald-400 text-left py-[5px] px-[11px] ml-5 mr-3 rounded-md shadow-sm">
            <span className="text-white dark:text-[#062615] text-sm font-extrabold">R</span>
          </span>
          <span className="text-[#0a3d1e] dark:text-emerald-300 text-base font-extrabold tracking-wide mr-[67px]">
            Career141
          </span>
        </Link>
      </div>
      <div className="flex items-center bg-[#ddf0e0] dark:bg-[#08361e] py-3 mb-2 border-b border-solid border-[#c2e5ca] dark:border-emerald-900/60 w-full">
        <button
          className="flex flex-col shrink-0 items-start bg-white dark:bg-[#062615] text-left p-[1px] ml-4 mr-3 rounded-[9999px] border border-solid border-[#0f5229]/20 dark:border-emerald-500/30"
          onClick={() => alert('Pressed!')}
        >
          <img
            src={imageUrl}
            className="w-[34px] h-[34px] rounded-[9999px] object-cover"
            alt="Profile"
          />
        </button>
        <div className="flex flex-col shrink-0 items-center mr-[42px]">
          <div className="flex flex-col items-start pr-[50px]">
            <span className="text-[#052612] dark:text-white text-[13px] font-bold">
              {userName}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col w-full px-3 flex-1">
        {/* ── Always visible ────────────────────────── */}
        <Link href="/dashboard" className={linkClass('/dashboard')}>
          <span className={iconClass('/dashboard')}>dashboard</span>
          <span className="text-[13px]">Dashboard</span>
        </Link>

        <Link href="/dashboard/jobs" className={linkClass('/dashboard/jobs')}>
          <span className={iconClass('/dashboard/jobs')}>work</span>
          <span className="text-[13px]">Jobs</span>
        </Link>

        {/* ── Full-access only ──────────────────────── */}
        {hasFullAccess && (
          <>
            <Link href="/dashboard/candidates" className={linkClass('/dashboard/candidates')}>
              <span className={iconClass('/dashboard/candidates')}>person_search</span>
              <span className="text-[13px]">Candidates Search</span>
            </Link>

            <Link href="/dashboard/outreach" className={linkClass('/dashboard/outreach')}>
              <span className={iconClass('/dashboard/outreach')}>campaign</span>
              <span className="text-[13px]">Outreach</span>
            </Link>

            <Link href="/dashboard/analytics" className={linkClass('/dashboard/analytics')}>
              <span className={iconClass('/dashboard/analytics')}>analytics</span>
              <span className="text-[13px]">Analytics</span>
            </Link>
          </>
        )}

        {/* ── Admin section ─────────────────────────── */}
        {showAdminSettings && (
          <>
            <div className="flex flex-col items-start py-3 mb-1 w-full mt-auto">
              <div className="bg-[#c2e5ca] dark:bg-emerald-900/60 w-full h-[1px] mb-3"></div>
              <span className="text-[#0f5229]/80 dark:text-emerald-300/80 text-[11px] font-bold px-3 tracking-wider">ADMIN</span>
            </div>

            <Link href="/dashboard/ingestion-monitor" className={linkClass('/dashboard/ingestion-monitor')}>
              <span className={iconClass('/dashboard/ingestion-monitor')}>monitor_heart</span>
              <span className="text-[13px]">Ingestion Monitor</span>
            </Link>

            <Link href="/dashboard/token-monitor" className={linkClass('/dashboard/token-monitor')}>
              <span className={iconClass('/dashboard/token-monitor')}>bar_chart</span>
              <span className="text-[13px]">Token Monitor</span>
            </Link>
          </>
        )}

        <div className={hasFullAccess ? "" : "mt-auto"}></div>

        {/* Settings: full-access only */}
        {hasFullAccess && (
          <Link href="/dashboard/settings" className={linkClass('/dashboard/settings')}>
            <span className={iconClass('/dashboard/settings')}>settings</span>
            <span className="text-[13px]">Settings</span>
          </Link>
        )}

        <ThemeToggle />

        {/* ── Always visible ────────────────────────── */}
        <div onClick={() => toast.info("Help docs coming soon")} className="flex items-center py-1.5 mb-1 rounded-md w-full cursor-pointer text-[#0f5229]/80 dark:text-emerald-100/80 hover:bg-[#0f5229]/10 dark:hover:bg-emerald-500/15 hover:text-[#052612] dark:hover:text-white transition-colors">
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 text-[#0f5229] dark:text-emerald-400">help</span>
          <span className="text-xs font-medium">Help &amp; Docs</span>
        </div>
        <div className="flex items-center py-1.5 rounded-md w-full text-[#0f5229]/80 dark:text-emerald-100/80 hover:bg-[#0f5229]/10 dark:hover:bg-emerald-500/15 hover:text-[#052612] dark:hover:text-white transition-colors cursor-pointer" onClick={() => alert('Sign out clicked')}>
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 text-[#0f5229] dark:text-emerald-400">logout</span>
          <span className="text-xs font-medium">Log out</span>
        </div>
      </div>
    </div>
  );
}

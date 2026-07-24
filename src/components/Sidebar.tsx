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
    `flex items-center py-2 mb-1 rounded-lg w-full cursor-pointer transition-all ${
      isActive(path)
        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-600 dark:border-emerald-400 font-bold text-emerald-800 dark:text-emerald-300 shadow-sm'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-100'
    }`;

  const iconClass = (path: string) =>
    `material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${
      isActive(path) ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'
    }`;

  return (
    <div className="flex flex-col shrink-0 items-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 pb-3 w-64 border-r border-slate-200 dark:border-slate-800/80 h-screen sticky top-0 overflow-y-auto shadow-sm transition-colors duration-200">
      <div className="flex items-center py-4 border-b border-solid border-slate-200 dark:border-slate-800/80 w-full">
        <Link href="/dashboard" className="flex items-center cursor-pointer">
          <span className="flex flex-col shrink-0 items-center bg-emerald-600 dark:bg-emerald-400 text-left py-[5px] px-[11px] ml-5 mr-3 rounded-md shadow-sm">
            <span className="text-white dark:text-slate-950 text-sm font-extrabold">R</span>
          </span>
          <span className="text-slate-800 dark:text-emerald-400 text-base font-extrabold tracking-wide mr-[67px]">
            Career141
          </span>
        </Link>
      </div>
      <div className="flex items-center bg-slate-100 dark:bg-slate-900/40 py-3 mb-2 border-b border-solid border-slate-200 dark:border-slate-800/80 w-full">
        <button
          className="flex flex-col shrink-0 items-start bg-white dark:bg-slate-800 text-left p-[1px] ml-4 mr-3 rounded-[9999px] border border-solid border-slate-200 dark:border-slate-700/50"
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
            <span className="text-slate-800 dark:text-white text-[13px] font-bold">
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
              <div className="bg-slate-200 dark:bg-slate-800 w-full h-[1px] mb-3"></div>
              <span className="text-slate-400 dark:text-slate-500 text-[11px] font-bold px-3 tracking-wider">ADMIN</span>
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
        <div onClick={() => toast.info("Help docs coming soon")} className="flex items-center py-2 mb-1 rounded-lg w-full cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 text-slate-400 dark:text-slate-500">help</span>
          <span className="text-[13px] font-medium">Help &amp; Docs</span>
        </div>
        <div className="flex items-center py-2 rounded-lg w-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer" onClick={() => alert('Sign out clicked')}>
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 text-slate-400 dark:text-slate-500">logout</span>
          <span className="text-[13px] font-medium">Log out</span>
        </div>
      </div>
    </div>
  );
}

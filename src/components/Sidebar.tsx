"use client";

import React from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { useRole } from '@/hooks/useRole';

export default function Sidebar() {
  const { user } = useUser();
  const userName = user?.fullName || user?.firstName || 'User';
  const imageUrl = user?.imageUrl || "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/136f03a3-c845-4fb7-9a5f-2145eae26c62";
  const pathname = usePathname();
  const { isAdmin, isTAManager } = useRole();
  const showAdminSettings = isAdmin || isTAManager;

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path !== '/dashboard' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="flex flex-col shrink-0 items-center bg-background pb-3 w-64 border-r border-border h-screen sticky top-0 overflow-y-auto">
      <div className="flex items-center py-4 border-b border-solid border-b-border w-full">
        <Link href="/dashboard" className="flex items-center cursor-pointer">
          <span className="flex flex-col shrink-0 items-center bg-primary-container text-left py-[5px] px-[11px] ml-5 mr-3 rounded-md">
            <span className="text-on-primary text-sm font-bold">R</span>
          </span>
          <span className="text-primary-container text-base font-bold mr-[67px]">
            Career141
          </span>
        </Link>
      </div>
      <div className="flex items-center bg-surface-container-low py-3 mb-2 border-b border-solid border-b-border w-full">
        <button
          className="flex flex-col shrink-0 items-start bg-surface-container-high text-left p-[1px] ml-4 mr-3 rounded-[9999px] border border-solid border-border"
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
            <span className="text-text-primary text-[13px] font-bold">
              {userName}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col w-full px-3 flex-1">
        <Link href="/dashboard" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard') ? 'bg-emerald-800/10 dark:bg-emerald-500/10 border-l-2 border-emerald-800 dark:border-emerald-500' : 'hover:bg-surface-container-high transition-colors'}`}>
          <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-emerald-900/90 dark:text-text-secondary'}`}>dashboard</span>
          <span className={`${isActive('/dashboard') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-text-secondary'} text-[13px]`}>Dashboard</span>
        </Link>
        <Link href="/dashboard/candidates" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/candidates') ? 'bg-emerald-800/10 dark:bg-emerald-500/10 border-l-2 border-emerald-800 dark:border-emerald-500' : 'hover:bg-surface-container-high transition-colors'}`}>
          <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/candidates') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-emerald-900/90 dark:text-text-secondary'}`}>person_search</span>
          <span className={`${isActive('/dashboard/candidates') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-text-secondary'} text-[13px]`}>Candidates Search</span>
        </Link>
        <Link href="/dashboard/outreach" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/outreach') ? 'bg-emerald-800/10 dark:bg-emerald-500/10 border-l-2 border-emerald-800 dark:border-emerald-500' : 'hover:bg-surface-container-high transition-colors'}`}>
          <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/outreach') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-emerald-900/90 dark:text-text-secondary'}`}>campaign</span>
          <span className={`${isActive('/dashboard/outreach') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-text-secondary'} text-[13px]`}>Outreach</span>
        </Link>
        <Link href="/dashboard/jobs" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/jobs') ? 'bg-emerald-800/10 dark:bg-emerald-500/10 border-l-2 border-emerald-800 dark:border-emerald-500' : 'hover:bg-surface-container-high transition-colors'}`}>
          <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/jobs') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-emerald-900/90 dark:text-text-secondary'}`}>work</span>
          <span className={`${isActive('/dashboard/jobs') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-text-secondary'} text-[13px]`}>Jobs</span>
        </Link>
        <Link href="/dashboard/analytics" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/analytics') ? 'bg-emerald-800/10 dark:bg-emerald-500/10 border-l-2 border-emerald-800 dark:border-emerald-500' : 'hover:bg-surface-container-high transition-colors'}`}>
          <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/analytics') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-emerald-900/90 dark:text-text-secondary'}`}>analytics</span>
          <span className={`${isActive('/dashboard/analytics') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-text-secondary'} text-[13px]`}>Analytics</span>
        </Link>

        {showAdminSettings && (
          <>
            <div className="flex flex-col items-start py-3 mb-1 w-full mt-auto">
              <div className="bg-border w-full h-[1px] mb-3"></div>
              <span className="text-text-disabled text-[11px] font-bold px-3">ADMIN</span>
            </div>
            
            <Link href="/dashboard/ingestion-monitor" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/ingestion-monitor') ? 'bg-emerald-800/10 dark:bg-emerald-500/10 border-l-2 border-emerald-800 dark:border-emerald-500' : 'hover:bg-surface-container-high transition-colors'}`}>
              <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/ingestion-monitor') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-emerald-900/90 dark:text-text-secondary'}`}>monitor_heart</span>
              <span className={`${isActive('/dashboard/ingestion-monitor') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-text-secondary'} text-[13px]`}>Ingestion Monitor</span>
            </Link>

            <Link href="/dashboard/token-monitor" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/token-monitor') ? 'bg-emerald-800/10 dark:bg-emerald-500/10 border-l-2 border-emerald-800 dark:border-emerald-500' : 'hover:bg-surface-container-high transition-colors'}`}>
              <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/token-monitor') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-emerald-900/90 dark:text-text-secondary'}`}>bar_chart</span>
              <span className={`${isActive('/dashboard/token-monitor') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-text-secondary'} text-[13px]`}>Token Monitor</span>
            </Link>
          </>
        )}

        <div className={showAdminSettings ? "" : "mt-auto"}></div>
        <Link href="/dashboard/settings" className={`flex items-center py-2 mb-4 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/settings') ? 'bg-emerald-800/10 dark:bg-emerald-500/10 border-l-2 border-emerald-800 dark:border-emerald-500' : 'hover:bg-surface-container-high transition-colors'}`}>
          <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/settings') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-emerald-900/90 dark:text-text-secondary'}`}>settings</span>
          <span className={`${isActive('/dashboard/settings') ? 'text-emerald-800 dark:text-emerald-400 font-bold' : 'text-text-secondary'} text-[13px]`}>Settings</span>
        </Link>
        
        <ThemeToggle />
        <div onClick={() => toast.info("Help docs coming soon")} className={`flex items-center py-1.5 mb-1 rounded-md w-full cursor-pointer hover:bg-surface-container-high transition-colors`}>
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 text-emerald-900/80 dark:text-text-disabled">help</span>
          <span className="text-text-disabled text-xs">Help & Docs</span>
        </div>
        <div className="flex items-center py-1.5 rounded-md w-full hover:bg-surface-container-high transition-colors cursor-pointer" onClick={() => alert('Sign out clicked')}>
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 text-emerald-900/80 dark:text-text-disabled">logout</span>
          <span className="text-text-disabled text-xs">Log out</span>
        </div>
      </div>
    </div>
  );
}

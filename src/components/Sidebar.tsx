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
  const imageUrl = user?.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 24 24' fill='%231b5e20'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-.85-5.05-2.2.03-1.68 3.37-2.6 5.05-2.6s5.02.92 5.05 2.6C15.8 19.15 14.03 20 12 20z'/%3E%3C/svg%3E";
  const pathname = usePathname();
  const { isAdmin, isTAManager } = useRole();
  const showAdminSettings = isAdmin || isTAManager;

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path !== '/dashboard' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="flex flex-col shrink-0 items-center bg-[#043419] dark:bg-[#021f0e] text-white pb-3 w-64 border-r border-[#085229] dark:border-emerald-900/60 h-screen sticky top-0 overflow-y-auto shadow-lg">
      <div className="flex items-center py-4 border-b border-solid border-[#085229] dark:border-emerald-900/60 w-full">
        <Link href="/dashboard" className="flex items-center cursor-pointer">
          <span className="flex flex-col shrink-0 items-center bg-emerald-400 text-left py-[5px] px-[11px] ml-5 mr-3 rounded-md shadow-md">
            <span className="text-[#043419] text-sm font-extrabold">R</span>
          </span>
          <span className="text-emerald-300 text-base font-extrabold tracking-wide mr-[67px]">
            Career141
          </span>
        </Link>
      </div>
      <div className="flex items-center bg-[#064221] dark:bg-[#042a13] py-3 mb-2 border-b border-solid border-[#085229] dark:border-emerald-900/60 w-full">
        <button
          className="flex flex-col shrink-0 items-start bg-[#085229] text-left p-[1px] ml-4 mr-3 rounded-[9999px] border border-solid border-emerald-500/30"
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
            <span className="text-white text-[13px] font-bold">
              {userName}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col w-full px-3 flex-1">
        <Link href="/dashboard" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard') ? 'bg-emerald-500/25 border-l-4 border-emerald-400 font-bold text-white shadow-sm' : 'text-emerald-100/80 hover:bg-emerald-500/15 hover:text-white'}`}>
          <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard') ? 'text-emerald-300 font-bold' : 'text-emerald-400'}`}>dashboard</span>
          <span className="text-[13px]">Dashboard</span>
        </Link>
        <Link href="/dashboard/candidates" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/candidates') ? 'bg-emerald-500/25 border-l-4 border-emerald-400 font-bold text-white shadow-sm' : 'text-emerald-100/80 hover:bg-emerald-500/15 hover:text-white'}`}>
          <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/candidates') ? 'text-emerald-300 font-bold' : 'text-emerald-400'}`}>person_search</span>
          <span className="text-[13px]">Candidates Search</span>
        </Link>
        <Link href="/dashboard/outreach" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/outreach') ? 'bg-emerald-500/25 border-l-4 border-emerald-400 font-bold text-white shadow-sm' : 'text-emerald-100/80 hover:bg-emerald-500/15 hover:text-white'}`}>
          <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/outreach') ? 'text-emerald-300 font-bold' : 'text-emerald-400'}`}>campaign</span>
          <span className="text-[13px]">Outreach</span>
        </Link>
        <Link href="/dashboard/jobs" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/jobs') ? 'bg-emerald-500/25 border-l-4 border-emerald-400 font-bold text-white shadow-sm' : 'text-emerald-100/80 hover:bg-emerald-500/15 hover:text-white'}`}>
          <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/jobs') ? 'text-emerald-300 font-bold' : 'text-emerald-400'}`}>work</span>
          <span className="text-[13px]">Jobs</span>
        </Link>
        <Link href="/dashboard/analytics" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/analytics') ? 'bg-emerald-500/25 border-l-4 border-emerald-400 font-bold text-white shadow-sm' : 'text-emerald-100/80 hover:bg-emerald-500/15 hover:text-white'}`}>
          <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/analytics') ? 'text-emerald-300 font-bold' : 'text-emerald-400'}`}>analytics</span>
          <span className="text-[13px]">Analytics</span>
        </Link>

        {showAdminSettings && (
          <>
            <div className="flex flex-col items-start py-3 mb-1 w-full mt-auto">
              <div className="bg-[#085229] w-full h-[1px] mb-3"></div>
              <span className="text-emerald-400/70 text-[11px] font-bold px-3 tracking-wider">ADMIN</span>
            </div>
            
            <Link href="/dashboard/ingestion-monitor" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/ingestion-monitor') ? 'bg-emerald-500/25 border-l-4 border-emerald-400 font-bold text-white shadow-sm' : 'text-emerald-100/80 hover:bg-emerald-500/15 hover:text-white'}`}>
              <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/ingestion-monitor') ? 'text-emerald-300 font-bold' : 'text-emerald-400'}`}>monitor_heart</span>
              <span className="text-[13px]">Ingestion Monitor</span>
            </Link>

            <Link href="/dashboard/token-monitor" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/token-monitor') ? 'bg-emerald-500/25 border-l-4 border-emerald-400 font-bold text-white shadow-sm' : 'text-emerald-100/80 hover:bg-emerald-500/15 hover:text-white'}`}>
              <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/token-monitor') ? 'text-emerald-300 font-bold' : 'text-emerald-400'}`}>bar_chart</span>
              <span className="text-[13px]">Token Monitor</span>
            </Link>
          </>
        )}

        <div className={showAdminSettings ? "" : "mt-auto"}></div>
        <Link href="/dashboard/settings" className={`flex items-center py-2 mb-4 rounded-md w-full cursor-pointer transition-all ${isActive('/dashboard/settings') ? 'bg-emerald-500/25 border-l-4 border-emerald-400 font-bold text-white shadow-sm' : 'text-emerald-100/80 hover:bg-emerald-500/15 hover:text-white'}`}>
          <span className={`material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 ${isActive('/dashboard/settings') ? 'text-emerald-300 font-bold' : 'text-emerald-400'}`}>settings</span>
          <span className="text-[13px]">Settings</span>
        </Link>
        
        <ThemeToggle />
        <div onClick={() => toast.info("Help docs coming soon")} className="flex items-center py-1.5 mb-1 rounded-md w-full cursor-pointer text-emerald-200/70 hover:bg-emerald-500/15 hover:text-white transition-colors">
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 text-emerald-400">help</span>
          <span className="text-xs font-medium">Help & Docs</span>
        </div>
        <div className="flex items-center py-1.5 rounded-md w-full text-emerald-200/70 hover:bg-emerald-500/15 hover:text-white transition-colors cursor-pointer" onClick={() => alert('Sign out clicked')}>
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0 text-emerald-400">logout</span>
          <span className="text-xs font-medium">Log out</span>
        </div>
      </div>
    </div>
  );
}

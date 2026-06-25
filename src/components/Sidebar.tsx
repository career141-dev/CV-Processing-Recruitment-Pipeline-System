"use client";

import React from 'react';
import { useUser } from '@clerk/nextjs';
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
        <Link href="/dashboard" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer ${isActive('/dashboard') ? 'bg-surface-container-high' : 'hover:bg-surface-container-high transition-colors'}`}>
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0" style={{color: isActive('/dashboard') ? 'var(--primary-container)' : 'var(--text-secondary)'}}>dashboard</span>
          <span className={`${isActive('/dashboard') ? 'text-primary-container' : 'text-text-secondary'} text-[13px]`}>Dashboard</span>
        </Link>
        <Link href="/dashboard/candidates" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer ${isActive('/dashboard/candidates') ? 'bg-surface-container-high' : 'hover:bg-surface-container-high transition-colors'}`}>
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0" style={{color: isActive('/dashboard/candidates') ? 'var(--primary-container)' : 'var(--text-secondary)'}}>person_search</span>
          <span className={`${isActive('/dashboard/candidates') ? 'text-primary-container' : 'text-text-secondary'} text-[13px]`}>Candidates Search</span>
        </Link>
        <Link href="/dashboard/outreach" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer ${isActive('/dashboard/outreach') ? 'bg-surface-container-high' : 'hover:bg-surface-container-high transition-colors'}`}>
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0" style={{color: isActive('/dashboard/outreach') ? 'var(--primary-container)' : 'var(--text-secondary)'}}>campaign</span>
          <span className={`${isActive('/dashboard/outreach') ? 'text-primary-container' : 'text-text-secondary'} text-[13px]`}>Outreach</span>
        </Link>
        <Link href="/dashboard/jobs" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer ${isActive('/dashboard/jobs') ? 'bg-surface-container-high' : 'hover:bg-surface-container-high transition-colors'}`}>
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0" style={{color: isActive('/dashboard/jobs') ? 'var(--primary-container)' : 'var(--text-secondary)'}}>work</span>
          <span className={`${isActive('/dashboard/jobs') ? 'text-primary-container' : 'text-text-secondary'} text-[13px]`}>Jobs</span>
        </Link>
        <Link href="/dashboard/analytics" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer ${isActive('/dashboard/analytics') ? 'bg-surface-container-high' : 'hover:bg-surface-container-high transition-colors'}`}>
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0" style={{color: isActive('/dashboard/analytics') ? 'var(--primary-container)' : 'var(--text-secondary)'}}>analytics</span>
          <span className={`${isActive('/dashboard/analytics') ? 'text-primary-container' : 'text-text-secondary'} text-[13px]`}>Analytics</span>
        </Link>

        {showAdminSettings && (
          <>
            <div className="flex flex-col items-start py-3 mb-1 w-full mt-auto">
              <div className="bg-border w-full h-[1px] mb-3"></div>
              <span className="text-text-disabled text-[11px] font-bold px-3">ADMIN</span>
            </div>
            
            <Link href="/dashboard/ingestion-monitor" className={`flex items-center py-2 mb-1 rounded-md w-full cursor-pointer ${isActive('/dashboard/ingestion-monitor') ? 'bg-surface-container-high' : 'hover:bg-surface-container-high transition-colors'}`}>
              <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0" style={{color: isActive('/dashboard/ingestion-monitor') ? 'var(--primary-container)' : 'var(--text-secondary)'}}>monitor_heart</span>
              <span className={`${isActive('/dashboard/ingestion-monitor') ? 'text-primary-container' : 'text-text-secondary'} text-[13px]`}>Ingestion Monitor</span>
            </Link>


            <Link href="/dashboard/settings" className={`flex items-center py-2 mb-4 rounded-md w-full cursor-pointer ${isActive('/dashboard/settings') ? 'bg-surface-container-high' : 'hover:bg-surface-container-high transition-colors'}`}>
              <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0" style={{color: isActive('/dashboard/settings') ? 'var(--primary-container)' : 'var(--text-secondary)'}}>settings</span>
              <span className={`${isActive('/dashboard/settings') ? 'text-primary-container' : 'text-text-secondary'} text-[13px]`}>Settings</span>
            </Link>
          </>
        )}
        
        <ThemeToggle />
        <Link href="/dashboard/help" className={`flex items-center py-1.5 mb-1 rounded-md w-full cursor-pointer ${isActive('/dashboard/help') ? 'bg-surface-container-high' : 'hover:bg-surface-container-high transition-colors'}`}>
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0" style={{color: isActive('/dashboard/help') ? 'var(--primary-container)' : 'var(--text-disabled)'}}>help</span>
          <span className={`${isActive('/dashboard/help') ? 'text-primary-container' : 'text-text-disabled'} text-xs`}>Help & Docs</span>
        </Link>
        <div className="flex items-center py-1.5 rounded-md w-full hover:bg-surface-container-high transition-colors cursor-pointer" onClick={() => alert('Sign out clicked')}>
          <span className="material-symbols-outlined ml-3 mr-2 text-[18px] shrink-0" style={{color: 'var(--text-disabled)'}}>logout</span>
          <span className="text-text-disabled text-xs">Log out</span>
        </div>
      </div>
    </div>
  );
}

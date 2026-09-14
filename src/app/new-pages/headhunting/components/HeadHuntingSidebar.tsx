'use client';

import React from 'react';
import { useClerk } from '@clerk/nextjs';
import { toast } from 'sonner';
import {
  Home,
  FileText,
  Search,
  Table,
  HelpCircle,
  LogOut,
  Plus,
  X,
} from 'lucide-react';
import { HeadHuntingTab } from '../types';

interface HeadHuntingSidebarProps {
  activeTab: HeadHuntingTab;
  setActiveTab: (tab: HeadHuntingTab) => void;
  isMobile?: boolean;
  onMobileClose?: () => void;
  activeNavTab?: 'projects' | 'jobs' | 'reports';
  setActiveNavTab?: (tab: 'projects' | 'jobs' | 'reports') => void;
}

export const HeadHuntingSidebar: React.FC<HeadHuntingSidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobile = false,
  onMobileClose,
  activeNavTab,
  setActiveNavTab,
}) => {
  const { signOut } = useClerk();

  const handleHelpClick = () => {
    toast.info('HeadHunting help & documentation coming soon');
  };

  const handleLogoutClick = () => {
    try {
      if (signOut) {
        signOut({ redirectUrl: '/sign-in' });
      } else {
        window.location.href = '/sign-in';
      }
    } catch {
      window.location.href = '/sign-in';
    }
  };

  const handleSelectTab = (tab: HeadHuntingTab) => {
    if (tab !== 'research') {
      toast.info(
        `${tab.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())} UI coming soon`
      );
      return;
    }
    setActiveTab(tab);
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const navItems = [
    { id: 'overview' as const, label: 'Overview', icon: Home },
    { id: 'research' as const, label: 'Research', icon: FileText },
    { id: 'boolean_search' as const, label: 'Boolean search', icon: Search },
    { id: 'excel_tables' as const, label: 'Excel Tables', icon: Table },
  ];

  return (
    <aside
      className={`bg-[#FAFAFA] text-slate-700 flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out z-40 overflow-y-auto overflow-x-hidden border-none shadow-none ${
        isMobile
          ? 'w-72 h-full p-2 bg-[#FAFAFA]'
          : 'sticky top-16 sm:top-18 h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] w-64'
      }`}
      style={{ backgroundColor: '#FAFAFA', border: 'none', boxShadow: 'none' }}
    >
      {/* ── TOP PART: MOBILE HEADER + MAIN NAVIGATION ITEMS ── */}
      <div>
        {/* Mobile Drawer Header */}
        {isMobile && (
          <div className="space-y-2 mb-2">
            <div className="flex items-center justify-between pb-1 px-2 pt-2 border-none">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Career141" className="h-8 sm:h-9 w-auto object-contain" />
              </div>
              <button
                type="button"
                onClick={onMobileClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile 3 Tabs at Top of Drawer */}
            {setActiveNavTab && (
              <div className="grid grid-cols-3 gap-1 px-1 bg-slate-200/60 p-1 rounded-lg">
                {(['projects', 'jobs', 'reports'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setActiveNavTab(tab);
                      if (onMobileClose) onMobileClose();
                    }}
                    className={`py-1.5 text-[13px] font-medium rounded-md capitalize text-center transition-all cursor-pointer ${
                      activeNavTab === tab
                        ? 'bg-white text-[#165B42] font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation Items */}
        <div className="py-2 space-y-1.5 text-[14px] px-1 sm:px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`w-full px-3 py-2.5 flex items-center rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#27323A] text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`}
                />
                <span className="ml-3 text-[14px] whitespace-nowrap overflow-hidden">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── BOTTOM SECTION: HELP, LOGOUT & PLUS ACTION ── */}
      <div className="py-4 space-y-1 text-[14px] px-1 sm:px-2 border-none mt-auto">
        <button
          type="button"
          onClick={handleHelpClick}
          className="w-full px-3 py-2 flex items-center rounded-lg text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 shrink-0 text-slate-400" />
          <span className="ml-3 text-[14px] whitespace-nowrap">Help</span>
        </button>

        <button
          type="button"
          onClick={handleLogoutClick}
          className="w-full px-3 py-2 flex items-center rounded-lg text-[#E02424] hover:bg-red-50/70 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0 text-[#E02424]" />
          <span className="ml-3 text-[14px] whitespace-nowrap font-medium text-[#E02424]">
            Logout Account
          </span>
        </button>

        {/* Action Plus Icon */}
        <div className="pt-3 px-1">
          <button
            type="button"
            onClick={() => toast.info('New HeadHunting task')}
            className="w-8 h-8 rounded-full border border-slate-300/90 text-slate-600 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-200/80 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
            title="Add New"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
          </button>
        </div>
      </div>
    </aside>
  );
};

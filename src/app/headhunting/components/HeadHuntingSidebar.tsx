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
}

export const HeadHuntingSidebar: React.FC<HeadHuntingSidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobile = false,
  onMobileClose,
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
      toast.info(`${tab.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())} UI coming soon`);
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
          ? 'w-72 h-full p-3 bg-[#FAFAFA]'
          : 'sticky top-14 sm:top-16 md:top-18 h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] md:h-[calc(100vh-72px)] w-60 lg:w-64 p-3.5'
      }`}
    >
      {/* ── TOP SECTION: MAIN NAVIGATION ── */}
      <div className="space-y-4">
        {/* Mobile Header with Close Button */}
        {isMobile && (
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-[14px] font-bold text-slate-800">HeadHunting Menu</span>
            <button
              onClick={onMobileClose}
              className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] font-medium transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#27323A] text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── BOTTOM SECTION: HELP, LOGOUT & PLUS ACTION ── */}
      <div className="pt-6 space-y-2 border-t border-slate-200/60 mt-auto">
        <button
          onClick={handleHelpClick}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer text-left"
        >
          <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
          <span>Help</span>
        </button>

        <button
          onClick={handleLogoutClick}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-[13px] font-medium text-[#EF4444] hover:bg-rose-50 transition-colors cursor-pointer text-left"
        >
          <LogOut className="w-4 h-4 text-[#EF4444] shrink-0" />
          <span>Logout Account</span>
        </button>

        {/* Floating / Bottom Action Plus Icon */}
        <div className="pt-4 px-1">
          <button
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

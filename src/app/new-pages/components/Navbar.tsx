'use client';

import React, { useState } from 'react';
import { Search, MoreHorizontal, User, HelpCircle, Menu, X } from 'lucide-react';

interface NavbarProps {
  activeNavTab: 'projects' | 'jobs' | 'reports';
  setActiveNavTab: (tab: 'projects' | 'jobs' | 'reports') => void;
  onBrandClick: () => void;
  onMenuClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeNavTab,
  setActiveNavTab,
  onBrandClick,
  onMenuClick,
}) => {
  const [mobileSearchOpen, setMobileSearchOpen] = useState<boolean>(false);

  return (
    <header
      className="bg-white sticky top-0 z-40 w-full border-none shadow-none"
      style={{ border: 'none', boxShadow: 'none' }}
    >
      <div className="w-full px-4 sm:px-6 h-14 sm:h-16 md:h-18 flex items-center justify-between gap-2">
        {/* Left: Brand Logo on mobile & Brand + 3 Tabs on desktop */}
        <div className="flex items-center gap-4 sm:gap-6 md:gap-8 min-w-0">
          <div
            onClick={onBrandClick}
            className="flex items-center gap-2 cursor-pointer select-none shrink-0"
            title="Career141 Recruiter Desk"
          >
            <img
              src="/logo.png"
              alt="Career141"
              className="h-9 sm:h-11 md:h-13.5 w-auto object-contain transition-transform hover:scale-102"
            />
          </div>

          {/* Desktop 3 Navigation Tabs (Projects, Jobs, Reports) */}
          <nav className="hidden md:flex items-center gap-1 py-1">
            {(['projects', 'jobs', 'reports'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveNavTab(tab)}
                className={`px-3 py-1.5 text-[14px] font-medium rounded-md capitalize transition-colors cursor-pointer whitespace-nowrap ${
                  activeNavTab === tab
                    ? 'text-[#165B42] bg-emerald-50/80 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Global Search & Mobile Menu Trigger (Like Image: Search icon + Hamburger menu on right) */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Desktop Search Input */}
          <div className="relative hidden lg:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Start a new search..."
              className="w-48 xl:w-64 pl-9 pr-3 py-1.5 bg-slate-100/90 border border-[#DDDFE2] rounded-md text-[14px] text-slate-800 placeholder:text-[14px] placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42] transition-all"
            />
          </div>

          {/* Mobile Search Icon Button */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Search"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Mobile Menu Hamburger (on the right, matching LinkedIn Recruiter) */}
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Desktop User Avatar & Tools */}
          <div className="hidden md:flex items-center gap-1 sm:gap-2 text-slate-600">
            <button
              className="hidden sm:inline-flex p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="More Options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            <button
              className="hidden sm:inline-flex p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Admin User"
            >
              <User className="w-5 h-5" />
            </button>
            <button
              className="hidden sm:inline-flex p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <div
              onClick={onBrandClick}
              className="w-8 h-8 rounded-full bg-[#e8be93] flex items-center justify-center font-bold text-amber-900 text-[13px] cursor-pointer select-none"
              title="Nipuni Senanayake (TA Lead)"
            >
              NS
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Mobile Search Bar */}
      {mobileSearchOpen && (
        <div className="lg:hidden px-4 pb-3 pt-1 border-b border-slate-100 animate-in fade-in duration-150">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              placeholder="Search candidates, jobs, skills..."
              className="w-full pl-9 pr-8 py-2 bg-slate-100 border border-[#DDDFE2] rounded-lg text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#165B42]"
            />
            <button
              onClick={() => setMobileSearchOpen(false)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

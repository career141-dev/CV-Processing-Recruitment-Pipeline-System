"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, UserButton } from '@clerk/nextjs';
import { toast } from 'sonner';
import { useRole } from '@/hooks/useRole';
import { ThemeToggle } from './ThemeToggle';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart3,
  HelpCircle,
  Activity,
  Settings,
  BookOpen,
  UserCheck,
  Search,
  ScanLine,
  Mic,
  Bell,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';

export default function TopHeader() {
  const pathname = usePathname();
  const { user } = useUser();
  const userName = user?.fullName || user?.firstName || 'User';

  const {
    isAdmin,
    isTAManager,
    canSearchCandidates,
    canViewAnalytics,
    canViewInquiries,
    canManageSettings,
  } = useRole();
  const showAdminSettings = isAdmin || isTAManager;

  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const candidatesRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or route change
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (candidatesRef.current && !candidatesRef.current.contains(event.target as Node)) {
        setCandidatesOpen(false);
      }
      if (adminRef.current && !adminRef.current.contains(event.target as Node)) {
        setAdminOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setCandidatesOpen(false);
    setAdminOpen(false);
    setMobileDrawerOpen(false);
  }, [pathname]);

  const isCandidatesActive =
    pathname.startsWith('/dashboard/candidates') ||
    pathname.startsWith('/dashboard/cv-scanner') ||
    pathname.startsWith('/dashboard/aura-voice-agent');

  const isAdminActive =
    pathname.startsWith('/dashboard/ingestion-monitor') ||
    pathname.startsWith('/dashboard/settings');

  const isExactActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  const navLinkClass = (isActive: boolean) =>
    `flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13.5px] font-medium transition-all duration-150 cursor-pointer ${
      isActive
        ? 'bg-emerald-100/80 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300 font-semibold shadow-2xs'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
    }`;

  const mobileLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
      isActive
        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300 font-semibold border-l-3 border-emerald-600 dark:border-emerald-400'
        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
    }`;

  return (
    <>
      <header className="sticky top-0 z-40 w-full h-[76px] bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-2xs transition-colors">
        <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 max-w-full">
          {/* Left Section: Brand Logo + Desktop Nav */}
          <div className="flex items-center gap-6 lg:gap-8 min-w-0">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center shrink-0">
              <img
                src="/logo.png"
                alt="Career141"
                className="h-10 w-auto object-contain dark:brightness-110 filter drop-shadow-2xs"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 min-w-0" aria-label="Main Navigation">
              {/* Dashboard */}
              <Link href="/dashboard" className={navLinkClass(isExactActive('/dashboard'))}>
                <LayoutDashboard size={16} className={isExactActive('/dashboard') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} />
                <span>Dashboard</span>
              </Link>

              {/* Jobs */}
              <Link href="/dashboard/jobs" className={navLinkClass(isExactActive('/dashboard/jobs'))}>
                <Briefcase size={16} className={isExactActive('/dashboard/jobs') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} />
                <span>Jobs</span>
              </Link>

              {/* Candidates Dropdown */}
              {canSearchCandidates && (
                <div className="relative" ref={candidatesRef}>
                  <button
                    onClick={() => setCandidatesOpen(!candidatesOpen)}
                    className={`${navLinkClass(isCandidatesActive)} group`}
                    aria-expanded={candidatesOpen}
                  >
                    <Users size={16} className={isCandidatesActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} />
                    <span>Candidates</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${candidatesOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Popover */}
                  {candidatesOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800/80 mb-1">
                        Candidate Tools
                      </div>

                      <Link
                        href="/dashboard/candidates"
                        className={`flex items-start gap-2.5 p-2 rounded-lg text-xs transition-colors ${
                          pathname === '/dashboard/candidates'
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <UserCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-[13px]">Candidate Management</div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Talent profiles and pipeline progress</div>
                        </div>
                      </Link>

                      <Link
                        href="/dashboard/candidates/search"
                        className={`flex items-start gap-2.5 p-2 rounded-lg text-xs transition-colors ${
                          pathname.startsWith('/dashboard/candidates/search')
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Search size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-[13px]">Candidate Search</div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Search database with AI & filters</div>
                        </div>
                      </Link>

                      <Link
                        href="/dashboard/cv-scanner"
                        className={`flex items-start gap-2.5 p-2 rounded-lg text-xs transition-colors ${
                          pathname.startsWith('/dashboard/cv-scanner')
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <ScanLine size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-[13px]">CV Scan</div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Direct upload & rapid AI extraction</div>
                        </div>
                      </Link>

                      <Link
                        href="/dashboard/aura-voice-agent"
                        className={`flex items-start gap-2.5 p-2 rounded-lg text-xs transition-colors ${
                          pathname.startsWith('/dashboard/aura-voice-agent')
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Mic size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-[13px]">Aura Voice Lab</div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">AI voice screening & simulations</div>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Analytics */}
              {canViewAnalytics && (
                <Link href="/dashboard/analytics" className={navLinkClass(isExactActive('/dashboard/analytics'))}>
                  <BarChart3 size={16} className={isExactActive('/dashboard/analytics') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} />
                  <span>Analytics</span>
                </Link>
              )}

              {/* Candidate Inquiries */}
              {canViewInquiries && (
                <Link href="/dashboard/inquiries" className={navLinkClass(isExactActive('/dashboard/inquiries'))}>
                  <HelpCircle size={16} className={isExactActive('/dashboard/inquiries') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} />
                  <span>Inquiries</span>
                </Link>
              )}

              {/* Admin Dropdown / Settings */}
              {(showAdminSettings || canManageSettings) && (
                <div className="relative" ref={adminRef}>
                  <button
                    onClick={() => setAdminOpen(!adminOpen)}
                    className={`${navLinkClass(isAdminActive)} group`}
                    aria-expanded={adminOpen}
                  >
                    <Settings size={16} className={isAdminActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} />
                    <span>Admin</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${adminOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Admin Popover */}
                  {adminOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800/80 mb-1">
                        System & Operations
                      </div>

                      {showAdminSettings && (
                        <Link
                          href="/dashboard/ingestion-monitor"
                          className={`flex items-center gap-2.5 p-2 rounded-lg text-xs transition-colors ${
                            pathname.startsWith('/dashboard/ingestion-monitor')
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Activity size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div className="font-semibold text-[13px]">Ingestion Monitor</div>
                        </Link>
                      )}

                      {canManageSettings && (
                        <Link
                          href="/dashboard/settings"
                          className={`flex items-center gap-2.5 p-2 rounded-lg text-xs transition-colors ${
                            pathname.startsWith('/dashboard/settings')
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Settings size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div className="font-semibold text-[13px]">Settings</div>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>

          {/* Right Section: Utilities, Theme, Notifications & User Avatar */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Help Docs Button */}
            <button
              onClick={() => toast.info('Help documentation coming soon')}
              className="hidden sm:flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors border border-slate-200/80 dark:border-slate-800 cursor-pointer"
              title="Help & Documentation"
              aria-label="Help and Documentation"
            >
              <BookOpen size={17} />
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => toast.info('No new notifications')}
              className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors border border-slate-200/80 dark:border-slate-800 cursor-pointer"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={17} />
            </button>

            {/* Compact Theme Toggle */}
            <ThemeToggle compact={true} />

            {/* User Profile / Clerk UserButton */}
            <div className="flex items-center gap-2.5 pl-1.5 border-l border-slate-200 dark:border-slate-800">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'w-8 h-8 rounded-lg shadow-2xs ring-1 ring-slate-200 dark:ring-slate-700',
                  },
                }}
              />
              <div className="hidden xl:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none truncate max-w-[120px]">
                  {userName}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-tight mt-0.5 truncate max-w-[120px]">
                  {isAdmin ? 'Admin' : isTAManager ? 'TA Lead' : 'Recruiter'}
                </span>
              </div>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden p-2 -mr-1 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-hidden cursor-pointer"
              aria-label="Open mobile navigation menu"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out md:hidden flex flex-col ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Link href="/dashboard" onClick={() => setMobileDrawerOpen(false)} className="flex items-center">
            <img
              src="/logo.png"
              alt="Career141"
              className="h-8 w-auto object-contain dark:brightness-110"
            />
          </Link>
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Info Tile */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-8 h-8',
              },
            }}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
              {userName}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
          </div>
        </div>

        {/* Mobile Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <Link
            href="/dashboard"
            onClick={() => setMobileDrawerOpen(false)}
            className={mobileLinkClass(isExactActive('/dashboard'))}
          >
            <LayoutDashboard size={18} className={isExactActive('/dashboard') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'} />
            <span>Dashboard</span>
          </Link>

          <Link
            href="/dashboard/jobs"
            onClick={() => setMobileDrawerOpen(false)}
            className={mobileLinkClass(isExactActive('/dashboard/jobs'))}
          >
            <Briefcase size={18} className={isExactActive('/dashboard/jobs') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'} />
            <span>Jobs</span>
          </Link>

          {/* Candidates Group */}
          {canSearchCandidates && (
            <div className="pt-2">
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Candidates
              </div>
              <div className="space-y-0.5 mt-1 pl-2">
                <Link
                  href="/dashboard/candidates"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={mobileLinkClass(pathname === '/dashboard/candidates')}
                >
                  <UserCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Management</span>
                </Link>

                <Link
                  href="/dashboard/candidates/search"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={mobileLinkClass(pathname.startsWith('/dashboard/candidates/search'))}
                >
                  <Search size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Search</span>
                </Link>

                <Link
                  href="/dashboard/cv-scanner"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={mobileLinkClass(pathname.startsWith('/dashboard/cv-scanner'))}
                >
                  <ScanLine size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>CV Scan</span>
                </Link>

                <Link
                  href="/dashboard/aura-voice-agent"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={mobileLinkClass(pathname.startsWith('/dashboard/aura-voice-agent'))}
                >
                  <Mic size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Aura Voice Lab</span>
                </Link>
              </div>
            </div>
          )}

          {/* Analytics */}
          {canViewAnalytics && (
            <Link
              href="/dashboard/analytics"
              onClick={() => setMobileDrawerOpen(false)}
              className={mobileLinkClass(isExactActive('/dashboard/analytics'))}
            >
              <BarChart3 size={18} className={isExactActive('/dashboard/analytics') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'} />
              <span>Analytics</span>
            </Link>
          )}

          {/* Inquiries */}
          {canViewInquiries && (
            <Link
              href="/dashboard/inquiries"
              onClick={() => setMobileDrawerOpen(false)}
              className={mobileLinkClass(isExactActive('/dashboard/inquiries'))}
            >
              <HelpCircle size={18} className={isExactActive('/dashboard/inquiries') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'} />
              <span>Inquiries</span>
            </Link>
          )}

          {/* Admin Section */}
          {(showAdminSettings || canManageSettings) && (
            <div className="pt-2">
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Admin
              </div>
              <div className="space-y-0.5 mt-1 pl-2">
                {showAdminSettings && (
                  <Link
                    href="/dashboard/ingestion-monitor"
                    onClick={() => setMobileDrawerOpen(false)}
                    className={mobileLinkClass(pathname.startsWith('/dashboard/ingestion-monitor'))}
                  >
                    <Activity size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Ingestion Monitor</span>
                  </Link>
                )}

                {canManageSettings && (
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setMobileDrawerOpen(false)}
                    className={mobileLinkClass(pathname.startsWith('/dashboard/settings'))}
                  >
                    <Settings size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Settings</span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Drawer Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <ThemeToggle />
          <button
            onClick={() => {
              setMobileDrawerOpen(false);
              toast.info('Help documentation coming soon');
            }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
          >
            <BookOpen size={16} />
            <span>Help &amp; Documentation</span>
          </button>
        </div>
      </div>
    </>
  );
}

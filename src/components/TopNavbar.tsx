"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, UserButton } from '@clerk/nextjs';
import { useRole } from '@/hooks/useRole';
import { ThemeToggle } from './ThemeToggle';
import { toast } from 'sonner';
import {
  Menu,
  X,
  Search,
  ChevronDown,
  MessageSquare,
  Bell,
  HelpCircle,
  UserCheck,
  ScanLine,
  Mic,
  LayoutDashboard,
  Briefcase,
  BarChart3,
  Building2,
  Settings,
  BookOpen
} from 'lucide-react';

export default function TopNavbar() {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const {
    canSearchCandidates,
    canViewAnalytics,
    canViewInquiries,
    canManageSettings
  } = useRole();

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [candidatesDropdownOpen, setCandidatesDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openCandidates  = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setCandidatesDropdownOpen(true);
  };
  const closeCandidates = () => {
    closeTimerRef.current = setTimeout(() => setCandidatesDropdownOpen(false), 150);
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCandidatesDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setCandidatesDropdownOpen(false);
  }, [pathname]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/dashboard/candidates/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path !== '/dashboard' && pathname.startsWith(path)) return true;
    return false;
  };

  const isCandidatesActive =
    pathname.startsWith('/dashboard/candidates') ||
    pathname.startsWith('/dashboard/cv-scanner') ||
    pathname.startsWith('/dashboard/aura-voice-agent');

  return (
    <header className="sticky top-0 z-40 w-full bg-surface border-b border-border shadow-2xs">
      <div className="mx-auto flex h-14 items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4">
        {/* Left Section: Mobile Menu Toggle + Brand + Main Nav */}
        <div className="flex items-center gap-1 sm:gap-6 min-w-0">
          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 -ml-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container-high transition-colors focus:outline-hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center shrink-0 group">
            <img
              src="/logo.png"
              alt="Career141"
              className="h-8 w-auto object-contain dark:brightness-110 filter drop-shadow-xs transition-transform group-hover:scale-102"
            />
          </Link>

          {/* Desktop Horizontal Navigation Links */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 ml-2">
            {/* Dashboard */}
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 rounded-md text-[14.5px] transition-all relative ${
                isActive('/dashboard')
                  ? 'text-emerald-700 dark:text-emerald-400 font-medium after:absolute after:bottom-[-10px] after:left-2.5 after:right-2.5 after:h-[2px] after:bg-emerald-600 dark:after:bg-emerald-400 after:rounded-full'
                  : 'text-slate-500 dark:text-slate-400 font-normal hover:text-slate-800 dark:hover:text-slate-200 hover:bg-surface-container-high/60'
              }`}
            >
              Dashboard
            </Link>

            {/* Clients */}
            <Link
              href="/dashboard/clients"
              className={`px-3 py-1.5 rounded-md text-[14.5px] transition-all relative ${
                isActive('/dashboard/clients')
                  ? 'text-emerald-700 dark:text-emerald-400 font-medium after:absolute after:bottom-[-10px] after:left-2.5 after:right-2.5 after:h-[2px] after:bg-emerald-600 dark:after:bg-emerald-400 after:rounded-full'
                  : 'text-slate-500 dark:text-slate-400 font-normal hover:text-slate-800 dark:hover:text-slate-200 hover:bg-surface-container-high/60'
              }`}
            >
              Clients
            </Link>

            {/* Jobs */}
            <Link
              href="/dashboard/jobs"
              className={`px-3 py-1.5 rounded-md text-[14.5px] transition-all relative ${
                isActive('/dashboard/jobs')
                  ? 'text-emerald-700 dark:text-emerald-400 font-medium after:absolute after:bottom-[-10px] after:left-2.5 after:right-2.5 after:h-[2px] after:bg-emerald-600 dark:after:bg-emerald-400 after:rounded-full'
                  : 'text-slate-500 dark:text-slate-400 font-normal hover:text-slate-800 dark:hover:text-slate-200 hover:bg-surface-container-high/60'
              }`}
            >
              Jobs
            </Link>

            {/* Candidates Dropdown */}
            {canSearchCandidates && (
              <div
                ref={dropdownRef}
                className="relative"
                onMouseEnter={openCandidates}
                onMouseLeave={closeCandidates}
              >
                <button
                  type="button"
                  onClick={() => setCandidatesDropdownOpen(!candidatesDropdownOpen)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[14.5px] transition-all relative cursor-pointer ${
                    isCandidatesActive
                      ? 'text-emerald-700 dark:text-emerald-400 font-medium after:absolute after:bottom-[-10px] after:left-2.5 after:right-2.5 after:h-[2px] after:bg-emerald-600 dark:after:bg-emerald-400 after:rounded-full'
                      : 'text-slate-500 dark:text-slate-400 font-normal hover:text-slate-800 dark:hover:text-slate-200 hover:bg-surface-container-high/60'
                  }`}
                >
                  <span>Candidates</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${candidatesDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Candidates Dropdown Menu */}
                {candidatesDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-56 rounded-xl bg-surface border border-border shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <Link
                      href="/dashboard/candidates"
                      className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors ${
                        pathname === '/dashboard/candidates'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary'
                      }`}
                    >
                      <UserCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Candidate Management
                    </Link>
                    <Link
                      href="/dashboard/candidates/search"
                      className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors ${
                        pathname.startsWith('/dashboard/candidates/search')
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary'
                      }`}
                    >
                      <Search size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Candidate Search
                    </Link>
                    <Link
                      href="/dashboard/cv-scanner"
                      className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors ${
                        pathname.startsWith('/dashboard/cv-scanner')
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary'
                      }`}
                    >
                      <ScanLine size={16} className="text-emerald-600 dark:text-emerald-400" />
                      CV Scan
                    </Link>
                    <Link
                      href="/dashboard/aura-voice-agent"
                      className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors ${
                        pathname.startsWith('/dashboard/aura-voice-agent')
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary'
                      }`}
                    >
                      <Mic size={16} className="text-emerald-600 dark:text-emerald-400" />
                      Aura Voice Lab
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Analytics */}
            {canViewAnalytics && (
              <Link
                href="/dashboard/analytics"
                className={`px-3 py-1.5 rounded-md text-[14.5px] transition-all relative ${
                  isActive('/dashboard/analytics')
                    ? 'text-emerald-700 dark:text-emerald-400 font-medium after:absolute after:bottom-[-10px] after:left-2.5 after:right-2.5 after:h-[2px] after:bg-emerald-600 dark:after:bg-emerald-400 after:rounded-full'
                    : 'text-slate-500 dark:text-slate-400 font-normal hover:text-slate-800 dark:hover:text-slate-200 hover:bg-surface-container-high/60'
                }`}
              >
                Analytics
              </Link>
            )}

            {/* Settings */}
            <Link
              href="/dashboard/settings"
              className={`px-3 py-1.5 rounded-md text-[14.5px] transition-all relative ${
                isActive('/dashboard/settings')
                  ? 'text-emerald-700 dark:text-emerald-400 font-medium after:absolute after:bottom-[-10px] after:left-2.5 after:right-2.5 after:h-[2px] after:bg-emerald-600 dark:after:bg-emerald-400 after:rounded-full'
                  : 'text-slate-500 dark:text-slate-400 font-normal hover:text-slate-800 dark:hover:text-slate-200 hover:bg-surface-container-high/60'
              }`}
            >
              Settings
            </Link>
          </nav>
        </div>

        {/* Right Section: Quick Search + Actions + Theme + Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Quick Search Bar (LinkedIn Recruiter style) */}
          <form onSubmit={handleSearchSubmit} className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Start a new search..."
              className="h-8 w-40 md:w-52 lg:w-68 pl-8 pr-3 py-1 bg-surface-container-high/60 hover:bg-surface-container-high focus:bg-surface text-xs text-text-primary placeholder:text-text-secondary rounded-md border border-border focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </form>

          {/* Messaging / Inquiries Action Icon */}
          {canViewInquiries && (
            <Link
              href="/dashboard/inquiries"
              className={`p-2 rounded-lg transition-colors relative ${
                isActive('/dashboard/inquiries')
                  ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-container-high'
              }`}
              title="Candidate Inquiries"
            >
              <MessageSquare size={18} />
            </Link>
          )}

          {/* Notifications Bell */}
          <button
            type="button"
            onClick={() => toast.info("No new notifications")}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container-high transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell size={18} />
            {/* Notification badge dot */}
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-surface" />
          </button>

          {/* Help Icon with Red Badge (matching reference) */}
          <button
            type="button"
            onClick={() => toast.info("Career141 Documentation & Support")}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container-high transition-colors relative cursor-pointer"
            title="Help & Documentation"
          >
            <HelpCircle size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-600 ring-2 ring-surface" />
          </button>

          {/* Theme Toggle (Compact) */}
          <div className="flex items-center">
            <ThemeToggle compact />
          </div>

          {/* User Profile Avatar */}
          <div className="flex items-center pl-1 border-l border-border ml-1">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8 rounded-full ring-1 ring-border',
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Mobile Drawer (Slide-out menu for smaller screens) */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-border shadow-2xl p-4 flex flex-col justify-between md:hidden animate-in slide-in-from-left duration-250">
            <div className="flex flex-col gap-4">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <Link href="/dashboard" className="flex items-center">
                  <img src="/logo.png" alt="Career141" className="h-8 w-auto object-contain" />
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container-high transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mobile Search */}
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Start a new search..."
                  className="h-9 w-full pl-8 pr-3 py-1.5 bg-surface-container-high/60 text-xs text-text-primary placeholder:text-text-secondary rounded-md border border-border focus:outline-hidden"
                />
              </form>

              {/* Mobile Links */}
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[60vh]">
                <Link
                  href="/dashboard"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive('/dashboard')
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                      : 'text-text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  <LayoutDashboard size={18} />
                  Dashboard
                </Link>

                <Link
                  href="/dashboard/clients"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive('/dashboard/clients')
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                      : 'text-text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  <Building2 size={18} />
                  Clients
                </Link>

                <Link
                  href="/dashboard/jobs"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive('/dashboard/jobs')
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                      : 'text-text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  <Briefcase size={18} />
                  Jobs
                </Link>

                {canSearchCandidates && (
                  <div className="flex flex-col gap-0.5 pt-1">
                    <span className="text-[11px] font-bold text-text-tertiary px-3 pt-2 uppercase tracking-wider">
                      Candidates
                    </span>
                    <Link
                      href="/dashboard/candidates"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:bg-surface-container-high"
                    >
                      <UserCheck size={18} />
                      Candidate Management
                    </Link>
                    <Link
                      href="/dashboard/candidates/search"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:bg-surface-container-high"
                    >
                      <Search size={18} />
                      Candidate Search
                    </Link>
                    <Link
                      href="/dashboard/cv-scanner"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:bg-surface-container-high"
                    >
                      <ScanLine size={18} />
                      CV Scan
                    </Link>
                    <Link
                      href="/dashboard/aura-voice-agent"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:bg-surface-container-high"
                    >
                      <Mic size={18} />
                      Aura Voice Lab
                    </Link>
                  </div>
                )}

                {canViewAnalytics && (
                  <Link
                    href="/dashboard/analytics"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isActive('/dashboard/analytics')
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'text-text-secondary hover:bg-surface-container-high'
                    }`}
                  >
                    <BarChart3 size={18} />
                    Analytics
                  </Link>
                )}

                {canViewInquiries && (
                  <Link
                    href="/dashboard/inquiries"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isActive('/dashboard/inquiries')
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'text-text-secondary hover:bg-surface-container-high'
                    }`}
                  >
                    <MessageSquare size={18} />
                    Inquiries
                  </Link>
                )}

                <Link
                  href="/dashboard/settings"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive('/dashboard/settings')
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                      : 'text-text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  <Settings size={18} />
                  Settings
                </Link>
              </div>
            </div>

            {/* Mobile Drawer Footer */}
            <div className="pt-3 border-t border-border flex flex-col gap-2">
              <ThemeToggle />
              <div
                onClick={() => toast.info("Help docs coming soon")}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:bg-surface-container-high cursor-pointer"
              >
                <BookOpen size={18} />
                Help & Docs
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}

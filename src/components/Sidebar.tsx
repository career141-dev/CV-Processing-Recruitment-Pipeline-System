import React from 'react';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { useRole } from '@/hooks/useRole';
import { 
  Pin, 
  PinOff, 
  ChevronDown, 
  ChevronRight, 
  Users, 
  LayoutDashboard, 
  Briefcase, 
  Megaphone, 
  BarChart3, 
  HelpCircle, 
  Activity, 
  Settings, 
  BookOpen, 
  LogOut,
  UserCheck,
  Search,
  ScanLine
} from 'lucide-react';

export default function Sidebar() {
  const { user } = useUser();
  const userName = user?.fullName || user?.firstName || 'User';
  const imageUrl = user?.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 24 24' fill='%231b5e20'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-.85-5.05-2.2.03-1.68 3.37-2.6 5.05-2.6s5.02.92 5.05 2.6C15.8 19.15 14.03 20 12 20z'/%3E%3C/svg%3E";
  const pathname = usePathname();
  const { 
    isAdmin, 
    isTAManager, 
    hasFullAccess, 
    canSearchCandidates, 
    canAccessOutreach, 
    canViewAnalytics, 
    canViewInquiries, 
    canManageSettings 
  } = useRole();
  const showAdminSettings = isAdmin || isTAManager;

  const [isPinned, setIsPinned] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem('sidebar-pinned');
    if (saved === 'true') {
      setIsPinned(true);
    }
  }, []);

  const togglePin = () => {
    const nextState = !isPinned;
    setIsPinned(nextState);
    localStorage.setItem('sidebar-pinned', String(nextState));
  };

  const isExpanded = isPinned || isHovered;

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path !== '/dashboard' && pathname.startsWith(path)) return true;
    return false;
  };

  const linkClass = (path: string) =>
    `flex items-center py-2 mb-1 rounded-lg w-full cursor-pointer transition-all group relative ${
      !isExpanded ? 'justify-center px-0' : 'px-3'
    } ${
      isActive(path)
        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-600 dark:border-emerald-400 font-bold text-emerald-800 dark:text-emerald-300 shadow-sm'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-100'
    }`;

  const renderIcon = (path: string) => {
    const active = isActive(path);
    const cls = `w-[18px] h-[18px] shrink-0 transition-all ${
      !isExpanded ? 'mx-auto' : 'ml-3 mr-2.5'
    } ${
      active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
    }`;

    switch (path) {
      case '/dashboard': return <LayoutDashboard className={cls} />;
      case '/dashboard/jobs': return <Briefcase className={cls} />;
      case '/dashboard/candidates': return <Users className={cls} />;
      case '/dashboard/outreach': return <Megaphone className={cls} />;
      case '/dashboard/analytics': return <BarChart3 className={cls} />;
      case '/dashboard/inquiries': return <HelpCircle className={cls} />;
      case '/dashboard/ingestion-monitor': return <Activity className={cls} />;
      case '/dashboard/settings': return <Settings className={cls} />;
      case '/help': return <BookOpen className={cls} />;
      case '/logout': return <LogOut className={cls} />;
      default: return <LayoutDashboard className={cls} />;
    }
  };

  const labelClass = `text-[13px] whitespace-nowrap transition-all duration-300 overflow-hidden ${
    !isExpanded ? 'opacity-0 w-0 pointer-events-none' : 'opacity-100 w-auto'
  }`;

  const renderTooltip = (label: string) => {
    if (isExpanded) return null;
    return (
      <div className="absolute left-20 pl-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 pointer-events-none z-50">
        <div className="bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold px-2 py-1 rounded shadow-md whitespace-nowrap border border-slate-700/50">
          {label}
        </div>
      </div>
    );
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`flex flex-col shrink-0 items-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 pb-3 border-r border-slate-200 dark:border-slate-800/80 h-screen sticky top-0 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out z-40 ${
        isExpanded 
          ? 'w-64 shadow-2xl dark:shadow-black/60' 
          : 'w-[68px] shadow-sm'
      }`}
    >
      <div className={`flex items-center py-4 border-b border-solid border-slate-200 dark:border-slate-800/80 w-full ${!isExpanded ? 'justify-center' : 'justify-between px-3'}`}>
        {isExpanded ? (
          <Link href="/dashboard" className="flex items-center cursor-pointer ml-1">
            <img
              src="/Artboard 4@2x 5.png"
              alt="Career141"
              className="h-9 w-auto max-w-[170px] object-contain dark:brightness-110 filter drop-shadow-sm"
            />
          </Link>
        ) : (
          <Link href="/dashboard" className="flex items-center justify-center cursor-pointer">
            <div className="w-9 h-9 overflow-hidden rounded-md flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-0.5 shadow-sm">
              <img
                src="/Artboard 4@2x 5.png"
                alt="Career141"
                className="h-7 w-auto object-cover object-left dark:brightness-110"
              />
            </div>
          </Link>
        )}
        
        {isExpanded && (
          <button 
            onClick={togglePin}
            className={`p-1.5 rounded-lg border shadow-sm transition-colors cursor-pointer ${
              isPinned
                ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title={isPinned ? "Unpin Sidebar (Auto-collapse on mouse leave)" : "Pin Sidebar (Keep expanded)"}
          >
            {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
          </button>
        )}
      </div>

      <div className={`flex items-center bg-slate-100 dark:bg-slate-900/40 py-3 mb-2 border-b border-solid border-slate-200 dark:border-slate-800/80 w-full transition-all duration-300 ${!isExpanded ? 'justify-center' : 'px-4'}`}>
        <button
          className="flex flex-col shrink-0 items-start bg-white dark:bg-slate-800 text-left p-[1px] rounded-[9999px] border border-solid border-slate-200 dark:border-slate-700/50"
          onClick={() => alert('Pressed!')}
        >
          <img
            src={imageUrl}
            className="w-[34px] h-[34px] rounded-[9999px] object-cover"
            alt="Profile"
          />
        </button>
        {isExpanded && (
          <div className="flex flex-col shrink-0 items-start ml-3">
            <span className="text-slate-800 dark:text-white text-[13px] font-bold">
              {userName}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col w-full px-3 flex-1">
        {/* ── Always visible ────────────────────────── */}
        <Link href="/dashboard" className={linkClass('/dashboard')}>
          {renderIcon('/dashboard')}
          <span className={labelClass}>Dashboard</span>
          {renderTooltip("Dashboard")}
        </Link>

        <Link href="/dashboard/jobs" className={linkClass('/dashboard/jobs')}>
          {renderIcon('/dashboard/jobs')}
          <span className={labelClass}>Jobs</span>
          {renderTooltip("Jobs")}
        </Link>

        {/* ── Candidates Dropdown (Consolidated Candidate Management, Search & CV Scanner) ────── */}
        {canSearchCandidates && (
          <CandidatesDropdown
            pathname={pathname}
            isExpanded={isExpanded}
            linkClass={linkClass}
            renderIcon={renderIcon}
            labelClass={labelClass}
            renderTooltip={renderTooltip}
          />
        )}

        {/* ── Outreach, Analytics & Inquiries ──────────────────────── */}
        {canAccessOutreach && (
          <Link href="/dashboard/outreach" className={linkClass('/dashboard/outreach')}>
            {renderIcon('/dashboard/outreach')}
            <span className={labelClass}>Outreach</span>
            {renderTooltip("Outreach")}
          </Link>
        )}

        {canViewAnalytics && (
          <Link href="/dashboard/analytics" className={linkClass('/dashboard/analytics')}>
            {renderIcon('/dashboard/analytics')}
            <span className={labelClass}>Analytics</span>
            {renderTooltip("Analytics")}
          </Link>
        )}

        {canViewInquiries && (
          <Link href="/dashboard/inquiries" className={linkClass('/dashboard/inquiries')}>
            {renderIcon('/dashboard/inquiries')}
            <span className={labelClass}>Candidate Inquiries</span>
            {renderTooltip("Candidate Inquiries")}
          </Link>
        )}

        {/* ── Admin section ─────────────────────────── */}
        {showAdminSettings && (
          <>
            <div className="flex flex-col items-start py-3 mb-1 w-full mt-auto">
              <div className="bg-slate-200 dark:bg-slate-800 w-full h-[1px] mb-3"></div>
              {isExpanded && (
                <span className="text-slate-400 dark:text-slate-500 text-[11px] font-bold px-3 tracking-wider transition-opacity duration-300">ADMIN</span>
              )}
            </div>

            <Link href="/dashboard/ingestion-monitor" className={linkClass('/dashboard/ingestion-monitor')}>
              {renderIcon('/dashboard/ingestion-monitor')}
              <span className={labelClass}>Ingestion Monitor</span>
              {renderTooltip("Ingestion Monitor")}
            </Link>
          </>
        )}

        <div className={hasFullAccess || canAccessOutreach ? "" : "mt-auto"}></div>

        {/* Settings: Admin only */}
        {canManageSettings && (
          <Link href="/dashboard/settings" className={linkClass('/dashboard/settings')}>
            {renderIcon('/dashboard/settings')}
            <span className={labelClass}>Settings</span>
            {renderTooltip("Settings")}
          </Link>
        )}

        {isExpanded && (
          <div className="w-full my-1">
            <ThemeToggle />
          </div>
        )}

        {/* ── Always visible ────────────────────────── */}
        <div onClick={() => toast.info("Help docs coming soon")} className="flex items-center py-2 mb-1 rounded-lg w-full cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-100 transition-colors group relative">
          {renderIcon('/help')}
          <span className={labelClass}>Help &amp; Docs</span>
          {renderTooltip("Help & Docs")}
        </div>
        <div className="flex items-center py-2 rounded-lg w-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer group relative" onClick={() => alert('Sign out clicked')}>
          {renderIcon('/logout')}
          <span className={labelClass}>Log out</span>
          {renderTooltip("Log out")}
        </div>
      </div>
    </div>
  );
}

interface CandidatesDropdownProps {
  pathname: string;
  isExpanded: boolean;
  linkClass: (path: string) => string;
  renderIcon: (path: string) => React.ReactNode;
  labelClass: string;
  renderTooltip: (label: string) => React.ReactNode;
}

function CandidatesDropdown({
  pathname,
  isExpanded,
  linkClass,
  renderIcon,
  labelClass,
  renderTooltip,
}: CandidatesDropdownProps) {
  const isCandidateRoute =
    pathname.startsWith('/dashboard/candidates') || pathname.startsWith('/dashboard/cv-scanner');

  const [isOpen, setIsOpen] = React.useState<boolean>(isCandidateRoute);
  const [isHovered, setIsHovered] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (isCandidateRoute) {
      setIsOpen(true);
    }
  }, [pathname, isCandidateRoute]);

  const subItemClass = (path: string) => {
    let isActiveItem = false;
    if (path === '/dashboard/candidates') {
      isActiveItem = pathname === '/dashboard/candidates';
    } else if (path === '/dashboard/candidates/search') {
      isActiveItem = pathname.startsWith('/dashboard/candidates/search');
    } else if (path === '/dashboard/cv-scanner') {
      isActiveItem = pathname.startsWith('/dashboard/cv-scanner');
    }

    return `flex items-center py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
      isActiveItem
        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold border-l-2 border-emerald-600 dark:border-emerald-400'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
    }`;
  };

  return (
    <div
      className="w-full relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Parent Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center py-2 mb-1 rounded-lg w-full cursor-pointer transition-all group relative ${
          !isExpanded ? 'justify-center px-0' : 'px-3'
        } ${
          isCandidateRoute
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-600 dark:border-emerald-400 font-bold text-emerald-800 dark:text-emerald-300 shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        {renderIcon('/dashboard/candidates')}
        <span className={labelClass}>Candidates</span>

        {isExpanded && (
          <span className="ml-auto text-slate-400 dark:text-slate-500">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        )}

        {renderTooltip('Candidates')}
      </div>

      {/* Inline Submenu (when sidebar is expanded) */}
      {isExpanded && isOpen && (
        <div className="pl-8 pr-2 space-y-1 mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <Link href="/dashboard/candidates" className={subItemClass('/dashboard/candidates')}>
            <UserCheck className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400 shrink-0" />
            Candidate Management
          </Link>
          <Link href="/dashboard/candidates/search" className={subItemClass('/dashboard/candidates/search')}>
            <Search className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400 shrink-0" />
            Candidate Search
          </Link>
          <Link href="/dashboard/cv-scanner" className={subItemClass('/dashboard/cv-scanner')}>
            <ScanLine className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400 shrink-0" />
            CV Scan
          </Link>
        </div>
      )}

      {/* Floating Hover Flyout Menu (when sidebar is collapsed) */}
      {!isExpanded && isHovered && (
        <div className="absolute left-[70px] top-0 z-50 bg-slate-900 dark:bg-slate-800 text-white rounded-xl shadow-2xl p-2 border border-slate-700/60 w-56 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400 px-2 py-1 border-b border-slate-800 dark:border-slate-700/60 mb-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            Candidates
          </div>
          <div className="space-y-1">
            <Link
              href="/dashboard/candidates"
              className="flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white dark:hover:bg-slate-700/70 transition-colors"
            >
              <UserCheck className="w-4 h-4 mr-2 text-emerald-400 shrink-0" />
              Candidate Management
            </Link>
            <Link
              href="/dashboard/candidates/search"
              className="flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white dark:hover:bg-slate-700/70 transition-colors"
            >
              <Search className="w-4 h-4 mr-2 text-emerald-400 shrink-0" />
              Candidate Search
            </Link>
            <Link
              href="/dashboard/cv-scanner"
              className="flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white dark:hover:bg-slate-700/70 transition-colors"
            >
              <ScanLine className="w-4 h-4 mr-2 text-emerald-400 shrink-0" />
              CV Scan
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

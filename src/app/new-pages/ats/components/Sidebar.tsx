'use client';

import React from 'react';
import { useClerk } from '@clerk/nextjs';
import { toast } from 'sonner';
import {
  Home,
  BarChart2,
  ChevronDown,
  ChevronUp,
  User,
  FileText,
  Calendar,
  HelpCircle,
  LogOut,
  X,
} from 'lucide-react';
import { PIPELINE_SUB_STAGES, INITIAL_CANDIDATES } from '../mock-data';
import { MockCandidate } from '../types';

interface SidebarProps {
  isExpanded?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  activeSidebarStage: string;
  setActiveSidebarStage: (stage: string) => void;
  isPipelineExpanded: boolean;
  setIsPipelineExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  candidates?: MockCandidate[];
  isMobile?: boolean;
  onMobileClose?: () => void;
  activeNavTab?: 'projects' | 'jobs' | 'reports';
  setActiveNavTab?: (tab: 'projects' | 'jobs' | 'reports') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isExpanded = true,
  onMouseEnter,
  onMouseLeave,
  activeSidebarStage,
  setActiveSidebarStage,
  isPipelineExpanded,
  setIsPipelineExpanded,
  candidates = INITIAL_CANDIDATES,
  isMobile = false,
  onMobileClose,
  activeNavTab,
  setActiveNavTab,
}) => {
  const { signOut } = useClerk();

  const handleHelpClick = () => {
    toast.info('Help docs coming soon');
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
  const isPipelineActive =
    activeSidebarStage.startsWith('pipeline') ||
    PIPELINE_SUB_STAGES.some((s) => s.id === activeSidebarStage);

  // Always expanded view on all screens
  const expanded = true;

  const handleSelectStage = (stageId: string) => {
    setActiveSidebarStage(stageId);
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const renderTooltip = (label: string) => {
    if (expanded) return null;
    return (
      <div className="absolute left-16 pl-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 pointer-events-none z-50">
        <div className="bg-[#27323A] text-white text-[14px] font-medium px-2.5 py-1.5 rounded shadow-lg whitespace-nowrap border border-slate-700">
          {label}
        </div>
      </div>
    );
  };

  return (
    <aside
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`bg-[#FAFAFA] text-slate-700 flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out z-40 overflow-y-auto overflow-x-hidden border-none shadow-none ${
        isMobile
          ? 'w-72 h-full p-2 bg-[#FAFAFA]'
          : 'sticky top-16 sm:top-18 h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] w-64'
      }`}
      style={{ backgroundColor: '#FAFAFA', border: 'none', boxShadow: 'none' }}
    >
      {/* Top Part: Mobile Header + Main Navigation Items */}
      <div>
        {/* Mobile Drawer Header */}
        {isMobile && (
          <div className="space-y-2 mb-2">
            <div className="flex items-center justify-between pb-1 px-2 pt-2 border-none">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Career141" className="h-8 sm:h-9 w-auto object-contain" />
              </div>
              <button
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

        <div className="py-2 space-y-1.5 text-[14px] px-1 sm:px-2">
          {/* Overview Navigation Item */}
          <button
            onClick={() => handleSelectStage('overview')}
            className={`transition-all group relative cursor-pointer ${
              !expanded
                ? 'w-10 h-10 mx-auto flex items-center justify-center rounded-lg'
                : 'w-full px-3 py-2.5 flex items-center rounded-lg'
            } ${
              activeSidebarStage === 'overview'
                ? 'bg-[#27323A] text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <Home
              className={`w-4 h-4 shrink-0 ${
                activeSidebarStage === 'overview' ? 'text-white' : 'text-slate-500'
              }`}
            />
            {expanded && (
              <span className="ml-3 text-[14px] whitespace-nowrap overflow-hidden">
                Overview
              </span>
            )}
            {renderTooltip('Overview')}
          </button>

          {/* Pipeline Dropdown */}
          <div className="relative">
            <button
              onClick={() => expanded && setIsPipelineExpanded(!isPipelineExpanded)}
              className={`transition-all group relative cursor-pointer ${
                !expanded
                  ? 'w-10 h-10 mx-auto flex items-center justify-center rounded-lg'
                  : 'w-full px-3 py-2.5 flex items-center justify-between rounded-lg'
              } ${
                isPipelineActive
                  ? 'bg-[#27323A] text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center">
                <BarChart2
                  className={`w-4 h-4 shrink-0 ${
                    isPipelineActive ? 'text-white' : 'text-slate-500'
                  }`}
                />
                {expanded && (
                  <span className="ml-3 text-[14px] whitespace-nowrap overflow-hidden">
                    Pipeline
                  </span>
                )}
              </div>
              {expanded && (
                <div>
                  {isPipelineExpanded ? (
                    <ChevronUp
                      className={`w-3.5 h-3.5 ${
                        isPipelineActive ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    />
                  ) : (
                    <ChevronDown
                      className={`w-3.5 h-3.5 ${
                        isPipelineActive ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    />
                  )}
                </div>
              )}
              {renderTooltip('Pipeline')}
            </button>

            {/* Sub-stages with connecting branch lines */}
            {expanded && isPipelineExpanded && (
              <div className="relative mt-1 ml-4 pl-3 border-l border-slate-200/90 space-y-0.5 animate-in fade-in duration-200">
                {PIPELINE_SUB_STAGES.map((subStage) => {
                  const isSelected = activeSidebarStage === subStage.id;

                  return (
                    <div key={subStage.id} className="relative flex items-center">
                      {/* Tree branch arm */}
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-2.5 h-[1px] bg-slate-200/90" />

                      <button
                        onClick={() => handleSelectStage(subStage.id)}
                        className={`w-full text-left pl-3.5 pr-3 py-2 transition-all flex items-center rounded-lg cursor-pointer ${
                          isSelected
                            ? 'bg-[#EAEBED] text-slate-900 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-normal'
                        }`}
                      >
                        <span className="text-[14px]">{subStage.label}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LinkedIn Job */}
          <button
            onClick={() => handleSelectStage('linkedin_job')}
            className={`w-full px-3 py-2.5 flex items-center rounded-lg transition-all cursor-pointer ${
              activeSidebarStage === 'linkedin_job'
                ? 'bg-[#27323A] text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <User
              className={`w-4 h-4 shrink-0 ${
                activeSidebarStage === 'linkedin_job' ? 'text-white' : 'text-slate-500'
              }`}
            />
            <span className="ml-3 text-[14px] whitespace-nowrap overflow-hidden">
              LinkedIn Job
            </span>
          </button>

          {/* Database Cv */}
          <button
            onClick={() => handleSelectStage('database_cv')}
            className={`w-full px-3 py-2.5 flex items-center rounded-lg transition-all cursor-pointer ${
              activeSidebarStage === 'database_cv'
                ? 'bg-[#27323A] text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <FileText
              className={`w-4 h-4 shrink-0 ${
                activeSidebarStage === 'database_cv' ? 'text-white' : 'text-slate-500'
              }`}
            />
            <span className="ml-3 text-[14px] whitespace-nowrap overflow-hidden">
              Database Cv
            </span>
          </button>

          {/* Reference */}
          <button
            onClick={() => handleSelectStage('reference')}
            className={`w-full px-3 py-2.5 flex items-center rounded-lg transition-all cursor-pointer ${
              activeSidebarStage === 'reference'
                ? 'bg-[#27323A] text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <Calendar
              className={`w-4 h-4 shrink-0 ${
                activeSidebarStage === 'reference' ? 'text-white' : 'text-slate-500'
              }`}
            />
            <span className="ml-3 text-[14px] whitespace-nowrap overflow-hidden">
              Reference
            </span>
          </button>

          {/* Snippets */}
          <button
            onClick={() => handleSelectStage('snippets')}
            className={`w-full px-3 py-2.5 flex items-center rounded-lg transition-all cursor-pointer ${
              activeSidebarStage === 'snippets'
                ? 'bg-[#27323A] text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <FileText
              className={`w-4 h-4 shrink-0 ${
                activeSidebarStage === 'snippets' ? 'text-white' : 'text-slate-500'
              }`}
            />
            <span className="ml-3 text-[14px] whitespace-nowrap overflow-hidden">
              Snippets
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Footer Section: Help & Logout Account */}
      <div className="py-4 space-y-1 text-[14px] px-1 sm:px-2 border-none">
        <button
          onClick={handleHelpClick}
          className={`transition-all group relative cursor-pointer ${
            !expanded
              ? 'w-10 h-10 mx-auto flex items-center justify-center rounded-lg'
              : 'w-full px-3 py-2 flex items-center rounded-lg'
          } text-slate-500 hover:bg-slate-100/80 hover:text-slate-900`}
        >
          <HelpCircle className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-slate-600" />
          {expanded && <span className="ml-3 text-[14px] whitespace-nowrap">Help</span>}
          {renderTooltip('Help')}
        </button>

        <button
          onClick={handleLogoutClick}
          className={`transition-all group relative cursor-pointer ${
            !expanded
              ? 'w-10 h-10 mx-auto flex items-center justify-center rounded-lg'
              : 'w-full px-3 py-2 flex items-center rounded-lg'
          } text-[#E02424] hover:bg-red-50/70`}
        >
          <LogOut className="w-4 h-4 shrink-0 text-[#E02424]" />
          {expanded && (
            <span className="ml-3 text-[14px] whitespace-nowrap font-medium text-[#E02424]">
              Logout Account
            </span>
          )}
          {renderTooltip('Logout Account')}
        </button>
      </div>
    </aside>
  );
};

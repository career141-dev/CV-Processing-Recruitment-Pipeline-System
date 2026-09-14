'use client';

import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { HeadHuntingSidebar } from './components/HeadHuntingSidebar';
import { ResearchView } from './components/ResearchView';
import { BooleanSearchView } from './components/BooleanSearchView';
import { ExcelTablesView } from './components/ExcelTablesView';
import { AiChatWidget } from '../components/AiChatWidget';
import { AiBotIcon } from '../components/AiBotIcon';
import { HeadHuntingTab } from './types';

export default function HeadHuntingPage() {
  const [activeNavTab, setActiveNavTab] = useState<'projects' | 'jobs' | 'reports'>('projects');
  const [activeSidebarTab, setActiveSidebarTab] = useState<HeadHuntingTab>('research');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#F7F7F7] text-slate-800 font-sans antialiased flex flex-col selection:bg-emerald-100 selection:text-emerald-900 relative">
      {/* ── TOP NAV BAR (SHARED SAME NAVBAR FROM NEW-PAGES) ── */}
      <Navbar
        activeNavTab={activeNavTab}
        setActiveNavTab={setActiveNavTab}
        onBrandClick={() => setActiveSidebarTab('research')}
        onMenuClick={() => setMobileDrawerOpen(true)}
      />

      {/* ── MOBILE DRAWER OVERLAY & SIDEBAR ── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative z-50 flex max-w-xs w-full bg-[#FAFAFA] border-none shadow-none">
            <HeadHuntingSidebar
              activeTab={activeSidebarTab}
              setActiveTab={setActiveSidebarTab}
              isMobile={true}
              onMobileClose={() => setMobileDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── MAIN WORKSPACE (DESKTOP SIDEBAR + ACTIVE VIEW) ── */}
      <div className="flex-1 w-full flex relative">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex bg-[#FAFAFA] border-none shadow-none shrink-0">
          <HeadHuntingSidebar
            activeTab={activeSidebarTab}
            setActiveTab={setActiveSidebarTab}
          />
        </div>

        {/* Active Content Area: Research, Boolean Search, or Excel Tables View */}
        <main className="flex-1 p-3.5 sm:p-5 md:p-7 space-y-6 overflow-x-hidden min-w-0">
          {activeSidebarTab === 'boolean_search' ? (
            <BooleanSearchView />
          ) : activeSidebarTab === 'excel_tables' ? (
            <ExcelTablesView />
          ) : (
            <ResearchView />
          )}
        </main>
      </div>

      {/* ── AI CHATBOT WIDGET & FLOATING LAUNCHER BUTTON (BOOLEAN SEARCH TAB ONLY) ── */}
      {activeSidebarTab === 'boolean_search' && (
        <>
          <AiChatWidget
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            title="HeadHunting AI Assistant"
          />

          <div className="fixed bottom-6 right-6 z-50">
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`w-[54px] h-[54px] sm:w-[58px] sm:h-[58px] bg-[#165B42] hover:bg-[#114934] active:scale-95 text-white rounded-[20px] shadow-lg hover:shadow-xl flex items-center justify-center transition-all cursor-pointer group hover:-translate-y-0.5 ${
                isChatOpen ? 'ring-4 ring-emerald-400/50 shadow-[#165B42]/30 scale-105' : ''
              }`}
              title={isChatOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
            >
              <AiBotIcon className="w-10 h-10 sm:w-11 sm:h-11 transition-transform group-hover:scale-105" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

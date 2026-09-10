'use client';

import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { FollowUpStageView } from './components/FollowUpStageView';
import { DirectorReviewStageView } from './components/DirectorReviewStageView';
import { DirectorShortlistStageView } from './components/DirectorShortlistStageView';
import { ClientShortlistStageView } from './components/ClientShortlistStageView';
import { InterviewStageView } from './components/InterviewStageView';
import { OfferStageView } from './components/OfferStageView';
import { LinkedInJobStageView } from './components/LinkedInJobStageView';
import { DatabaseCvStageView } from './components/DatabaseCvStageView';
import { ReferenceStageView } from './components/ReferenceStageView';
import { SnippetsStageView } from './components/SnippetsStageView';
import { OverviewStageView } from './components/OverviewStageView';
import { CandidateProfileDrawer } from './components/CandidateProfileDrawer';
import { ChangeStageModal } from './components/Modals';
import { INITIAL_CANDIDATES } from './mock-data';
import { MockCandidate } from './types';

export default function Career141RecruiterDesk() {
  const [activeNavTab, setActiveNavTab] = useState<'projects' | 'jobs' | 'reports'>('projects');
  const [activeSidebarStage, setActiveSidebarStage] = useState<string>('follow_up');
  const [isPipelineExpanded, setIsPipelineExpanded] = useState<boolean>(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // ── SHARED PIPELINE CANDIDATE STATE ACROSS ALL STAGES ──
  const [candidates, setCandidates] = useState<MockCandidate[]>(INITIAL_CANDIDATES);

  // ── CANDIDATE PROFILE SLIDE-OVER DRAWER STATE ──
  const [selectedProfileCandidate, setSelectedProfileCandidate] = useState<MockCandidate | null>(
    null
  );

  // ── MODALS STATE ──
  const [stageModalCandidate, setStageModalCandidate] = useState<MockCandidate | null>(null);

  const handleProfileClick = (candidate: MockCandidate) => {
    setSelectedProfileCandidate(candidate);
  };

  const handleChangeStage = (
    candidateId: string,
    newStageKey: MockCandidate['stage'],
    newStatusLabel: string
  ) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? {
              ...c,
              stage: newStageKey,
              stageStatus: newStatusLabel,
              stageChangedDate: new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
            }
          : c
      )
    );

    // Also update selectedProfileCandidate if it is currently open
    if (selectedProfileCandidate && selectedProfileCandidate.id === candidateId) {
      setSelectedProfileCandidate((prev) =>
        prev
          ? {
              ...prev,
              stage: newStageKey,
              stageStatus: newStatusLabel,
              stageChangedDate: new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
            }
          : null
      );
    }

    setStageModalCandidate(null);
  };

  const handleRejectCandidate = (candidateId: string) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? {
              ...c,
              stageStatus: 'Rejected',
              stageChangedDate: new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
            }
          : c
      )
    );

    if (selectedProfileCandidate && selectedProfileCandidate.id === candidateId) {
      setSelectedProfileCandidate((prev) =>
        prev
          ? {
              ...prev,
              stageStatus: 'Rejected',
              stageChangedDate: new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }),
            }
          : null
      );
    }
  };

  // Candidates in currently active stage for drawer carousel navigation
  const activeStageCandidates = candidates.filter((c) => c.stage === activeSidebarStage);

  return (
    <div className="min-h-screen bg-[#F7F7F7] text-slate-800 font-sans antialiased flex flex-col selection:bg-sky-100 selection:text-sky-900">
      {/* ── TOP NAV BAR WITH CAREER141 LOGO ── */}
      <Navbar
        activeNavTab={activeNavTab}
        setActiveNavTab={setActiveNavTab}
        onBrandClick={() => setActiveSidebarStage('follow_up')}
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
            <Sidebar
              isExpanded={true}
              activeSidebarStage={activeSidebarStage}
              setActiveSidebarStage={setActiveSidebarStage}
              isPipelineExpanded={isPipelineExpanded}
              setIsPipelineExpanded={setIsPipelineExpanded}
              candidates={candidates}
              isMobile={true}
              onMobileClose={() => setMobileDrawerOpen(false)}
              activeNavTab={activeNavTab}
              setActiveNavTab={setActiveNavTab}
            />
          </div>
        </div>
      )}

      {/* ── MAIN WORKSPACE (DESKTOP SIDEBAR + ACTIVE STAGE VIEW) ── */}
      <div className="flex-1 w-full flex relative">
        {/* ── DESKTOP PERMANENTLY EXPANDED SIDEBAR ── */}
        <div className="hidden md:flex bg-[#FAFAFA] border-none shadow-none shrink-0">
          <Sidebar
            isExpanded={true}
            activeSidebarStage={activeSidebarStage}
            setActiveSidebarStage={setActiveSidebarStage}
            isPipelineExpanded={isPipelineExpanded}
            setIsPipelineExpanded={setIsPipelineExpanded}
            candidates={candidates}
            activeNavTab={activeNavTab}
            setActiveNavTab={setActiveNavTab}
          />
        </div>

        {/* ── ACTIVE STAGE CONTENT AREA: DEDICATED INDIVIDUAL STAGE VIEWS ── */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-6 overflow-x-hidden min-w-0">
          {activeSidebarStage === 'follow_up' && (
            <FollowUpStageView
              candidates={candidates}
              setCandidates={setCandidates}
              onProfileClick={handleProfileClick}
            />
          )}

          {activeSidebarStage === 'director_review' && (
            <DirectorReviewStageView
              candidates={candidates}
              setCandidates={setCandidates}
              onProfileClick={handleProfileClick}
            />
          )}

          {activeSidebarStage === 'director_shortlist' && (
            <DirectorShortlistStageView
              candidates={candidates}
              setCandidates={setCandidates}
              onProfileClick={handleProfileClick}
            />
          )}

          {activeSidebarStage === 'client_shortlist' && (
            <ClientShortlistStageView
              candidates={candidates}
              setCandidates={setCandidates}
              onProfileClick={handleProfileClick}
            />
          )}

          {activeSidebarStage === 'interview' && (
            <InterviewStageView
              candidates={candidates}
              setCandidates={setCandidates}
              onProfileClick={handleProfileClick}
            />
          )}

          {activeSidebarStage === 'offer' && (
            <OfferStageView
              candidates={candidates}
              setCandidates={setCandidates}
              onProfileClick={handleProfileClick}
            />
          )}

          {activeSidebarStage === 'linkedin_job' && (
            <LinkedInJobStageView
              candidates={candidates}
              setCandidates={setCandidates}
              onProfileClick={handleProfileClick}
            />
          )}

          {activeSidebarStage === 'database_cv' && (
            <DatabaseCvStageView
              candidates={candidates}
              setCandidates={setCandidates}
              onProfileClick={handleProfileClick}
            />
          )}

          {activeSidebarStage === 'reference' && (
            <ReferenceStageView
              candidates={candidates}
              setCandidates={setCandidates}
              onProfileClick={handleProfileClick}
            />
          )}

          {activeSidebarStage === 'overview' && <OverviewStageView />}

          {activeSidebarStage === 'snippets' && <SnippetsStageView />}
        </main>
      </div>

      {/* ── CANDIDATE PROFILE SLIDE-OVER DRAWER ── */}
      {selectedProfileCandidate && (
        <CandidateProfileDrawer
          candidate={selectedProfileCandidate}
          candidatesList={
            activeStageCandidates.length > 0 ? activeStageCandidates : candidates
          }
          onClose={() => setSelectedProfileCandidate(null)}
          onSelectCandidate={(c) => setSelectedProfileCandidate(c)}
          onChangeStageClick={(c) => setStageModalCandidate(c)}
          onRejectClick={handleRejectCandidate}
        />
      )}

      {/* ── GLOBAL CHANGE STAGE MODAL ── */}
      <ChangeStageModal
        candidate={stageModalCandidate}
        onClose={() => setStageModalCandidate(null)}
        onChangeStage={handleChangeStage}
      />
    </div>
  );
}

"use client";

import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { User, Users, Bot, Puzzle, Mail, CreditCard, History, Database, RefreshCw } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { SettingsSidebar } from '@/components/settings/SettingsSidebar';
import { ProfileTab } from '@/components/settings/tabs/ProfileTab';
import { TeamTab } from '@/components/settings/tabs/TeamTab';
import { Card } from '@/components/ui/Card';
import { useRole } from '@/hooks/useRole';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';

import { IntegrationsTab } from '@/components/settings/tabs/IntegrationsTab';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const { user } = useUser();
  const firstName = user?.firstName || 'Admin';
  const lastName = user?.lastName || 'User';
  const fullName = `${firstName} ${lastName}`;
  const email = user?.primaryEmailAddress?.emailAddress || 'admin@career141.com';
  const initial = firstName.charAt(0);

  const { role, isAdmin, isTAManager } = useRole();
  const showAdminTabs = isAdmin || isTAManager;

  // Backfill state
  const backfill = useMutation(api.stats.stats.backfillSystemStats);
  const [backfillState, setBackfillState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [backfillResult, setBackfillResult] = useState<any>(null);

  const handleBackfill = async () => {
    if (!confirm('This will recount ALL candidates, CVs, and applications from the database and update the dashboard totals. Proceed?')) return;
    setBackfillState('running');
    try {
      const result = await backfill({});
      setBackfillResult(result);
      setBackfillState('done');
    } catch (err: any) {
      setBackfillState('error');
      setBackfillResult({ error: err.message });
    }
  };

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: <User size={18} /> },
    ...(showAdminTabs ? [
      { id: 'team', label: 'Team Members', icon: <Users size={18} /> },
      { id: 'ai', label: 'AI Agent Config', icon: <Bot size={18} /> },
      { id: 'integrations', label: 'Channel Integrations', icon: <Puzzle size={18} /> },
      { id: 'email', label: 'Email Templates', icon: <Mail size={18} /> },
      { id: 'billing', label: 'Billing & Plan', icon: <CreditCard size={18} /> },
      { id: 'audit', label: 'Audit Log', icon: <History size={18} /> },
    ] : []),
    ...(isAdmin ? [
      { id: 'maintenance', label: 'DB Maintenance', icon: <Database size={18} /> },
    ] : []),
  ];

  return (
    <div className="self-stretch bg-background min-h-screen w-full flex flex-col">
      <PageHeader title="Settings" />
      <div className="px-6 flex flex-col lg:flex-row gap-6 pb-20">
        <SettingsSidebar activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs} />

        {/* Content Area */}
        <div className="flex-grow">
          {activeTab === 'profile' && (
            <ProfileTab fullName={fullName} email={email} initial={initial} role={role} />
          )}

          {activeTab === 'team' && (
            <TeamTab />
          )}

          {activeTab === 'ai' && (
            <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-text-primary text-[14px] font-bold mb-6">AI Agent Configuration</h2>
              <p className="text-text-secondary text-[13px]">Configure AI models and prompts for automated interactions.</p>
            </Card>
          )}

          {activeTab === 'integrations' && (
            <IntegrationsTab />
          )}

          {activeTab === 'email' && (
            <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-text-primary text-[14px] font-bold mb-6">Email Templates</h2>
              <p className="text-text-secondary text-[13px]">Customize automated email templates for candidates and clients.</p>
            </Card>
          )}

          {activeTab === 'billing' && (
            <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-text-primary text-[14px] font-bold mb-6">Billing & Plan</h2>
              <p className="text-text-secondary text-[13px]">Manage your subscription, invoices, and payment methods.</p>
            </Card>
          )}

          {activeTab === 'audit' && (
            <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-text-primary text-[14px] font-bold mb-6">Audit Log</h2>
              <p className="text-text-secondary text-[13px]">View a history of system actions and user activities.</p>
            </Card>
          )}

          {activeTab === 'maintenance' && isAdmin && (
            <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
              <div>
                <h2 className="text-text-primary text-[14px] font-bold mb-1">Database Maintenance</h2>
                <p className="text-text-secondary text-[12px]">Admin-only tools for repairing database state.</p>
              </div>

              <div className="border border-border rounded-xl p-5 bg-surface-container-low">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <RefreshCw className="text-amber-600 dark:text-amber-400" size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-text-primary text-[13px] font-bold mb-1">Recalculate Dashboard Totals</h3>
                    <p className="text-text-secondary text-[12px] mb-4">
                      Rescans all candidates, CV uploads, and applications to correct the dashboard stat counters.
                      Run this once if the &quot;Candidates in Database&quot; card shows an incorrect number (e.g. capped at 1,000).
                      After running, all future inserts/deletes are tracked automatically.
                    </p>

                    {backfillState === 'done' && backfillResult && (
                      <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-[12px] text-green-700 dark:text-green-300 font-mono space-y-0.5">
                        <div>✅ Backfill complete</div>
                        <div>Candidates: <strong>{backfillResult.totalCandidates?.toLocaleString()}</strong></div>
                        <div>CV Uploads: <strong>{backfillResult.totalCvUploads?.toLocaleString()}</strong></div>
                        <div>Applications: <strong>{backfillResult.totalApplications?.toLocaleString()}</strong></div>
                        <div>Active Jobs: <strong>{backfillResult.activeJobsCount}</strong></div>
                      </div>
                    )}

                    {backfillState === 'error' && (
                      <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-[12px] text-red-700 dark:text-red-300">
                        ❌ {backfillResult?.error || 'Unknown error'}
                      </div>
                    )}

                    <button
                      onClick={handleBackfill}
                      disabled={backfillState === 'running'}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-colors"
                    >
                      <RefreshCw size={14} className={backfillState === 'running' ? 'animate-spin' : ''} />
                      {backfillState === 'running' ? 'Recalculating...' : 'Run Backfill Now'}
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

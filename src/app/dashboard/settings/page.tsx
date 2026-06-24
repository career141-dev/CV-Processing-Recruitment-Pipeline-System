"use client";

import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { User, Users, Bot, Puzzle, Mail, CreditCard, History } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { SettingsSidebar } from '@/components/settings/SettingsSidebar';
import { ProfileTab } from '@/components/settings/tabs/ProfileTab';
import { TeamTab } from '@/components/settings/tabs/TeamTab';
import { Card } from '@/components/ui/Card';
import { useRole } from '@/hooks/useRole';

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
            <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-text-primary text-[14px] font-bold mb-6">Channel Integrations</h2>
              <p className="text-text-secondary text-[13px]">Manage your connected channels like Slack, WhatsApp, and LinkedIn.</p>
            </Card>
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
        </div>
      </div>
    </div>
  );
}

"use client";

import React from 'react';
import { Card } from '@/components/ui/Card';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';

export function IntegrationsTab() {
  const settings = useQuery(api.admin.settings.getSystemSettings);
  const updateToggles = useMutation(api.admin.settings.updateChannelToggles);

  if (settings === undefined) {
    return (
      <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-[300px] flex items-center justify-center">
        <span className="text-text-secondary text-[14px]">Loading settings...</span>
      </Card>
    );
  }

  const handleToggle = async (key: keyof typeof settings) => {
    const newToggles = { ...settings, [key]: !settings[key] };
    await updateToggles({ toggles: newToggles });
  };

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-[#006763]' : 'bg-surface-variant'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-text-primary text-[14px] font-bold">Global Channel Pauses</h2>
          <p className="text-text-secondary text-[13px] mt-1">
            Temporarily block processing of incoming candidates or automated follow-ups without breaking your integrations.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* INGESTION SETTINGS */}
        <div>
          <h3 className="text-[13px] font-semibold text-text-primary mb-3 uppercase tracking-wider text-opacity-80">Incoming Candidates (Ingestion)</h3>
          <div className="bg-background rounded-lg border border-border divide-y divide-border">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-text-primary">WhatsApp Ingestion</p>
                <p className="text-[13px] text-text-secondary mt-0.5">
                  Process new CVs sent via WhatsApp. If paused, CVs are securely queued until resumed.
                </p>
              </div>
              <div className="ml-4 flex items-center">
                <span className={`text-[12px] font-medium mr-3 ${settings.whatsappIngestion ? 'text-[#006763]' : 'text-text-disabled'}`}>
                  {settings.whatsappIngestion ? 'Active' : 'Paused'}
                </span>
                <ToggleSwitch checked={settings.whatsappIngestion} onChange={() => handleToggle('whatsappIngestion')} />
              </div>
            </div>
            
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-text-primary">Email Ingestion</p>
                <p className="text-[13px] text-text-secondary mt-0.5">
                  Process new CVs sent via shared Email inboxes.
                </p>
              </div>
              <div className="ml-4 flex items-center">
                <span className={`text-[12px] font-medium mr-3 ${settings.emailIngestion ? 'text-[#006763]' : 'text-text-disabled'}`}>
                  {settings.emailIngestion ? 'Active' : 'Paused'}
                </span>
                <ToggleSwitch checked={settings.emailIngestion} onChange={() => handleToggle('emailIngestion')} />
              </div>
            </div>
          </div>
        </div>

        {/* FOLLOW-UP SETTINGS */}
        <div>
          <h3 className="text-[13px] font-semibold text-text-primary mb-3 uppercase tracking-wider text-opacity-80">Automated Outreach (Follow-ups)</h3>
          <div className="bg-background rounded-lg border border-border divide-y divide-border">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-text-primary">WhatsApp Follow-ups</p>
                <p className="text-[13px] text-text-secondary mt-0.5">
                  Send automated Day 0/4/6 WhatsApp messages to unresponsive candidates.
                </p>
              </div>
              <div className="ml-4 flex items-center">
                <span className={`text-[12px] font-medium mr-3 ${settings.whatsappFollowUp ? 'text-[#006763]' : 'text-text-disabled'}`}>
                  {settings.whatsappFollowUp ? 'Active' : 'Paused'}
                </span>
                <ToggleSwitch checked={settings.whatsappFollowUp} onChange={() => handleToggle('whatsappFollowUp')} />
              </div>
            </div>
            
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-text-primary">Email Follow-ups</p>
                <p className="text-[13px] text-text-secondary mt-0.5">
                  Send automated Day 0/4/6 Email messages to unresponsive candidates.
                </p>
              </div>
              <div className="ml-4 flex items-center">
                <span className={`text-[12px] font-medium mr-3 ${settings.emailFollowUp ? 'text-[#006763]' : 'text-text-disabled'}`}>
                  {settings.emailFollowUp ? 'Active' : 'Paused'}
                </span>
                <ToggleSwitch checked={settings.emailFollowUp} onChange={() => handleToggle('emailFollowUp')} />
              </div>
            </div>
          </div>
        </div>
        
        {(!settings.whatsappFollowUp && !settings.emailFollowUp) && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-md flex items-start gap-2">
            <div className="mt-0.5">⚠️</div>
            <p className="text-[12px] text-yellow-600 font-medium">
              Both follow-up channels are currently paused. The 7-day "Unresponsive" expiration timer for candidates in the follow-up stage is currently suspended.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

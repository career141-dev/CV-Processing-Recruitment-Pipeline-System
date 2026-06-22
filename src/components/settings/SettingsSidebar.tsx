import React from 'react';
import { Card } from '@/components/ui/Card';

interface SettingsSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabs: { id: string; label: string; icon: React.ReactNode }[];
}

export function SettingsSidebar({ activeTab, setActiveTab, tabs }: SettingsSidebarProps) {
  return (
    <aside className="w-full lg:w-64 flex-shrink-0">
      <Card className="overflow-hidden" noPadding>
        <nav className="flex flex-col py-2">
          {tabs.map((tab) => (
            <NavButton
              key={tab.id}
              id={tab.id}
              active={activeTab}
              setActive={setActiveTab}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </nav>
      </Card>
    </aside>
  );
}

function NavButton({ id, active, setActive, icon, label }: { id: string; active: string; setActive: (id: string) => void; icon: React.ReactNode; label: string }) {
  const isActive = active === id;
  return (
    <button
      onClick={() => setActive(id)}
      className={`flex items-center gap-3 px-4 py-3 text-left w-full transition-colors border-l-2 ${
        isActive
          ? 'bg-[#E8F5E9] text-primary-container border-primary-container'
          : 'text-text-secondary border-transparent hover:bg-background'
      }`}
    >
      <div className={isActive ? 'text-primary-container' : 'text-text-secondary'}>{icon}</div>
      <span className={`text-[13px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MessageCircle, Mail, Globe, RefreshCw, UserPlus, UserSearch, Upload } from 'lucide-react';
import { ChannelStatusCard } from '@/components/ingestion-monitor/ChannelStatusCard';
import { ProcessingQueue } from '@/components/ingestion-monitor/ProcessingQueue';
import { IngestionLog, LogEntry } from '@/components/ingestion-monitor/IngestionLog';
import { ErrorLog } from '@/components/ingestion-monitor/ErrorLog';
import { CustomSelect } from '@/components/ui/CustomSelect';

const SOURCES = [
  { name: 'WhatsApp', bgColor: 'bg-[#E8F5E9]', textColor: 'text-primary-container' },
  { name: 'Email Campaign', bgColor: 'bg-[#FFF3E0]', textColor: 'text-[#E65100]' },
  { name: 'Portal', bgColor: 'bg-[#E3F2FD]', textColor: 'text-[#1565C0]' },
  { name: 'LinkedIn', bgColor: 'bg-[#E1F5FE]', textColor: 'text-[#0277BD]' }
];

const CANDIDATES = [
  'Robert De Niro', 'Meryl Streep', 'Al Pacino', 'Tom Hanks', 'Denzel Washington', 
  'Leonardo DiCaprio', 'Cate Blanchett', 'Morgan Freeman', 'Julianne Moore', 
  'Christian Bale', 'Amy Adams', 'Joaquin Phoenix', 'Gary Oldman', 'Viola Davis'
];

export default function IngestionMonitorPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showErrorLog, setShowErrorLog] = useState(false);
  const [jobFilter, setJobFilter] = useState('Brand Manager — Atlas');

  // Used to prevent picking the exact same candidate twice in a row
  const lastPickedRef = useRef<string | null>(null);

  // Simulation logic
  useEffect(() => {
    let logIdCounter = 0;
    const timeouts: NodeJS.Timeout[] = [];

    const addLogEntry = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', { hour12: false });
      const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
      
      let candidate = '';
      do {
        candidate = CANDIDATES[Math.floor(Math.random() * CANDIDATES.length)];
      } while (candidate === lastPickedRef.current);
      lastPickedRef.current = candidate;

      const newId = Math.random().toString(36).substring(2, 11);

      const newEntry: LogEntry = {
        id: newId,
        time,
        source,
        candidate,
        status: 'parsing'
      };

      setLogs(prev => {
        const updated = [newEntry, ...prev];
        if (updated.length > 15) return updated.slice(0, 15);
        return updated;
      });

      // Simulate Queue visually
      setQueueCount(prev => prev + 1);
      setProgress(45);
      
      timeouts.push(setTimeout(() => {
        setQueueCount(prev => Math.max(0, prev - 1));
        setProgress(0);
      }, 2500));

      // Simulate parsing completion
      timeouts.push(setTimeout(() => {
        setLogs(prev => prev.map(log => 
          log.id === newId ? { ...log, status: 'parsed' } : log
        ));
      }, 3000));
    };

    // Initial pop
    for (let i = 0; i < 3; i++) {
      timeouts.push(setTimeout(addLogEntry, i * 1000));
    }

    const interval = setInterval(addLogEntry, 6000);
    
    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const getCampaignEmail = () => {
    if (jobFilter === 'Brand Manager — Atlas') return 'brand24@career141.com';
    if (jobFilter === 'CFO — LPI') return 'cfo@career141.com';
    return 'cvs@career141.com';
  };

  return (
    <div className="self-stretch bg-background min-h-screen w-full flex flex-col">
      <PageHeader title="" />
      
      <div className="px-6 pb-24 md:pb-6 mx-auto w-full max-w-7xl">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-[24px] leading-8 font-semibold text-text-primary">Ingestion Monitor</h1>
            <p className="text-[13px] text-text-secondary mt-1">Real-time status of all CV intake channels and the AI parsing queue.</p>
          </div>
          <div className="flex items-center gap-4">
            <CustomSelect 
              label="Job Filter"
              labelColorClass="text-[#E65100]"
              hoverColorClass="hover:shadow-[0_4px_20px_rgba(230,81,0,0.1)] group-hover:text-[#E65100]"
              gradientFromClass="bg-gradient-to-r from-[#E65100]/5 to-transparent"
              value={jobFilter}
              onChange={setJobFilter}
              options={["All Active Jobs", "Brand Manager — Atlas", "CFO — LPI"]}
            />
            <div className="flex items-center gap-3 bg-surface px-4 py-2.5 rounded-md border border-border shadow-sm">
              <div className="w-2 h-2 rounded-full bg-[#006E1C] animate-pulse"></div>
              <span className="text-[11px] font-semibold tracking-widest text-[#006E1C]">AUTO-REFRESH: ON</span>
            </div>
          </div>
        </header>

        {/* Channel Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          <ChannelStatusCard
            title="LinkedIn Monitor"
            status="Active"
            statusColor="text-[#006E1C]"
            pulse={true}
            icon={<UserPlus size={20} />}
            stats={[
              { label: 'CVs Today', value: '136' },
              { label: 'Last received', value: '1 min ago' },
              { label: 'Routing', value: 'linkedin@career141.com' }
            ]}
          />
          <ChannelStatusCard
            title="Email Campaign"
            status="Active"
            statusColor="text-[#006E1C]"
            pulse={true}
            icon={<Mail size={20} />}
            stats={[
              { label: 'CVs Today', value: '12' },
              { label: 'Last received', value: '22 min ago' },
              { label: 'Inbox', value: getCampaignEmail() }
            ]}
          />
          <ChannelStatusCard
            title="WhatsApp Monitor"
            status="Active"
            statusColor="text-[#006E1C]"
            pulse={true}
            icon={<MessageCircle size={20} />}
            stats={[
              { label: 'CVs Today', value: '18' },
              { label: 'Last received', value: '4 min ago' },
              { label: 'Number', value: '+971 50 XXX XXXX' }
            ]}
          />
          <ChannelStatusCard
            title="Campaign Portal"
            status="Active"
            statusColor="text-[#006E1C]"
            pulse={true}
            icon={<Globe size={20} />}
            stats={[
              { label: 'CVs Today', value: '7' },
              { label: 'Last received', value: '1 hr ago' },
              { label: 'Status', value: 'Healthy' }
            ]}
          />
          <ChannelStatusCard
            title="Workable Sync"
            status="Sync Delayed"
            statusColor="text-[#E65100]"
            borderClass="border-[#E65100]"
            icon={<RefreshCw size={20} />}
            stats={[
              { label: 'Last sync', value: '2 hr ago' },
              { label: 'CVs Today', value: '5' },
              { label: 'Next sync', value: 'in 1 hr' }
            ]}
            actionButton={
              <button className="w-full py-1.5 text-[11px] font-semibold tracking-wider border border-[#E65100] text-[#E65100] rounded-lg hover:bg-[#E65100] hover:text-on-primary transition-colors">
                SYNC NOW
              </button>
            }
          />
          <ChannelStatusCard
            title="Headhunting (Passive)"
            status="Manual"
            statusColor="text-text-secondary"
            icon={<UserSearch size={20} />}
            stats={[
              { label: 'Added Today', value: '3' },
              { label: 'Top Tagger', value: 'Shambra' },
              { label: 'Status', value: 'Awaiting Outreach' }
            ]}
          />
          <ChannelStatusCard
            title="Bulk Upload"
            status="Manual"
            statusColor="text-text-secondary"
            icon={<Upload size={20} />}
            stats={[
              { label: 'Total Today', value: '42' },
              { label: 'Last Batch', value: '3 hrs ago (20 CVs)' },
              { label: 'Uploader', value: 'Rayan' }
            ]}
          />
        </div>

        <ProcessingQueue 
          queueCount={queueCount}
          rate="43 CVs/hr"
          estClear="~0 min"
          progress={progress}
        />

        <IngestionLog logs={logs} />

        <ErrorLog 
          showErrorLog={showErrorLog} 
          setShowErrorLog={setShowErrorLog} 
          errorCount={1}
        />

      </div>
    </div>
  );
}

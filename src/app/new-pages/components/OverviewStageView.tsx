'use client';

import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';

type NotificationCategoryKey = 'daily_cv' | 'stale_jobs' | 'shortlist_sla' | 'client_feedback';

interface NotificationCardItem {
  id: string;
  category: NotificationCategoryKey;
  taName: string;
  role: string;
  locationAndCompany?: string;
  notificationMessage: string;
  statusLabel: string;
  dateStr: string;
}

const NOTIFICATION_DATA: NotificationCardItem[] = [
  // ── 1. DAILY CV TARGET (<10 CVs/day) ──

  {
    id: 'notif-4',
    category: 'daily_cv',
    taName: 'Chirani',
    role: 'Executive / Senior Executive Quality Assurance',
    locationAndCompany: 'Eheliyagoda | Kahathuduwa · Apparel Manufacturing',
    notificationMessage:
      'Daily CV quota not met: Only 4 out of 10 CVs received today for Senior Quality Assurance role. Multi-channel scraping & WhatsApp broadcast required to achieve 10 CV quota.',
    statusLabel: 'In contacted',
    dateStr: 'April 28, 2025',
  },

  // ── 2. UNCLOSED JOBS (>5 DAYS) ──
  {
    id: 'notif-5',
    category: 'stale_jobs',
    taName: 'Nethma Tharindi',
    role: 'Apparel Merchandiser Lead',
    locationAndCompany: 'Avissawella · Apparel & Fashion',
    notificationMessage:
      'Job position created 7 days ago remains open without candidate placement or stage closure. Hiring lead review recommended to accelerate interview round.',
    statusLabel: 'In contacted',
    dateStr: 'April 28, 2025',
  },
  {
    id: 'notif-6',
    category: 'stale_jobs',
    taName: 'Chirani',
    role: 'Operations Shift Supervisor',
    locationAndCompany: 'Biyagama Free Trade Zone · Manufacturing',
    notificationMessage:
      'Job requisition has been active for 6 days (> 5 days SLA threshold). Client shortlist stage pending client hiring manager availability.',
    statusLabel: 'In contacted',
    dateStr: 'April 28, 2025',
  },
  {
    id: 'notif-7',
    category: 'stale_jobs',
    taName: 'Kavindi Jayawardena',
    role: 'Senior React Native Developer',
    locationAndCompany: 'Colombo 07 · Tech Services',
    notificationMessage:
      'Position created 9 days ago. Client has received 5 shortlisted candidates; stage closure review required with client account manager.',
    statusLabel: 'In contacted',
    dateStr: 'April 26, 2025',
  },

  // ── 3. SHORTLIST SLA BREACH (>24 HOURS) ──
  {
    id: 'notif-8',
    category: 'shortlist_sla',
    taName: 'Nethma Tharindi',
    role: 'HR Associate',
    locationAndCompany: 'Colombo · Human Resources',
    notificationMessage:
      'Candidate profiles in Director Review stage have exceeded the 24-hour shortlist turnaround SLA (28 hours pending). Immediate TA review required.',
    statusLabel: 'In contacted',
    dateStr: 'April 28, 2025',
  },
  {
    id: 'notif-9',
    category: 'shortlist_sla',
    taName: 'Sahan Perera',
    role: 'DevOps Lead Engineer',
    locationAndCompany: 'Colombo · Cloud Infrastructure',
    notificationMessage:
      'CV ingested 32 hours ago has not been actioned or moved to initial candidate shortlist. SLA deadline breached by 8 hours.',
    statusLabel: 'In contacted',
    dateStr: 'April 28, 2025',
  },
  {
    id: 'notif-10',
    category: 'shortlist_sla',
    taName: 'Chirani',
    role: 'Financial Analyst Specialist',
    locationAndCompany: 'Colombo 02 · Banking & Finance',
    notificationMessage:
      'Candidate submission received yesterday at 11:00 AM. 26 hours elapsed without shortlist evaluation or stage progression.',
    statusLabel: 'In contacted',
    dateStr: 'April 28, 2025',
  },

  // ── 4. CLIENT FEEDBACK OVERDUE (>2 DAYS) ──
  {
    id: 'notif-11',
    category: 'client_feedback',
    taName: 'Nethma Tharindi',
    role: 'HR Associate',
    locationAndCompany: 'Colombo · HR Services',
    notificationMessage:
      'Client shortlist submitted 3 days ago with no interview feedback or status update received. Automated follow-up sequence ready to send.',
    statusLabel: 'In contacted',
    dateStr: 'April 28, 2025',
  },
  {
    id: 'notif-12',
    category: 'client_feedback',
    taName: 'Dilshan Silva',
    role: 'Senior Merchandiser Lead',
    locationAndCompany: 'Katunayake · Apparel Manufacturing',
    notificationMessage:
      '4 candidate profiles sent to client hiring manager 2 days ago. No interview schedule confirmed within 48-hour client response window.',
    statusLabel: 'In contacted',
    dateStr: 'April 28, 2025',
  },
  {
    id: 'notif-13',
    category: 'client_feedback',
    taName: 'Chirani',
    role: 'Quality Assurance Manager',
    locationAndCompany: 'Biyagama · Quality Operations',
    notificationMessage:
      'Client 1st round interview completed 48 hours ago. Final hiring decision and feedback overdue from client recruitment representative.',
    statusLabel: 'In contacted',
    dateStr: 'April 27, 2025',
  },
];

export const OverviewStageView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategoryKey>('daily_cv');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const CATEGORY_METRICS = [
    {
      key: 'daily_cv' as NotificationCategoryKey,
      count: 10,
      title: 'Daily CV Target',
      subtitle: '< 10 CVs/day per position',
    },
    {
      key: 'stale_jobs' as NotificationCategoryKey,
      count: 20,
      title: 'Unclosed Jobs',
      subtitle: 'Created > 5 days ago & open',
    },
    {
      key: 'shortlist_sla' as NotificationCategoryKey,
      count: 43,
      title: 'Pending Shortlist',
      subtitle: 'Unshortlisted for > 24 hours',
    },
    {
      key: 'client_feedback' as NotificationCategoryKey,
      count: 66,
      title: 'Client Feedback',
      subtitle: 'Pending feedback > 2 days',
    },
  ];

  const filteredItems = NOTIFICATION_DATA.filter((item) => {
    if (item.category !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.taName.toLowerCase().includes(q) ||
      item.role.toLowerCase().includes(q) ||
      item.notificationMessage.toLowerCase().includes(q)
    );
  });

  const handleReject = (taName: string) => {
    toast.info(`Rejected / dismissed notification for ${taName}`);
  };

  return (
    <div className="space-y-6 w-full">
      {/* ── 1. NOTIFICATION HEADER & 4 METRIC CARDS ── */}
      <div className="space-y-3.5">
        <div>
          <h2 className="text-[20px] font-bold text-slate-900 tracking-tight">
            Notification
          </h2>
        </div>

        {/* 4 Clickable Metric Widgets (2 Columns x 2 Rows on Mobile, 4 Columns on Desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {CATEGORY_METRICS.map((metric) => {
            const isSelected = selectedCategory === metric.key;

            return (
              <button
                key={metric.key}
                onClick={() => setSelectedCategory(metric.key)}
                className={`text-left bg-white rounded-[10px] p-3.5 sm:p-5 shadow-2xs transition-all cursor-pointer relative overflow-hidden border ${isSelected
                    ? 'border-slate-900 ring-2 ring-slate-900/10 shadow-sm bg-slate-50/40'
                    : 'border-[#E2E8F0] hover:border-slate-300 hover:shadow-xs hover:bg-slate-50/20'
                  }`}
              >
                <div>
                  <h3 className="text-[24px] sm:text-[30px] font-bold text-slate-900 leading-none tracking-tight">
                    {metric.count}
                  </h3>
                </div>

                <div className="mt-2 sm:mt-2.5">
                  <p className="text-[12.5px] sm:text-[13.5px] font-bold text-slate-800 leading-tight">
                    {metric.title}
                  </p>
                  <p className="text-[11px] sm:text-[11.5px] text-slate-500 font-medium mt-0.5 leading-snug">
                    {metric.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. NOTIFICATION LIST (CLEAN CARD STYLE WITHOUT CHECKBOXES OR SORT BY) ── */}
      <div className="bg-white rounded-[8px] border border-[#DBDEE0] overflow-hidden shadow-2xs w-full">
        {/* Top Search Bar */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[#DBDEE0]">
          <div className="relative w-[210px] sm:w-[320px] h-[31px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pipeline"
              className="w-full h-full pl-8 pr-7 bg-white border border-[#8B9399] rounded-[5px] text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <span className="text-[12px] font-semibold text-slate-500">
            {filteredItems.length} alerts
          </span>
        </div>

        {/* ── NOTIFICATION ROWS (NO CHECKBOXES, CLEAN LAYOUT) ── */}
        <div className="divide-y divide-[#E2E8F0]">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-6 transition-colors hover:bg-slate-50/40"
            >
              <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
                {/* Left Column: Notification Details */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  {/* Row 1: Name (Green Link Style) */}
                  <div>
                    <h3
                      onClick={() => toast.info(`Viewing details for ${item.taName}`)}
                      className="font-bold text-[16px] text-[#165B42] hover:underline cursor-pointer tracking-normal leading-[100%] inline-block"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 700,
                        fontSize: '16px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                      }}
                    >
                      {item.taName}
                    </h3>
                  </div>

                  {/* Role / Position */}
                  <p className="text-[13.5px] font-semibold text-slate-800">
                    {item.role}
                  </p>

                  {/* Notification Description Paragraph */}
                  <p className="text-[13px] text-slate-600 leading-relaxed max-w-4xl break-words">
                    {item.notificationMessage}
                  </p>
                </div>

                {/* Right Column: Reject Button Only */}
                <div className="shrink-0 self-start sm:self-center pt-2 sm:pt-0">
                  <button
                    onClick={() => handleReject(item.taName)}
                    className="px-5 py-1 rounded-full border border-[#165B42] text-[#165B42] hover:bg-emerald-50 text-[13px] font-semibold transition-colors cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

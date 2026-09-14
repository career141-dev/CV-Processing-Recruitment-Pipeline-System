/**
 * Career141 Recruiter Desk — Design Tokens & Theme Constants
 * Strictly preserves the design system colors, borders, shadows, and typography.
 */

export const DESK_THEME = {
  colors: {
    primaryGreen: '#165B42',
    primaryGreenHover: '#114934',
    accentGreen: '#057642',
    bgPage: '#F7F7F7',
    bgSidebar: '#FAFAFA',
    bgCard: '#FFFFFF',
    borderCard: '#DBDEE0',
    borderInput: '#8B9399',
    borderDivider: '#DBDEE0',
    borderModal: '#DDDFE2',
    badgeApplicantBg: '#EBEBEB',
    botBadgeBg: '#EAF3EE',
  },
  typography: {
    candidateName: {
      fontFamily: 'Inter, sans-serif',
      fontWeight: 700,
      fontSize: '16px',
      lineHeight: '100%',
      letterSpacing: '0%',
    },
  },
  classes: {
    card: 'bg-white rounded-[8px] border border-[#DBDEE0] shadow-2xs',
    cardLg: 'bg-white rounded-[10px] border border-[#DBDEE0] shadow-2xs',
    searchInput:
      'bg-white border border-[#8B9399] rounded-[5px] text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#165B42] focus:border-[#165B42] transition-all',
    btnPrimary:
      'px-4 py-1.5 bg-[#165B42] hover:bg-[#114934] active:scale-95 text-white font-semibold rounded-full text-[13px] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-40',
    btnOutline:
      'px-4 py-1.5 bg-white border border-[#165B42] hover:bg-emerald-50 text-[#165B42] font-semibold rounded-full text-[13px] transition-colors cursor-pointer',
    btnToolbar:
      'h-[31px] flex items-center gap-1.5 px-3 rounded-[5px] border border-[#DBDEE0] text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer shrink-0',
    badgeApplicant: 'px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[#EBEBEB] text-slate-700',
    linkGreen: 'text-[#165B42] hover:underline cursor-pointer',
  },
} as const;

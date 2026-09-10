"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { 
  FileSpreadsheet, ExternalLink, RefreshCw, CheckCircle2, 
  Search, Download, Calendar, User, Phone, Mail, Sparkles, 
  Loader2, Check, Clock, Edit3, ArrowUpDown, Filter, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const DEFAULT_MASTER_SHEET_WEB_URL =
  "https://careerc141.sharepoint.com/:x:/s/TalentAcquisition/IQDb-5p_FvHbRq6cuvPdyut3AYRyIYDTms15rJC17GGWWt4?e=D7gtk8";

const TA_STATUS_OPTIONS = [
  { value: "Shortlisted", label: "Shortlisted", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "To Call", label: "To Call", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { value: "Contacted", label: "Contacted", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { value: "Interview Scheduled", label: "Interview Scheduled", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  { value: "Offer Extended", label: "Offer Extended", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { value: "Placed", label: "Placed", color: "bg-green-600/10 text-green-700 border-green-600/30" },
  { value: "Rejected", label: "Rejected", color: "bg-red-500/10 text-red-600 border-red-500/20" },
];

interface JobMasterSheetViewProps {
  jobId: Id<"jobs">;
  jobTitle?: string;
  onSelectCandidate?: (candidateId: Id<"candidates">) => void;
}

export function JobMasterSheetView({ jobId, jobTitle, onSelectCandidate }: JobMasterSheetViewProps) {
  const masterDetails = useQuery(api.integrations.excelMutations.getJobMasterSheetDetails, { jobId });
  const rows = useQuery(api.integrations.excelMutations.getMasterSheetGridData, { jobId });
  const updateCell = useMutation(api.integrations.excelMutations.updateCandidateMasterSheetCell);
  const triggerSyncAll = useMutation(api.integrations.excelMutations.triggerSyncAllShortlisted);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [savedCellBadge, setSavedCellBadge] = useState<string | null>(null);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      const matchesSearch =
        !searchQuery ||
        r.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.candidateEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.candidatePhone.includes(searchQuery) ||
        r.taNotes.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || r.taStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, searchQuery, statusFilter]);

  // Handle cell edits
  const handleStatusChange = async (applicationId: Id<"applications">, newStatus: string) => {
    try {
      await updateCell({ applicationId, field: "status", value: newStatus });
      triggerSavedBadge(applicationId);
      toast.success("Status updated & queued for SharePoint sync");
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleInterviewDateChange = async (applicationId: Id<"applications">, dateVal: string) => {
    try {
      await updateCell({ applicationId, field: "interviewDate", value: dateVal });
      triggerSavedBadge(applicationId);
      toast.success("Interview date updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update date");
    }
  };

  const handleNotesBlur = async (applicationId: Id<"applications">, originalNotes: string) => {
    const currentVal = localNotes[applicationId];
    setEditingNotesId(null);
    if (currentVal === undefined || currentVal === originalNotes) return;

    try {
      await updateCell({ applicationId, field: "notes", value: currentVal });
      triggerSavedBadge(applicationId);
      toast.success("Notes saved & queued for SharePoint sync");
    } catch (err: any) {
      toast.error(err.message || "Failed to save notes");
    }
  };

  const triggerSavedBadge = (id: string) => {
    setSavedCellBadge(id);
    setTimeout(() => setSavedCellBadge(null), 2000);
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      await triggerSyncAll({ jobId });
      toast.success("SharePoint sync started! All candidate rows are being updated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to sync with SharePoint");
    } finally {
      setTimeout(() => setIsSyncingAll(false), 2000);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (!rows || rows.length === 0) {
      toast.error("No candidates to export");
      return;
    }

    const headers = [
      "Date Shortlisted",
      "Candidate Name",
      "Current Role",
      "Email",
      "Phone",
      "Experience (Years)",
      "AI Match Score",
      "TA Progress Status",
      "Interview Date",
      "Recruiter Notes",
      "Shortlisted By",
    ];

    const csvRows = [headers.join(",")];
    for (const r of rows) {
      const formattedDate = new Date(r.shortlistedAt).toLocaleDateString();
      const clean = (val: any) => `"${String(val || "").replace(/"/g, '""')}"`;
      csvRows.push([
        clean(formattedDate),
        clean(r.candidateName),
        clean(r.role),
        clean(r.candidateEmail),
        clean(r.candidatePhone),
        clean(r.experience ? `${r.experience} yrs` : "-"),
        clean(r.aiMatchScore ? `${r.aiMatchScore}%` : "-"),
        clean(r.taStatus),
        clean(r.interviewDate),
        clean(r.taNotes),
        clean(r.recruiterName),
      ].join(","));
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Master_Tracker_${jobTitle?.replace(/[^a-zA-Z0-9]/g, "_") || "Job"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Spreadsheet exported successfully!");
  };

  const webUrl = masterDetails?.excelMasterSheetUrl || DEFAULT_MASTER_SHEET_WEB_URL;

  if (rows === undefined || masterDetails === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-text-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium">Loading Master Tracking Sheet...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-surface border border-border rounded-2xl shadow-sm overflow-hidden mb-12">
      {/* ─────────────────────────────────────────────────────────────────────────────
          TOP TOOLBAR
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-surface-elevated/80 backdrop-blur border-b border-border p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Title, Live Indicator & Candidate Count */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-text-primary">
                {masterDetails?.excelMasterSheetName || "TA Master Tracking Sheet"}
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live In-App Grid
              </span>
            </div>
            <p className="text-[11px] text-text-tertiary">
              {rows.length} {rows.length === 1 ? "candidate" : "candidates"} shortlisted • Auto-syncs to SharePoint
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search sheet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 sm:w-56 transition-all"
            />
          </div>

          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface text-text-secondary focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            {TA_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Sync All Button */}
          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm disabled:opacity-50"
            title="Push all shortlisted candidates to the SharePoint Excel file"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? "animate-spin" : ""}`} />
            {isSyncingAll ? "Syncing..." : "Sync with SharePoint"}
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface border border-border hover:bg-surface-hover text-text-secondary transition-all"
            title="Download CSV copy of this sheet"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          {/* Open in SharePoint Excel */}
          <a
            href={webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface border border-border hover:bg-surface-hover text-text-primary transition-all"
            title="Open in Microsoft 365 SharePoint Online"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Excel
          </a>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          EMPTY STATE
      ───────────────────────────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="py-20 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-text-primary mb-1">
            No Shortlisted Candidates Yet
          </h4>
          <p className="text-xs text-text-secondary max-w-md mx-auto mb-5">
            When recruiters click <strong>"Shortlist"</strong> in the Pipeline or Matched Candidates tab, candidates will automatically appear in this master sheet and sync to SharePoint.
          </p>
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────────────────────
            INTERACTIVE SPREADSHEET TABLE
        ───────────────────────────────────────────────────────────────────────────── */
        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-left border-collapse text-xs">
            {/* Table Header */}
            <thead>
              <tr className="bg-surface-container/60 border-b border-border text-text-secondary uppercase tracking-wider font-semibold text-[11px] sticky top-0 z-10 backdrop-blur">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4 min-w-[120px]">Date Shortlisted</th>
                <th className="py-3 px-4 min-w-[200px]">Candidate</th>
                <th className="py-3 px-4 min-w-[200px]">Contact Info</th>
                <th className="py-3 px-4 min-w-[90px] text-center">Exp</th>
                <th className="py-3 px-4 min-w-[100px] text-center">AI Match</th>
                <th className="py-3 px-4 min-w-[170px]">★ TA Progress Status</th>
                <th className="py-3 px-4 min-w-[150px]">📅 Interview Date</th>
                <th className="py-3 px-4 min-w-[240px]">📝 Recruiter Notes</th>
                <th className="py-3 px-4 min-w-[130px]">Shortlisted By</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border/60">
              {filteredRows.map((row, idx) => {
                const isSaved = savedCellBadge === row.applicationId;
                const activeStatus = TA_STATUS_OPTIONS.find((s) => s.value === row.taStatus) || TA_STATUS_OPTIONS[0];

                return (
                  <tr
                    key={row.applicationId}
                    className="hover:bg-surface-hover/40 transition-colors group"
                  >
                    {/* # Index */}
                    <td className="py-3 px-4 text-center text-text-tertiary font-medium">
                      {idx + 1}
                    </td>

                    {/* Date Shortlisted */}
                    <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                      {new Date(row.shortlistedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    {/* Candidate Name & Role */}
                    <td className="py-3 px-4">
                      <div>
                        <button
                          onClick={() => row.candidateId && onSelectCandidate?.(row.candidateId)}
                          className="font-semibold text-text-primary hover:text-emerald-600 transition-colors text-left flex items-center gap-1.5"
                        >
                          {row.candidateName}
                        </button>
                        <span className="text-[11px] text-text-tertiary block line-clamp-1">
                          {row.role || "Candidate"}
                        </span>
                      </div>
                    </td>

                    {/* Contact Info */}
                    <td className="py-3 px-4 text-text-secondary">
                      <div className="space-y-0.5">
                        {row.candidateEmail && (
                          <div className="flex items-center gap-1 text-[11px] text-text-secondary">
                            <Mail className="w-3 h-3 text-text-tertiary shrink-0" />
                            <span className="truncate max-w-[170px]" title={row.candidateEmail}>
                              {row.candidateEmail}
                            </span>
                          </div>
                        )}
                        {row.candidatePhone && (
                          <div className="flex items-center gap-1 text-[11px] text-text-secondary">
                            <Phone className="w-3 h-3 text-text-tertiary shrink-0" />
                            <span>{row.candidatePhone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Experience */}
                    <td className="py-3 px-4 text-center text-text-secondary whitespace-nowrap">
                      {row.experience ? `${row.experience}y` : "-"}
                    </td>

                    {/* AI Match Score */}
                    <td className="py-3 px-4 text-center">
                      {row.aiMatchScore ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            row.aiMatchScore >= 75
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : row.aiMatchScore >= 60
                              ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                              : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          }`}
                        >
                          {row.aiMatchScore}%
                        </span>
                      ) : (
                        <span className="text-text-tertiary">-</span>
                      )}
                    </td>

                    {/* TA Progress Status (Editable Cell) */}
                    <td className="py-3 px-4">
                      <select
                        value={row.taStatus}
                        onChange={(e) => handleStatusChange(row.applicationId, e.target.value)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer transition-all ${activeStatus.color}`}
                      >
                        {TA_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-surface text-text-primary">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Interview Date (Editable Cell) */}
                    <td className="py-3 px-4">
                      <input
                        type="date"
                        defaultValue={row.interviewDate}
                        onBlur={(e) => {
                          if (e.target.value !== row.interviewDate) {
                            handleInterviewDateChange(row.applicationId, e.target.value);
                          }
                        }}
                        className="px-2.5 py-1 text-xs rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </td>

                    {/* Recruiter Notes (Editable Cell) */}
                    <td className="py-3 px-4 relative">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Click to add notes..."
                          value={
                            editingNotesId === row.applicationId
                              ? localNotes[row.applicationId] ?? row.taNotes
                              : row.taNotes
                          }
                          onFocus={() => {
                            setEditingNotesId(row.applicationId);
                            setLocalNotes((prev) => ({ ...prev, [row.applicationId]: row.taNotes }));
                          }}
                          onChange={(e) => {
                            setLocalNotes((prev) => ({ ...prev, [row.applicationId]: e.target.value }));
                          }}
                          onBlur={() => handleNotesBlur(row.applicationId, row.taNotes)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleNotesBlur(row.applicationId, row.taNotes);
                            }
                          }}
                          className="w-full px-2.5 py-1 text-xs rounded-lg border border-transparent hover:border-border focus:border-emerald-500 bg-transparent hover:bg-surface focus:bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none transition-all"
                        />
                        {isSaved && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded shadow-sm animate-in fade-in">
                            <Check className="w-3 h-3" /> Saved
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Shortlisted By */}
                    <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <User className="w-3 h-3 text-text-tertiary" />
                        {row.recruiterName}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          BOTTOM STATUS FOOTER
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-surface-container/40 border-t border-border px-6 py-2.5 flex flex-wrap items-center justify-between text-[11px] text-text-tertiary">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Native In-App Grid: Edits save in real-time and auto-sync to SharePoint Online
        </span>
        <span className="flex items-center gap-1.5">
          Changes reflect in the SharePoint file in the background
        </span>
      </div>
    </div>
  );
}

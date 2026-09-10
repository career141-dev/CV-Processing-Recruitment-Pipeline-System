"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import {
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Loader2,
  Sparkles,
  Info,
} from "lucide-react";

// FortuneSheet CSS
import "@fortune-sheet/react/dist/index.css";

// Dynamic import with SSR disabled (FortuneSheet uses browser DOM/canvas)
const Workbook = dynamic(
  () => import("@fortune-sheet/react").then((m) => m.Workbook),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-96 gap-3 bg-surface border border-border rounded-xl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-medium text-text-secondary">
          Initializing in-app Excel engine...
        </span>
      </div>
    ),
  }
);

interface JobMasterSpreadsheetProps {
  jobId: Id<"jobs">;
}

const STANDARD_COLUMNS = [
  { header: "Date Shortlisted", width: 140 },
  { header: "Candidate Name", width: 180 },
  { header: "Current Role / Title", width: 200 },
  { header: "Email", width: 220 },
  { header: "Phone", width: 140 },
  { header: "Experience", width: 110 },
  { header: "AI Match Score", width: 130 },
  { header: "TA Progress Status", width: 160 },
  { header: "Shortlisted By", width: 140 },
  { header: "Recruiter Notes", width: 300 },
];

export function JobMasterSpreadsheet({ jobId }: JobMasterSpreadsheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Queries & Mutations
  const sheetQuery = useQuery(api.integrations.excelMutations.getJobSpreadsheetData, { jobId });
  const saveSpreadsheet = useMutation(api.integrations.excelMutations.saveJobSpreadsheetData);

  // Local state
  const [workbookSheets, setWorkbookSheets] = useState<any[] | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeDataRef = useRef<any[] | null>(null);

  // Helper to build initial candidate rows if no saved sheet exists
  const buildInitialSheet = useCallback((candidates: any[], jobTitle: string) => {
    const celldata: any[] = [];

    // 1. Header row (Row 0)
    STANDARD_COLUMNS.forEach((col, cIdx) => {
      celldata.push({
        r: 0,
        c: cIdx,
        v: {
          v: col.header,
          m: col.header,
          bg: "#0f172a", // Slate-900 header
          fc: "#ffffff",
          bl: 1,
          fs: 11,
          ht: 0, // Center
          vt: 0, // Middle
        },
      });
    });

    // 2. Candidate data rows (Row 1..N)
    candidates.forEach((cand, rIdx) => {
      const row = rIdx + 1;
      const formattedDate = new Date(cand.shortlistedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      const rowValues = [
        formattedDate,
        cand.candidateName,
        cand.role,
        cand.candidateEmail,
        cand.candidatePhone,
        cand.experience ? `${cand.experience} yrs` : "-",
        cand.aiMatchScore ? `${cand.aiMatchScore}%` : "Pending",
        "Shortlisted",
        cand.recruiterName,
        cand.notes || "",
      ];

      rowValues.forEach((val, cIdx) => {
        const isScore = cIdx === 6;
        const isStatus = cIdx === 7;

        let bg = row % 2 === 0 ? "#f8fafc" : "#ffffff";
        let fc = "#0f172a";
        let bl = isScore || isStatus ? 1 : 0;

        if (isScore && cand.aiMatchScore) {
          if (cand.aiMatchScore >= 80) fc = "#15803d"; // Green
          else if (cand.aiMatchScore >= 60) fc = "#d97706"; // Amber
          else fc = "#b91c1c"; // Red
        }

        celldata.push({
          r: row,
          c: cIdx,
          v: {
            v: val,
            m: String(val),
            bg,
            fc,
            bl,
            fs: 10,
            ht: cIdx === 1 || cIdx === 2 || cIdx === 9 ? 1 : 0, // Left-align name, role, notes
            vt: 0,
          },
        });
      });
    });

    return [
      {
        name: "Master Tracking",
        id: "master_tracking_1",
        row: Math.max(candidates.length + 30, 50),
        column: 20,
        defaultRowHeight: 28,
        defaultColWidth: 160,
        celldata,
      },
    ];
  }, []);

  // Initialize sheet data from Convex
  useEffect(() => {
    if (!sheetQuery || workbookSheets !== null) return;

    if (sheetQuery.savedSpreadsheetData) {
      try {
        const parsed = JSON.parse(sheetQuery.savedSpreadsheetData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWorkbookSheets(parsed);
          activeDataRef.current = parsed;
          if (sheetQuery.lastSavedAt) {
            setLastSavedTime(new Date(sheetQuery.lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
          return;
        }
      } catch (err) {
        console.error("Failed to parse saved spreadsheet JSON, regenerating:", err);
      }
    }

    // Default generation from live candidate rows
    const initial = buildInitialSheet(sheetQuery.candidateRows || [], sheetQuery.jobTitle || "Job");
    setWorkbookSheets(initial);
    activeDataRef.current = initial;
  }, [sheetQuery, workbookSheets, buildInitialSheet]);

  // Debounced auto-save handler
  const handleSheetChange = (data: any[]) => {
    activeDataRef.current = data;
    setSaveStatus("saving");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        const jsonStr = JSON.stringify(data);
        await saveSpreadsheet({
          jobId,
          spreadsheetData: jsonStr,
          savedBy: "Recruiter",
        });
        setSaveStatus("saved");
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (e: any) {
        console.error("Auto-save failed:", e);
        setSaveStatus("unsaved");
        toast.error("Auto-save failed. Check connection.");
      }
    }, 1200);
  };

  // Re-sync and append latest candidate rows
  const handleSyncLatestCandidates = () => {
    if (!sheetQuery?.candidateRows) return;
    const refreshed = buildInitialSheet(sheetQuery.candidateRows, sheetQuery.jobTitle || "Job");
    setWorkbookSheets(refreshed);
    handleSheetChange(refreshed);
    toast.success(`Spreadsheet refreshed with ${sheetQuery.candidateRows.length} shortlisted candidates!`);
  };

  // Export to native .xlsx via ExcelJS
  const handleExportXlsx = async () => {
    const currentSheets = activeDataRef.current || workbookSheets;
    if (!currentSheets || currentSheets.length === 0) {
      toast.error("No spreadsheet data available to export");
      return;
    }

    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Career141 Platform";
      workbook.created = new Date();

      currentSheets.forEach((sheetData) => {
        const worksheet = workbook.addWorksheet(sheetData.name || "Sheet1");

        // Set column widths
        STANDARD_COLUMNS.forEach((col, idx) => {
          worksheet.getColumn(idx + 1).width = Math.round(col.width / 7.5);
        });

        // Populate cells
        const celldata = sheetData.celldata || [];
        celldata.forEach((item: any) => {
          const rowNum = item.r + 1;
          const colNum = item.c + 1;
          const cell = worksheet.getRow(rowNum).getCell(colNum);
          const cellVal = item.v;

          if (cellVal) {
            if (cellVal.f) {
              cell.value = { formula: cellVal.f.replace(/^=/, ""), result: cellVal.v };
            } else {
              cell.value = cellVal.v ?? "";
            }

            // Bold
            if (cellVal.bl) cell.font = { bold: true };
            // Background fill
            if (cellVal.bg && cellVal.bg !== "#ffffff") {
              const hex = cellVal.bg.replace("#", "");
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: `FF${hex.toUpperCase()}` },
              };
            }
            // Font color
            if (cellVal.fc) {
              const hex = cellVal.fc.replace("#", "");
              cell.font = { ...cell.font, color: { argb: `FF${hex.toUpperCase()}` } };
            }
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cleanTitle = (sheetQuery?.jobTitle || "Job").replace(/[^a-zA-Z0-9_-]/g, "_");
      a.href = url;
      a.download = `${cleanTitle}_MasterTrackingSheet.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Excel spreadsheet exported successfully!");
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error("Failed to export Excel file: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Import .xlsx file into FortuneSheet
  const handleImportXlsx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const importedSheets: any[] = [];

      workbook.eachSheet((worksheet, sheetId) => {
        const celldata: any[] = [];

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const rawVal = cell.value;
            let displayVal = "";
            let formula = undefined;

            if (typeof rawVal === "object" && rawVal !== null && "formula" in rawVal) {
              formula = `=${(rawVal as any).formula}`;
              displayVal = String((rawVal as any).result ?? "");
            } else {
              displayVal = cell.text || String(rawVal ?? "");
            }

            celldata.push({
              r: rowNumber - 1,
              c: colNumber - 1,
              v: {
                v: typeof rawVal === "number" ? rawVal : displayVal,
                m: displayVal,
                f: formula,
                bl: cell.font?.bold ? 1 : 0,
              },
            });
          });
        });

        importedSheets.push({
          name: worksheet.name || `Sheet${sheetId}`,
          id: `sheet_${sheetId}`,
          row: Math.max(worksheet.rowCount + 20, 50),
          column: Math.max(worksheet.columnCount + 5, 20),
          defaultRowHeight: 28,
          defaultColWidth: 140,
          celldata,
        });
      });

      if (importedSheets.length > 0) {
        setWorkbookSheets(importedSheets);
        handleSheetChange(importedSheets);
        toast.success(`Imported "${file.name}" with ${importedSheets.length} sheet(s)!`);
      }
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error("Failed to import Excel file: " + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-surface border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-200 ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none h-screen w-screen" : "h-[750px] w-full"
      }`}
    >
      {/* Top Header & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-surface-bright border-b border-border select-none">
        {/* Left: Title & Auto-Save Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-text-primary flex items-center gap-2">
                Master Tracking Sheet
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Live In-App Excel
                </span>
              </div>
              <div className="text-[11px] text-text-secondary flex items-center gap-1.5">
                <span>{sheetQuery?.jobTitle || "Job"}</span>
                <span>•</span>
                <span>{sheetQuery?.candidateRows?.length || 0} shortlisted candidates</span>
              </div>
            </div>
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Auto-Save State Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium">
            {saveStatus === "saving" ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving to cloud...
              </span>
            ) : saveStatus === "saved" ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved {lastSavedTime ? `at ${lastSavedTime}` : "in Convex"}
              </span>
            ) : (
              <span className="text-rose-600 font-semibold">Unsaved changes</span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Re-sync Candidate Rows Button */}
          <button
            type="button"
            onClick={handleSyncLatestCandidates}
            title="Reload live candidate rows from pipeline"
            className="px-2.5 py-1.5 text-[12px] font-medium rounded-lg border border-border bg-surface hover:bg-surface-container transition-colors flex items-center gap-1.5 text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sync Candidates</span>
          </button>

          {/* Import .xlsx */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleImportXlsx}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            title="Import an existing .xlsx spreadsheet"
            className="px-2.5 py-1.5 text-[12px] font-medium rounded-lg border border-border bg-surface hover:bg-surface-container transition-colors flex items-center gap-1.5 text-text-secondary hover:text-text-primary cursor-pointer disabled:opacity-50"
          >
            {isImporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">Import .xlsx</span>
          </button>

          {/* Export .xlsx */}
          <button
            type="button"
            onClick={handleExportXlsx}
            disabled={isExporting}
            title="Download workbook as a standard Microsoft Excel .xlsx file"
            className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Export .xlsx</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-container transition-colors text-text-secondary hover:text-text-primary cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Spreadsheet Canvas Area */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-white dark:bg-slate-900">
        {workbookSheets && workbookSheets.length > 0 ? (
          <Workbook
            data={workbookSheets}
            onChange={handleSheetChange}
            showToolbar={true}
            showFormulaBar={true}
            showSheetTabs={true}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm font-medium text-text-secondary">
              Generating candidate spreadsheet...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

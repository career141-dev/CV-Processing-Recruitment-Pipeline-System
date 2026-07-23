"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  RefreshCw,
  Coins,
  FileText,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  Database,
  Trash2,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";

export default function TokenMonitorPage() {
  const { isAdmin } = useRole();
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [limit, setLimit] = useState(100);

  // Model pricing selection
  type ModelKey = "free" | "llama" | "gpt4o" | "deepseek";
  const [selectedModel, setSelectedModel] = useState<ModelKey>("deepseek");

  // Real-time reactive Convex queries (automatically reconnects & syncs live metrics)
  const queryMetrics = useQuery(api.stats.stats.getTokenMetrics);
  const queryLogs = useQuery(api.stats.stats.getRecentTokenLogs, { limit });

  // Action fallbacks for manual refresh
  const fetchTokenMetrics = useAction(api.stats.stats.getTokenMetricsAction);
  const fetchRecentTokenLogs = useAction(api.stats.stats.getRecentTokenLogsAction);

  // Local override state for manual refresh triggers
  const [manualMetrics, setManualMetrics] = useState<any>(null);
  const [manualLogs, setManualLogs] = useState<any[] | null>(null);

  const metrics = manualMetrics ?? queryMetrics ?? null;
  const logs = manualLogs ?? queryLogs ?? null;

  // Fetch logic helper with connection retry & error handling
  const loadData = React.useCallback(async () => {
    try {
      const [fetchedMetrics, fetchedLogs] = await Promise.all([
        fetchTokenMetrics().catch(() => null),
        fetchRecentTokenLogs({ limit }).catch(() => null),
      ]);
      if (fetchedMetrics) setManualMetrics(fetchedMetrics);
      if (fetchedLogs) setManualLogs(fetchedLogs);
    } catch (err: any) {
      console.warn("Failed to load token monitor stats via action, relying on real-time query:", err);
    }
  }, [fetchTokenMetrics, fetchRecentTokenLogs, limit]);

  // Reset manual overrides when query updates
  useEffect(() => {
    if (queryMetrics) setManualMetrics(null);
    if (queryLogs) setManualLogs(null);
  }, [queryMetrics, queryLogs]);

  // Mutations
  const clearLogs = useMutation(api.stats.stats.clearAllTokenLogs);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    toast.success("Usage metrics refreshed successfully.");
  };

  const handleResetLogs = async () => {
    try {
      const res = await clearLogs();
      setIsResetModalOpen(false);
      setManualMetrics(null);
      setManualLogs(null);
      toast.success(`Purged ${res.count} token logs from the system.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to clear token logs.");
    }
  };

  // Cost charting filters & calculations
  const [chartMode, setChartMode] = useState<"all" | "cv_extraction">("all");

  const [activeProviderTab, setActiveProviderTab] = useState<"openrouter" | "nvidia">("openrouter");
  const [openrouterSubTab, setOpenrouterSubTab] = useState<"deepseek" | "gemma">("deepseek");

  const filteredLogs = logs?.filter((log) => {
    const matchesType =
      taskTypeFilter === "all" || log.taskType === taskTypeFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "success" && log.success) ||
      (statusFilter === "failure" && !log.success);

    let matchesProvider = true;
    const isDeepSeek = log.model.toLowerCase().includes("deepseek");
    const isGemma = log.model.toLowerCase().includes("gemma");
    const isNvidia = log.provider === "nvidia" || log.taskType === "embedding" || log.model.includes("nvidia");

    if (providerFilter === "deepseek") matchesProvider = isDeepSeek;
    else if (providerFilter === "openrouter_free") matchesProvider = isGemma || log.model.includes(":free");
    else if (providerFilter === "nvidia") matchesProvider = isNvidia;

    return matchesType && matchesStatus && matchesProvider;
  });

  // Extract structured metrics from backend
  const dsMetrics = metrics?.openrouterDeepseek ?? {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalCost: 0,
    candidatesAddedCount: 0,
    totalCalls: 0,
    successCalls: 0,
  };

  const gemmaMetrics = metrics?.openrouterGemma ?? {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalCost: 0,
    candidatesAddedCount: 0,
    totalCalls: 0,
    successCalls: 0,
  };

  const nvidiaMetrics = metrics?.nvidiaEmbedding ?? {
    totalTokens: 0,
    totalCost: 0,
    totalCalls: 0,
    successCalls: 0,
  };

  const getDailyCosts = (d: any) => {
    return {
      totalCost: d.totalCost ?? 0,
      cvExtractionCost: d.cvExtractionCost ?? 0,
    };
  };

  const getLogCost = (log: any) => {
    if (!log.success) return 0;
    return log.estimatedCost ?? 0;
  };

  // SVG Chart Dimensions
  const chartHeight = 160;
  const chartWidth = 500;
  const barPadding = 12;

  const maxCostInChart = metrics?.dailyChartData?.reduce((max: number, d: any) => {
    const dailyCosts = getDailyCosts(d);
    const val = chartMode === "all" ? dailyCosts.totalCost : dailyCosts.cvExtractionCost;
    return val > max ? val : max;
  }, 0.001) || 0.001;

  // Formatting helpers
  const formatCost = (val: number) => {
    if (val === 0) return "$0.000";
    if (val < 0.01) return `$${val.toFixed(5)}`;
    return `$${val.toFixed(3)}`;
  };

  const formatTokens = (val: number) => {
    return val.toLocaleString();
  };

  const getTaskBadgeStyles = (type: string) => {
    switch (type) {
      case "cv_structuring":
        return "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30";
      case "jd_matching":
        return "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/30";
      case "jd_extraction":
        return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30";
      case "embedding":
        return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30";
      case "cv_vision_ocr":
        return "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/30";
      default:
        return "bg-gray-50 text-gray-700 border-gray-100 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800/30";
    }
  };

  const getTaskLabel = (type: string) => {
    switch (type) {
      case "cv_structuring":
        return "CV Extraction";
      case "jd_matching":
        return "AI Match Scoring";
      case "jd_extraction":
        return "Search Query Parse";
      case "embedding":
        return "Vector Embedding";
      case "cv_vision_ocr":
        return "Vision OCR (Scanned CV)";
      default:
        return type;
    }
  };

  return (
    <div className="flex flex-col items-stretch self-stretch min-h-screen bg-background pb-12 w-full">
      <PageHeader title="NVIDIA API Token Usage & Cost Monitor" />

      {/* Container wrapper */}
      <div className="px-6 flex flex-col gap-6 w-full max-w-7xl mx-auto">
        
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center bg-surface border border-border p-4 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Observability Console</h1>
            <p className="text-xs text-text-secondary">
              Review and audit your real-time NVIDIA integrate API credits consumption.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 py-2 px-4 rounded-xl border border-border bg-surface hover:bg-surface-container-high text-xs font-semibold text-text-primary transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh Metrics
            </button>
            {isAdmin && (
              <button
                onClick={() => setIsResetModalOpen(true)}
                className="flex items-center gap-2 py-2 px-4 rounded-xl border border-red-200 hover:border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-xs font-semibold transition-all hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Logs
              </button>
            )}
          </div>
        </div>

        {/* Provider Selection Tabs */}
        <div className="flex items-center justify-between border-b border-border pb-1">
          <div className="flex items-center gap-2 bg-surface-container-high p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveProviderTab("openrouter")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeProviderTab === "openrouter"
                  ? "bg-surface text-text-primary shadow-sm border border-border/10"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              <span>OpenRouter API</span>
            </button>
            <button
              onClick={() => setActiveProviderTab("nvidia")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeProviderTab === "nvidia"
                  ? "bg-surface text-text-primary shadow-sm border border-border/10"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span>NVIDIA API (Embeddings)</span>
            </button>
          </div>
        </div>

        {/* Tab 1: OpenRouter API View */}
        {activeProviderTab === "openrouter" && (
          <div className="flex flex-col gap-5">
            {/* OpenRouter Model Sub-Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpenrouterSubTab("deepseek")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  openrouterSubTab === "deepseek"
                    ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/40 shadow-sm"
                    : "bg-surface text-text-secondary border-border hover:bg-surface-container-high"
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <span>DeepSeek V4 Flash (Primary)</span>
              </button>
              <button
                onClick={() => setOpenrouterSubTab("gemma")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  openrouterSubTab === "gemma"
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/40 shadow-sm"
                    : "bg-surface text-text-secondary border-border hover:bg-surface-container-high"
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span>Gemma 4 26B (Free Fallback)</span>
              </button>
            </div>

            {/* Sub-Tab A: DeepSeek V4 Flash KPI Grid */}
            {openrouterSubTab === "deepseek" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Candidates Added (CVs Parsed) */}
                <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm group">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-text-secondary">Candidates Added (CVs Parsed)</span>
                    <span className="text-3xl font-black text-text-primary tabular-nums">
                      {dsMetrics.candidatesAddedCount}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      Parsed & stored in database
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>

                {/* Card 2: Calculated Spend */}
                <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm group">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-text-secondary">Calculated Spend ($)</span>
                    <span className="text-3xl font-black text-text-primary tabular-nums">
                      {formatCost(dsMetrics.totalCost)}
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      Input: $0.14/M • Output: $0.28/M
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950 text-amber-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                    <Coins className="w-6 h-6" />
                  </div>
                </div>

                {/* Card 3: Tokens Used */}
                <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm group">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-text-secondary">Tokens Used</span>
                    <span className="text-3xl font-black text-text-primary tabular-nums">
                      {formatTokens(dsMetrics.totalTokens)}
                    </span>
                    <span className="text-[10px] text-text-secondary font-mono">
                      In: {formatTokens(dsMetrics.promptTokens)} • Out: {formatTokens(dsMetrics.completionTokens)}
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>

                {/* Card 4: Total API Calls */}
                <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm group">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-text-secondary">API Invocations</span>
                    <span className="text-3xl font-black text-text-primary tabular-nums">
                      {dsMetrics.totalCalls}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {dsMetrics.totalCalls > 0 ? ((dsMetrics.successCalls / dsMetrics.totalCalls) * 100).toFixed(1) : "100"}% Success Rate
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab B: Gemma 4 26B (Free) KPI Grid */}
            {openrouterSubTab === "gemma" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Scanned Candidates Added */}
                <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm group">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-text-secondary">Scanned Candidates Added</span>
                    <span className="text-3xl font-black text-text-primary tabular-nums">
                      {gemmaMetrics.candidatesAddedCount}
                    </span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                      Scanned / Image CVs parsed
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>

                {/* Card 2: Calculated Spend */}
                <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm group">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-text-secondary">Calculated Spend ($)</span>
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      $0.000
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      OpenRouter Free Tier
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                    <Coins className="w-6 h-6" />
                  </div>
                </div>

                {/* Card 3: Tokens Used */}
                <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm group">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-text-secondary">Tokens Used</span>
                    <span className="text-3xl font-black text-text-primary tabular-nums">
                      {formatTokens(gemmaMetrics.totalTokens)}
                    </span>
                    <span className="text-[10px] text-text-secondary font-mono">
                      In: {formatTokens(gemmaMetrics.promptTokens)} • Out: {formatTokens(gemmaMetrics.completionTokens)}
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>

                {/* Card 4: Total API Calls */}
                <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm group">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-text-secondary">OCR Invocations</span>
                    <span className="text-3xl font-black text-text-primary tabular-nums">
                      {gemmaMetrics.totalCalls}
                    </span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                      {gemmaMetrics.totalCalls > 0 ? ((gemmaMetrics.successCalls / gemmaMetrics.totalCalls) * 100).toFixed(1) : "100"}% Success Rate
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                    <Activity className="w-6 h-6" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: NVIDIA API View (Embeddings Only) */}
        {activeProviderTab === "nvidia" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Total Vector Embedding Operations */}
            <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm group">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-text-secondary">Vector Embedding Operations</span>
                <span className="text-3xl font-black text-text-primary tabular-nums">
                  {nvidiaMetrics.totalCalls}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  nvidia/nv-embedqa-e5-v5
                </span>
              </div>
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                <Database className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2: Calculated Spend */}
            <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm group">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-text-secondary">Calculated Spend ($)</span>
                <span className="text-3xl font-black text-text-primary tabular-nums">
                  {formatCost(nvidiaMetrics.totalCost)}
                </span>
                <span className="text-[10px] text-text-secondary">
                  Rate: $0.07 / 1,000,000 tokens
                </span>
              </div>
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950 text-amber-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                <Coins className="w-6 h-6" />
              </div>
            </div>

            {/* Card 3: Prompt Tokens Used */}
            <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm group">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-text-secondary">Prompt Tokens Used</span>
                <span className="text-3xl font-black text-text-primary tabular-nums">
                  {formatTokens(nvidiaMetrics.totalTokens)}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  {nvidiaMetrics.totalCalls > 0 ? ((nvidiaMetrics.successCalls / nvidiaMetrics.totalCalls) * 100).toFixed(1) : "100"}% Success Rate
                </span>
              </div>
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>
        )}

        {/* Charts & Breakdown Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Daily Costs Chart Card */}
          <div className="bg-surface border border-border p-5 rounded-2xl shadow-sm flex flex-col gap-4 lg:col-span-2">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-text-secondary" />
                  Daily API Ingestion Credit Spend
                </h2>
                <p className="text-[10px] text-text-secondary">
                  Last 7 days credit spending patterns.
                </p>
              </div>
              <div className="flex bg-surface-container-high rounded-lg p-0.5 border border-border">
                <button
                  onClick={() => setChartMode("all")}
                  className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-all ${chartMode === "all" ? "bg-surface text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
                >
                  All Operations
                </button>
                <button
                  onClick={() => setChartMode("cv_extraction")}
                  className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-all ${chartMode === "cv_extraction" ? "bg-surface text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
                >
                  CV Extractions Only
                </button>
              </div>
            </div>

            {/* SVG Custom Graph */}
            <div className="flex items-center justify-center bg-surface-container-lowest/50 rounded-xl p-4 border border-border/50 min-h-[200px]">
              {metrics?.dailyChartData && metrics.dailyChartData.length > 0 ? (
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
                  className="w-full max-w-full overflow-visible"
                >
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = chartHeight * (1 - ratio);
                    const gridVal = maxCostInChart * ratio;
                    return (
                      <g key={ratio}>
                        <line
                          x1="45"
                          y1={y}
                          x2={chartWidth}
                          y2={y}
                          stroke="var(--border)"
                          strokeWidth="0.5"
                          strokeDasharray="4 4"
                        />
                        <text
                          x="0"
                          y={y + 3}
                          fontSize="9"
                          fontWeight="600"
                          fill="var(--text-disabled)"
                          className="tabular-nums font-mono"
                        >
                          {formatCost(gridVal)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Bars & Labels */}
                  {metrics.dailyChartData.map((d: any, index: number) => {
                    const barCount = metrics.dailyChartData.length;
                    const blockWidth = (chartWidth - 50) / barCount;
                    const x = 50 + index * blockWidth;
                    
                    const dailyCosts = getDailyCosts(d);
                    const costVal = chartMode === "all" ? dailyCosts.totalCost : dailyCosts.cvExtractionCost;
                    const normalizedHeight = (costVal / maxCostInChart) * chartHeight;
                    const y = chartHeight - normalizedHeight;
                    const barW = blockWidth - barPadding;

                    const dateLabel = new Date(d.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });

                    return (
                      <g key={d.date} className="group/bar cursor-pointer">
                        {/* Bar Segment */}
                        <rect
                          x={x + barPadding / 2}
                          y={y}
                          width={barW}
                          height={Math.max(2, normalizedHeight)}
                          rx="4"
                          fill={chartMode === "all" ? "var(--primary-container)" : "var(--primary)"}
                          className="hover:opacity-90 transition-all duration-300 fill-[#1565C0] dark:fill-[#2196F3]"
                        />

                        {/* Cost value on hover */}
                        <g className="opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200">
                          <rect
                            x={x + barPadding / 2 - 15}
                            y={Math.max(0, y - 20)}
                            width={barW + 30}
                            height="16"
                            rx="4"
                            fill="var(--text-primary)"
                          />
                          <text
                            x={x + blockWidth / 2}
                            y={Math.max(11, y - 8)}
                            textAnchor="middle"
                            fontSize="8"
                            fontWeight="bold"
                            fill="var(--background)"
                            className="font-mono"
                          >
                            {formatCost(costVal)}
                          </text>
                        </g>

                        {/* Date label at bottom */}
                        <text
                          x={x + blockWidth / 2}
                          y={chartHeight + 16}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="bold"
                          fill="var(--text-secondary)"
                        >
                          {dateLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-text-disabled">
                  <Database className="w-8 h-8 mb-2 animate-pulse" />
                  <p className="text-xs">No daily charting metrics found.</p>
                </div>
              )}
            </div>
          </div>

          {/* Task Breakdown Card */}
          <div className="bg-surface border border-border p-5 rounded-2xl shadow-sm flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-text-secondary" />
                Distribution by Operation type
              </h2>
              <p className="text-[10px] text-text-secondary">
                Where your API credits are going.
              </p>
            </div>

            <div className="flex flex-col gap-4 justify-center flex-1">
              {metrics && Object.keys(metrics.taskBreakdown).length > 0 ? (
                Object.entries(metrics.taskBreakdown).map(([task, details]: [string, any]) => {
                  const taskCost = details.credits ?? 0;
                  const totalSpent = metrics.overall?.totalCredits || 1;
                  const share = (taskCost / (totalSpent || 1)) * 100;
                  
                  // Simple color selector
                  const getTaskBarColor = (t: string) => {
                    if (t === "cv_structuring") return "bg-[#1565C0]";
                    if (t === "jd_matching") return "bg-[#7B1FA2]";
                    return "bg-[#388E3C]";
                  };

                  return (
                    <div key={task} className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-text-primary">{getTaskLabel(task)}</span>
                        <span className="text-text-secondary tabular-nums">
                          {formatCost(taskCost)} ({share.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-border h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getTaskBarColor(task)}`}
                          style={{ width: `${share}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-text-disabled font-medium">
                        <span>{details.count} API calls</span>
                        <span>{formatTokens(details.tokens)} tokens</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-text-disabled">
                  <Database className="w-8 h-8 mb-2" />
                  <p className="text-xs">No distribution records found.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Requests & Auditing Logs Table */}
        <div className="bg-surface border border-border p-5 rounded-2xl shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                <Database className="w-4 h-4 text-text-secondary" />
                NVIDIA API Invocations Auditing
              </h2>
              <p className="text-[10px] text-text-secondary">
                Detailed transaction records linking token usage to specific CV files and processes.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 border border-border rounded-xl px-3 py-1.5 bg-surface-container-lowest">
                <Filter className="w-3.5 h-3.5 text-text-secondary" />
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="bg-transparent text-xs text-text-primary border-none focus:outline-none cursor-pointer font-semibold"
                >
                  <option value="all">All Providers & Models</option>
                  <option value="deepseek">DeepSeek V4 Flash Only</option>
                  <option value="openrouter_free">OpenRouter Free Models</option>
                  <option value="nvidia">NVIDIA API Only</option>
                </select>
              </div>

              <div className="flex items-center gap-1 border border-border rounded-xl px-3 py-1.5 bg-surface-container-lowest">
                <select
                  value={taskTypeFilter}
                  onChange={(e) => setTaskTypeFilter(e.target.value)}
                  className="bg-transparent text-xs text-text-primary border-none focus:outline-none cursor-pointer font-semibold"
                >
                  <option value="all">All Tasks</option>
                  <option value="cv_structuring">CV Extraction</option>
                  <option value="jd_matching">AI Match Scoring</option>
                  <option value="jd_extraction">Search Query Parse</option>
                  <option value="embedding">Vector Embeddings</option>
                  <option value="cv_vision_ocr">Vision OCR (Scanned CV)</option>
                </select>
              </div>

              <div className="flex items-center gap-1 border border-border rounded-xl px-3 py-1.5 bg-surface-container-lowest">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs text-text-primary border-none focus:outline-none cursor-pointer font-semibold"
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-border rounded-xl bg-surface-container-lowest">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-border text-[11px] font-bold text-text-secondary uppercase">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Task</th>
                  <th className="py-3 px-4">Provider & Model</th>
                  <th className="py-3 px-4 text-right">Prompt / Comp</th>
                  <th className="py-3 px-4">CV Upload Link / Process</th>
                  <th className="py-3 px-4 text-right">Calculated Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {filteredLogs && filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    const localTime = new Date(log.timestamp).toLocaleString();
                    const isNvidia = log.provider === "nvidia" || log.taskType === "cv_vision_ocr" || log.taskType === "embedding" || log.model.includes("nvidia");
                    return (
                      <tr
                        key={log._id}
                        className="hover:bg-surface-container-low transition-colors"
                      >
                        {/* Status */}
                        <td className="py-3 px-4">
                          {log.success ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <CheckCircle className="w-4 h-4 shrink-0" />
                              OK
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold" title={log.error}>
                              <XCircle className="w-4 h-4 shrink-0" />
                              ERR
                            </span>
                          )}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-4 text-text-secondary font-medium tabular-nums whitespace-nowrap">
                          {localTime}
                        </td>

                        {/* Task Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`border text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getTaskBadgeStyles(
                              log.taskType
                            )}`}
                          >
                            {getTaskLabel(log.taskType)}
                          </span>
                        </td>

                        {/* Provider & Model */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold w-max ${
                                isNvidia
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                              }`}
                            >
                              {isNvidia ? "NVIDIA API" : "OpenRouter API"}
                            </span>
                            <span className="text-text-primary font-mono text-[10px] font-bold">
                              {log.model}
                            </span>
                          </div>
                        </td>

                        {/* Tokens */}
                        <td className="py-3 px-4 text-right font-medium text-text-primary tabular-nums">
                          {log.success ? (
                            <>
                              <span className="text-text-primary font-bold">{formatTokens(log.promptTokens)}</span>
                              <span className="text-text-disabled mx-1">/</span>
                              <span className="text-text-secondary">{formatTokens(log.completionTokens)}</span>
                            </>
                          ) : (
                            <span className="text-text-disabled">—</span>
                          )}
                        </td>

                        {/* CV link */}
                        <td className="py-3 px-4">
                          {log.cvUploadId ? (
                            <div className="flex flex-col gap-0.5 max-w-[220px]">
                              <span className="font-semibold text-primary-container truncate" title={log.fileName}>
                                {log.fileName || "Parsed CV File"}
                              </span>
                              {log.candidateName && (
                                <span className="text-[10px] text-text-secondary">
                                  Candidate: {log.candidateName}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-text-disabled italic">System action</span>
                          )}
                        </td>

                        {/* Cost */}
                        <td className="py-3 px-4 text-right font-bold text-text-primary font-mono tabular-nums">
                          {formatCost(getLogCost(log))}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-text-disabled italic"
                    >
                      No NVIDIA call transactions match your selected filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Load More Controls */}
          {filteredLogs && filteredLogs.length >= limit && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => setLimit((prev) => prev + 20)}
                className="py-2 px-6 rounded-xl border border-border text-xs font-bold text-text-primary bg-surface hover:bg-surface-container-high transition-all"
              >
                Load 20 More
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Confirmation Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-base font-bold text-text-primary">Clear Token Log History</h3>
              <p className="text-xs text-text-secondary mt-1">
                Are you sure you want to permanently delete all NVIDIA API token logs? This action is irreversible and will delete credit monitoring details.
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="py-2 px-4 rounded-xl border border-border bg-surface hover:bg-surface-container-high text-xs font-semibold text-text-primary transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleResetLogs}
                className="py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-sm"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

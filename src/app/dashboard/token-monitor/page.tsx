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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [limit, setLimit] = useState(20);

  // Model pricing selection
  type ModelKey = "llama" | "gpt4o" | "deepseek";
  const [selectedModel, setSelectedModel] = useState<ModelKey>("llama");

  // Actions
  const fetchTokenMetrics = useAction(api.stats.stats.getTokenMetricsAction);
  const fetchRecentTokenLogs = useAction(api.stats.stats.getRecentTokenLogsAction);

  // Local state
  const [metrics, setMetrics] = useState<any>(null);
  const [logs, setLogs] = useState<any[] | null>(null);

  // Fetch logic helper
  const loadData = React.useCallback(async () => {
    try {
      const [fetchedMetrics, fetchedLogs] = await Promise.all([
        fetchTokenMetrics(),
        fetchRecentTokenLogs({ limit }),
      ]);
      setMetrics(fetchedMetrics);
      setLogs(fetchedLogs);
    } catch (err: any) {
      console.error("Failed to load token monitor stats", err);
    }
  }, [fetchTokenMetrics, fetchRecentTokenLogs, limit]);

  // Load data on mount or limit change
  useEffect(() => {
    loadData();
  }, [loadData]);

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
      await loadData();
      toast.success(`Purged ${res.count} token logs from the system.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to clear token logs.");
    }
  };

  // Cost charting filters & calculations
  const [chartMode, setChartMode] = useState<"all" | "cv_extraction">("all");

  const filteredLogs = logs?.filter((log) => {
    const matchesType =
      taskTypeFilter === "all" || log.taskType === taskTypeFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "success" && log.success) ||
      (statusFilter === "failure" && !log.success);
    return matchesType && matchesStatus;
  });

  const getPricingForModel = (model: ModelKey) => {
    switch (model) {
      case "llama":
        return { name: "Llama 3.1 70B Instruct", input: 0.40, output: 0.40 };
      case "gpt4o":
        return { name: "ChatGPT-4o-mini", input: 0.15, output: 0.60 };
      case "deepseek":
        return { name: "DeepSeek V4 Flash", input: 0.09, output: 0.18 };
    }
  };

  const calculateCost = (model: ModelKey, prompt: number, completion: number, isEmbedding = false) => {
    if (isEmbedding) {
      return (prompt + completion) * (0.07 / 1_000_000);
    }
    const pricing = getPricingForModel(model);
    return (prompt * pricing.input + completion * pricing.output) / 1_000_000;
  };

  // Recompute cost metrics dynamically based on selectedModel and the actual token counts
  let totalCredits = 0;
  let cvExtractionCredits = 0;
  if (metrics) {
    Object.entries(metrics.taskBreakdown).forEach(([task, details]: [string, any]) => {
      const prompt = details.promptTokens ?? (details.tokens * 0.7);
      const comp = details.completionTokens ?? (details.tokens * 0.3);
      const isEmbedding = task === "embedding";
      const cost = calculateCost(selectedModel, prompt, comp, isEmbedding);
      totalCredits += cost;
      if (task === "cv_structuring") {
        cvExtractionCredits = cost;
      }
    });
  }
  const avgCostPerCv = metrics?.cvExtraction.totalCvExtractionsCount > 0
    ? cvExtractionCredits / metrics.cvExtraction.totalCvExtractionsCount
    : 0;

  const getDailyCosts = (d: any) => {
    const hasTokens = d.promptTokens !== undefined && d.completionTokens !== undefined;
    
    let prompt = d.promptTokens ?? 0;
    let comp = d.completionTokens ?? 0;
    let cvPrompt = d.cvPromptTokens ?? 0;
    let cvComp = d.cvCompletionTokens ?? 0;
    
    if (!hasTokens) {
      // Estimate from legacy cost using $0.40/M Llama rate
      const estimatedTotalTokens = d.totalCost / (0.40 / 1_000_000);
      prompt = estimatedTotalTokens * 0.7;
      comp = estimatedTotalTokens * 0.3;
      
      const estimatedCvTokens = d.cvExtractionCost / (0.40 / 1_000_000);
      cvPrompt = estimatedCvTokens * 0.7;
      cvComp = estimatedCvTokens * 0.3;
    }

    const totalCost = calculateCost(selectedModel, prompt, comp, false);
    const cvExtractionCost = calculateCost(selectedModel, cvPrompt, cvComp, false);
    
    return { totalCost, cvExtractionCost };
  };

  const getLogCost = (log: any) => {
    if (!log.success) return 0;
    const isEmbedding = log.taskType === "embedding" || log.model.toLowerCase().includes("embed") || log.model.toLowerCase().includes("bge");
    return calculateCost(selectedModel, log.promptTokens, log.completionTokens, isEmbedding);
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
      case "embedding":
        return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30";
      default:
        return "bg-gray-50 text-gray-700 border-gray-100 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800/30";
    }
  };

  const getTaskLabel = (type: string) => {
    switch (type) {
      case "cv_structuring":
        return "CV Extraction";
      case "jd_matching":
        return "Search Query Parse";
      case "embedding":
        return "Vector Embedding";
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

        {/* Model Pricing Comparison Tabs */}
        <div className="flex flex-wrap bg-surface-container-high rounded-xl p-1 border border-border self-start gap-1">
          {[
            { key: "llama", label: "Llama 3.1 70B Instruct", price: "In/Out: $0.40/M" },
            { key: "gpt4o", label: "GPT-4o-mini", price: "In: $0.15 / Out: $0.60/M" },
            { key: "deepseek", label: "DeepSeek V4 Flash", price: "In: $0.09 / Out: $0.18/M" },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedModel(m.key as any)}
              className={`flex flex-col items-center gap-0.5 px-6 py-2 rounded-lg text-xs font-bold transition-all ${
                selectedModel === m.key
                  ? "bg-surface text-text-primary shadow-sm border border-border/10"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <span>{m.label}</span>
              <span className="text-[10px] opacity-70 font-medium font-mono">{m.price}</span>
            </button>
          ))}
        </div>

        {/* Dashboard KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* KPI 1: Estimated Total Credits */}
          <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group">
            <div className="flex flex-col gap-1 z-10">
              <span className="text-xs font-medium text-text-secondary">Estimated Total Spent</span>
              <span className="text-2xl font-black text-text-primary tabular-nums">
                {metrics ? formatCost(totalCredits) : "$0.000"}
              </span>
              <span className="text-[10px] text-text-disabled">
                Across {metrics ? formatTokens(metrics.overall.totalTokens) : 0} tokens
              </span>
            </div>
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950 rounded-2xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition-all">
              <Coins className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 2: Average Cost per CV Ingest */}
          <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group">
            <div className="flex flex-col gap-1 z-10">
              <span className="text-xs font-medium text-text-secondary">Avg. Cost / CV Extraction</span>
              <span className="text-2xl font-black text-text-primary tabular-nums text-primary-container">
                {metrics ? formatCost(avgCostPerCv) : "$0.000"}
              </span>
              <span className="text-[10px] text-text-disabled">
                Successful extractions: {metrics?.cvExtraction.totalCvExtractionsCount || 0}
              </span>
            </div>
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-all">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 3: Total CV Ingestion Spend */}
          <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group">
            <div className="flex flex-col gap-1 z-10">
              <span className="text-xs font-medium text-text-secondary">CV Ingestion Cost</span>
              <span className="text-2xl font-black text-text-primary tabular-nums">
                {metrics ? formatCost(cvExtractionCredits) : "$0.000"}
              </span>
              <span className="text-[10px] text-text-disabled">
                {totalCredits > 0 ? ((cvExtractionCredits / totalCredits) * 100).toFixed(0) : "0"}% of total credit usage
              </span>
            </div>
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/10 rounded-2xl flex items-center justify-center text-purple-500 group-hover:scale-110 transition-all">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 4: API Success Rate */}
          <div className="bg-surface border border-border p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden group">
            <div className="flex flex-col gap-1 z-10">
              <span className="text-xs font-medium text-text-secondary">API Success Rate</span>
              <span className="text-2xl font-black text-text-primary tabular-nums">
                {metrics ? `${metrics.overall.successRate.toFixed(1)}%` : "100%"}
              </span>
              <span className="text-[10px] text-text-disabled">
                Total API calls: {metrics?.overall.totalRequests || 0}
              </span>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all ${(metrics?.overall.successRate || 0) >= 95 ? "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/10" : "bg-red-50 text-red-500 dark:bg-red-900/10"}`}>
              <Activity className="w-6 h-6" />
            </div>
          </div>

        </div>

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
                  const prompt = details.promptTokens ?? (details.tokens * 0.7);
                  const comp = details.completionTokens ?? (details.tokens * 0.3);
                  const isEmbedding = task === "embedding";
                  const taskCost = calculateCost(selectedModel, prompt, comp, isEmbedding);
                  const share = (taskCost / (totalCredits || 1)) * 100;
                  
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
                  value={taskTypeFilter}
                  onChange={(e) => setTaskTypeFilter(e.target.value)}
                  className="bg-transparent text-xs text-text-primary border-none focus:outline-none cursor-pointer font-semibold"
                >
                  <option value="all">All Tasks</option>
                  <option value="cv_structuring">CV Extraction</option>
                  <option value="jd_matching">Search Query Parse</option>
                  <option value="embedding">Vector Embeddings</option>
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
                  <th className="py-3 px-4">NVIDIA Model</th>
                  <th className="py-3 px-4 text-right">Prompt / Comp</th>
                  <th className="py-3 px-4">CV Upload Link / Process</th>
                  <th className="py-3 px-4 text-right">Calculated Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {filteredLogs && filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    const localTime = new Date(log.timestamp).toLocaleString();
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

                        {/* Model */}
                        <td className="py-3 px-4 text-text-primary font-mono text-[10px] font-bold">
                          {log.model}
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

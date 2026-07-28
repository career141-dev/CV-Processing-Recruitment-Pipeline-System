"use client";

import React, { useState } from "react";
import { 
  AlertOctagon, 
  UserX, 
  ShieldAlert, 
  Layers, 
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { useErrorPopup } from "@/components/ui/ErrorPopupProvider";
import { toast } from "sonner";

export default function TestErrorsPage() {
  const { showError } = useErrorPopup();
  const [customErrorText, setCustomErrorText] = useState("");

  const triggerError = (rawMsg: string, title?: string) => {
    try {
      throw new Error(rawMsg);
    } catch (e: any) {
      showError(e, title ? { title } : undefined);
    }
  };

  const triggerCustomActionError = () => {
    try {
      throw new Error("Missing mandatory Follow-up data (CV, Current Salary, Expected Salary, Notice Period). Please log a manual call to complete the profile.");
    } catch (e: any) {
      showError(e, {
        title: "Action Required: Missing Info",
        actionLabel: "Log Manual Call Now",
        onAction: () => {
          toast.success("Redirecting to call logger... Callback successfully executed!");
        }
      });
    }
  };

  const testScenarios = [
    {
      title: "Missing 2nd Shortlist Profile Details",
      description: "Triggered when a recruiter attempts to transition a candidate to 2nd Shortlist without the 4 mandatory follow-up data points (CV, Current Salary, Expected Salary, Notice Period).",
      rawMessage: "Cannot move to 2nd Shortlist: Missing mandatory Follow-up data (CV, Current Salary, Expected Salary, Notice Period). Please log a manual call to complete the profile.",
      icon: <Layers className="w-5 h-5 text-amber-500" />,
      colorClass: "border-amber-200 bg-amber-500/5 hover:bg-amber-500/10",
      btnClass: "bg-amber-600 hover:bg-amber-700 shadow-amber-600/15"
    },
    {
      title: "Duplicate Job Routing Keyword",
      description: "Triggered when trying to create or publish a job posting using a tracking keyword that is already actively assigned to another job.",
      rawMessage: 'The keyword "SENIOR-DEV-24" is already in use. Please choose another one.',
      icon: <AlertOctagon className="w-5 h-5 text-orange-500" />,
      colorClass: "border-orange-200 bg-orange-500/5 hover:bg-orange-500/10",
      btnClass: "bg-orange-600 hover:bg-orange-700 shadow-orange-600/15"
    },
    {
      title: "Access Denied (403 Restriction)",
      description: "Triggered when a user tries to access a feature or edit data that their workspace role (e.g. Viewer or Recruiter) restricts them from accessing.",
      rawMessage: "[403] Access denied. Your role (viewer) does not have permission to execute this feature. Required role: admin | ta_manager | senior_ta",
      icon: <ShieldAlert className="w-5 h-5 text-violet-500" />,
      colorClass: "border-violet-200 bg-violet-500/5 hover:bg-violet-500/10",
      btnClass: "bg-violet-600 hover:bg-violet-700 shadow-violet-600/15"
    },
    {
      title: "Job Unassigned Access Barrier",
      description: "Triggered when a recruiter attempts to manage candidates or transition stages for a job they are not assigned to as primary or supporting recruiter.",
      rawMessage: "You are not assigned to this job with the required role to execute stage transition.",
      icon: <UserX className="w-5 h-5 text-purple-500" />,
      colorClass: "border-purple-200 bg-purple-500/5 hover:bg-purple-500/10",
      btnClass: "bg-purple-600 hover:bg-purple-700 shadow-purple-600/15"
    },
    {
      title: "Deactivated Account / Session Expired",
      description: "Triggered when the current session's validation fails on the backend, or the database indicates that the user's account has been deactivated.",
      rawMessage: "Account deactivated. Please contact your manager.",
      icon: <UserX className="w-5 h-5 text-rose-500" />,
      colorClass: "border-rose-200 bg-rose-500/5 hover:bg-rose-500/10",
      btnClass: "bg-rose-600 hover:bg-rose-700 shadow-rose-600/15"
    },
    {
      title: "Invalid Pipeline Transition State",
      description: "Triggered when trying to shortlist a candidate that is already moved past the ingestion stage, violates stage history, or is in an invalid stage.",
      rawMessage: "Can only shortlist from Stage 1 (New CVs)",
      icon: <HelpCircle className="w-5 h-5 text-yellow-500" />,
      colorClass: "border-yellow-200 bg-yellow-500/5 hover:bg-yellow-500/10",
      btnClass: "bg-yellow-600 hover:bg-yellow-700 shadow-yellow-600/15"
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-1">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-primary" />
            <span>Error Management Audit & Visual Testbed</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Validate translations, micro-animations, glassmorphic layout, and user-friendly resolutions of the global Error popup.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => toast.success("Testbed metrics updated!")}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-350 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Logs</span>
          </button>
        </div>
      </div>

      {/* Intro info box */}
      <div className="bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
          <HelpCircle className="w-6 h-6 animate-pulse" />
        </div>
        <div className="space-y-1 flex-1">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">How it works</h3>
          <p className="text-sm text-slate-600 dark:text-slate-450 leading-relaxed">
            The global error management system intercepts raw technical exceptions thrown by Convex backend schemas and translates them into readable titles, detailed friendly explanations, and clear instructions. Collapsible raw logs remain accessible for debugging.
          </p>
        </div>
      </div>

      {/* Grid of Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {testScenarios.map((scenario, index) => (
          <div 
            key={index}
            className={`border rounded-2xl p-5 md:p-6 flex flex-col justify-between transition-all duration-200 ${scenario.colorClass}`}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                  {scenario.icon}
                </span>
                <h3 className="font-bold text-slate-950 dark:text-white text-base">
                  {scenario.title}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {scenario.description}
              </p>
              <div className="bg-white/40 dark:bg-black/30 rounded-lg p-3 border border-slate-200/50 dark:border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-450 block uppercase mb-1">Simulated raw error:</span>
                <code className="text-xs text-slate-750 dark:text-slate-300 font-mono block break-all whitespace-pre-wrap">{scenario.rawMessage}</code>
              </div>
            </div>

            <button
              onClick={() => triggerError(scenario.rawMessage, scenario.title)}
              className={`mt-5 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-95 shadow-md focus:outline-none ${scenario.btnClass}`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Trigger Animated Popup</span>
            </button>
          </div>
        ))}
      </div>

      {/* Special and custom scenarios section */}
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          Special Actions & Custom Simulator
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Action Trigger Card */}
          <div className="border border-slate-150 dark:border-slate-800/80 rounded-xl p-5 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col justify-between">
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                Modal Action Callbacks
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed">
                Simulates an error popup providing a custom action button. Clicking the button automatically runs a frontend handler (e.g. logging calls, directing the user, retrying operations).
              </p>
            </div>
            
            <button
              onClick={triggerCustomActionError}
              className="mt-4 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-650 transition-colors shadow-md focus:outline-none"
            >
              <span>Test Action Callback</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* Text simulator */}
          <div className="border border-slate-150 dark:border-slate-800/80 rounded-xl p-5 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                Free-Text Error Simulator
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed">
                Type any random error message below to see how the system handles unrecognized fallback exceptions.
              </p>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={customErrorText}
                onChange={(e) => setCustomErrorText(e.target.value)}
                placeholder="e.g., Network timeout, DB read exception..."
                className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <button
                disabled={!customErrorText.trim()}
                onClick={() => triggerError(customErrorText, "Simulated Error")}
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Simulate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

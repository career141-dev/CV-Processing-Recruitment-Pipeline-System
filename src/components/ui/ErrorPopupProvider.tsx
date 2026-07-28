"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  AlertTriangle, 
  X, 
  ShieldAlert, 
  KeyRound, 
  FileWarning, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  UserX
} from "lucide-react";

interface ErrorPopupOptions {
  title?: string;
  resolveMessage?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ErrorPopupContextType {
  showError: (error: any, optionsOrContext?: ErrorPopupOptions | string) => void;
  hideError: () => void;
}

const ErrorPopupContext = createContext<ErrorPopupContextType | undefined>(undefined);

export function useErrorPopup() {
  const context = useContext(ErrorPopupContext);
  if (!context) {
    throw new Error("useErrorPopup must be used within an ErrorPopupProvider");
  }
  return context;
}

interface ParsedError {
  title: string;
  description: string;
  resolve: string;
  iconType: "warning" | "permission" | "missing_data" | "duplicate" | "auth" | "generic";
  code: string;
  rawMessage: string;
}

// Translate raw error messages to user-friendly messages
function parseError(error: any, options?: ErrorPopupOptions): ParsedError {
  const rawMsg = typeof error === "string" 
    ? error 
    : error?.message || error?.toString() || "An unexpected error occurred.";

  // Default values
  let title = options?.title || "Operation Failed";
  let description = "The system encountered an error while processing your request.";
  let resolve = options?.resolveMessage || "Please check your inputs and try again. If this persists, contact support.";
  let iconType: ParsedError["iconType"] = "generic";
  let code = "SYSTEM_ERROR";

  // 1. Missing mandatory follow-up data (Second Shortlist transition)
  if (
    rawMsg.includes("Missing mandatory Follow-up data") || 
    rawMsg.includes("Cannot move to 2nd Shortlist")
  ) {
    title = options?.title || "Missing Profile Details";
    description = "This candidate cannot be moved to the 2nd Shortlist stage because their profile is missing mandatory information required by stage rules.";
    resolve = options?.resolveMessage || "Verify that the candidate has an uploaded CV, Current Salary, Expected Salary, and Notice Period. You can log a manual call with the candidate to gather and enter these details.";
    iconType = "missing_data";
    code = "MISSING_MANDATORY_DATA";
  }
  // 2. Duplicate keyword/job posting error
  else if (
    rawMsg.includes("already in use") || 
    rawMsg.includes("duplicate") || 
    rawMsg.includes("keyword")
  ) {
    title = options?.title || "Duplicate Job Routing Key";
    description = "The tracking keyword or job identifier you specified is already assigned to another job in the system.";
    resolve = options?.resolveMessage || "Please go back to Step 1 and choose a unique keyword, or change the Job Title so that a unique tracking keyword can be automatically generated.";
    iconType = "duplicate";
    code = "DUPLICATE_KEYWORD";
  }
  // 3. Permission denied (403 or role guard)
  else if (
    rawMsg.includes("[403]") || 
    rawMsg.includes("Access denied") || 
    rawMsg.includes("does not have permission")
  ) {
    title = options?.title || "Access Denied";
    description = "Your user account role does not have the required permissions to perform this action.";
    resolve = options?.resolveMessage || "If you believe this is an error, please ask your TA Manager or Admin to verify your system role permissions or assign you the correct role.";
    iconType = "permission";
    code = "PERMISSION_DENIED";
  }
  // 4. Job assignment error
  else if (rawMsg.includes("You are not assigned to this job")) {
    title = options?.title || "Unassigned Job Access";
    description = "You cannot move this candidate because you are not assigned to this job's recruitment team.";
    resolve = options?.resolveMessage || "Only the assigned Primary Recruiter, Supporting Recruiters, Directors, or Admins are allowed to make pipeline updates for this job. Contact the job owner or an Admin to be added to the team.";
    iconType = "permission";
    code = "JOB_NOT_ASSIGNED";
  }
  // 5. Stage transition state rules
  else if (rawMsg.includes("Can only shortlist from Stage 1")) {
    title = options?.title || "Invalid Stage Transition";
    description = "This candidate cannot be moved to the TA Shortlist. They can only be shortlisted directly from Stage 1 (New CVs).";
    resolve = options?.resolveMessage || "If the candidate is already in follow-up or another stage, they cannot be re-shortlisted. Use standard pipeline boards to manage their stage.";
    iconType = "warning";
    code = "INVALID_TRANSITION";
  }
  else if (rawMsg.includes("Candidate is not at Director Shortlist stage")) {
    title = options?.title || "Invalid Stage Transition";
    description = "This action requires the candidate to be at the Director Shortlist stage.";
    resolve = options?.resolveMessage || "Verify the current stage of the candidate on the Kanban board before attempting Director approval/rejection.";
    iconType = "warning";
    code = "INVALID_TRANSITION";
  }
  else if (rawMsg.includes("Candidate is not at Client Review stage")) {
    title = options?.title || "Invalid Stage Transition";
    description = "This action requires the candidate to be at the Client Review stage.";
    resolve = options?.resolveMessage || "Verify the current stage of the candidate on the Kanban board before performing client actions.";
    iconType = "warning";
    code = "INVALID_TRANSITION";
  }
  // 6. Unauthenticated / Auth errors
  else if (
    rawMsg.includes("Unauthenticated") || 
    rawMsg.includes("not found in database") || 
    rawMsg.includes("Account deactivated")
  ) {
    title = options?.title || "Session Expired";
    description = "Your session is invalid, or your account has been deactivated.";
    resolve = options?.resolveMessage || "Please refresh the page, sign out, and sign back in. If you continue to see this, contact your administrator.";
    iconType = "auth";
    code = "AUTH_ERROR";
  }
  // 7. Pending onboarding
  else if (rawMsg.includes("Pending role assignment")) {
    title = options?.title || "Account Onboarding Pending";
    description = "Your account is active, but you have not yet been assigned a workspace role.";
    resolve = options?.resolveMessage || "Please contact your administrator or TA Manager to onboard your account and assign your role (e.g. Recruiter, Senior TA).";
    iconType = "auth";
    code = "PENDING_ONBOARDING";
  }

  return { title, description, resolve, iconType, code, rawMessage: rawMsg };
}

export function ErrorPopupProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [errorData, setErrorData] = useState<ParsedError | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [customAction, setCustomAction] = useState<{ label: string; handler: () => void } | null>(null);

  // Esc key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        hideError();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const showError = (error: any, optionsOrContext?: ErrorPopupOptions | string) => {
    let options: ErrorPopupOptions = {};
    if (typeof optionsOrContext === "object") {
      options = optionsOrContext;
    } else if (typeof optionsOrContext === "string") {
      options = { resolveMessage: optionsOrContext };
    }

    const parsed = parseError(error, options);
    setErrorData(parsed);
    setShowDetails(false);
    setIsCopied(false);

    if (options.onAction && options.actionLabel) {
      setCustomAction({
        label: options.actionLabel,
        handler: () => {
          options.onAction?.();
          hideError();
        }
      });
    } else {
      setCustomAction(null);
    }

    setIsOpen(true);
    document.body.style.overflow = "hidden";
  };

  const hideError = () => {
    setIsOpen(false);
    document.body.style.overflow = "unset";
  };

  const copyToClipboard = async () => {
    if (!errorData) return;
    try {
      await navigator.clipboard.writeText(
        `Error Code: ${errorData.code}\nTitle: ${errorData.title}\nDescription: ${errorData.description}\nResolve: ${errorData.resolve}\nRaw Details: ${errorData.rawMessage}`
      );
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy error details", err);
    }
  };

  const renderIcon = () => {
    if (!errorData) return null;
    
    switch (errorData.iconType) {
      case "missing_data":
        return (
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-500 border-4 border-amber-100 dark:border-amber-900/50 animate-bounce">
            <FileWarning className="w-8 h-8 animate-pulse" />
          </div>
        );
      case "duplicate":
        return (
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/30 text-orange-500 border-4 border-orange-100 dark:border-orange-900/50 animate-bounce">
            <KeyRound className="w-8 h-8" />
          </div>
        );
      case "permission":
        return (
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-violet-50 dark:bg-violet-950/30 text-violet-500 border-4 border-violet-100 dark:border-violet-900/50 animate-bounce">
            <ShieldAlert className="w-8 h-8" />
          </div>
        );
      case "auth":
        return (
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-500 border-4 border-rose-100 dark:border-rose-900/50 animate-bounce">
            <UserX className="w-8 h-8" />
          </div>
        );
      case "warning":
        return (
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-yellow-50 dark:bg-yellow-950/30 text-yellow-500 border-4 border-yellow-100 dark:border-yellow-900/50 animate-bounce">
            <AlertTriangle className="w-8 h-8" />
          </div>
        );
      case "generic":
      default:
        return (
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/30 text-red-500 border-4 border-red-100 dark:border-red-900/50 animate-bounce">
            <AlertTriangle className="w-8 h-8" />
          </div>
        );
    }
  };

  return (
    <ErrorPopupContext.Provider value={{ showError, hideError }}>
      {children}

      {isOpen && errorData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-md transition-opacity duration-300 ease-out"
            onClick={hideError}
          />
          
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 scale-100 opacity-100 ease-out animate-in fade-in zoom-in-95">
            <div className={`h-1.5 w-full ${
              errorData.iconType === "permission" ? "bg-violet-500" :
              errorData.iconType === "missing_data" ? "bg-amber-500" :
              errorData.iconType === "duplicate" ? "bg-orange-500" :
              errorData.iconType === "auth" ? "bg-rose-500" : "bg-red-500"
            }`} />

            <button 
              onClick={hideError}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 md:p-8 flex flex-col items-center text-center">
              <div className="mb-6">{renderIcon()}</div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {errorData.title}
              </h3>

              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 mb-4">
                Code: {errorData.code}
              </span>

              <p className="text-sm text-slate-600 dark:text-slate-450 leading-relaxed mb-4">
                {errorData.description}
              </p>

              <div className="w-full text-left bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 mb-6">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                  How to Resolve:
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {errorData.resolve}
                </p>
              </div>

              <div className="w-full mb-6">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center justify-between w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors focus:outline-none"
                >
                  <span>TECHNICAL ERROR DETAILS</span>
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showDetails && (
                  <div className="mt-2 text-left bg-slate-900 dark:bg-black rounded-lg p-3 text-xs text-slate-300 font-mono overflow-x-auto max-h-40 border border-slate-800 animate-in slide-in-from-top-1 duration-200">
                    <pre className="whitespace-pre-wrap">{errorData.rawMessage}</pre>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 border border-slate-200 dark:border-slate-850 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors focus:outline-none"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Details</span>
                    </>
                  )}
                </button>

                {customAction ? (
                  <button
                    onClick={customAction.handler}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity focus:outline-none shadow-md ${
                      errorData.iconType === "permission" ? "bg-violet-600 shadow-violet-500/20" :
                      errorData.iconType === "missing_data" ? "bg-amber-600 shadow-amber-500/20" :
                      errorData.iconType === "duplicate" ? "bg-orange-600 shadow-orange-500/20" :
                      errorData.iconType === "auth" ? "bg-rose-600 shadow-rose-500/20" : "bg-red-600 shadow-red-500/20"
                    }`}
                  >
                    {customAction.label}
                  </button>
                ) : (
                  <button
                    onClick={hideError}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity focus:outline-none shadow-md ${
                      errorData.iconType === "permission" ? "bg-violet-600 shadow-violet-500/20" :
                      errorData.iconType === "missing_data" ? "bg-amber-600 shadow-amber-500/20" :
                      errorData.iconType === "duplicate" ? "bg-orange-600 shadow-orange-500/20" :
                      errorData.iconType === "auth" ? "bg-rose-600 shadow-rose-500/20" : "bg-red-600 shadow-red-500/20"
                    }`}
                  >
                    Got It
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </ErrorPopupContext.Provider>
  );
}

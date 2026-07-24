"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, X, Lock } from "lucide-react";

export function showAccessDeniedModal(details?: { title?: string; message?: string }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("show-access-denied", {
        detail: details,
      })
    );
  }
}

export function AccessDeniedModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalDetails, setModalDetails] = useState<{ title?: string; message?: string }>({});

  useEffect(() => {
    const handleAccessDeniedEvent = (e: any) => {
      setModalDetails(e.detail || {});
      setIsOpen(true);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || String(event.reason || "");
      if (
        reason.includes("Access denied") ||
        reason.includes("[403]") ||
        reason.includes("Unauthorized") ||
        reason.includes("permission") ||
        reason.includes("does not have permission")
      ) {
        event.preventDefault(); // Prevent raw crash error
        setModalDetails({
          title: "Access Restricted",
          message: reason.replace(/^Error:\s*/, ""),
        });
        setIsOpen(true);
      }
    };

    window.addEventListener("show-access-denied", handleAccessDeniedEvent);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("show-access-denied", handleAccessDeniedEvent);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="relative flex flex-col bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-red-50/50 dark:bg-red-950/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-text-primary">
                {modalDetails.title || "Access Restricted"}
              </h3>
              <p className="text-[12px] text-text-secondary">Feature Permission Notice</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-container transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-start gap-3.5 bg-surface-container-low p-4 rounded-xl border border-border/80">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[13px] text-text-primary leading-relaxed">
              {modalDetails.message ? (
                <p>{modalDetails.message}</p>
              ) : (
                <p>
                  You do not have permission to perform this action with your current role.
                </p>
              )}
            </div>
          </div>

          <div className="text-[12px] text-text-secondary leading-normal">
            To access this feature, please request role elevation or permissions from your Administrator or TA Manager.
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-border bg-surface-bright gap-3">
          <button
            onClick={() => setIsOpen(false)}
            className="px-5 py-2 rounded-xl bg-primary text-white text-[13px] font-semibold hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}

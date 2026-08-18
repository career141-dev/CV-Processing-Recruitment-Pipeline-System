"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import { ShieldOff } from "lucide-react";

/**
 * Defines which routes are accessible per permission level.
 * Keep this list in sync with the sidebar navigation.
 * Future roles can be added here without touching the component logic.
 */
const ROUTE_PERMISSIONS: Record<string, (role: string | null) => boolean> = {
  "/dashboard": () => true,
  "/dashboard/jobs": () => true,
  "/dashboard/candidates": (role) =>
    ["admin", "ta_manager", "senior_ta", "test_ta"].includes(role ?? ""),
  "/dashboard/outreach": (role) =>
    ["admin", "ta_manager", "senior_ta", "test_ta"].includes(role ?? ""),
  "/dashboard/analytics": (role) =>
    ["admin", "ta_manager", "senior_ta", "test_ta"].includes(role ?? ""),
  "/dashboard/inquiries": (role) =>
    ["admin", "ta_manager", "senior_ta", "test_ta"].includes(role ?? ""),
  "/dashboard/ingestion-monitor": (role) =>
    ["admin", "ta_manager"].includes(role ?? ""),
  "/dashboard/token-monitor": (role) =>
    ["admin", "ta_manager"].includes(role ?? ""),
  "/dashboard/settings": (role) =>
    ["admin"].includes(role ?? ""),
};

/** Returns true if the given pathname is accessible for the given role. */
function isRouteAllowed(pathname: string, role: string | null): boolean {
  // Find the longest matching route prefix
  const matchingPrefixes = Object.keys(ROUTE_PERMISSIONS).filter((route) =>
    pathname === route || pathname.startsWith(route + "/")
  );

  if (matchingPrefixes.length === 0) {
    // Route not in permission map — allow by default (unenforced page)
    return true;
  }

  // Most specific match wins
  const mostSpecific = matchingPrefixes.sort((a, b) => b.length - a.length)[0];
  return ROUTE_PERMISSIONS[mostSpecific](role);
}

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, isOnboarded, isActive } = useRole();

  // Wait until role is resolved before making decisions
  const isLoading = role === null && isOnboarded;

  const allowed = isRouteAllowed(pathname, role);

  useEffect(() => {
    // Once role is available and access is denied, redirect to dashboard root
    if (!isLoading && role !== null && !allowed) {
      router.replace("/dashboard");
    }
  }, [role, allowed, isLoading, router]);

  // If still loading role, render nothing (AccessGate already shows a spinner)
  if (isLoading) return null;

  // If access is denied, show a friendly 403 page while the redirect kicks in
  if (role !== null && !allowed) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh] p-8">
        <div className="flex flex-col items-center text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-5">
            <ShieldOff className="text-red-500 dark:text-red-400" size={32} />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Access Denied</h2>
          <p className="text-text-secondary text-sm mb-6">
            You don&apos;t have permission to view this page. Please contact your administrator if you believe this is an error.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-5 py-2.5 bg-primary-container text-on-primary rounded-lg text-sm font-medium hover:bg-primary-container/90 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

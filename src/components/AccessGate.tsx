"use client";

import React from "react";
import { useRole, useCurrentUser } from "@/hooks/useRole";
import { ShieldAlert, Clock, LogOut } from "lucide-react";
import { useClerk } from "@clerk/nextjs";

export function AccessGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useClerk();

  // We use useCurrentUser to see if it's still loading (undefined).
  const user = useCurrentUser();
  const { isOnboarded, isActive } = useRole();

  // Middleware now handles unauthenticated redirects to /sign-in.
  // AccessGate only needs to handle Convex loading states and role-based blocking.

  // If Convex user is still loading, show spinner
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-text-secondary text-sm font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  // If user is null, Convex hasn't synced the profile yet — show loading
  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-text-secondary text-sm font-medium">Setting up profile...</p>
        </div>
      </div>
    );
  }

  const handleSignOut = () => {
    signOut({ redirectUrl: "/sign-in" });
  };

  if (!isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="bg-surface border border-error/20 p-8 rounded-2xl shadow-subtle max-w-md w-full text-center">
          <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Account Deactivated</h2>
          <p className="text-text-secondary mb-8">
            Your access to Career141 has been revoked by an administrator. If you believe this is an error, please contact your TA Manager.
          </p>
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 w-full py-3 bg-surface-container hover:bg-surface-container-high text-text-primary rounded-xl font-medium transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!isOnboarded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="bg-surface border border-border p-8 rounded-2xl shadow-subtle max-w-md w-full text-center">
          <div className="w-16 h-16 bg-primary-container/10 text-primary-container rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={32} />
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Pending Approval</h2>
          <p className="text-text-secondary mb-8">
            Your account has been created successfully, but an Administrator needs to assign you a role before you can access the dashboard.
          </p>
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 w-full py-3 bg-surface-container hover:bg-surface-container-high text-text-primary rounded-xl font-medium transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

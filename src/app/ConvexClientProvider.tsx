"use client";

import { ConvexReactClient, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth, useUser } from "@clerk/nextjs";
import { ReactNode, useEffect } from "react";
import { api } from "../../convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// This component watches the Clerk auth state and fires our syncUser mutation
function AuthSync({ children }: { children: ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const syncCurrentUser = useMutation(api.users.users.syncCurrentUser);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress || "";
      const rawName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
      let displayName = rawName;
      if (!displayName && email.includes("@")) {
        const prefix = email.split("@")[0];
        displayName = prefix
          .split(/[._-]/)
          .filter(Boolean)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          .join(" ");
      }
      if (!displayName) displayName = "Team Member";

      const syncKey = `user_synced_${user.id}_${email}`;
      const lastSynced = typeof window !== "undefined" ? sessionStorage.getItem(syncKey) : null;
      const now = Date.now();

      // Only run syncCurrentUser DB mutation if not synced in the last 5 minutes
      if (!lastSynced || now - Number(lastSynced) > 300000) {
        syncCurrentUser({
          email: email,
          name: displayName || user.username || "Team Member",
          avatarUrl: user.imageUrl,
          invitedRole: (user.publicMetadata?.role as string) || undefined,
        })
          .then(() => {
            if (typeof window !== "undefined") {
              sessionStorage.setItem(syncKey, String(Date.now()));
            }
          })
          .catch(console.error);
      }
    }
  }, [isLoaded, isSignedIn, user, syncCurrentUser]);

  return <>{children}</>;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <AuthSync>{children}</AuthSync>
    </ConvexProviderWithClerk>
  );
}

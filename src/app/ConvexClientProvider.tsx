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
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      syncCurrentUser({
        email: user.primaryEmailAddress?.emailAddress || "",
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown User",
        avatarUrl: user.imageUrl,
      }).catch(console.error);
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

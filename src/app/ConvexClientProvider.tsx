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
  const syncUser = useMutation(api.users.syncUser);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      syncUser({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress || "",
        fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown User",
        // Pull the role dynamically from Clerk's publicMetadata. If you haven't assigned one yet, default to 'ta'
        role: (user.publicMetadata?.role as string) || "ta", 
      }).catch(console.error);
    }
  }, [isLoaded, isSignedIn, user, syncUser]);

  return <>{children}</>;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <AuthSync>{children}</AuthSync>
    </ConvexProviderWithClerk>
  );
}

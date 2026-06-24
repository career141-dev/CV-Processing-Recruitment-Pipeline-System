"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";

export async function inviteUser(emailAddress: string, role: string) {
  try {
    const authSession = await auth();
    if (!authSession.userId) {
      throw new Error("Unauthorized");
    }

    // Clerk v5+ syntax support
    let client;
    if (typeof clerkClient === "function") {
      client = await clerkClient();
    } else {
      client = clerkClient;
    }

    const invitation = await client.invitations.createInvitation({
      emailAddress,
      publicMetadata: {
        role,
      },
    });

    // Invitation object is complex, serialize only what we need to return to client
    return { 
      success: true, 
      invitationId: invitation.id, 
      email: invitation.emailAddress 
    };
  } catch (error: any) {
    console.error("Clerk Invitation Error:", error);
    
    // Clerk errors usually have an array of errors
    const errorMessage = error.errors?.[0]?.longMessage || error.message || "Failed to invite user";
    
    return { success: false, error: errorMessage };
  }
}

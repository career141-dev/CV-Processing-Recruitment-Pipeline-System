import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

export default function SSOCallback() {
  // Handle the redirect flow by rendering the provided Clerk component
  return <AuthenticateWithRedirectCallback />;
}

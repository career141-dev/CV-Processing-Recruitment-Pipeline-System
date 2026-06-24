"use client";

import { useRole } from "../hooks/useRole";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface Props {
  allowedRoles: string[];
  children: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ allowedRoles, children, redirectTo = "/dashboard" }: Props) {
  const { role } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (role !== null && !allowedRoles.includes(role)) {
      router.push(redirectTo);
    }
  }, [role, allowedRoles, router, redirectTo]);

  if (role === null) return <div>Loading...</div>;
  if (!allowedRoles.includes(role)) return null;

  return <>{children}</>;
}

"use client";

import { useSession } from "next-auth/react";
import { ReactNode } from "react";

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  loadingComponent?: ReactNode;
}

// Component to show content only when authenticated
export function SignedIn({ children, fallback, loadingComponent }: AuthGuardProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <>{loadingComponent || null}</>;
  }

  if (session?.user) {
    return <>{children}</>;
  }

  return <>{fallback || null}</>;
}

// Component to show content only when not authenticated
export function SignedOut({ children, fallback, loadingComponent }: AuthGuardProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <>{loadingComponent || null}</>;
  }

  if (!session?.user) {
    return <>{children}</>;
  }

  return <>{fallback || null}</>;
}

// Hook to get user information
export function useUser() {
  const { data: session, status } = useSession();
  
  return {
    user: session?.user || null,
    isLoading: status === "loading",
    isSignedIn: !!session?.user,
  };
}
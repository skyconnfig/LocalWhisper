// Auth components and utilities
export { SessionProvider } from "./SessionProvider";
export { SignInForm } from "./SignInForm";
export { SignUpForm } from "./SignUpForm";
export { UserButton } from "./UserButton";
export { SignOutButton } from "./SignOutButton";
export { SignedIn, SignedOut, useUser } from "./AuthGuards";

// Re-export NextAuth hooks for convenience
export { useSession, signIn, signOut } from "next-auth/react";
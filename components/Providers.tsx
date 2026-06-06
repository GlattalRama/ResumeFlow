"use client";

import { SessionProvider } from "next-auth/react";

// Wraps the app so client components (Nav, sign-in button) can use useSession.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

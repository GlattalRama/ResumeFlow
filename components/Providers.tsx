"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

// Wraps the app so client components (Nav, sign-in button) can use useSession,
// and so the class-based dark theme is applied/persisted via next-themes.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}

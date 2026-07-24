"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import AiConsentHost from "./AiConsentHost";

// Wraps the app so client components (Nav, sign-in button) can use useSession,
// and so the class-based dark theme is applied/persisted via next-themes.
// AiConsentHost renders the (initially hidden) AI data-sharing consent dialog
// that lib/aiConsentClient triggers before the first AI request.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <AiConsentHost />
      </ThemeProvider>
    </SessionProvider>
  );
}

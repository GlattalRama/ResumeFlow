import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import Nav from "@/components/Nav";
import NativeTabs from "@/components/native/NativeTabs";
import NativeTopBar from "@/components/native/NativeTopBar";
import Providers from "@/components/Providers";
import { getAccessToken } from "@/lib/serverSession";
import { hasGoogleCredentials } from "@/lib/googleConfig";
import { isNativeAppRequest } from "@/lib/nativeApp";

export const metadata: Metadata = {
  title: "Resumeflow-ATS",
  description: "Resume builder and job application tracker",
  applicationName: "Resumeflow-ATS",
  appleWebApp: {
    capable: true,
    title: "Resumeflow-ATS",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Resumeflow-ATS",
    description: "Resume builder and job application tracker",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0033a0" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Final auth guard. middleware sets x-pathname for every protected route
  // (never for /signin), so its presence means this page needs a Drive token.
  // If the token reads empty here we re-authenticate gracefully instead of
  // letting a server component throw DriveAuthError into the error boundary.
  const pathname = (await headers()).get("x-pathname");
  if (pathname && hasGoogleCredentials() && !(await getAccessToken())) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  const locale = await getLocale();
  const messages = await getMessages();

  // Inside the Capacitor Android WebView the site wears an app-style shell:
  // slim top bar + bottom tab bar instead of the website navbar. The web
  // layout is untouched — "native" is detected per request (lib/nativeApp.ts).
  const native = await isNativeAppRequest();

  return (
    // suppressHydrationWarning: next-themes sets the theme class on <html>
    // before hydration, which the server can't know about.
    <html
      lang={locale}
      suppressHydrationWarning
      className={native ? "native-app" : undefined}
    >
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            {native ? <NativeTopBar /> : <Nav />}
            <main
              className={
                native
                  ? "mx-auto max-w-6xl px-4 pb-28 pt-5"
                  : "mx-auto max-w-6xl px-4 py-8"
              }
            >
              {children}
            </main>
            {native && <NativeTabs />}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

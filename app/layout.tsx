import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import Nav from "@/components/Nav";
import Providers from "@/components/Providers";
import { getAccessToken } from "@/lib/serverSession";
import { hasGoogleCredentials } from "@/lib/googleConfig";

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
  themeColor: "#0033a0",
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

  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

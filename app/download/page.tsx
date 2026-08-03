import type { Metadata } from "next";
import Image from "next/image";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Get the app · Resumeflow-ATS",
  description:
    "Download Resumeflow-ATS for iPhone, iPad, and Android — build ATS-friendly resumes, tailor them to job descriptions, and track your applications on the go.",
};

const APP_STORE_URL = "https://apps.apple.com/app/resumeflow-ats/id6791545537";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.resumeflowats.app";

export default function DownloadPage() {
  return (
    <LegalPage title="Get the app" updated="August 3, 2026">
      <p>
        <strong>Resumeflow-ATS</strong> is available as a mobile app for iPhone,
        iPad, and Android. Same account, same data as the website — your
        resumes and applications stay in your own Google Drive, so everything
        is instantly in sync across all your devices.
      </p>

      <div className="flex flex-wrap items-center gap-4 py-4">
        <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
          <Image
            src="/badges/app-store-badge.svg"
            alt="Download on the App Store"
            width={162}
            height={54}
            priority
          />
        </a>
        <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
          <Image
            src="/badges/google-play-badge.svg"
            alt="Get it on Google Play"
            width={182}
            height={54}
            priority
          />
        </a>
      </div>

      <LegalSection title="What you can do in the app">
        <ul>
          <li>Build and edit ATS-friendly resumes from your phone.</li>
          <li>Tailor a resume to a job description with AI in minutes.</li>
          <li>Check your ATS compatibility score before you apply.</li>
          <li>Generate cover letters and export polished PDFs.</li>
          <li>Track applications, interviews, and follow-ups on the go.</li>
        </ul>
        <p>
          The app is completely free — no subscriptions, paid content, or
          in-app purchases.
        </p>
      </LegalSection>

      <LegalSection title="Requirements">
        <p>
          You sign in with your Google account; your data is stored in a
          private folder of your own Google Drive. The iOS app also supports
          Sign in with Apple. See the <a href="/privacy">Privacy Policy</a> for
          details, or visit <a href="/support">Support</a> if you run into any
          trouble.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

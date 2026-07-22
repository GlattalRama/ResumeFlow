import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Support · Resumeflow-ATS",
  description:
    "Get help with Resumeflow-ATS — contact us, ask questions, or report a problem.",
};

export default function SupportPage() {
  return (
    <LegalPage title="Support" updated="July 22, 2026">
      <p>
        Need help with <strong>Resumeflow-ATS</strong>? You&rsquo;re in the
        right place. We answer every message ourselves, usually within 1&ndash;2
        business days.
      </p>

      <LegalSection title="Contact us">
        <p>
          Email us at{" "}
          <a href="mailto:devteamprayaga@gmail.com">devteamprayaga@gmail.com</a>{" "}
          with any question, problem, or feedback about the website or the
          mobile apps. To help us resolve issues faster, please include:
        </p>
        <ul>
          <li>What you were trying to do and what happened instead.</li>
          <li>
            Whether you were using the website, the Android app, or the iOS app.
          </li>
          <li>
            Any error message shown on screen (a screenshot is perfect), and the
            &ldquo;Error reference&rdquo; number if one is displayed.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Common questions">
        <p>
          <strong>I can&rsquo;t sign in, or the app says it can&rsquo;t reach
          my Google Drive.</strong>{" "}
          Resumeflow-ATS stores your resumes and application data in your own
          Google Drive, so it needs the Drive permission you&rsquo;re shown
          during sign-in. If you unchecked that option, sign out and sign in
          again, keeping the Google Drive option checked. You can review the
          access you&rsquo;ve granted at{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
        <p>
          <strong>Where is my data stored?</strong> In a private,
          application-specific folder in your own Google Drive &mdash; not on
          our servers. See the{" "}
          <a href="/privacy">Privacy Policy</a> for details.
        </p>
        <p>
          <strong>How do I delete my data?</strong> You can delete individual
          items inside the app, remove the app&rsquo;s hidden data folder from
          your Google account, or revoke Resumeflow-ATS&rsquo;s access entirely
          at{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
        <p>
          <strong>Does Resumeflow-ATS cost anything?</strong> No. The website
          and the mobile apps are free, with no paid content, subscriptions, or
          in-app purchases.
        </p>
      </LegalSection>

      <LegalSection title="More information">
        <p>
          Our <a href="/privacy">Privacy Policy</a> explains what information we
          collect and how we use it, and our{" "}
          <a href="/terms">Terms of Service</a> cover the rules for using the
          Service.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

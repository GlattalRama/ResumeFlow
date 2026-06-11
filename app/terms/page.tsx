import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service · ResumeFlow ATS",
  description: "The terms that govern your use of ResumeFlow ATS.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="June 11, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
        use of <strong>ResumeFlow ATS</strong> (the &ldquo;Service&rdquo;),
        available at <a href="https://kiwi-cv.com">https://kiwi-cv.com</a>. By
        accessing or using the Service you agree to be bound by these Terms. If
        you do not agree, do not use the Service.
      </p>

      <LegalSection title="1. The Service">
        <p>
          ResumeFlow ATS is a resume builder and job-application tracker that
          lets you create tailored resume versions, track applications, prepare
          for interviews, and export documents. The content you create is stored
          in your own Google Drive via Google&rsquo;s application-data folder.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility and accounts">
        <p>
          You must be at least 13 years old to use the Service. You access the
          Service by signing in with a Google account, and you are responsible
          for maintaining the security of that account. You are responsible for
          all activity that occurs under your account.
        </p>
      </LegalSection>

      <LegalSection title="3. Your content">
        <p>
          You retain all rights to the content you create with the Service
          (&ldquo;Your Content&rdquo;), including resumes, applications, notes,
          and interview material. We do not claim ownership of Your Content. You
          grant us only the limited permission necessary to operate the Service
          on your behalf &mdash; for example, to read and write Your Content to
          your Google Drive app-data folder and to process it through AI features
          you choose to use.
        </p>
        <p>
          You are solely responsible for the accuracy and legality of Your
          Content and for keeping your own backups where appropriate.
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful or fraudulent purpose.</li>
          <li>
            Upload content that infringes the rights of others or that is
            unlawful, harmful, or misleading.
          </li>
          <li>
            Attempt to gain unauthorized access to the Service, other accounts,
            or related systems.
          </li>
          <li>
            Interfere with, disrupt, or place an unreasonable load on the Service
            or its infrastructure.
          </li>
          <li>
            Reverse engineer or misuse the Service or any third-party services it
            relies on.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. AI-generated content">
        <p>
          The Service uses third-party AI models to help generate and tailor
          resume and interview content. AI output may be inaccurate, incomplete,
          or unsuitable for your situation. You are responsible for reviewing,
          editing, and verifying any AI-generated content before relying on or
          submitting it. The Service does not guarantee any particular outcome,
          including employment or interview results.
        </p>
      </LegalSection>

      <LegalSection title="6. Third-party services">
        <p>
          The Service depends on third-party providers including Google
          (authentication and storage), Vercel (hosting), and OpenRouter and its
          model providers (AI processing). Your use of those services through
          ResumeFlow ATS is also subject to their respective terms and policies.
        </p>
      </LegalSection>

      <LegalSection title="7. Privacy">
        <p>
          Your use of the Service is also governed by our{" "}
          <a href="/privacy">Privacy Policy</a>, which explains how we handle
          your information.
        </p>
      </LegalSection>

      <LegalSection title="8. Availability and changes">
        <p>
          The Service is provided on an ongoing basis but may be modified,
          suspended, or discontinued at any time without notice. We may also
          update these Terms from time to time; when we do, we will revise the
          &ldquo;Last updated&rdquo; date above. Continued use of the Service
          after changes take effect constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimer of warranties">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; without warranties of any kind, whether express or
          implied, including warranties of merchantability, fitness for a
          particular purpose, and non-infringement. We do not warrant that the
          Service will be uninterrupted, error-free, or secure.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitation of liability">
        <p>
          To the maximum extent permitted by law, ResumeFlow ATS and its
          operators will not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or for any loss of data, profits,
          or goodwill, arising out of or related to your use of the Service.
        </p>
      </LegalSection>

      <LegalSection title="11. Termination">
        <p>
          You may stop using the Service at any time and revoke its access to
          your Google account. We may suspend or terminate access if you violate
          these Terms or use the Service in a way that could cause harm to us,
          other users, or third parties.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact us">
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:devteamprayaga@gmail.com">devteamprayaga@gmail.com</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

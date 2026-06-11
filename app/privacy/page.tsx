import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy · Resumeflow-ATS",
  description:
    "How Resumeflow-ATS collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="June 11, 2026">
      <p>
        This Privacy Policy explains how <strong>Resumeflow-ATS</strong>{" "}
        (&ldquo;Resumeflow-ATS&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
        collects, uses, and protects your information when you use the
        application at{" "}
        <a href="https://kiwi-cv.com">https://kiwi-cv.com</a> (the
        &ldquo;Service&rdquo;). By using the Service you agree to the practices
        described here.
      </p>

      <LegalSection title="1. Who we are">
        <p>
          Resumeflow-ATS is a resume builder and job-application tracker. It
          helps you create tailored resume versions, track the jobs you apply
          to, and prepare for interviews. The Service is designed so that the
          content you create is stored in your own Google Drive rather than in a
          database we control.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>We collect only what is needed to run the Service:</p>
        <ul>
          <li>
            <strong>Google account profile.</strong> When you sign in with
            Google we receive your name, email address, and profile picture.
            This is used to identify you, display your account in the app, and
            secure your session.
          </li>
          <li>
            <strong>Content you create.</strong> Resumes, job applications,
            notes, interview questions and answers, and related status history.
            As described below, this content is stored in your own Google Drive.
          </li>
          <li>
            <strong>Aggregate usage analytics.</strong> We keep anonymous,
            aggregate counts of certain actions (for example sign-ins, resumes
            created, applications created, exports, and AI tailoring runs). These
            counters never include your name, email, resume text, job
            descriptions, IP address, or device details. To count distinct users
            and approximate geography we store a salted, non-reversible token
            derived from your account id and a two-letter country code derived
            from your connection&rsquo;s region header. We do not store your IP
            address.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Google Drive and the appdata folder">
        <p>
          When you sign in, we request the{" "}
          <a
            href="https://developers.google.com/workspace/drive/api/guides/appdata"
            target="_blank"
            rel="noopener noreferrer"
          >
            <code>drive.appdata</code>
          </a>{" "}
          permission. This is a restricted scope that grants access{" "}
          <strong>only</strong> to a hidden, application-specific folder in your
          Google Drive (&ldquo;appDataFolder&rdquo;). We use it to read and write
          the JSON files that hold your Resumeflow-ATS content.
        </p>
        <ul>
          <li>
            We <strong>cannot</strong> see, read, or modify any of your other
            Google Drive files, photos, or documents.
          </li>
          <li>
            Your content stays in your Google Drive under your control. If you
            stop using the Service you can delete that app-data folder from your
            Google account at any time.
          </li>
          <li>
            Resumeflow-ATS&rsquo;s use of information received from Google APIs
            adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. AI features">
        <p>
          When you use AI-powered features &mdash; tailoring a resume to a job
          description, importing an existing resume, or generating interview
          questions &mdash; the relevant text you provide (such as your resume
          content and the job description) is sent to a third-party AI provider
          (OpenRouter and the underlying model providers it routes to) to
          generate the result. We send only the text necessary for the requested
          task. We do not use your content to train our own models.
        </p>
      </LegalSection>

      <LegalSection title="5. How we use your information">
        <ul>
          <li>To authenticate you and keep your session secure.</li>
          <li>
            To store, display, and let you manage the content you create.
          </li>
          <li>To provide AI-assisted resume and interview features.</li>
          <li>
            To understand aggregate usage so we can maintain and improve the
            Service.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> sell your personal information or use it for
          advertising.
        </p>
      </LegalSection>

      <LegalSection title="6. Service providers">
        <p>
          We rely on a small number of service providers to operate the Service:
        </p>
        <ul>
          <li>
            <strong>Google</strong> &mdash; sign-in and Drive storage of your
            content.
          </li>
          <li>
            <strong>Vercel</strong> &mdash; application hosting and delivery.
          </li>
          <li>
            <strong>OpenRouter</strong> and its model providers &mdash;
            processing AI feature requests.
          </li>
        </ul>
        <p>
          These providers process data only to perform services for us and are
          subject to their own privacy terms.
        </p>
      </LegalSection>

      <LegalSection title="7. Data retention and deletion">
        <p>
          Your content remains in your Google Drive app-data folder until you
          delete it. You can remove individual items inside the app, delete the
          app-data folder from your Google account, or revoke Resumeflow-ATS&rsquo;s
          access at{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
          >
            myaccount.google.com/permissions
          </a>
          . Aggregate analytics counters contain no personal information and are
          retained in anonymized form.
        </p>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>
          We use industry-standard measures including encrypted connections
          (HTTPS) and OAuth-based authentication. No method of transmission or
          storage is completely secure, but we work to protect your information
          and limit the data we hold.
        </p>
      </LegalSection>

      <LegalSection title="9. Children&rsquo;s privacy">
        <p>
          The Service is not directed to children under 13, and we do not
          knowingly collect personal information from them.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we
          will revise the &ldquo;Last updated&rdquo; date above. Continued use of
          the Service after changes take effect constitutes acceptance of the
          updated policy.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact us">
        <p>
          If you have questions about this Privacy Policy or your data, contact
          us at{" "}
          <a href="mailto:devteamprayaga@gmail.com">devteamprayaga@gmail.com</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

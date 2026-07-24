"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { registerConsentHost } from "@/lib/aiConsentClient";

// Renders the AI data-sharing consent dialog (App Store guideline 5.1.2(i)).
// Mounted once in Providers; aiFetch triggers it via lib/aiConsentClient before
// the first AI request of an account. Explains WHAT is sent and TO WHOM, and
// only proceeds on an explicit Allow.
export default function AiConsentHost() {
  const t = useTranslations("aiConsent");
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((allowed: boolean) => void) | null>(null);

  useEffect(() => {
    return registerConsentHost((resolve) => {
      resolverRef.current = resolve;
      setOpen(true);
    }, t("declined"));
  }, [t]);

  function answer(allowed: boolean) {
    setOpen(false);
    resolverRef.current?.(allowed);
    resolverRef.current = null;
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-consent-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h2
          id="ai-consent-title"
          className="text-lg font-bold text-foreground"
        >
          {t("title")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("body1")}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>{t("point1")}</li>
          <li>{t("point2")}</li>
          <li>{t("point3")}</li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground/80">
          {t("body2")}{" "}
          <Link
            href="/privacy"
            target="_blank"
            className="underline hover:text-foreground"
          >
            {t("privacyLink")}
          </Link>
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => answer(false)}
            className="flex-1 rounded-md border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground/80 transition hover:bg-muted/50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            className="flex-1 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            {t("allow")}
          </button>
        </div>
      </div>
    </div>
  );
}

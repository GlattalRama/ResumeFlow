"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

// Small per-card control for the resume list: shows a "Base Resume" badge when
// this version is the designated base, otherwise a compact "Set as base" button.
// Rendered as a sibling overlay of the card's navigation Link (not nested inside
// it), so clicking it never triggers navigation.
export default function BaseResumeControl({
  resumeId,
  isBase,
}: {
  resumeId: string;
  isBase: boolean;
}) {
  const t = useTranslations("resumeDetail");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (isBase) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-900">
        ★ {t("baseResume")}
      </span>
    );
  }

  async function setBase(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await fetch("/api/base-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={setBase}
      disabled={busy}
      className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm transition hover:border-brand-300 dark:hover:border-brand-400/60 hover:text-brand-700 dark:hover:text-brand-300 disabled:opacity-50"
    >
      {busy ? t("settingBase") : t("setAsBaseShort")}
    </button>
  );
}

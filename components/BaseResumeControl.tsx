"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (isBase) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        ★ Base Resume
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
      className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500 shadow-sm transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
    >
      {busy ? "Setting…" : "Set as base"}
    </button>
  );
}

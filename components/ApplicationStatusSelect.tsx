"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ApplicationStatus } from "@/lib/types";
import { APPLICATION_STATUSES, STATUS_STYLES } from "@/lib/constants";

// Inline status change for the tracker table: a <select> dressed as the
// status badge. Saves immediately through the same route as the detail page
// (which records a status-history entry) and, when moving to "Applied" with
// no applied date yet, stamps today's date.
export default function ApplicationStatusSelect({
  applicationId,
  status,
  appliedDate,
}: {
  applicationId: string;
  status: ApplicationStatus;
  appliedDate: string;
}) {
  const t = useTranslations("applications");
  const tStatus = useTranslations("status");
  const router = useRouter();
  const [current, setCurrent] = useState<ApplicationStatus>(status);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function change(next: ApplicationStatus) {
    if (next === current) return;
    const previous = current;
    setCurrent(next);
    setBusy(true);
    setFailed(false);
    try {
      const body: Record<string, string> = { status: next };
      if (next === "Applied" && !appliedDate) {
        body.appliedDate = new Date().toISOString().slice(0, 10);
      }
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setCurrent(previous);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <span className="relative inline-flex items-center">
        <select
          value={current}
          disabled={busy}
          aria-label={t("changeStatus")}
          title={t("changeStatus")}
          onChange={(e) => change(e.target.value as ApplicationStatus)}
          className={`cursor-pointer appearance-none rounded-full border py-0.5 pl-2.5 pr-6 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 ${STATUS_STYLES[current]}`}
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-2 text-[10px] opacity-70">
          ▾
        </span>
      </span>
      {failed && (
        <span className="mt-0.5 text-[10px] text-red-600 dark:text-red-400">{t("saveFailed")}</span>
      )}
    </span>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ApplicationStatus } from "@/lib/types";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { buttonClass } from "./ui";

export default function StatusUpdater({
  applicationId,
  current,
}: {
  applicationId: string;
  current: ApplicationStatus;
}) {
  const t = useTranslations("application");
  const tStatus = useTranslations("status");
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(current);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const changed = status !== current;

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/applications/${applicationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, statusComment: comment }),
    });
    if (res.ok) {
      setComment("");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs font-medium text-muted-foreground">{t("statusUpdater.status")}</label>
        <select
          className="mt-1 rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          value={status}
          onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </select>
      </div>
      <input
        className="min-w-[12rem] flex-1 rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        placeholder={t("statusUpdater.commentPlaceholder")}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button
        onClick={save}
        disabled={!changed || busy}
        className={buttonClass("primary")}
      >
        {busy ? t("statusUpdater.updating") : t("statusUpdater.update")}
      </button>
    </div>
  );
}

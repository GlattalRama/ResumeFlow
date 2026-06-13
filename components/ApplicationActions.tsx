"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "./ui";

export default function ApplicationActions({ id }: { id: string }) {
  const t = useTranslations("application");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(t("actions.confirmDelete"))) return;
    setBusy(true);
    const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/applications");
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Link href={`/applications/${id}/edit`} className={buttonClass("secondary")}>
        {t("actions.edit")}
      </Link>
      <button
        onClick={remove}
        disabled={busy}
        className={buttonClass("danger")}
        type="button"
      >
        {t("actions.delete")}
      </button>
    </div>
  );
}

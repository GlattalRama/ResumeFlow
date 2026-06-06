"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "./ui";

export default function ApplicationActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Delete this application? This cannot be undone.")) return;
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
        Edit
      </Link>
      <button
        onClick={remove}
        disabled={busy}
        className={buttonClass("danger")}
        type="button"
      >
        Delete
      </button>
    </div>
  );
}

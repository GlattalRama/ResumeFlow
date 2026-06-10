"use client";

import { useState } from "react";

export interface AdminTemplateRow {
  id: string;
  name: string;
  description: string;
  defaultHidden: boolean;
  visible: boolean;
}

// Admin UI: a toggle per resume template controlling whether it appears in the
// resume builder's template picker. Saving persists the overrides map via the
// admin API; existing resumes always keep rendering their template regardless.
export default function TemplateAdminControls({
  initial,
}: {
  initial: AdminTemplateRow[];
}) {
  const [rows, setRows] = useState<AdminTemplateRow[]>(initial);
  const [status, setStatus] = useState<{
    kind: "idle" | "saving" | "ok" | "error";
    message?: string;
  }>({ kind: "idle" });

  function toggle(id: string) {
    setRows((rs) =>
      rs.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r))
    );
    setStatus({ kind: "idle" });
  }

  async function save() {
    setStatus({ kind: "saving" });
    const templateVisibility = Object.fromEntries(
      rows.map((r) => [r.id, r.visible])
    );
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateVisibility }),
      });
      if (res.ok) {
        setStatus({ kind: "ok", message: "Saved. Changes apply to new resumes." });
      } else {
        setStatus({ kind: "error", message: "Could not save changes." });
      }
    } catch {
      setStatus({ kind: "error", message: "Could not save changes." });
    }
  }

  const enabledCount = rows.filter((r) => r.visible).length;

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-4 p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">{r.name}</p>
                {r.defaultHidden && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    hidden by default
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{r.description}</p>
              <p className="mt-0.5 text-[11px] text-gray-400">id: {r.id}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={r.visible}
              onClick={() => toggle(r.id)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                r.visible ? "bg-brand-600" : "bg-gray-300"
              }`}
              title={r.visible ? "Enabled (shown in picker)" : "Disabled (hidden)"}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  r.visible ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status.kind === "saving"}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {status.kind === "saving" ? "Saving…" : "Save changes"}
        </button>
        <span className="text-xs text-gray-400">
          {enabledCount} of {rows.length} enabled
        </span>
        {status.message && (
          <span
            className={`text-sm ${
              status.kind === "error" ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}

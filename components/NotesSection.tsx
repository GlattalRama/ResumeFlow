"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Note, NoteType } from "@/lib/types";
import { NOTE_TYPES } from "@/lib/constants";

const TYPE_LABEL: Record<NoteType, string> = {
  general: "General",
  recruiter: "Recruiter",
  interview: "Interview",
  todo: "To-do",
};

export default function NotesSection({
  applicationId,
  notes,
}: {
  applicationId: string;
  notes: Note[];
}) {
  const router = useRouter();
  const [type, setType] = useState<NoteType>("general");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  // Newest first.
  const sorted = [...notes].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, type, text }),
    });
    if (res.ok) {
      setText("");
      router.refresh();
    }
    setBusy(false);
  }

  async function remove(id: string) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-input bg-card text-foreground px-2 py-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as NoteType)}
        >
          {NOTE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          className="min-w-[12rem] flex-1 rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          placeholder="Add a note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          disabled={busy}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {sorted.length === 0 && (
          <li className="text-sm text-muted-foreground/70">No notes yet.</li>
        )}
        {sorted.map((n) => (
          <li
            key={n.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3"
          >
            <div>
              <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {TYPE_LABEL[n.type]}
              </span>
              <span className="text-sm text-foreground">{n.text}</span>
              <p className="mt-1 text-[11px] text-muted-foreground/70">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => remove(n.id)}
              className="text-xs text-muted-foreground/70 hover:text-red-600 dark:hover:text-red-400"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

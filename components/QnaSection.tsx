"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QnaDifficulty, QnaItem } from "@/lib/types";
import { QNA_DIFFICULTIES } from "@/lib/constants";

const inputClass =
  "w-full rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default function QnaSection({
  applicationId,
  items,
}: {
  applicationId: string;
  items: QnaItem[];
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("General");
  const [difficulty, setDifficulty] = useState<QnaDifficulty>("medium");
  const [busy, setBusy] = useState(false);

  // Group by category.
  const grouped = items.reduce<Record<string, QnaItem[]>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  async function add() {
    if (!question.trim()) return;
    setBusy(true);
    const res = await fetch("/api/qna", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId,
        question,
        answer,
        category: category || "General",
        difficulty,
      }),
    });
    if (res.ok) {
      setQuestion("");
      setAnswer("");
      router.refresh();
    }
    setBusy(false);
  }

  async function patch(id: string, body: Partial<QnaItem>) {
    await fetch(`/api/qna/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/qna/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      {/* Add form */}
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <div className="grid gap-2">
          <input
            className={inputClass}
            placeholder="Question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <textarea
            className={inputClass}
            rows={2}
            placeholder="Answer (optional)"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <input
              className="w-40 rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm"
              placeholder="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <select
              className="rounded-md border border-input bg-card text-foreground px-2 py-2 text-sm"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as QnaDifficulty)}
            >
              {QNA_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button
              onClick={add}
              disabled={busy}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Add Q&amp;A
            </button>
          </div>
        </div>
      </div>

      {/* Grouped list */}
      <div className="mt-4 space-y-5">
        {Object.keys(grouped).length === 0 && (
          <p className="text-sm text-muted-foreground/70">No questions yet.</p>
        )}
        {Object.entries(grouped).map(([cat, qs]) => (
          <div key={cat}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {cat} <span className="font-normal text-muted-foreground/70">({qs.length})</span>
            </h3>
            <ul className="space-y-2">
              {qs.map((q) => (
                <li
                  key={q.id}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-foreground">{q.question}</p>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {q.difficulty}
                    </span>
                  </div>
                  <textarea
                    className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-sm text-foreground/80 focus:border-brand-400 focus:outline-none"
                    rows={2}
                    defaultValue={q.answer}
                    placeholder="Write your answer…"
                    onBlur={(e) => {
                      if (e.target.value !== q.answer)
                        patch(q.id, { answer: e.target.value });
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={q.practiced}
                        onChange={(e) =>
                          patch(q.id, { practiced: e.target.checked })
                        }
                      />
                      Practiced
                    </label>
                    <button
                      onClick={() => remove(q.id)}
                      className="text-xs text-muted-foreground/70 hover:text-red-600 dark:hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

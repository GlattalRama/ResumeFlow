"use client";

import { useTranslations } from "next-intl";
import type { InterviewCoachEntry } from "@/lib/types";

// Print-formatted document for exported interview Q&As: a cover block, then
// one section per category, each starting on a fresh page. Rendered twice by
// the export dialog — on screen as the preview and inside a `print:block`
// container that window.print() turns into the PDF. Colors are hardcoded
// (not theme tokens) so the PDF looks the same in dark mode.
export default function InterviewPrintDoc({
  groups,
  includeAnswers,
  preparedBy,
  context,
}: {
  groups: { category: string; items: InterviewCoachEntry[] }[];
  includeAnswers: boolean;
  preparedBy: string;
  context: string;
}) {
  const t = useTranslations("interviewCoach");
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="bg-white text-[#333]">
      {/* Cover */}
      <div style={{ breakAfter: "page" }} className="px-2 pb-10 pt-6 print:pt-40">
        <p className="text-4xl font-bold text-indigo-800">
          {t("export.coverTitle")}
        </p>
        <div className="mt-4 space-y-1 text-sm text-[#6b7280]">
          {preparedBy && <p>{t("export.preparedBy", { name: preparedBy })}</p>}
          {context && <p>{context}</p>}
          <p>{new Date().toLocaleDateString()}</p>
          <p>{t("export.questionCount", { count: total })}</p>
        </div>
      </div>

      {groups.map(({ category, items }) => (
        <section
          key={category}
          style={{ breakBefore: "page" }}
          className="px-2 pt-6"
        >
          <h2 className="border-b-2 border-indigo-800 pb-1 text-sm font-bold uppercase tracking-wide text-indigo-800">
            {t(`category.${category}` as never)}
          </h2>
          {items.map((entry, i) => (
            <div
              key={entry.id}
              style={{ breakInside: "avoid" }}
              className="mt-4"
            >
              <p className="text-sm font-semibold">
                {i + 1}. {entry.question}
              </p>
              {(entry.topic || entry.status) && (
                <p className="mt-0.5 text-xs text-[#6b7280]">
                  {[entry.topic, t(`statusChip.${entry.status}` as never)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {includeAnswers &&
                (entry.answer.trim() ? (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                    {entry.answer}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm italic text-[#6b7280]">
                    {t("export.noAnswer")}
                  </p>
                ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

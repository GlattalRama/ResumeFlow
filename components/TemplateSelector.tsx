"use client";

import { VISIBLE_TEMPLATES } from "@/lib/constants";
import type { TemplateId, TemplateMeta } from "@/lib/types";

// Template selector cards. Clicking a card switches the live preview. The list
// of offered templates is passed in (resolved against the admin visibility
// overrides); falls back to the static visible set.
export default function TemplateSelector({
  value,
  onChange,
  templates = VISIBLE_TEMPLATES,
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  templates?: TemplateMeta[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {templates.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`rounded-lg border p-3 text-left transition ${
              active
                ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-sm font-semibold ${
                  active ? "text-brand-700" : "text-gray-800"
                }`}
              >
                {t.name}
              </span>
              {active && (
                <span className="text-xs font-bold text-brand-600">✓</span>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-gray-500">
              {t.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

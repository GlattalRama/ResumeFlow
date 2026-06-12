"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

// Languages are shown in their own language (never translated), so a user
// stuck in the wrong locale can always find their way back.
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
];

// UI language preference. Stored in the NEXT_LOCALE cookie (read by
// i18n/request.ts) — no URL routing, the whole app re-renders in place.
export default function LanguagePicker() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("language");

  function change(code: string) {
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  return (
    <select
      aria-label={t("label")}
      value={locale}
      onChange={(e) => change(e.target.value)}
      className="h-9 rounded-md border border-input bg-card px-2 text-sm text-muted-foreground transition hover:text-foreground focus:border-brand-500 focus:outline-none"
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

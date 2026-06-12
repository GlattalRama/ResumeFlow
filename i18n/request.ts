// next-intl request configuration — cookie-based locale, no URL routing.
//
// ResumeFlow is fully behind sign-in, so there is no SEO reason for locale
// path prefixes (/de/...). The UI language is a user preference stored in the
// NEXT_LOCALE cookie (set by components/LanguagePicker); English is the
// default and the fallback for any unknown value.
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const LOCALES = ["en", "de", "fr", "it", "es"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export default getRequestConfig(async () => {
  const candidate = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale = isAppLocale(candidate) ? candidate : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

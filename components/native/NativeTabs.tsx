"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BriefcaseIcon,
  ChatIcon,
  DocIcon,
} from "@/components/DashboardIcons";
import { BookIcon, HomeIcon } from "@/components/native/NativeIcons";

// Bottom tab bar for the native (Android app) shell. `key` is the label's id
// in the "appShell" messages namespace. `also` lists extra path prefixes that
// keep a tab highlighted (e.g. interview prep pages under the Interview tab).
const TABS = [
  { href: "/", key: "home", Icon: HomeIcon, also: [] },
  { href: "/resumes", key: "resumes", Icon: DocIcon, also: [] },
  { href: "/applications", key: "jobs", Icon: BriefcaseIcon, also: [] },
  {
    href: "/interview-coach",
    key: "interview",
    Icon: ChatIcon,
    also: ["/interview-prep"],
  },
  { href: "/work-journal", key: "journal", Icon: BookIcon, also: [] },
] as const;

export default function NativeTabs() {
  const pathname = usePathname();
  const t = useTranslations("appShell");

  if (pathname === "/signin") return null;

  function isActive(tab: (typeof TABS)[number]) {
    if (tab.href === "/") return pathname === "/";
    return [tab.href, ...tab.also].some((p) => pathname.startsWith(p));
  }

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label={t("tabs")}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 pb-2 pt-2.5 transition ${
                active
                  ? "text-brand-600 dark:text-brand-300"
                  : "text-muted-foreground"
              }`}
            >
              <tab.Icon className="h-5 w-5" />
              <span
                className={`max-w-full truncate px-1 text-[10px] leading-none ${
                  active ? "font-semibold" : "font-medium"
                }`}
              >
                {t(tab.key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

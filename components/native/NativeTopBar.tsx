"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import ThemeToggle from "@/components/ThemeToggle";
import LanguagePicker from "@/components/LanguagePicker";

// Compact top bar for the native (Android app) shell: brand mark on the left,
// theme toggle + avatar menu on the right. Navigation lives in the bottom tab
// bar (NativeTabs), so this stays a single slim row.
export default function NativeTopBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const onSignIn = pathname === "/signin";

  return (
    <header className="no-print sticky top-0 z-30 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" className="h-8 w-auto" />
          <span className="whitespace-nowrap text-base font-extrabold tracking-tight text-[#0033a0] dark:text-brand-200">
            Resumeflow-ATS
          </span>
        </Link>
        {!onSignIn && (
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user && <AvatarMenu user={user} />}
          </div>
        )}
      </div>
    </header>
  );
}

function AvatarMenu({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { data: session } = useSession();
  const t = useTranslations("nav");

  const isAdmin = Boolean((session as { isAdmin?: boolean } | null)?.isAdmin);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user.name ?? t("signedIn")}
        onClick={() => setOpen((v) => !v)}
        className="block rounded-full"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name ?? "Profile"}
            className="h-8 w-8 rounded-full border border-border"
          />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
            {initial}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-border bg-background p-2 shadow-lg"
        >
          <div className="border-b border-border px-2 pb-2">
            <p className="truncate text-sm font-medium text-foreground">
              {user.name ?? t("signedIn")}
            </p>
            {user.email && (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
          <div className="px-2 py-2">
            <LanguagePicker />
          </div>
          <Link
            href="/settings"
            role="menuitem"
            className="block rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            {t("aiSettings")}
          </Link>
          {isAdmin && (
            <>
              <Link
                href="/admin/analytics"
                role="menuitem"
                className="block rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                {t("analytics")}
              </Link>
              <Link
                href="/admin/templates"
                role="menuitem"
                className="block rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                {t("templates")}
              </Link>
            </>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/signin" })}
            className="mt-1 block w-full rounded-md border border-input px-2 py-2 text-left text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}

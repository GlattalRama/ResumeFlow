"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/resumes", label: "Resumes" },
  { href: "/applications", label: "Applications" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  // On the sign-in page, show only the brand mark.
  const onSignIn = pathname === "/signin";

  const isAdmin = Boolean((session as { isAdmin?: boolean } | null)?.isAdmin);
  const links = isAdmin
    ? [
        ...LINKS,
        { href: "/admin/analytics", label: "Analytics" },
        { href: "/admin/templates", label: "Templates" },
      ]
    : LINKS;

  const user = session?.user;
  const authed = status === "authenticated" && !!user;

  return (
    <header className="no-print sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" className="h-9 w-auto sm:h-10" />
          <span className="text-lg font-extrabold tracking-tight text-[#0033a0] dark:text-brand-200 sm:text-xl">
            Resumeflow-ATS
          </span>
        </Link>

        {/* ---- Desktop nav ---- */}
        {!onSignIn && (
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  isActive(link.href)
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/* ---- Desktop account ---- */}
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {user && (
            <>
              <div className="hidden text-right lg:block">
                <p className="text-sm font-medium leading-tight text-foreground">
                  {user.name ?? "Signed in"}
                </p>
                {user.email && (
                  <p className="text-xs leading-tight text-muted-foreground">
                    {user.email}
                  </p>
                )}
              </div>
              {user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name ?? "Profile"}
                  className="h-8 w-8 rounded-full border border-border"
                />
              )}
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                Sign out
              </button>
            </>
          )}
        </div>

        {/* ---- Mobile menu toggle ---- */}
        {!onSignIn && authed && (
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-md border border-input text-foreground/80"
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        )}
      </div>

      {/* ---- Mobile menu panel ---- */}
      {!onSignIn && user && menuOpen && (
        <nav className="border-t border-border bg-background px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  isActive(link.href)
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
                    : "text-foreground/80 hover:bg-accent"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex min-w-0 items-center gap-2">
              {user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name ?? "Profile"}
                  className="h-8 w-8 shrink-0 rounded-full border border-border"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-tight text-foreground">
                  {user.name ?? "Signed in"}
                </p>
                {user.email && (
                  <p className="truncate text-xs leading-tight text-muted-foreground">
                    {user.email}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="shrink-0 rounded-md border border-input px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-accent"
            >
              Sign out
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

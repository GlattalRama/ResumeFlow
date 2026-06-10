"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/resumes", label: "Resumes" },
  { href: "/applications", label: "Applications" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

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

  return (
    <header className="no-print sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-600 text-sm text-white">
            R
          </span>
          <span className="text-lg">ResumeFlow</span>
        </Link>

        {!onSignIn && (
          <nav className="flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  isActive(link.href)
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {status === "authenticated" && session?.user && (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium leading-tight text-gray-800">
                  {session.user.name ?? "Signed in"}
                </p>
                {session.user.email && (
                  <p className="text-xs leading-tight text-gray-500">
                    {session.user.email}
                  </p>
                )}
              </div>
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ?? "Profile"}
                  className="h-8 w-8 rounded-full border border-gray-200"
                />
              )}
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

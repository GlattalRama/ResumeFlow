import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ApplicationStatus } from "@/lib/types";
import { STATUS_STYLES } from "@/lib/constants";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  // Status VALUES stay English in the data; only the display is localized.
  const t = useTranslations("status");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {t(status)}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  cta,
}: {
  title: string;
  hint?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-input bg-card p-6 text-center sm:p-10">
      <p className="font-medium text-foreground/80">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

export function buttonClass(
  variant: "primary" | "secondary" | "danger" = "primary"
): string {
  const base =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50";
  if (variant === "secondary")
    return `${base} border border-input bg-card text-foreground/80 hover:bg-accent`;
  if (variant === "danger")
    return `${base} border border-red-200 bg-card text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50`;
  return `${base} bg-brand-600 text-white hover:bg-brand-700`;
}

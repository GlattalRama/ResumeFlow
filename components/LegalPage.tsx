import Link from "next/link";

// Shared chrome for the public legal pages (/privacy, /terms). Renders a
// centered, readable prose column styled to match the rest of the app.

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground/70">Last updated: {updated}</p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-brand-600 dark:text-brand-300 [&_a:hover]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.8125rem] [&_code]:text-foreground/80 [&_li]:ml-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>

      <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground/70">
        <Link href="/" className="font-medium text-brand-600 dark:text-brand-300 hover:underline">
          ← Back to Resumeflow-ATS
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <Link href="/terms" className="hover:underline">
          Terms
        </Link>
        <span className="mx-2">·</span>
        <Link href="/support" className="hover:underline">
          Support
        </Link>
      </footer>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

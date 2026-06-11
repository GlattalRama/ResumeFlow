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
      <header className="mb-8 border-b border-gray-100 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {title}
        </h1>
        <p className="mt-2 text-sm text-gray-400">Last updated: {updated}</p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-gray-600 [&_a]:font-medium [&_a]:text-brand-600 [&_a:hover]:underline [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.8125rem] [&_code]:text-gray-700 [&_li]:ml-1 [&_strong]:font-semibold [&_strong]:text-gray-800 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>

      <footer className="mt-12 border-t border-gray-100 pt-6 text-sm text-gray-400">
        <Link href="/" className="font-medium text-brand-600 hover:underline">
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
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

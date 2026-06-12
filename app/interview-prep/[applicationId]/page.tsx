import Link from "next/link";
import { notFound } from "next/navigation";
import { getItem, readByApplication } from "@/lib/store";
import { Card } from "@/components/ui";
import QnaSection from "@/components/QnaSection";
import AiActions from "@/components/AiActions";

export const dynamic = "force-dynamic";

export default async function InterviewPrepPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const app = await getItem("applications", applicationId);
  if (!app) notFound();

  const qna = await readByApplication("qna", applicationId);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/applications/${applicationId}`}
          className="text-sm text-brand-600 dark:text-brand-300 hover:underline"
        >
          ← Back to application
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Interview prep
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {app.jobTitle} · {app.company}
        </p>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground/80">
          Generate questions
        </h2>
        <AiActions applicationId={applicationId} />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground/80">
          Questions &amp; answers
        </h2>
        <QnaSection applicationId={applicationId} items={qna} />
      </Card>
    </div>
  );
}

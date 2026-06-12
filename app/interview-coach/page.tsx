import { readAll } from "@/lib/store";
import { resolveBaseResumeId } from "@/lib/baseResume";
import InterviewCoach from "@/components/InterviewCoach";

export const dynamic = "force-dynamic";

export default async function InterviewCoachPage({
  searchParams,
}: {
  searchParams: Promise<{ application?: string }>;
}) {
  const { application } = await searchParams;
  const [entries, apps, resumes, notes, baseResumeId] = await Promise.all([
    readAll("interviewCoach"),
    readAll("applications"),
    readAll("resumes"),
    readAll("notes"),
    resolveBaseResumeId(),
  ]);

  const noteCount = new Map<string, number>();
  for (const n of notes) {
    noteCount.set(n.applicationId, (noteCount.get(n.applicationId) ?? 0) + 1);
  }

  // Slim context objects for the client — enough to drive the UI without
  // shipping whole records.
  const applications = [...apps]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => ({
      id: a.id,
      company: a.company,
      jobTitle: a.jobTitle,
      jobId: a.jobId,
      status: a.status,
      hasJobDescription: !!a.jobDescription.trim(),
      jobDescriptionPreview: a.jobDescription.slice(0, 280),
      resumeVersionUsed: a.resumeVersionUsed,
      noteCount: noteCount.get(a.id) ?? 0,
    }));

  const resumeOptions = resumes.map((r) => ({
    id: r.id,
    name: r.versionName,
    isBase: r.id === baseResumeId,
  }));

  const initialApplicationId = applications.some((a) => a.id === application)
    ? (application as string)
    : "";

  return (
    <InterviewCoach
      initialEntries={entries}
      applications={applications}
      resumes={resumeOptions}
      baseResumeId={baseResumeId ?? ""}
      initialApplicationId={initialApplicationId}
    />
  );
}

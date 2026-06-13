import { getTranslations } from "next-intl/server";
import { readAll } from "@/lib/store";
import { resolveBaseResumeId } from "@/lib/baseResume";
import WorkJournal from "@/components/WorkJournal";

export const dynamic = "force-dynamic";

export default async function WorkJournalPage() {
  const t = await getTranslations("workJournal");
  const [notes, resumes, baseResumeId] = await Promise.all([
    readAll("workJournal"),
    readAll("resumes"),
    resolveBaseResumeId(),
  ]);

  // Slim picker data for the "add bullet to resume" flow — version names plus
  // experience-entry labels, never full resume content.
  const resumeOptions = resumes.map((r) => ({
    id: r.id,
    name: r.versionName,
    isBase: r.id === baseResumeId,
    experience: r.resumeData.experience.map(
      (e) => `${e.role || t("untitledRole")} — ${e.company || t("unknownCompany")}`
    ),
  }));

  return <WorkJournal initialNotes={notes} resumes={resumeOptions} />;
}

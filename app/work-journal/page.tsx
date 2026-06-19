import { getTranslations } from "next-intl/server";
import { readAll } from "@/lib/store";
import { resolveBaseResumeId } from "@/lib/baseResume";
import { toV2 } from "@/lib/career/migrate";
import WorkJournal from "@/components/WorkJournal";

export const dynamic = "force-dynamic";

export default async function WorkJournalPage() {
  const t = await getTranslations("workJournal");
  const [rawNotes, resumes, baseResumeId] = await Promise.all([
    readAll("workJournal"),
    readAll("resumes"),
    resolveBaseResumeId(),
  ]);
  // Lazily migrate legacy notes to the STAR-native shape for display/editing.
  // Non-destructive: stored data is only rewritten when the user next saves.
  const notes = rawNotes.map(toV2);

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

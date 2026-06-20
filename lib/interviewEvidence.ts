// Shared evidence assembly for the Interview Coach and Interview Practice.
// Gathers everything the AI may ground an answer/feedback in: the work journal
// and base resume always participate; the selected resume version and the
// application/JD only when linked.
import { getBaseResume } from "./baseResume";
import { loadSettings } from "./aiSettings";
import { getItem, readAll, readByApplication } from "./store";
import { buildEvidence, type InterviewEvidence } from "./aiInterviewCoach";

export async function assembleEvidence(
  applicationId: string,
  resumeId: string
): Promise<InterviewEvidence> {
  const [journalNotes, baseResume, settings] = await Promise.all([
    readAll("workJournal"),
    getBaseResume(),
    loadSettings(),
  ]);
  const application = applicationId
    ? (await getItem("applications", applicationId)) ?? null
    : null;
  const applicationNotes = application
    ? await readByApplication("notes", application.id)
    : [];
  // The selected version only adds signal when it isn't the base itself.
  const baseId = settings?.baseResumeId ?? "";
  const selected =
    resumeId && resumeId !== baseId
      ? (await getItem("resumes", resumeId)) ?? null
      : null;

  return buildEvidence({
    journalNotes,
    baseResume: baseResume?.resumeData ?? null,
    selectedResume: selected
      ? { name: selected.versionName, data: selected.resumeData }
      : null,
    application,
    applicationNotes,
  });
}

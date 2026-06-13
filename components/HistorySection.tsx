"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { ResumeSnapshot, ResumeVersion } from "@/lib/types";
import { buildTailorChanges } from "@/lib/tailorDiff";
import TailorComparePane from "./TailorComparePane";
import { buttonClass } from "./ui";

// Version history on the resume preview page: snapshots captured around saves
// (throttled server-side), each restorable and comparable side-by-side with
// the current state. Restoring snapshots the current state first, so it's
// always reversible.

// Coarse "what differs vs current" summary per snapshot row. JSON comparison
// per content group — cheap and complete. Returns translation keys under
// "resumeDetail.history.groups" for display.
function changedGroups(snap: ResumeSnapshot, current: ResumeVersion): string[] {
  const pick = (
    v: Pick<
      ResumeSnapshot,
      | "versionName"
      | "targetRole"
      | "selectedTemplate"
      | "templateStyle"
      | "sectionState"
      | "resumeData"
    >
  ): [string, unknown][] => [
    ["basicsSummary", v.resumeData.basics],
    ["areasOfExpertise", v.resumeData.areasOfExpertise],
    ["experience", v.resumeData.experience],
    ["education", v.resumeData.education],
    ["projects", v.resumeData.projects],
    ["skills", [v.resumeData.skillCategories, v.resumeData.skills]],
    ["certifications", v.resumeData.certifications],
    ["languages", v.resumeData.languages],
    ["customSections", v.resumeData.customSections],
    [
      "templateStyle",
      [v.selectedTemplate, v.templateStyle ?? null, v.sectionState ?? null],
    ],
    ["nameTargetRole", [v.versionName, v.targetRole]],
  ];
  const a = pick(snap);
  const b = pick(current);
  return a
    .filter(([, value], i) => JSON.stringify(value) !== JSON.stringify(b[i][1]))
    .map(([label]) => label);
}

export default function HistorySection({
  resume,
  snapshots,
}: {
  resume: ResumeVersion;
  snapshots: ResumeSnapshot[];
}) {
  const t = useTranslations("resumeDetail.history");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const comparing = snapshots.find((s) => s.id === compareId) ?? null;

  async function restore(snapshot: ResumeSnapshot) {
    const when = new Date(snapshot.savedAt).toLocaleString(locale);
    if (!window.confirm(t("restoreConfirm", { when }))) {
      return;
    }
    setBusyId(snapshot.id);
    setError("");
    try {
      const res = await fetch(`/api/resumes/${resume.id}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: snapshot.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("restoreFailed"));
        return;
      }
      setCompareId(null);
      router.refresh();
    } catch {
      setError(t("restoreNetworkError"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="no-print mt-6 rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-foreground/80">
          {t("title")}{" "}
          <span className="font-normal text-muted-foreground/70">
            ({snapshots.length})
          </span>
        </span>
        <span
          className="text-muted-foreground/70 transition-transform"
          style={{ transform: open ? "none" : "rotate(-90deg)" }}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          {snapshots.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {snapshots.map((snap) => {
                const groups = changedGroups(snap, resume);
                return (
                  <li
                    key={snap.id}
                    className="rounded-lg border border-border bg-muted/50 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground/80">
                          {new Date(snap.savedAt).toLocaleString(locale)}
                          {snap.reason === "pre-restore" && (
                            <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
                              {t("beforeRestore")}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {groups.length === 0
                            ? t("identicalToCurrent")
                            : t("differsIn", {
                                groups: groups
                                  .map((key) => t(`groups.${key}`))
                                  .join(", "),
                              })}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCompareId(compareId === snap.id ? null : snap.id)
                          }
                          disabled={groups.length === 0}
                          className="rounded-md border border-input px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-40"
                        >
                          {compareId === snap.id ? t("hideCompare") : t("compare")}
                        </button>
                        <button
                          type="button"
                          onClick={() => restore(snap)}
                          disabled={busyId !== null || groups.length === 0}
                          className="rounded-md border border-brand-200 dark:border-brand-500/40 bg-brand-50 dark:bg-brand-500/15 px-2.5 py-1 text-xs font-medium text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-500/20 disabled:opacity-40"
                        >
                          {busyId === snap.id ? t("restoring") : t("restore")}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      )}

      {/* Side-by-side: snapshot vs current, changed regions outlined. */}
      {open && comparing && (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("comparingFrom", {
                when: new Date(comparing.savedAt).toLocaleString(locale),
              })}
            </p>
            <button
              type="button"
              onClick={() => restore(comparing)}
              disabled={busyId !== null}
              className={buttonClass("primary")}
            >
              {busyId === comparing.id ? t("restoring") : t("restoreThisSnapshot")}
            </button>
          </div>
          <TailorComparePane
            source={comparing.resumeData}
            tailored={resume.resumeData}
            selectedTemplate={resume.selectedTemplate}
            templateStyle={resume.templateStyle}
            sectionState={resume.sectionState}
            changedKeys={buildTailorChanges(
              comparing.resumeData,
              resume.resumeData,
              undefined
            ).map((c) => c.key)}
            labelLeft={t("labelSnapshot", {
              date: new Date(comparing.savedAt).toLocaleDateString(locale),
            })}
            labelRight={t("labelCurrent")}
          />
        </div>
      )}
    </div>
  );
}

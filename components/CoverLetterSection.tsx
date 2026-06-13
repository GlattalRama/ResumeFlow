"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Document, Packer, Paragraph, TextRun } from "docx";
import type { CoverLetterMeta } from "@/lib/types";
import { COVER_LETTER_TONES } from "@/lib/aiCoverLetter";
import { buttonClass } from "./ui";

type ResumeOption = { id: string; label: string };

const inputClass =
  "rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

// Cover letter card on the application page: generate a draft from a source
// resume + the application's JD (tone selectable), edit inline, then save to
// the application, copy, or download as .docx.
export default function CoverLetterSection({
  applicationId,
  company,
  initialLetter,
  initialMeta,
  resumeOptions,
  defaultSourceId,
}: {
  applicationId: string;
  company: string;
  initialLetter: string;
  initialMeta: CoverLetterMeta | null;
  resumeOptions: ResumeOption[];
  defaultSourceId: string;
}) {
  const router = useRouter();
  const t = useTranslations("ai");
  const [letter, setLetter] = useState(initialLetter);
  const [meta, setMeta] = useState<CoverLetterMeta | null>(initialMeta);
  const [savedLetter, setSavedLetter] = useState(initialLetter);
  const [sourceId, setSourceId] = useState(defaultSourceId);
  const [tone, setTone] = useState("professional");
  const [busy, setBusy] = useState<"" | "generating" | "saving">("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const dirty = letter !== savedLetter;
  const wordCount = useMemo(
    () => letter.split(/\s+/).filter(Boolean).length,
    [letter]
  );

  async function generate() {
    if (!sourceId) return;
    setBusy("generating");
    setError("");
    setWarnings([]);
    try {
      const res = await fetch("/api/ai/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, sourceResumeId: sourceId, tone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("coverLetter.errors.generation"));
        return;
      }
      setLetter(data.letter);
      setMeta(data.meta);
      setWarnings(data.unverifiedFigures ?? []);
    } catch {
      setError(t("coverLetter.errors.network"));
    } finally {
      setBusy("");
    }
  }

  async function save() {
    setBusy("saving");
    setError("");
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverLetter: letter, coverLetterMeta: meta }),
      });
      if (!res.ok) {
        setError(t("coverLetter.errors.save"));
        return;
      }
      setSavedLetter(letter);
      router.refresh();
    } catch {
      setError(t("coverLetter.errors.networkSave"));
    } finally {
      setBusy("");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t("coverLetter.errors.clipboard"));
    }
  }

  async function downloadDocx() {
    const paragraphs = letter
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map(
        (p) =>
          new Paragraph({
            children: p
              .split("\n")
              .flatMap((line, i) =>
                i === 0
                  ? [new TextRun(line)]
                  : [new TextRun({ text: line, break: 1 })]
              ),
            spacing: { after: 200 },
          })
      );
    const doc = new Document({ sections: [{ children: paragraphs }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t("coverLetter.fileName", {
      company: company || t("coverLetter.fileNameFallback"),
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  const generatorRow = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={sourceId}
        onChange={(e) => setSourceId(e.target.value)}
        disabled={busy === "generating"}
        className={`${inputClass} min-w-[12rem] flex-1`}
        aria-label={t("coverLetter.sourceAria")}
      >
        <option value="">{t("coverLetter.choosePlaceholder")}</option>
        {resumeOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.id === defaultSourceId
              ? t("coverLetter.defaultOption", { label: o.label })
              : o.label}
          </option>
        ))}
      </select>
      <select
        value={tone}
        onChange={(e) => setTone(e.target.value)}
        disabled={busy === "generating"}
        className={inputClass}
        aria-label={t("coverLetter.toneAria")}
      >
        {COVER_LETTER_TONES.map((tn) => (
          <option key={tn.id} value={tn.id}>
            {t(`coverLetter.tone.${tn.id}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={generate}
        disabled={!sourceId || busy === "generating"}
        className={buttonClass("primary")}
      >
        {busy === "generating"
          ? t("coverLetter.writing")
          : letter
            ? t("coverLetter.regenerate")
            : t("coverLetter.generate")}
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {!letter && (
        <p className="text-xs text-muted-foreground">
          {t("coverLetter.intro")}
        </p>
      )}
      {generatorRow}

      {letter && (
        <>
          <textarea
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            rows={14}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm leading-relaxed text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label={t("coverLetter.letterAria")}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground/70">
              {t("coverLetter.wordCount", { count: wordCount })}
              {meta &&
                ` · ${t("coverLetter.generatedMeta", {
                  date: new Date(meta.generatedAt).toLocaleDateString(),
                  tone: COVER_LETTER_TONES.some((tn) => tn.id === meta.tone)
                    ? t(`coverLetter.tone.${meta.tone}`)
                    : meta.tone,
                })}`}
              {dirty && ` · ${t("coverLetter.unsavedEdits")}`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copy} className={buttonClass("secondary")}>
                {copied ? t("coverLetter.copied") : t("coverLetter.copy")}
              </button>
              <button
                type="button"
                onClick={downloadDocx}
                className={buttonClass("secondary")}
              >
                {t("coverLetter.download")}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy === "saving" || !dirty}
                className={buttonClass("primary")}
              >
                {busy === "saving"
                  ? t("coverLetter.saving")
                  : dirty
                    ? t("coverLetter.save")
                    : t("coverLetter.saved")}
              </button>
            </div>
          </div>
        </>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-200">
          {t("coverLetter.unverifiedWarning")}{" "}
          <span className="font-semibold">{warnings.join(", ")}</span>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

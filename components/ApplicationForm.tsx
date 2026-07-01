"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Application, ApplicationStatus } from "@/lib/types";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { buttonClass } from "./ui";

const inputClass =
  "w-full rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

export interface ResumeOption {
  id: string;
  label: string;
}

interface Props {
  mode: "create" | "edit";
  initial?: Application;
  resumeOptions: ResumeOption[];
}

export default function ApplicationForm({
  mode,
  initial,
  resumeOptions,
}: Props) {
  const t = useTranslations("application");
  const tStatus = useTranslations("status");
  const router = useRouter();
  const [form, setForm] = useState({
    company: initial?.company ?? "",
    jobTitle: initial?.jobTitle ?? "",
    jobId: initial?.jobId ?? "",
    jobLink: initial?.jobLink ?? "",
    jobDescription: initial?.jobDescription ?? "",
    resumeVersionUsed: initial?.resumeVersionUsed ?? "",
    status: (initial?.status ?? "Saved") as ApplicationStatus,
    appliedDate: initial?.appliedDate ?? "",
    nextAction: initial?.nextAction ?? "",
    nextActionDate: initial?.nextActionDate ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [autofilling, setAutofilling] = useState(false);
  const [autofillNote, setAutofillNote] = useState("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Pull company / title / job ID / description out of the linked posting and
  // drop them into the form. Only fills EMPTY fields for the identity bits
  // (company, title, ID) so a manual entry is never clobbered; the description
  // is always replaced since that's the field the user is autofilling for.
  async function autofill() {
    const link = form.jobLink.trim();
    setAutofillNote("");
    setError("");
    if (!link) {
      setError(t("form.autofillNoLink"));
      return;
    }
    setAutofilling(true);
    try {
      const res = await fetch("/api/applications/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobLink: link }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("form.autofillFailed"));
      setForm((f) => ({
        ...f,
        company: f.company.trim() || data.company || f.company,
        jobTitle: f.jobTitle.trim() || data.jobTitle || f.jobTitle,
        jobId: f.jobId.trim() || data.jobId || f.jobId,
        jobDescription: data.jobDescription || f.jobDescription,
      }));
      setAutofillNote(t("form.autofillDone"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("form.autofillFailed"));
    } finally {
      setAutofilling(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const url =
        mode === "create"
          ? "/api/applications"
          : `/api/applications/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(t("form.saveFailed"));
      const saved = await res.json();
      router.push(`/applications/${saved.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("form.saveFailed"));
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t("form.company")}</label>
            <input className={inputClass} value={form.company} onChange={(e) => set("company", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("form.jobTitle")}</label>
            <input className={inputClass} value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("form.jobId")}</label>
            <input className={inputClass} value={form.jobId} onChange={(e) => set("jobId", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("form.jobLink")}</label>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={form.jobLink}
                onChange={(e) => set("jobLink", e.target.value)}
                placeholder="https://…"
              />
              <button
                type="button"
                onClick={autofill}
                disabled={autofilling}
                className={buttonClass("secondary") + " shrink-0 whitespace-nowrap"}
              >
                {autofilling ? t("form.autofilling") : t("form.autofill")}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("form.autofillHint")}</p>
            {autofillNote && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{autofillNote}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>{t("form.status")}</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => set("status", e.target.value as ApplicationStatus)}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tStatus(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("form.resumeVersionUsed")}</label>
            <select
              className={inputClass}
              value={form.resumeVersionUsed}
              onChange={(e) => set("resumeVersionUsed", e.target.value)}
            >
              <option value="">{t("form.noneOption")}</option>
              {resumeOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("form.appliedDate")}</label>
            <input type="date" className={inputClass} value={form.appliedDate} onChange={(e) => set("appliedDate", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("form.nextActionDate")}</label>
            <input type="date" className={inputClass} value={form.nextActionDate} onChange={(e) => set("nextActionDate", e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <label className={labelClass}>{t("form.nextAction")}</label>
          <input className={inputClass} value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)} placeholder={t("form.nextActionPlaceholder")} />
        </div>
        <div className="mt-3">
          <label className={labelClass}>{t("form.jobDescription")}</label>
          <textarea
            className={inputClass}
            rows={6}
            value={form.jobDescription}
            onChange={(e) => set("jobDescription", e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className={buttonClass("primary")}>
          {saving
            ? t("form.saving")
            : mode === "create"
              ? t("form.addApplication")
              : t("form.saveChanges")}
        </button>
        <button onClick={() => router.back()} className={buttonClass("secondary")} type="button">
          {t("form.cancel")}
        </button>
      </div>
    </div>
  );
}

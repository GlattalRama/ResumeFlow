"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Application, ApplicationStatus } from "@/lib/types";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { buttonClass } from "./ui";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "block text-xs font-medium text-gray-600 mb-1";

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

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
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
      if (!res.ok) throw new Error("Save failed");
      const saved = await res.json();
      router.push(`/applications/${saved.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Company *</label>
            <input className={inputClass} value={form.company} onChange={(e) => set("company", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Job title *</label>
            <input className={inputClass} value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Job ID</label>
            <input className={inputClass} value={form.jobId} onChange={(e) => set("jobId", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Job link</label>
            <input className={inputClass} value={form.jobLink} onChange={(e) => set("jobLink", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => set("status", e.target.value as ApplicationStatus)}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Resume version used</label>
            <select
              className={inputClass}
              value={form.resumeVersionUsed}
              onChange={(e) => set("resumeVersionUsed", e.target.value)}
            >
              <option value="">— none —</option>
              {resumeOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Applied date</label>
            <input type="date" className={inputClass} value={form.appliedDate} onChange={(e) => set("appliedDate", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Next action date</label>
            <input type="date" className={inputClass} value={form.nextActionDate} onChange={(e) => set("nextActionDate", e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <label className={labelClass}>Next action</label>
          <input className={inputClass} value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)} placeholder="e.g. Follow up with recruiter" />
        </div>
        <div className="mt-3">
          <label className={labelClass}>Job description</label>
          <textarea
            className={inputClass}
            rows={6}
            value={form.jobDescription}
            onChange={(e) => set("jobDescription", e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className={buttonClass("primary")}>
          {saving ? "Saving…" : mode === "create" ? "Add application" : "Save changes"}
        </button>
        <button onClick={() => router.back()} className={buttonClass("secondary")} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

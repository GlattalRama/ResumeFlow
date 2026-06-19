"use client";

import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Visual prototype of the redesigned Career Growth System.
// Mock data only — demonstrates the UX from docs/career-growth-system-design.md.
// ─────────────────────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-md border border-input bg-card text-foreground px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

const CATEGORIES = [
  "Technical Delivery", "Leadership", "Incident Resolution", "Automation",
  "Process Improvement", "Quality Improvement", "Compliance",
  "Customer Impact", "Cost Optimization", "Innovation",
] as const;

const CAT_COLOR: Record<string, string> = {
  "Technical Delivery": "bg-brand-500/15 text-brand-300 border-brand-500/30",
  Leadership: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  "Incident Resolution": "bg-red-500/15 text-red-300 border-red-500/30",
  Automation: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  "Quality Improvement": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "Cost Optimization": "bg-amber-500/15 text-amber-300 border-amber-500/30",
};
const catColor = (c: string) =>
  CAT_COLOR[c] || "bg-muted text-muted-foreground border-border";

type Achievement = {
  id: string;
  title: string;
  category: string;
  metrics: string[];
  outputs: "ready" | "stale" | "none";
  leadership?: boolean;
};

const MOCK: Achievement[] = [
  { id: "1", title: "Led Verification 7.1 release planning across 4 teams", category: "Technical Delivery", metrics: ["on-time", "0 critical defects"], outputs: "ready", leadership: true },
  { id: "2", title: "Automated batch-job regression suite", category: "Automation", metrics: ["40% faster", "2 days → 4 hrs"], outputs: "ready" },
  { id: "3", title: "Resolved Sev-1 settlement outage in 90 minutes", category: "Incident Resolution", metrics: ["$1.2M exposure avoided"], outputs: "stale" },
  { id: "4", title: "Mentored two junior analysts to independent delivery", category: "Leadership", metrics: ["2 promoted"], outputs: "none", leadership: true },
  { id: "5", title: "Cut DB2 query cost on nightly reconciliation", category: "Cost Optimization", metrics: ["$200k/yr saved"], outputs: "ready" },
];

const OUTPUT_PILL: Record<string, string> = {
  ready: "bg-emerald-500/15 text-emerald-300",
  stale: "bg-amber-500/15 text-amber-300",
  none: "bg-muted text-muted-foreground",
};
const OUTPUT_LABEL: Record<string, string> = {
  ready: "✓ 4 outputs ready",
  stale: "⚠ outputs stale",
  none: "○ no outputs yet",
};

const TABS = ["Capture", "Dashboard", "Outputs", "Promotion"] as const;
type Tab = (typeof TABS)[number];

export default function CareerPreview() {
  const [tab, setTab] = useState<Tab>("Capture");
  const [expandOpen, setExpandOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [capture, setCapture] = useState("");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Prototype banner */}
      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
        🎨 Visual prototype — mock data, no backend. See <code>docs/career-growth-system-design.md</code> for the full spec.
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Career</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture wins as they happen — turn them into bullets, stories, and a promotion case.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
            {tab === t && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />
            )}
          </button>
        ))}
      </div>

      {tab === "Capture" && (
        <CaptureTab
          capture={capture}
          setCapture={setCapture}
          onHelpMeWrite={() => setExpandOpen(true)}
          onOpenEditor={() => setEditorOpen(true)}
        />
      )}
      {tab === "Dashboard" && <DashboardTab />}
      {tab === "Outputs" && <OutputsTab />}
      {tab === "Promotion" && <PromotionTab />}

      {expandOpen && (
        <AiExpandModal
          input={capture}
          onClose={() => setExpandOpen(false)}
          onAccept={() => {
            setExpandOpen(false);
            setEditorOpen(true);
          }}
        />
      )}
      {editorOpen && <EditorDrawer onClose={() => setEditorOpen(false)} />}
    </div>
  );
}

// ── Capture tab ──────────────────────────────────────────────────────────────
function CaptureTab({
  capture,
  setCapture,
  onHelpMeWrite,
  onOpenEditor,
}: {
  capture: string;
  setCapture: (v: string) => void;
  onHelpMeWrite: () => void;
  onOpenEditor: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Quick capture hero */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <label className={labelClass}>Quick capture</label>
        <textarea
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
          rows={2}
          placeholder='e.g. "Coordinated Verification 7.1 release planning and testing across 4 teams"'
          className={inputClass}
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Type a rough sentence — AI turns it into a STAR achievement.
          </p>
          <button
            onClick={onHelpMeWrite}
            disabled={!capture.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            ✦ Help Me Write
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input placeholder="Search…" className={`${inputClass} max-w-xs`} />
        {["Category ▾", "Year ▾", "Resume-ready", "Leadership", "Technical"].map(
          (f) => (
            <button
              key={f}
              className="rounded-full border border-input bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {f}
            </button>
          )
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {MOCK.map((a) => (
          <button
            key={a.id}
            onClick={onOpenEditor}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-brand-500/40"
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{a.title}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${catColor(a.category)}`}
                >
                  {a.category}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {a.metrics.map((m) => (
                  <span key={m} className="rounded bg-muted px-1.5 py-0.5">
                    {m}
                  </span>
                ))}
                <span className={`rounded px-1.5 py-0.5 ${OUTPUT_PILL[a.outputs]}`}>
                  {OUTPUT_LABEL[a.outputs]}
                </span>
              </div>
            </div>
            <span className="text-muted-foreground">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── AI "Help Me Write" modal ─────────────────────────────────────────────────
function AiExpandModal({
  input,
  onClose,
  onAccept,
}: {
  input: string;
  onClose: () => void;
  onAccept: () => void;
}) {
  const star = {
    Situation:
      "The Verification 7.1 release spanned four teams with overlapping test scopes and a fixed regulatory go-live date.",
    Task: "As validation lead, I owned release planning and coordination of testing activities across those teams.",
    Action:
      "I built a unified test plan, set entry/exit criteria, ran daily triage, and sequenced regression so dependencies cleared first.",
    Result:
      "We delivered on time with zero critical production defects in the first 30 days.",
  };
  return (
    <Overlay onClose={onClose}>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg">✦</span>
        <h2 className="font-semibold text-foreground">AI draft — review &amp; edit</h2>
      </div>
      <p className="mb-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        From: “{input || "Coordinated Verification 7.1 release planning…"}”
      </p>
      <div className="space-y-3">
        {Object.entries(star).map(([k, v]) => (
          <div key={k}>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">
              {k}
            </p>
            <p className="text-sm text-foreground/90">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Suggested category
        </p>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${catColor("Technical Delivery")}`}>
          Technical Delivery
        </span>
        <p className="mb-1.5 mt-3 text-xs font-medium text-muted-foreground">
          Metrics to confirm <span className="text-amber-400">(unverified — you fill the numbers)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["On-time delivery", "Critical defects", "Teams coordinated"].map((m) => (
            <span key={m} className="rounded bg-card px-2 py-0.5 text-xs text-foreground/80">
              {m} ?
            </span>
          ))}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-accent">
          Discard
        </button>
        <button onClick={onAccept} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Use this →
        </button>
      </div>
    </Overlay>
  );
}

// ── Editor drawer ────────────────────────────────────────────────────────────
function EditorDrawer({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"star" | "outputs">("star");
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative h-full w-full max-w-xl overflow-y-auto border-l border-border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Edit achievement</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <label className={labelClass}>Title *</label>
        <input
          defaultValue="Led Verification 7.1 release planning across 4 teams"
          className={`${inputClass} mb-3`}
        />

        <label className={labelClass}>Category</label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <span
              key={c}
              className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${
                c === "Technical Delivery"
                  ? catColor(c)
                  : "border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </span>
          ))}
        </div>

        <div className="mb-4 flex gap-1 border-b border-border">
          <DrawerTab active={tab === "star"} onClick={() => setTab("star")}>STAR</DrawerTab>
          <DrawerTab active={tab === "outputs"} onClick={() => setTab("outputs")}>Outputs</DrawerTab>
        </div>

        {tab === "star" ? (
          <div className="space-y-3">
            {[
              ["Situation", "Four teams, overlapping test scopes, fixed regulatory go-live."],
              ["Task", "Owned release planning and cross-team test coordination as validation lead."],
              ["Action", "Built a unified test plan, set entry/exit criteria, ran daily triage."],
              ["Result", "Delivered on time with zero critical production defects."],
            ].map(([k, v]) => (
              <div key={k}>
                <label className={labelClass}>{k}</label>
                <textarea defaultValue={v} rows={2} className={inputClass} />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                ✦ Help Me Write
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground/80 hover:bg-accent">
                ✦ Polish wording
              </button>
            </div>

            <div className="pt-2">
              <label className={labelClass}>Metrics</label>
              <div className="space-y-2">
                {[["Time saved", "—", ""], ["Defects prevented", "0 critical", "first 30 days"]].map(
                  ([t, v, u], i) => (
                    <div key={i} className="flex gap-2">
                      <select className={`${inputClass} max-w-[40%]`} defaultValue={t as string}>
                        <option>{t}</option>
                      </select>
                      <input className={inputClass} defaultValue={v as string} placeholder="value" />
                      <input className={`${inputClass} max-w-[30%]`} defaultValue={u as string} placeholder="unit" />
                    </div>
                  )
                )}
                <button className="text-sm font-medium text-brand-400 hover:text-brand-300">+ add metric</button>
              </div>
            </div>

            <div className="pt-2">
              <label className={labelClass}>Evidence</label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select className={`${inputClass} max-w-[35%]`} defaultValue="Jira">
                    <option>Jira</option><option>Azure DevOps</option><option>ServiceNow</option>
                    <option>Confluence</option><option>URL</option><option>Screenshot</option>
                  </select>
                  <input className={inputClass} defaultValue="VER-7.1 release ticket" />
                </div>
                <button className="text-sm font-medium text-brand-400 hover:text-brand-300">+ add evidence</button>
              </div>
            </div>
          </div>
        ) : (
          <OutputsPanel />
        )}

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-input" />
            Resume-ready
          </label>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-accent">Cancel</button>
            <button onClick={onClose} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-2 text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
      {active && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-brand-500" />}
    </button>
  );
}

function OutputsPanel() {
  const outs = [
    ["Resume bullet", "Led Verification 7.1 release planning across four teams, delivering on time with zero critical production defects."],
    ["STAR interview story", "When four teams converged on the Verification 7.1 release with a fixed regulatory date… (full narrative)"],
    ["LinkedIn post", "Proud to have led the Verification 7.1 release — four teams, one plan, zero critical defects at go-live. 🚀"],
    ["Performance review", "Demonstrated cross-team leadership by owning Verification 7.1 release planning, de-risking a regulatory deadline and delivering defect-free."],
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">✓ generated · 1 AI call</span>
        <button className="text-sm font-medium text-brand-400 hover:text-brand-300">↻ Regenerate all</button>
      </div>
      {outs.map(([k, v]) => (
        <div key={k} className="rounded-md border border-border bg-card p-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</p>
            <button className="text-xs text-brand-400 hover:text-brand-300">Copy</button>
          </div>
          <p className="text-sm text-foreground/90">{v}</p>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard tab ────────────────────────────────────────────────────────────
function DashboardTab() {
  const stats = [
    ["Achievements", "42"], ["Resume-ready", "18"], ["STAR stories", "12"],
    ["Leadership", "9"], ["Technical", "27"], ["Promotions supported", "2"],
  ];
  const months = [3, 5, 2, 6, 4, 7, 5, 8, 6, 9, 7, 11];
  const cats = [
    ["Technical Delivery", 27], ["Leadership", 9], ["Automation", 7],
    ["Cost Optimization", 5], ["Incident Resolution", 4],
  ] as const;
  const maxCat = Math.max(...cats.map((c) => c[1]));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-3xl font-bold text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-4 font-semibold text-foreground">Achievements over time</p>
          <div className="flex h-32 items-end gap-1.5">
            {months.map((m, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-brand-600 to-brand-400"
                style={{ height: `${(m / 11) * 100}%` }}
                title={`${m}`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Last 12 months</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-4 font-semibold text-foreground">By category</p>
          <ul className="space-y-2.5">
            {cats.map(([c, n]) => (
              <li key={c} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 truncate text-muted-foreground">{c}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${(n / maxCat) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-muted-foreground">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-3 flex items-center gap-2 font-semibold text-foreground">
          <span>✦</span> Career insights
        </p>
        <ul className="space-y-2 text-sm text-foreground/80">
          <li>• Your strongest area is <strong className="text-foreground">Technical Delivery</strong> (27 wins).</li>
          <li>• Leadership achievements are up <strong className="text-foreground">3×</strong> vs last year — promotion signal.</li>
          <li>• Gap for Staff promotion: <strong className="text-amber-400">Mentoring</strong> — only 1 captured achievement.</li>
          <li>• Most-demonstrated skills: <strong className="text-foreground">release management, regression strategy, stakeholder comms</strong>.</li>
        </ul>
      </div>
    </div>
  );
}

// ── Outputs library tab ──────────────────────────────────────────────────────
function OutputsTab() {
  const rows = [
    ["Resume bullet", "Led Verification 7.1 release planning across four teams, delivering on time with zero critical production defects.", "Technical Delivery"],
    ["LinkedIn post", "Proud to have led the Verification 7.1 release — four teams, one plan, zero critical defects. 🚀", "Technical Delivery"],
    ["Resume bullet", "Automated batch-job regression, cutting a 2-day cycle to 4 hours (40% faster releases).", "Automation"],
    ["STAR story", "When a Sev-1 settlement outage hit at market open… resolved in 90 minutes, avoiding $1.2M exposure.", "Incident Resolution"],
    ["Performance review", "Mentored two junior analysts to independent delivery; both promoted within the year.", "Leadership"],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input placeholder="Search outputs…" className={`${inputClass} max-w-xs`} />
        {["Type ▾", "Category ▾", "Copy selected", "Export .md"].map((f) => (
          <button key={f} className="rounded-full border border-input bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">{f}</button>
        ))}
      </div>
      {rows.map(([type, text, cat], i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="rounded bg-brand-500/15 px-2 py-0.5 text-xs font-medium text-brand-300">{type}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${catColor(cat)}`}>{cat}</span>
            <button className="ml-auto text-xs text-brand-400 hover:text-brand-300">Copy</button>
          </div>
          <p className="text-sm text-foreground/90">{text}</p>
        </div>
      ))}
    </div>
  );
}

// ── Promotion readiness tab ──────────────────────────────────────────────────
function PromotionTab() {
  const dims = [
    ["Technical Excellence", 8, 12], ["Delivery", 8, 11], ["Leadership", 5, 6],
    ["Stakeholder Mgmt", 6, 7], ["Innovation", 4, 3], ["Communication", 6, 5],
    ["Mentoring", 2, 1],
  ] as const;
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-foreground">Promotion readiness</p>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Senior → Staff</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
          <Radar dims={dims.map(([label, score]) => ({ label, score }))} />
          <ul className="space-y-3">
            {dims.map(([label, score, count]) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 text-foreground/80">{label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${score <= 3 ? "bg-amber-500" : "bg-gradient-to-r from-brand-600 to-brand-400"}`}
                    style={{ width: `${score * 10}%` }}
                  />
                </div>
                <span className="w-10 text-right text-muted-foreground">{score}/10</span>
                <span className="w-16 text-right text-xs text-muted-foreground/70">({count} wins)</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-3 flex items-center gap-2 font-semibold text-foreground"><span>✦</span> Recommendations</p>
        <ul className="space-y-2 text-sm text-foreground/80">
          <li>• <strong className="text-amber-400">Mentoring is your weakest dimension</strong> (2/10). Capture coaching and onboarding wins — you have strong delivery but thin evidence of growing others.</li>
          <li>• Innovation has impact but few entries — log the experiments and proposals you drove.</li>
          <li>• You exceed the Staff bar on Technical Excellence and Delivery; lead your packet with those.</li>
        </ul>
      </div>
    </div>
  );
}

// Hand-rolled SVG radar — no chart library.
function Radar({ dims }: { dims: { label: string; score: number }[] }) {
  const n = dims.length;
  const cx = 100, cy = 100, r = 78;
  const pt = (i: number, frac: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * r * frac, cy + Math.sin(angle) * r * frac];
  };
  const ring = (frac: number) =>
    dims.map((_, i) => pt(i, frac).join(",")).join(" ");
  const shape = dims.map((d, i) => pt(i, d.score / 10).join(",")).join(" ");
  return (
    <svg viewBox="0 0 200 200" className="mx-auto h-48 w-48">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} className="fill-none stroke-border" strokeWidth={1} />
      ))}
      {dims.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="stroke-border" strokeWidth={1} />;
      })}
      <polygon points={shape} className="fill-brand-500/25 stroke-brand-400" strokeWidth={2} />
    </svg>
  );
}

// ── Shared overlay ───────────────────────────────────────────────────────────
function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-xl">
        {children}
      </div>
    </div>
  );
}

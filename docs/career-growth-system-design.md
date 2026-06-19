# Career Growth System — Redesign of the Work Journal

> Turns the Work Journal from a note-taking surface into a **Career Growth System**: capture
> achievements continuously, then auto-transform them into resume bullets, LinkedIn posts,
> STAR interview stories, performance-review content, and promotion packets.

This design is grounded in the **actual ResumeFlow codebase**, not a generic template. Key
constraints it respects:

| Reality in this repo | Design consequence |
| --- | --- |
| Storage is a per-user JSON document in Google Drive (`lib/store.ts`), no SQL DB | "Schema" = a versioned **document model**; analytics computed in-memory over one user's collection |
| No charting library installed; dashboard uses Tailwind/SVG bars (`app/page.tsx`) | New charts are hand-rolled Tailwind/SVG — **no new dependency** |
| Shared AI key is capped at **30 calls/user/day** (`lib/aiSettings.ts`) | **Batch** generation (all outputs in one call), cache on the doc, regenerate on demand only |
| Every AI generator verifies output against source to block invented numbers (`lib/aiTailor.ts`, `lib/aiCoverLetter.ts`) | New AI features reuse the **fact-binding** guardrail; metrics are user-confirmed, never invented |
| AI via OpenRouter + Vercel AI SDK `generateObject` + `jsonSchema` (`lib/aiServer.ts`) | New helpers mirror `resolveAiAccess()` → `openrouterModel()` → `generateObject()` |
| next-intl, 5 locales, no URL routing (`messages/*.json`) | All new strings go in a `career` namespace across `en/de/fr/it/es` |
| Nav is a flat `LINKS` array (`components/Nav.tsx`) | Rename `workJournal` → `career`; sub-views are tabs, not nav items |

---

## 1. UX Redesign (the core idea)

**Problem with today's form:** 13 flat fields at equal weight, optional context indistinguishable
from the one required field. Capture feels like data entry, and nothing happens after you save —
the user has to manually run "generate bullets."

**New mental model — three moments:**

1. **Capture (10 seconds).** One box: "What did you do?" Type a rough sentence, hit **Help Me
   Write**. AI expands it into STAR, suggests a category, proposes metrics to confirm, and extracts
   demonstrated skills. The user edits, not authors.
2. **Enrich (optional, async).** Add evidence links (Jira/ADO/ServiceNow/Confluence/URL), confirm
   metrics, tag. Done whenever — the capture already has value.
3. **Harvest (automatic).** Each finalized achievement yields four ready-to-paste outputs (resume
   bullet, STAR story, LinkedIn post, perf-review blurb), plus it feeds the dashboard, career
   insights, and promotion-readiness score.

**Tone:** Notion/Linear calm. One primary action per screen, keyboard-first (`C` to capture,
`⌘↵` to save, `⌘K` to jump). Mobile = a single capture field behind a FAB; everything else
progressively disclosed (the collapsible form already shipped in Phase 0).

---

## 2. Information Architecture

Rename the **"Journal"** nav item to **"Career"** (`/career`, keep `/work-journal` as a redirect for
existing links). One route, four tabs:

```
/career
 ├─ Capture     (default)  timeline of achievements + quick-capture bar
 ├─ Dashboard              career stats, trends, insights
 ├─ Outputs                library of generated bullets / STAR / LinkedIn / perf-review, filter+export
 └─ Promotion              readiness score across 7 dimensions + recommendations
```

Cross-links that already make sense in the app:
- **Capture → Resume:** existing `add-to-resume` flow (`/api/work-journal/add-to-resume`) stays.
- **Outputs → Cover Letter / Interview Coach:** STAR stories feed the existing interview-coach
  context (`lib/aiContext.ts`), closing the loop the product already started.

---

## 3. Data Model (document model, backward-compatible)

We **extend** `WorkJournalNote` rather than replace it, and keep the `"workJournal"` collection key so
existing entries and the dual-backend store keep working. New fields are optional; a one-time
migration backfills STAR from the legacy prose fields.

```ts
// lib/types.ts — extends the existing WorkJournalNote (legacy fields kept, marked @deprecated)

export type AchievementCategory =
  | "technical-delivery" | "leadership" | "incident-resolution" | "automation"
  | "process-improvement" | "quality-improvement" | "compliance"
  | "customer-impact" | "cost-optimization" | "innovation";

export type MetricType =
  | "time-saved" | "cost-saved" | "revenue-impact" | "defects-prevented"
  | "risk-reduced" | "customers-impacted" | "people-influenced"
  | "projects-delivered" | "custom";

export interface Metric {
  type: MetricType;
  label: string;          // display label ("Time saved", or custom)
  value: string;          // "40%", "$200k", "3" — free text, user-confirmed
  unit?: string;          // optional ("hrs/week", "USD")
}

export type EvidenceType =
  | "jira" | "azure-devops" | "servicenow" | "confluence" | "document" | "screenshot" | "url";

export interface Evidence {
  type: EvidenceType;
  label: string;          // "VER-7.1 release ticket"
  url?: string;           // external link
  blobKey?: string;       // for uploaded screenshots/docs (Vercel Blob)
}

export interface Star { situation: string; task: string; action: string; result: string; }

export interface GeneratedOutputs {
  resumeBullet: string;
  starStory: string;       // narrative form for interviews
  linkedinPost: string;
  perfReviewBlurb: string; // manager-friendly language
  generatedAt: string;     // ISO; lets UI show "outputs are stale, regenerate"
  model: string;           // which model produced them
}

export interface WorkJournalNote {
  // ── existing fields (unchanged) ──
  id: string; title: string; company: string; client: string; project: string;
  role: string; period: string; tags: string[]; resumeReady: boolean;
  linkedResumeId: string; linkedSection: string;
  createdAt: string; updatedAt: string;

  // ── legacy free-text (kept; source for STAR migration) ──
  /** @deprecated migrated into `star.action` */ whatIDid: string;
  /** @deprecated migrated into `star.situation`/`task` */ problemSolved: string;
  /** @deprecated migrated into `star.result` */ impactResult: string;
  /** @deprecated replaced by structured `metrics` */ metrics: string;
  generatedResumeBullets: string[];   // kept; mirrors outputs.resumeBullet
  starStory: string;                  // kept; mirrors outputs.starStory

  // ── new ──
  star?: Star;
  category?: AchievementCategory;
  metricsList?: Metric[];
  evidence?: Evidence[];
  skills?: string[];                  // demonstrated skills (for insights)
  outputs?: GeneratedOutputs;         // cached multi-output generation
  schemaVersion?: number;             // 2 = STAR-native; absent/1 = legacy
}
```

**Why no relational schema:** the store reads/writes the whole array per user (`lib/store.ts`).
Evidence and metrics are embedded arrays, not joined tables — correct for a document store and for
the data volume (tens-to-low-hundreds of entries per user).

**Migration:** on first load of a v1 note, derive `star` from `{problemSolved→situation/task,
whatIDid→action, impactResult→result}` and set `schemaVersion=2`. Non-destructive; legacy fields
remain. No bulk migration job needed — migrate lazily on read/edit.

---

## 4. React Component Hierarchy

Mirrors existing primitives (`Card`, `PageHeader`, `buttonClass`, `EmptyState` from
`components/ui.tsx`; the AI-preview pattern from `WorkJournal.tsx`).

```
app/career/page.tsx                 server: loads collection, computes stats, renders <CareerHub/>
components/career/
  CareerHub.tsx                     client: tab state (Capture/Dashboard/Outputs/Promotion)
  capture/
    QuickCapture.tsx                single textarea + "Help Me Write" (the hero action)
    AchievementList.tsx             searchable/filterable timeline
    AchievementCard.tsx             collapsed row: title, category chip, metric chips, output status
    AchievementEditor.tsx           slide-in drawer (replaces inline form)
      StarFields.tsx                Situation/Task/Action/Result (4 areas)
      CategoryPicker.tsx            10 categories as a chip grid
      MetricsEditor.tsx             add typed metric rows (type ▾ + value + unit)
      EvidenceList.tsx              add link / upload screenshot rows
      OutputsPanel.tsx              shows 4 generated outputs; copy / add-to-resume / regenerate
    AiExpandModal.tsx               preview of "Help Me Write" → accept fills the drawer
  dashboard/
    StatGrid.tsx                    6 metric cards (reuses dashboard card styling)
    TrendChart.tsx                  achievements/month — CSS bars (like pipeline in app/page.tsx)
    CategoryBreakdown.tsx           horizontal Tailwind bars per category
    InsightsPanel.tsx               AI career insights (cached)
  outputs/
    OutputsLibrary.tsx              all outputs across achievements, filter + bulk copy/export
  promotion/
    PromotionReadiness.tsx          orchestrates score + recommendations
    ReadinessRadar.tsx              hand-rolled SVG radar (7 axes), no chart lib
    DimensionBar.tsx                per-dimension score + evidence count
    RecommendationsList.tsx         "to be promotion-ready, capture more X"
  shared/
    Drawer.tsx                      reusable right-side panel (new primitive)
    AiPreview.tsx                   generalized accept/reject preview (extracted from WorkJournal)
```

**Refactor note:** promote the hardcoded `inputClass`/`labelClass` (currently copy-pasted in
`ApplicationForm.tsx`, `WorkJournal.tsx`, etc.) into `components/ui.tsx` exports while we're here.

---

## 5. Page Wireframes (ASCII)

**Capture (default tab):**
```
┌─────────────────────────────────────────────────────────────┐
│ Career                                   [Capture]·Dashboard·Outputs·Promotion
│ Capture wins as they happen — turn them into bullets, stories, and a promotion case.
│                                                                │
│ ┌─ Quick capture ─────────────────────────────────────────┐  │
│ │ What did you do?  e.g. "Coordinated Verification 7.1     │  │
│ │ release planning and testing across 4 teams"            │  │
│ │                                    [ ✦ Help Me Write ]  │  │
│ └──────────────────────────────────────────────────────────┘ │
│  Search…   ▾Category  ▾Year  ☐Resume-ready ☐Leadership ☐Tech  │
│                                                                │
│ ● Led Verification 7.1 release planning      [Tech Delivery]  │
│   ⏱ on-time · 🛡 0 critical defects · ✔ 4 outputs ready  →    │
│ ● Automated regression suite for batch jobs  [Automation]     │
│   ⏱ 40% faster · ⚠ outputs stale          →                  │
└─────────────────────────────────────────────────────────────┘
```

**Achievement editor (drawer):**
```
                              ┌── Edit achievement ──────────────┐
   list stays visible  ……… │ Title*  [Led Verification 7.1 …] │
                            │ Category ▾ [Technical Delivery]    │
                            │ ── STAR ──                          │
                            │ Situation [……]  Task [……]          │
                            │ Action    [……]  Result [……]        │
                            │ ✦ Help Me Write   ✦ Polish wording │
                            │ ── Metrics ──                       │
                            │ [Time saved ▾][40%][hrs/wk]  + add  │
                            │ ── Evidence ──                      │
                            │ [Jira ▾][VER-7.1] [link]     + add  │
                            │ ── Outputs (auto) ──                │
                            │ Resume ▸  STAR ▸  LinkedIn ▸  Perf ▸ │
                            │ [Regenerate all]  ☑ Resume-ready    │
                            │            [Save]  [Cancel]         │
                            └────────────────────────────────────┘
```

**Dashboard:**
```
[ 42 Achievements ] [ 18 Resume-ready ] [ 12 STAR ] [ 9 Leadership ] [ 27 Technical ] [ 2 Promotions ]
┌ Achievements over time ─────────────┐ ┌ By category ───────────────┐
│  ▁▃▅▂▆█▄▃  (bars, last 12 mo)        │ │ Technical Delivery ███████  │
└─────────────────────────────────────┘ │ Leadership        ████       │
┌ Career insights (AI) ───────────────┐ │ Automation        ███        │
│ • Strongest area: Technical Delivery │ └────────────────────────────┘
│ • Leadership wins up 3× vs last year │
│ • Gap for promotion: Mentoring (1)   │
└─────────────────────────────────────┘
```

**Promotion readiness:**
```
┌ Promotion readiness — Senior → Staff ───────────────────────┐
│        Technical Excellence ●                                │
│   Communication ●        ╱│╲        ● Leadership             │
│        Mentoring ●──── radar ────● Stakeholder Mgmt          │
│            Innovation ●     ● Delivery                        │
│                                                              │
│ Technical Excellence ████████░░ 8/10  (12 achievements)      │
│ Leadership           █████░░░░░ 5/10  (6)                    │
│ Mentoring            ██░░░░░░░░ 2/10  (1)  ← weakest         │
│ Recommendation: capture mentoring/coaching wins — you have   │
│ strong delivery but thin evidence of growing others.         │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. AI Workflow Architecture

New helper `lib/aiCareer.ts`, new route `app/api/ai/career/route.ts` (mirrors
`app/api/ai/work-journal/route.ts`: validate → `resolveAiAccess()` → `generateObject` → return draft,
client accepts before persist). **Cap-aware: each user action = exactly one AI call.**

| Action | Trigger | Input | Output (one `generateObject` call) | Verification |
| --- | --- | --- | --- | --- |
| `expand` (Help Me Write) | capture box | rough text + context (role/company) | `{ star, suggestedCategory, suggestedMetrics[], skills[] }` | metrics returned as *suggestions to confirm*, flagged if numbers absent from input |
| `polish` | editor | a STAR draft | tightened `{ situation, task, action, result }` | reject any new figures (reuse `aiTailor` guard) |
| `outputs` | finalize / "Regenerate all" | full achievement | **all four** `{ resumeBullet, starStory, linkedinPost, perfReviewBlurb }` | strip/flag figures not in source (reuse `aiCoverLetter` `numberTokens`) |
| `insights` | Dashboard open (cached 24h) | whole collection digest | `{ strongestCategory, trends[], gaps[], topSkills[] }` | descriptive only; no fabricated claims |
| `promotion` | Promotion tab (cached) | collection digest + target level | `{ scores[7], recommendations[] }` | scores derived from evidence counts the prompt is given |

**Cost discipline (critical given 30/day cap):**
- One call yields **all four outputs**, not four calls.
- Outputs cached on `note.outputs`; UI shows "stale" when `updatedAt > outputs.generatedAt` and only
  regenerates on explicit user action.
- `insights` and `promotion` are **collection-level and cached** (store `generatedAt` + a hash of the
  collection; recompute only when the hash changes or cache is >24h old).
- BYOK users (own OpenRouter key) are unmetered — power users get instant regeneration.

**Hallucination guardrail (non-negotiable, matches existing code):** the system prompt carries the
same hard rule already used across the app — *"use ONLY facts present in the achievement; never invent
employers, clients, tools, numbers, or outcomes."* `expand` may *suggest* metric **types** to capture,
but any numeric value the user didn't supply is surfaced as an unconfirmed suggestion, never written as
fact.

---

## 7. Dashboard Design

All computed server-side in `app/career/page.tsx` over the loaded collection (no DB query, no chart
lib):

- **6 stat cards** — Total, Resume-ready, STAR stories, Leadership, Technical, Promotions supported.
  Reuse the gradient metric-card markup from `app/page.tsx:212`.
- **Achievements-over-time** — bucket by `createdAt` month → CSS-height bars (same technique as the
  application-pipeline bars).
- **Category breakdown** — count per `category` → horizontal Tailwind bars.
- **Career insights** — cached AI panel (section 6).

`leadership`/`technical` counts are **derived** from category (e.g. leadership = `leadership` +
`process-improvement` + `customer-impact`; technical = `technical-delivery` + `automation` +
`quality-improvement` + `incident-resolution`) so the user never tags twice.

---

## 8. Mobile Experience

- **FAB** ("＋ Capture") opens the quick-capture sheet — one field + Help Me Write. That alone is a
  complete capture; everything else is optional and behind disclosure (Phase 0's collapsible form is
  the foundation).
- Tabs become a **bottom segmented control**; the editor drawer becomes a **full-screen sheet**.
- STAR fields auto-grow to 2 rows; metric/evidence rows stack.
- Optional later: voice-to-text into the capture box (browser `SpeechRecognition`) — minimal-typing
  promise from the brief.

---

## 9. Future Roadmap

| Phase | Theme | Ships |
| --- | --- | --- |
| **0 ✅** | Declutter | Collapsible form (done) |
| **1** | STAR-native capture | Data-model v2 + lazy migration; STAR fields; `expand` (Help Me Write); categories; nav rename |
| **2** | Real metrics & evidence | Structured `MetricsEditor`; `EvidenceList` (links + Blob screenshot upload) |
| **3** | Multi-output engine | Batched `outputs` generation; `OutputsPanel` + `OutputsLibrary`; LinkedIn & perf-review copy |
| **4** | Career intelligence | Dashboard (stats/trends) + cached `insights` |
| **5** | Promotion readiness | 7-dimension score, SVG radar, recommendations |
| **6** | Automation & integrations | Weekly "capture your wins" nudge (email via existing Resend); Jira/ADO/ServiceNow import to pre-fill evidence; export promotion packet as PDF (reuse resume PDF pipeline) |

---

## 10. Detailed Implementation Plan — Phase 1 (the foundation)

Smallest slice that delivers the new feel. ~1–1.5 days.

1. **Types** — `lib/types.ts`: add `Star`, `AchievementCategory`, the new optional fields, and
   `schemaVersion`. Keep legacy fields.
2. **Lazy migration** — `lib/career/migrate.ts`: `toV2(note)` maps legacy prose → `star`, sets
   `schemaVersion=2`. Call it in the GET route's map and on editor open. Non-destructive.
3. **AI helper** — `lib/aiCareer.ts`: `expandToStar(text, context, model)` and
   `polishStar(star, model)` using `generateObject` + `jsonSchema`, mirroring `lib/aiWorkJournal.ts`
   (reuse `resolveAiAccess`, `openrouterModel`, the fact-binding system prompt, `isCreditsError`).
4. **API** — `app/api/ai/career/route.ts` with `action: "expand" | "polish"`; `maxDuration = 60`;
   validate before `resolveAiAccess()` (don't burn cap on empty input).
5. **UI** —
   - Extract `Drawer.tsx` and generalize the existing AI-preview into `AiPreview.tsx`.
   - Build `QuickCapture.tsx` (textarea + Help Me Write → `AiExpandModal` → opens prefilled
     `AchievementEditor` drawer).
   - `AchievementEditor.tsx` with `StarFields` + `CategoryPicker`; reuse the collapsible "more
     details" block already shipped for company/client/project/period/tags/evidence-later.
   - `AchievementCard.tsx` shows the category chip + output-status pill.
6. **Nav + i18n** — `Nav.tsx`: rename `workJournal` key → `career`, `href: "/career"`; add
   `/work-journal` → `/career` redirect. Add a `career` namespace (STAR labels, 10 category names,
   button strings) to all five `messages/*.json`. (Sync all locales — missing keys have caused
   runtime bugs here before.)
7. **Verify** — `npx tsc --noEmit`; JSON-validate all catalogs; manual pass: capture → Help Me Write →
   edit → save → reopen (migration intact) → add to resume (existing flow still works).

**Acceptance:** a user types one sentence, clicks Help Me Write, gets an editable STAR achievement with
a suggested category, saves it, and existing entries still open correctly with their prose mapped into
STAR.

---

## Monetization fit ($10–20/mo)

- **Free:** unlimited manual capture, STAR fields, basic dashboard counts — the habit-forming core.
- **Pro:** AI (Help Me Write, multi-output generation, insights, promotion scoring), evidence uploads,
  promotion-packet PDF export, integrations. The 30/day shared cap *is* the free tier; BYOK or Pro
  removes it.

The value story is concrete: "Never walk into a review or interview cold again — your wins are already
written up as bullets, stories, and a promotion case." That's worth a subscription in a way a notes app
is not.

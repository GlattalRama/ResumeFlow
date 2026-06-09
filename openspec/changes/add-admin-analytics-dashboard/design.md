# Design: Admin Analytics Dashboard

## Context

ResumeFlow has **no shared database**. User resume/application data lives in each
user's **own Google Drive appDataFolder**, with a local-JSON fallback (`/data`)
for dev. The app owner therefore has no vantage point that sees activity across
users.

Analytics needs the opposite of the resume model: a single **app-owned**
aggregate store, with **no per-user content**. So analytics cannot reuse the
per-user Drive layer — it needs its own store and its own narrow data shape.

## Admin role

For MVP, admin access is controlled by an environment variable — no role storage
needed:

```env
ADMIN_EMAILS=rama.prayaga@gmail.com,another-admin@example.com
```

- `lib/admin.ts` exports `isAdminEmail(email)` and `requireAdmin(session)`.
- The set is parsed once (comma-separated, trimmed, lower-cased).
- If `ADMIN_EMAILS` is empty/unset, **no one** is an admin (fail closed for
  authorization; this is independent of tracking, which fails open).
- The dashboard route and all `/api/admin/*` routes call `requireAdmin` and
  return 404 (not 403, to avoid advertising the route) when it fails.

## What we track (and what we never store)

Tracking is **counter-based**, not event-log-based. We never write a row per
action with identifying detail. Each tracked action increments counters in a set
of fixed time buckets.

Event types (a closed enum — adding one is a code change, not user input):

| Event              | Emitted from                                            |
| ------------------ | ------------------------------------------------------- |
| `login`            | NextAuth `signIn` callback                              |
| `resume_created`   | resume version create path                              |
| `application_created` | application create path                              |
| `resume_exported`  | export endpoints (carries `format`: `pdf` \| `docx` \| …) |
| `ai_tailored`      | `app/api/ai/tailor` accept (the `origin:"tailored"` save) |

The **only** structured dimension allowed beyond the event type is a small,
closed enum (`format` for exports). The event payload type has **no field** for
resume text, job descriptions, names, emails, or photos — privacy is enforced by
the type, not by convention.

```ts
// lib/analytics/types.ts
export type AnalyticsEvent =
  | { type: "login" }
  | { type: "resume_created" }
  | { type: "application_created" }
  | { type: "resume_exported"; format: ExportFormat }
  | { type: "ai_tailored" };
```

## Time bucketing

Each event increments a counter for every period that contains "now":

- `all` (single all-time bucket)
- `year`  → key `YYYY`
- `month` → key `YYYY-MM`
- `week`  → key `YYYY-Www` (ISO week)
- `day`   → key `YYYY-MM-DD`

Counters are stored as a flat map of `"{event}|{period}|{bucketKey}|{dimension}"
→ count`. This makes "logins this month" a single key read and avoids scanning
event rows. Bucket keys are computed in UTC so totals are stable regardless of
server region.

### Unique / active users

A raw "logins" count double-counts frequent users. To report **active users**
without storing a user list, keep a privacy-preserving distinct estimate per
period: a small HyperLLog-style sketch, or — simpler for MVP — a per-period set
of **salted, truncated** user-id hashes (`sha256(userId + DAILY_SALT)` truncated
to N bytes) that is reset per bucket. The dashboard reports an approximate active
-user count. We never store the reversible user id. (MVP may ship logins-only and
add active-users in a follow-up; the spec marks active-users as a SHOULD.)

## Storage abstraction

```ts
// lib/analytics/store.ts
export interface AnalyticsStore {
  increment(keys: string[]): Promise<void>;        // bump many bucket keys at once
  read(keys: string[]): Promise<Record<string, number>>;
  // optional: distinct-user sketch ops
}
```

Two implementations, selected like the existing Drive-vs-local pattern:

1. **Local JSON file** (`/data/analytics.json`) — dev / single-instance
   fallback. Mirrors the existing `/data` fallback. **Not durable on Vercel**
   (the serverless filesystem is ephemeral and not shared between instances) —
   fine for local dev only.
2. **Durable JSON via Vercel Blob** (production) — the same counter map stored
   as a single JSON document (`analytics.json`) in Vercel Blob (`@vercel/blob`,
   private), read-modify-written on each event. Selected when `BLOB_READ_WRITE_TOKEN`
   is present. Keeps the project's "JSON files, no database" model — Blob is just
   a durable, instance-shared home for that JSON.

Both stores hold the **same shape**: one flat `Record<string, number>` of
`"{event}|{period}|{bucket}|{dimension}" → count`. Only the read/write transport
differs, so the `AnalyticsStore` interface is identical for both.

### Concurrency note (read-modify-write)

A single JSON document has no atomic `INCRBY`, so two near-simultaneous events
that both read → increment → write can lose one update. For a low-traffic resume
app (small user base, per-user daily AI caps) this is acceptable for MVP. If
volume grows, mitigate without changing the model:

- **Conditional write / ETag** — re-read and retry on Blob version conflict
  (optimistic concurrency), or
- **Sharded deltas** — each instance appends to its own `analytics.{shard}.json`
  and the dashboard sums shards at read time (write-contention-free).

These are isolated behind `AnalyticsStore`; the event emitters and dashboard are
unaffected. MVP ships the simple single-document store and `log()`s nothing
about shards.

> Note: Vercel Postgres/KV as first-party products are retired. We deliberately
> avoid a Marketplace KV/Redis here and use **Vercel Blob** so storage stays
> plain JSON. Blob is the only new dependency and is **optional** — absent its
> token, analytics runs on the local JSON store (dev) or no-ops.

### Fail-open tracking

```ts
// lib/analytics/track.ts
export async function track(event: AnalyticsEvent): Promise<void> {
  try {
    if (!analyticsEnabled()) return;        // no store configured → no-op
    await getStore().increment(bucketKeys(event, now()));
  } catch (err) {
    console.warn("[analytics] track failed (ignored):", err);
  }
}
```

`track()` never throws and is `await`ed only where convenient; a failure or a
missing store must never break a login, save, or export.

## API & dashboard

- `GET /api/admin/analytics?period=day|week|month|year|all&range=N`
  → admin-gated; returns the counter series for each event over the last `N`
  buckets of the requested period, plus all-time totals. Read-only.
- `app/admin/analytics/page.tsx` — admin-gated server component: period toggle
  (Day / Week / Month / Year / All-time), summary cards (totals), and simple
  per-period bars/series for each event, with exports split by format. No new
  charting dependency required for MVP (CSS bars); a chart lib can come later.

## Privacy summary

- Stored: integer counters keyed by `event | period | bucket | enum-dimension`,
  plus an optional per-period distinct-user **estimate** (salted, truncated,
  non-reversible). Nothing else.
- Never stored: resume content, job descriptions, photos, names, emails, raw
  user ids, IP addresses, user agents.
- The payload **type** has no field for any of the above, so the privacy
  guarantee is checkable at compile time.

## Risks / trade-offs

- **Local store isn't durable on Vercel** — acceptable because production uses
  the durable Blob JSON store; documented so no one expects
  `/data/analytics.json` to persist in prod.
- **Read-modify-write can lose increments under concurrency** — acceptable for a
  low-traffic app at MVP; mitigations (conditional write / sharded deltas) are
  available behind the same interface (see Concurrency note).
- **Approximate active users** — acceptable for product analytics; exact unique
  counts would require storing a user set, which we explicitly avoid.
- **One new optional dependency** (Vercel Blob, `@vercel/blob`) — isolated
  behind `AnalyticsStore`; nothing else in the app learns about it.

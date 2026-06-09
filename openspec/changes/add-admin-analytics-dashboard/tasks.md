# Tasks: Admin Analytics Dashboard

## 1. Admin role

- [x] Add `lib/admin.ts`: parse `ADMIN_EMAILS` once; `isAdminEmail(email)` and
      `isAdminSession(session)` (fails closed when `ADMIN_EMAILS` is empty; open
      in local-dev mode where auth isn't enforced).
- [x] Document `ADMIN_EMAILS` in `.env.local.example`.

## 2. Analytics core (privacy-friendly counters)

- [x] Add `lib/analytics/types.ts`: closed `AnalyticsEvent` union and
      `ExportFormat`; deliberately **no** content/PII fields.
- [x] Add `lib/analytics/buckets.ts`: `bucketKeysForEvent` / `recentBucketKeys`
      producing all/year/month/week/day keys in UTC (ISO week for `week`).
      Verified the key math incl. ISO-week year boundaries (2021-01-01→2020-W53,
      2023-01-01→2022-W52) and cross-year `recentBucketKeys`.
- [x] Add `lib/analytics/store.ts`: `AnalyticsStore` interface +
      `getStore()`/`storeBackend()` selector (local JSON file vs durable
      Blob JSON).
- [x] Add local-JSON-file store (`/data/analytics.json`) for dev; noted it is
      not durable on Vercel.
- [x] Add durable Blob JSON store (`@vercel/blob`, private `analytics` doc,
      read-modify-write), selected when `BLOB_READ_WRITE_TOKEN` is present.
- [ ] (Follow-up, only if volume warrants) Guard concurrent writes via
      conditional/ETag write retry or sharded delta files.
- [x] Add `lib/analytics/track.ts`: `track(event)` that is fail-open (never
      throws).
- [ ] (SHOULD, follow-up) Add per-period distinct-user estimate (salted,
      truncated, non-reversible) for active-user counts. MVP ships logins-only.

## 3. Event emission (wire `track()` into existing flows)

- [x] `login` — NextAuth `signIn` callback (`lib/auth.ts`).
- [x] `resume_created` — `POST /api/resumes` (non-tailored saves).
- [x] `application_created` — `POST /api/applications`.
- [x] `resume_exported` (with `format`) — client beacon → `POST
      /api/analytics/export` from `ResumePreviewActions` (pdf/docx/pptx).
- [x] `ai_tailored` — `POST /api/resumes` when `origin === "tailored"`.
- [x] Each call site is fail-open: `track()` swallows errors; the export beacon
      is fire-and-forget with `keepalive`.

## 4. Admin API

- [x] `GET /api/admin/analytics?period=&range=` — `isAdminSession`-gated;
      returns per-event series + all-time totals; read-only; 404 when not admin.

## 5. Admin dashboard UI

- [x] `app/admin/analytics/page.tsx` — admin-gated server component (`notFound()`
      for non-admins).
- [x] Period toggle (Day / Week / Month / Year / All-time) via links.
- [x] Summary cards (all-time totals) + per-period CSS bars for each event;
      exports split by format. No new chart dependency.
- [x] Admin nav link surfaced via a non-sensitive `session.isAdmin` flag
      (`components/Nav.tsx`); authorization still re-checked server-side.

## 6. Docs & verification

- [x] Update `openspec/project.md` (admin analytics + app-owned analytics store,
      separate from per-user Drive).
- [x] `openspec validate add-admin-analytics-dashboard --strict` → valid.
- [x] `npm run typecheck` → clean; `npm run build` → clean (all 3 new routes
      registered, no warnings).
- [x] Verify (no creds): bucket math + local-store increment/read round-trip
      (all-time/day/month/year + per-format exports), and that every stored key
      is a 4-part structural key (no resume/JD/photo content).
- [ ] PENDING (needs `BLOB_READ_WRITE_TOKEN`, in prod): counters persist and
      aggregate across serverless instances via the Blob store.
- [ ] PENDING (in-app): admin sees dashboard; non-admin gets 404; live login /
      create / export / tailor increments visible on the dashboard.

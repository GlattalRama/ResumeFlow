---
name: verify
description: How to run and drive this Next.js app locally for end-to-end verification — auth bypass, local data seeding, and Playwright driving.
---

# Verifying Resumeflow-ATS changes locally

## Launch (auth-free local mode)

Start dev with **placeholder Google creds** — middleware and `lib/store.ts`
treat creds starting with `replace_with` as "not configured", so every page is
open (no sign-in) and storage falls back to local `data/*.json` files instead
of Google Drive:

```bash
GOOGLE_CLIENT_ID=replace_with_dev GOOGLE_CLIENT_SECRET=replace_with_dev npm run dev
# → http://localhost:3001  (port 3001, not 3000)
```

Shell env vars override `.env.local`, so this works without editing that file.

## Local data

- Collections live at `data/<collectionName>.json` (see `lib/jsonStore.ts`);
  the name matches the `CollectionName` key, e.g. `data/interviewCoach.json`,
  `data/interviewPracticeSessions.json`.
- `data/` is **gitignored** — safe to seed/delete test JSON freely.
- Seed entries must match the interfaces in `lib/types.ts`; delete seeded
  files after verifying to leave the checkout clean.

## Drive the UI

No Playwright in the repo. Install it in the session scratchpad (not the repo):

```bash
cd $SCRATCHPAD && npm init -y && npm i playwright && npx playwright install chromium
```

Gotchas learned driving it:
- The Next.js dev-tools floating button is also named "Next" — always use
  `exact: true` on `getByRole("button", ...)` locators.
- Button labels come from `messages/en.json` — check the catalog for exact
  text before writing locators (e.g. the prev button is "Previous", finish is
  "Finish session").
- API routes are open in local mode — `curl http://localhost:3001/api/...`
  works without cookies, useful for seeding sessions and probing validation.

## i18n check (past runtime bug)

Every `t("key")` used in code must exist in **all 5** catalogs
(`messages/{en,de,es,fr,it}.json`) — a missing key crashes at runtime.
Quick check: extract `t("...")` keys from the component with a regex and
diff against each catalog's namespace.

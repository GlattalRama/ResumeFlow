/**
 * Record a ~30 s portrait video of the mobile app (the native shell layout)
 * for App Store previews, the Google Play promo video and YouTube Shorts.
 *
 *   GOOGLE_CLIENT_ID=replace_with_dev GOOGLE_CLIENT_SECRET=replace_with_dev npm run dev
 *   caffeinate -i node scripts/tour/record-app-preview.mjs [en|de] [outDir]
 *
 * Same data handling as record-tour.mjs (swaps in scripts/tour/demo-data and
 * restores data/ afterwards). Captions are burned in, in the chosen language,
 * because store previews can't carry subtitle files.
 *
 * Output (outDir, default public/tour): app-preview-<lang>.mp4 — 886x1920,
 * 30 fps, silent stereo track (App Store 6.9"/6.5" iPhone size) — and
 * app-short-<lang>.mp4 — 1080x1920 for YouTube Shorts / Play.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

const LANG = process.argv[2] ?? "en";
const OUT = resolve(process.argv[3] ?? join("public", "tour"));
const BASE = process.env.TOUR_BASE_URL ?? "http://localhost:3001";
const ROOT = process.cwd();
const DATA = join(ROOT, "data");
const DATA_BACKUP = join(ROOT, "data.tour-backup");
const FIXTURE = join(ROOT, "scripts", "tour", "demo-data");
const TMP = join(ROOT, ".tour-tmp");
// 390x844 CSS px at 3x renders crisp frames for an 886x1920 video.
const VW = 390;
const VH = 844;
const OW = 886;
const OH = 1920;

const CAPTIONS = {
  en: {
    home: "Your whole job search,\nin your pocket",
    resumes: "Every resume version,\nwith its ATS score",
    jobs: "Track every application\nby stage",
    tailor: "Tailor your resume to\nany job with AI",
    review: "Review every change\nbefore you keep it",
    coach: "Practice interview answers\nfrom your real experience",
    end: "Free · Private in your\nown Google Drive",
  },
  de: {
    home: "Deine ganze Jobsuche\nin der Hosentasche",
    resumes: "Jede Lebenslauf-Version\nmit ATS-Score",
    jobs: "Jede Bewerbung\nnach Phase im Blick",
    tailor: "Lebenslauf mit KI an\njede Stelle anpassen",
    review: "Jede Änderung prüfen,\nbevor du sie übernimmst",
    coach: "Interview-Antworten aus\ndeiner echten Erfahrung",
    end: "Kostenlos · Privat in deinem\neigenen Google Drive",
  },
};
const C = CAPTIONS[LANG] ?? CAPTIONS.en;

const cuts = [];
let t0 = 0;
const now = () => (performance.now() - t0) / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function caption(page, key) {
  console.log(`[${now().toFixed(1)}s] ${key}`);
  await page.evaluate((text) => window.__tourCaption?.(text), C[key]).catch(() => undefined);
}

async function tap(page, locator, holdMs = 700) {
  // Centre it so the fixed top bar / tab bar can't sit on top of it.
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => undefined);
  await sleep(250);
  const box = await locator.boundingBox();
  if (!box) throw new Error("not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await locator.click();
  await sleep(holdMs);
}

async function swipe(page, dy) {
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, dy / 10);
    await sleep(35);
  }
  await sleep(400);
}

async function waitCut(promise) {
  await sleep(900);
  const from = now();
  await promise;
  const to = now() - 0.3;
  if (to - from > 0.5) cuts.push([from, to]);
  await sleep(400);
}

async function step(name, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`  ! step "${name}" failed: ${String(err).split("\n")[0]}`);
  }
}

const tab = (page, name) => page.getByRole("navigation").last().getByRole("link", { name }).first();

async function film(page) {
  const L = (en, de) => (LANG === "de" ? de : en);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(300);
  await caption(page, "home");
  await sleep(2200);
  await swipe(page, 380);
  await sleep(600);

  await step("resumes", async () => {
    await tap(page, tab(page, L("Resumes", "Lebensläufe")), 900);
    await caption(page, "resumes");
    await tap(page, page.locator('a[href="/resumes/res-base"]').first(), 1600);
    await swipe(page, 300);
    await sleep(500);
  });

  await step("jobs", async () => {
    await tap(page, tab(page, L("Jobs", "Jobs")), 1000);
    await caption(page, "jobs");
    await sleep(1800);
  });

  await step("tailor", async () => {
    await page.goto(BASE + "/applications/app-swissre", { waitUntil: "networkidle" });
    await sleep(500);
    const open = page.getByRole("button", { name: L("Tailor Resume for this Job", "Lebenslauf für diesen Job anpassen") }).first();
    await tap(page, open, 900);
    await caption(page, "tailor");
    await tap(page, page.getByRole("button", { name: L("Generate", "Generieren"), exact: true }).first(), 200);
    const changes = page.getByText(/^(Changes|Änderungen) \(\d+\)$/).first();
    await waitCut(changes.waitFor({ state: "visible", timeout: 240000 }));
    await caption(page, "review");
    await sleep(1200);
    await swipe(page, 350);
    await sleep(1400);
    await page.keyboard.press("Escape");
  });

  await step("coach", async () => {
    await page.goto(BASE + "/interview-coach", { waitUntil: "networkidle" });
    await sleep(300);
    await caption(page, "coach");
    await tap(page, page.getByText(L("How would you drive adoption", "How would you drive adoption"), { exact: false }).first(), 900);
    await swipe(page, 320);
    await sleep(900);
  });

  await step("end", async () => {
    await tap(page, tab(page, L("Home", "Start")), 700);
    await caption(page, "end");
    await sleep(2600);
  });
}

// Tap ripple + caption banner, re-installed on every navigation.
const OVERLAY_SCRIPT = `
(() => {
  const css = "nextjs-portal{display:none!important}" +
    "#__tap{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(0,51,160,.35);border:2px solid rgba(0,51,160,.9);z-index:2147483647;pointer-events:none;opacity:0;transform:scale(.5);transition:opacity .35s,transform .35s}" +
    "#__tap.on{opacity:1;transform:scale(1)}" +
    "#__cap{position:fixed;left:14px;right:14px;top:calc(env(safe-area-inset-top) + 64px);z-index:2147483646;pointer-events:none;background:#0033a0;color:#fff;border-radius:18px;padding:14px 18px;font:800 22px/1.2 Inter,system-ui,sans-serif;letter-spacing:-.3px;white-space:pre-line;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:opacity .3s}";
  const install = () => {
    if (!document.head || document.getElementById("__tour_css")) return;
    const s = document.createElement("style"); s.id = "__tour_css"; s.textContent = css; document.head.appendChild(s);
    const tap = document.createElement("div"); tap.id = "__tap"; document.body.appendChild(tap);
    const text = sessionStorage.getItem("__cap");
    if (text) window.__tourCaption(text);
  };
  window.__tourCaption = (text) => {
    try { sessionStorage.setItem("__cap", text); } catch {}
    let c = document.getElementById("__cap");
    if (!c) { c = document.createElement("div"); c.id = "__cap"; document.body.appendChild(c); }
    c.textContent = text;
  };
  document.addEventListener("mousedown", (e) => {
    const t = document.getElementById("__tap"); if (!t) return;
    t.style.left = e.clientX + "px"; t.style.top = e.clientY + "px";
    t.classList.add("on"); setTimeout(() => t.classList.remove("on"), 450);
  }, true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
})();
`;

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = join(homedir(), "Library", "Caches", "ms-playwright");
  if (!existsSync(cache)) return undefined;
  for (const dir of readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    const p = join(cache, dir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
    if (existsSync(p)) return p;
  }
  return undefined;
}

function restoreData() {
  rmSync(DATA, { recursive: true, force: true });
  if (existsSync(DATA_BACKUP)) renameSync(DATA_BACKUP, DATA);
}

async function main() {
  const res = await fetch(BASE + "/api/resumes").catch(() => null);
  if (!res || res.status !== 200) throw new Error(`${BASE}/api/resumes did not return 200 — start the dev server in local mode.`);
  if (existsSync(DATA_BACKUP)) throw new Error(`${DATA_BACKUP} exists — a previous run did not finish. Move it back to data/ first.`);
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  if (existsSync(DATA)) renameSync(DATA, DATA_BACKUP);
  cpSync(FIXTURE, DATA, { recursive: true });
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (restoreData(), process.exit(130)));

  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  try {
    const ctxOpts = {
      viewport: { width: VW, height: VH },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      colorScheme: "light",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ResumeflowApp",
    };
    const cookies = [
      { name: "NEXT_LOCALE", value: LANG, url: BASE },
      { name: "rf_native", value: "ios", url: BASE },
    ];
    const warm = await browser.newContext(ctxOpts);
    await warm.addCookies(cookies);
    const wp = await warm.newPage();
    for (const p of ["/", "/resumes", "/resumes/res-base", "/applications", "/applications/app-swissre", "/interview-coach"]) {
      await wp.goto(BASE + p, { waitUntil: "networkidle", timeout: 120000 }).catch(() => undefined);
    }
    await warm.close();

    const context = await browser.newContext({ ...ctxOpts, recordVideo: { dir: TMP, size: { width: OW, height: OH } } });
    await context.addCookies(cookies);
    await context.addInitScript(OVERLAY_SCRIPT);
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on("dialog", (d) => d.accept().catch(() => undefined));
    t0 = performance.now();
    await film(page);
    await context.close();
  } finally {
    await browser.close();
    restoreData();
  }

  const webm = readdirSync(TMP).find((f) => f.endsWith(".webm"));
  if (!webm) throw new Error("No video recorded");
  const src = join(TMP, webm);
  // Drop the first 0.4 s (blank page before the first paint) and the AI waits.
  const drop = [[0, 0.4], ...cuts];
  const select = `select='not(${drop.map(([a, b]) => `between(t\\,${a.toFixed(2)}\\,${b.toFixed(2)})`).join("+")})',setpts=N/FRAME_RATE/TB`;
  const preview = join(OUT, `app-preview-${LANG}.mp4`);
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", src, "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-vf", `fps=30,${select},scale=${OW}:${OH}`, "-map", "0:v", "-map", "1:a", "-shortest",
    "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", preview,
  ], { stdio: "inherit" });
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", preview, "-vf", "scale=-2:1920,pad=1080:1920:(ow-iw)/2:0:color=0xf8fafc",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart",
    join(OUT, `app-short-${LANG}.mp4`),
  ], { stdio: "inherit" });
  rmSync(TMP, { recursive: true, force: true });
  const d = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", preview]).toString().trim();
  console.log(`app preview: ${Number(d).toFixed(1)} s (cut ${cuts.length} AI waits) → ${preview}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

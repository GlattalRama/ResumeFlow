// Structured job-board adapters.
//
// Big ATS platforms (Workday, Greenhouse, Lever) render their job pages
// client-side, so a plain server fetch of the posting URL returns an empty
// JavaScript shell with no readable job text. Each of them, however, exposes a
// public JSON API that returns the posting directly. These adapters map a
// posting URL to that API and parse the result into the fields our "New
// application" form needs — no AI extraction required (faster, more accurate,
// and it never spends a daily-cap unit). The route falls back to the generic
// HTML + model path when no adapter matches or the API call fails.

export interface StructuredJob {
  company: string;
  jobTitle: string;
  jobId: string;
  jobDescription: string; // plain text
  source: string; // adapter name, for telemetry/UX
}

// Strip a raw HTML fragment down to readable text: drop script/style, convert
// block tags to newlines, remove remaining tags, decode common entities, and
// collapse whitespace. Shared with the autofill route's generic path.
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|br|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Decode HTML entities once. Greenhouse entity-encodes its already-HTML
// `content` field (e.g. "&lt;h2&gt;"), so we decode before htmlToText strips
// the resulting real tags. `&amp;` is decoded last so double-encoded sequences
// resolve in the right order.
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&amp;/gi, "&");
}

function safeCodePoint(n: number): string {
  try {
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  } catch {
    return "";
  }
}

// Accept a requisition/job ID only if it looks like one. Some boards return
// placeholder text (Greenhouse: "See Opening ID") which we'd rather drop than
// paste into the form's Job ID field.
function cleanJobId(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  if (/^n\/?a$/i.test(s)) return "";
  if (/\s/.test(s) && !/\d/.test(s)) return ""; // multi-word with no digits → prose, not an ID
  return s;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

interface Adapter {
  name: string;
  matches(url: URL): boolean;
  apiUrl(url: URL): string | null;
  parse(json: unknown, url: URL): StructuredJob | null;
}

// ---- Workday (*.myworkdayjobs.com) -----------------------------------------
// Page:  https://{tenant}.wd{N}.myworkdayjobs.com/{locale?}/{site}/job/{slug…}
// API:   https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/job/{slug…}
const workday: Adapter = {
  name: "workday",
  matches: (url) => url.hostname.endsWith(".myworkdayjobs.com"),
  apiUrl: (url) => {
    const segments = url.pathname.split("/").filter(Boolean);
    const jobIdx = segments.indexOf("job");
    if (jobIdx <= 0) return null; // need a {site} segment before "job"
    const site = segments[jobIdx - 1];
    const tenant = url.hostname.split(".")[0];
    const rest = segments.slice(jobIdx).join("/"); // "job/…"
    if (!tenant || !site || !rest) return null;
    return `${url.origin}/wday/cxs/${tenant}/${site}/${rest}`;
  },
  parse: (json) => {
    const info = (json as { jobPostingInfo?: Record<string, unknown> })
      ?.jobPostingInfo;
    if (!info) return null;
    const org = (json as { hiringOrganization?: { name?: string } })
      ?.hiringOrganization;
    const description = htmlToText(str(info.jobDescription));
    if (!description) return null;
    return {
      company: str(org?.name),
      jobTitle: str(info.title),
      jobId: cleanJobId(info.jobReqId),
      jobDescription: description,
      source: "workday",
    };
  },
};

// ---- Greenhouse (boards[-api].greenhouse.io, job-boards.greenhouse.io) ------
// Page:  https://boards.greenhouse.io/{token}/jobs/{id}
// API:   https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{id}
const greenhouse: Adapter = {
  name: "greenhouse",
  matches: (url) => url.hostname.endsWith(".greenhouse.io"),
  apiUrl: (url) => {
    const segments = url.pathname.split("/").filter(Boolean);
    // Standard path form: /{token}/jobs/{id}
    let token = "";
    let id = "";
    const jobsIdx = segments.indexOf("jobs");
    if (jobsIdx > 0 && segments[jobsIdx + 1]) {
      token = segments[jobsIdx - 1];
      id = segments[jobsIdx + 1];
    } else {
      // Embed form: /embed/job_app?for={token}&token={id} or ?gh_jid=
      token = url.searchParams.get("for") || segments[0] || "";
      id = url.searchParams.get("gh_jid") || url.searchParams.get("token") || "";
    }
    if (!token || !id || !/^\d+$/.test(id)) return null;
    return `https://boards-api.greenhouse.io/v1/boards/${token}/jobs/${id}`;
  },
  parse: (json) => {
    const j = json as {
      title?: string;
      content?: string;
      company_name?: string;
      requisition_id?: string;
      location?: { name?: string };
    };
    const description = htmlToText(decodeEntities(str(j.content)));
    if (!description) return null;
    return {
      company: str(j.company_name),
      jobTitle: str(j.title),
      jobId: cleanJobId(j.requisition_id),
      jobDescription: description,
      source: "greenhouse",
    };
  },
};

// ---- Lever (jobs.lever.co) --------------------------------------------------
// Page:  https://jobs.lever.co/{company}/{postingId}
// API:   https://api.lever.co/v0/postings/{company}/{postingId}
const lever: Adapter = {
  name: "lever",
  matches: (url) => url.hostname.endsWith(".lever.co"),
  apiUrl: (url) => {
    const segments = url.pathname.split("/").filter(Boolean);
    const company = segments[0];
    const postingId = segments[1];
    if (!company || !postingId) return null;
    return `https://api.lever.co/v0/postings/${company}/${postingId}`;
  },
  parse: (json) => {
    const j = json as {
      text?: string;
      description?: string;
      descriptionPlain?: string;
      additional?: string;
      lists?: { text?: string; content?: string }[];
    };
    // Lever splits the posting into an opening (description), labelled lists
    // (requirements etc.), and a closing (additional). Reassemble as HTML.
    const parts: string[] = [];
    if (j.description) parts.push(j.description);
    for (const l of j.lists ?? []) {
      parts.push(`<h3>${l.text ?? ""}</h3>${l.content ?? ""}`);
    }
    if (j.additional) parts.push(j.additional);
    const description =
      htmlToText(parts.join("\n")) || str(j.descriptionPlain);
    if (!description) return null;
    return {
      company: "", // Lever's API carries no clean company name; user fills it
      jobTitle: str(j.text),
      jobId: "", // Lever posting IDs are opaque UUIDs, not requisition numbers
      jobDescription: description,
      source: "lever",
    };
  },
};

const ADAPTERS: Adapter[] = [workday, greenhouse, lever];

// Return the API URL + adapter for a posting URL, or null if none matches.
export function matchJobBoard(url: URL): Adapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}

// Try to fetch a posting as structured data from its job board's public JSON
// API. Returns null when no adapter matches, the API is unreachable/!ok, or the
// payload yields no usable description — the caller then falls back to the
// generic HTML + model path.
export async function fetchStructuredJob(
  url: URL
): Promise<StructuredJob | null> {
  const adapter = matchJobBoard(url);
  if (!adapter) return null;
  const apiUrl = adapter.apiUrl(url);
  if (!apiUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(apiUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; ResumeFlowBot/1.0; +https://resumeflow-ats.com)",
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return adapter.parse(json, url);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

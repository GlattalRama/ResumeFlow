import { NextResponse } from "next/server";
import { generateObject, jsonSchema } from "ai";
import { resolveAiAccess, openrouterModel } from "@/lib/aiServer";
import { isCreditsError, notifyOwnerCreditsExhausted } from "@/lib/aiNotify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Fetch a job posting URL, extract its visible text, then have the model pull
// out the structured fields our "New application" form needs. PERSISTS NOTHING —
// the client drops the result into the form for the user to review before they
// save. One run = one daily-cap unit (resolveAiAccess increments once).

const MAX_HTML_BYTES = 2_000_000; // don't try to parse enormous pages
const MAX_TEXT_CHARS = 12_000; // cap what we send to the model

// Strip a raw HTML document down to readable text: drop script/style/noscript,
// convert tags to spaces, collapse whitespace, decode the few entities that
// matter for job descriptions.
function htmlToText(html: string): string {
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

const extractSchema = jsonSchema<{
  company: string;
  jobTitle: string;
  jobId: string;
  jobDescription: string;
}>({
  type: "object",
  properties: {
    company: {
      type: "string",
      description: "Hiring company name, or empty string if not stated.",
    },
    jobTitle: {
      type: "string",
      description: "The job / role title, or empty string if not stated.",
    },
    jobId: {
      type: "string",
      description:
        "Requisition / job ID or reference number if present, else empty string.",
    },
    jobDescription: {
      type: "string",
      description:
        "The full job description as plain text: responsibilities, requirements, and qualifications. Preserve the wording; omit site navigation, cookie banners, and unrelated boilerplate.",
    },
  },
  required: ["company", "jobTitle", "jobId", "jobDescription"],
  additionalProperties: false,
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rawUrl = typeof body.jobLink === "string" ? body.jobLink.trim() : "";

  if (!rawUrl) {
    return NextResponse.json(
      { error: "A job link is required." },
      { status: 400 }
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    return NextResponse.json(
      { error: "That doesn't look like a valid http(s) link." },
      { status: 400 }
    );
  }

  // Fetch the page BEFORE resolving access, so an unreachable link never burns a
  // daily-cap unit.
  let text = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Some sites return an empty shell to non-browser agents.
        "User-Agent":
          "Mozilla/5.0 (compatible; ResumeFlowBot/1.0; +https://resumeflow-ats.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Couldn't open that link (HTTP ${res.status}). Paste the description manually instead.`,
        },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return NextResponse.json(
        {
          error:
            "That link isn't a web page we can read. Paste the description manually instead.",
        },
        { status: 415 }
      );
    }

    const buf = await res.arrayBuffer();
    const html = new TextDecoder().decode(buf.slice(0, MAX_HTML_BYTES));
    text = htmlToText(html).slice(0, MAX_TEXT_CHARS);
  } catch {
    return NextResponse.json(
      {
        error:
          "Couldn't reach that link. Some job sites block automated access — paste the description manually instead.",
      },
      { status: 502 }
    );
  }

  // Many job boards (LinkedIn, Indeed) render the posting client-side, so a
  // server fetch gets almost no text. Bail early rather than burn an AI unit.
  if (text.length < 200) {
    return NextResponse.json(
      {
        error:
          "This page didn't return readable job text — it may require a login or load its content in the browser. Paste the description manually instead.",
      },
      { status: 422 }
    );
  }

  const access = await resolveAiAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status }
    );
  }

  try {
    const { object } = await generateObject({
      model: openrouterModel(access.apiKey, access.model),
      schema: extractSchema,
      system:
        "You extract structured job-posting data from the raw text of a careers page. Return ONLY facts present in the text; use an empty string for anything not stated. Do NOT invent a company, title, or requisition ID. For jobDescription, return the substantive posting (responsibilities, requirements, qualifications) as plain text and drop navigation, cookie notices, and unrelated site chrome.",
      prompt: `Source URL: ${url.toString()}\n\nPage text:\n${text}`,
      maxOutputTokens: 2000,
    });

    return NextResponse.json({
      company: object.company?.trim() || "",
      jobTitle: object.jobTitle?.trim() || "",
      jobId: object.jobId?.trim() || "",
      jobDescription: object.jobDescription?.trim() || "",
    });
  } catch (err) {
    if (!access.usingUserKey && isCreditsError(err)) {
      void notifyOwnerCreditsExhausted(
        err instanceof Error ? err.message : String(err)
      );
    }
    console.error("applications/autofill error:", err);
    return NextResponse.json(
      { error: "Couldn't read that posting. Paste the description manually instead." },
      { status: 502 }
    );
  }
}

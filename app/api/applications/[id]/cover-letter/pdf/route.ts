import { NextResponse } from "next/server";
import { getItem } from "@/lib/store";
import { launchPdfBrowser } from "@/lib/pdfBrowser";

// Server-side PDF export for an application's cover letter, mirroring
// /api/resumes/[id]/pdf: headless Chromium renders the letter (needed because
// the Capacitor shells can't print) and the response is a direct file
// download. The letter text comes from the request body so unsaved edits in
// the editor export as-is; it falls back to the saved letter.
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function letterHtml(letter: string): string {
  const paragraphs = letter
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.55;
    color: #1a1a1a;
    margin: 0;
  }
  p { margin: 0 0 12pt; }
</style>
</head>
<body>${paragraphs}</body>
</html>`;
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const app = await getItem("applications", id);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const letter =
    (typeof body.letter === "string" && body.letter.trim()) ||
    (app.coverLetter || "").trim();
  if (!letter) {
    return NextResponse.json({ error: "No cover letter" }, { status: 400 });
  }

  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(letterHtml(letter), { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "25mm", right: "25mm", bottom: "25mm", left: "25mm" },
    });

    const base =
      (app.company || "application")
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "") || "application";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Cover_Letter_${base}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}

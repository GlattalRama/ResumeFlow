import { NextResponse } from "next/server";
import { getItem } from "@/lib/store";
import { resolveTemplateStyle } from "@/lib/constants";

// Server-side PDF export, used by BOTH the web "Download PDF" button (direct
// file download) and the Capacitor shells (which can't print — window.print()
// is a silent no-op in Android WebView and WKWebView). Headless Chromium loads
// the same /resumes/[id] preview page — with the caller's cookies forwarded,
// so auth and the Drive-backed store behave exactly as they do for the user —
// emulates print media (which hides the .no-print chrome) and returns the
// rendered PDF.
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

async function launchBrowser() {
  const { chromium } = await import("playwright-core");
  if (process.env.VERCEL) {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: sparticuz.args,
      executablePath: await sparticuz.executablePath(),
    });
  }
  // Local dev: @sparticuz/chromium only ships a Linux binary. Use an explicit
  // executable when provided, otherwise the machine's installed Chrome.
  const executablePath = process.env.PDF_CHROMIUM_PATH;
  return chromium.launch(
    executablePath ? { executablePath } : { channel: "chrome" }
  );
}

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const resume = await getItem("resumes", id);
  if (!resume)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const target = new URL(`/resumes/${id}`, url.origin);
  if (url.searchParams.get("atsSafe") === "1")
    target.searchParams.set("atsSafe", "1");

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext();
    // Forward the caller's cookies so the page render (and its subrequests,
    // e.g. /api/drive/photos/*) run as the signed-in user.
    const cookie = req.headers.get("cookie");
    if (cookie) await context.setExtraHTTPHeaders({ cookie });
    const page = await context.newPage();
    await page.goto(target.toString(), {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    await page.emulateMedia({ media: "print" });
    // Use the resume's saved page margins so the PDF matches the on-screen
    // preview exactly. The preview also injects a matching @page rule (which
    // Chromium lets win over these values), so either path yields the same
    // geometry.
    const m = resolveTemplateStyle(resume.templateStyle).pageMargins;
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: `${m.top}mm`,
        right: `${m.right}mm`,
        bottom: `${m.bottom}mm`,
        left: `${m.left}mm`,
      },
    });

    const name = resume.resumeData?.basics?.name?.trim() || "resume";
    const base =
      name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "resume";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${base}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}

// Shared headless-Chromium launcher for server-side PDF exports (resume and
// cover letter routes). On Vercel the @sparticuz/chromium Lambda binary is
// used; locally an explicit executable (PDF_CHROMIUM_PATH) or the machine's
// installed Chrome.
export async function launchPdfBrowser() {
  const { chromium } = await import("playwright-core");
  if (process.env.VERCEL) {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: sparticuz.args,
      executablePath: await sparticuz.executablePath(),
    });
  }
  const executablePath = process.env.PDF_CHROMIUM_PATH;
  return chromium.launch(
    executablePath ? { executablePath } : { channel: "chrome" }
  );
}

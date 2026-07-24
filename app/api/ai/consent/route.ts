import { NextRequest, NextResponse } from "next/server";
import { loadSettings, setAiConsent } from "@/lib/aiSettings";

// AI data-sharing consent status (App Store guideline 5.1.2(i)). Stored on the
// user's settings singleton in their own storage, so it follows the account
// across devices. Auth is enforced by middleware like every other /api route.
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await loadSettings();
  return NextResponse.json({ consented: !!settings?.aiConsentAt });
}

export async function POST(req: NextRequest) {
  let consented = true;
  try {
    const body = await req.json();
    if (typeof body?.consented === "boolean") consented = body.consented;
  } catch {
    // No/invalid body — default to granting consent (the dialog's Allow).
  }
  await setAiConsent(consented);
  return NextResponse.json({ ok: true, consented });
}

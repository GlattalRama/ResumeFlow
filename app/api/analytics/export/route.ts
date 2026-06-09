import { NextResponse } from "next/server";
import { track } from "@/lib/analytics/track";
import { isExportFormat } from "@/lib/analytics/types";

// Resume exports run entirely in the browser (DOCX/PPTX libs + the PDF print
// dialog), so the client pings this endpoint to record the aggregate count.
// Only a closed-enum `format` is accepted — no resume content crosses the wire.
// Fail-open: tracking errors never surface to the user.
export async function POST(req: Request) {
  let format: unknown;
  try {
    ({ format } = await req.json());
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (isExportFormat(format)) {
    await track({ type: "resume_exported", format });
  }
  return new NextResponse(null, { status: 204 });
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/serverSession";
import { isAdminSession } from "@/lib/admin";
import { getReport } from "@/lib/analytics/report";
import { isPeriod, type Period } from "@/lib/analytics/types";

// Default number of buckets per period when ?range is omitted.
const DEFAULT_RANGE: Record<Period, number> = {
  day: 14,
  week: 12,
  month: 12,
  year: 5,
  all: 1,
};

export async function GET(req: Request) {
  const session = await getSession();
  if (!isAdminSession(session)) {
    // 404 rather than 403: don't advertise the admin surface.
    return new NextResponse(null, { status: 404 });
  }

  const url = new URL(req.url);
  const periodParam = url.searchParams.get("period") ?? "month";
  const period: Period = isPeriod(periodParam) ? periodParam : "month";

  const rangeParam = Number(url.searchParams.get("range"));
  const range =
    Number.isFinite(rangeParam) && rangeParam > 0
      ? Math.min(Math.floor(rangeParam), 366)
      : DEFAULT_RANGE[period];

  const report = await getReport(period, range);
  return NextResponse.json(report);
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/serverSession";
import { isAdminSession } from "@/lib/admin";
import { TEMPLATES, isTemplateId, isTemplateVisible } from "@/lib/constants";
import { loadTemplateVisibility, setTemplateVisibility } from "@/lib/aiSettings";

export const dynamic = "force-dynamic";

// GET: list every template with its effective visibility (admin override applied
// over the hardcoded `hidden` default). Admin-only.
export async function GET() {
  const session = await getSession();
  if (!isAdminSession(session)) {
    // 404 rather than 403: don't advertise the admin surface.
    return new NextResponse(null, { status: 404 });
  }
  const overrides = await loadTemplateVisibility();
  const templates = TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    defaultHidden: Boolean(t.hidden),
    visible: isTemplateVisible(t, overrides),
  }));
  return NextResponse.json({ templates });
}

// POST: persist the visibility overrides map. Body: { templateVisibility:
// Record<TemplateId, boolean> }. Unknown ids are ignored. Admin-only.
export async function POST(req: Request) {
  const session = await getSession();
  if (!isAdminSession(session)) {
    return new NextResponse(null, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const input = body?.templateVisibility;
  if (!input || typeof input !== "object") {
    return NextResponse.json(
      { error: "templateVisibility object is required" },
      { status: 400 }
    );
  }
  const overrides: Record<string, boolean> = {};
  for (const [id, value] of Object.entries(input)) {
    if (isTemplateId(id) && typeof value === "boolean") overrides[id] = value;
  }
  await setTemplateVisibility(overrides);
  return NextResponse.json({ ok: true, templateVisibility: overrides });
}

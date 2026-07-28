import { NextResponse } from "next/server";
import { createItem, readAll } from "@/lib/store";
import type { ProjectExperience } from "@/lib/types";

export const dynamic = "force-dynamic";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strList = (v: unknown) =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

export async function GET() {
  const projects = await readAll("projectExperience");
  return NextResponse.json(projects);
}

// Save one reviewed project draft (from the AI extraction or typed manually).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = str(body.name);
  const responsibilities = strList(body.responsibilities);
  if (!name && responsibilities.length === 0) {
    return NextResponse.json(
      { error: "A project needs at least a name or responsibilities." },
      { status: 400 }
    );
  }
  const now = new Date().toISOString();
  const project: Omit<ProjectExperience, "id"> = {
    name,
    client: str(body.client),
    domain: str(body.domain),
    description: str(body.description),
    techStack: str(body.techStack),
    role: str(body.role),
    responsibilities,
    achievements: strList(body.achievements),
    period: str(body.period),
    createdAt: now,
    updatedAt: now,
  };
  const created = await createItem("projectExperience", project);
  return NextResponse.json(created, { status: 201 });
}

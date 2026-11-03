import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import TourPlayer, { type TourChapter, type TourCue } from "@/components/tour/TourPlayer";
import { getSession } from "@/lib/serverSession";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tour");
  return { title: `${t("title")} · Resumeflow-ATS`, description: t("intro") };
}

type TourFile = { duration: number; chapters: TourChapter[]; cues: TourCue[] };

// Written by scripts/tour/record-tour.mjs next to the video.
function loadTour(): TourFile {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", "tour", "tour.json"), "utf8")) as TourFile;
  } catch {
    return { duration: 0, chapters: [], cues: [] };
  }
}

export default async function TourPage() {
  const t = await getTranslations("tour");
  const locale = await getLocale();
  const session = await getSession();
  const { duration, chapters, cues } = loadTour();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("intro")}</p>
      </div>
      <TourPlayer
        cues={cues}
        chapters={chapters}
        duration={duration}
        locale={locale}
        exitHref={session ? "/" : "/signin"}
      />
    </div>
  );
}

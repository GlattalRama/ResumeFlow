import { getTranslations } from "next-intl/server";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-6">
        <SettingsForm />
      </div>
    </div>
  );
}

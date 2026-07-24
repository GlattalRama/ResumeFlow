import { getTranslations } from "next-intl/server";
import SettingsForm from "@/components/SettingsForm";
import { isNativeIOSRequest } from "@/lib/nativeApp";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  // The BYOK (own OpenRouter key) option is hidden in the iOS app: App Store
  // guideline 3.1.1 reads externally billed services as out-of-app purchases.
  const hideByok = await isNativeIOSRequest();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-6">
        <SettingsForm hideByok={hideByok} />
      </div>
    </div>
  );
}

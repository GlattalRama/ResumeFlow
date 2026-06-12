import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/serverSession";
import { isAdminSession } from "@/lib/admin";
import { TEMPLATES, isTemplateVisible } from "@/lib/constants";
import { loadTemplateVisibility } from "@/lib/aiSettings";
import TemplateAdminControls, {
  type AdminTemplateRow,
} from "@/components/TemplateAdminControls";

export const dynamic = "force-dynamic";

export default async function TemplatesAdminPage() {
  const session = await getSession();
  if (!isAdminSession(session)) notFound();

  const overrides = await loadTemplateVisibility();
  const rows: AdminTemplateRow[] = TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    defaultHidden: Boolean(t.hidden),
    visible: isTemplateVisible(t, overrides),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable or disable resume templates in the builder&apos;s picker.
          Disabling a template only hides it for new resumes — existing resumes
          that already use it keep rendering and stay editable.
        </p>
        <nav className="mt-3 flex gap-1 text-sm">
          <Link
            href="/admin/analytics"
            className="rounded-md px-3 py-1.5 font-medium text-muted-foreground hover:bg-muted"
          >
            Analytics
          </Link>
          <span className="rounded-md bg-brand-50 dark:bg-brand-500/15 px-3 py-1.5 font-medium text-brand-700 dark:text-brand-300">
            Templates
          </span>
        </nav>
      </div>

      <TemplateAdminControls initial={rows} />
    </div>
  );
}

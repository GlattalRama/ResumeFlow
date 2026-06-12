import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">AI Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect your own AI key to enable “Improve with AI” suggestions across
        your resume sections.
      </p>
      <div className="mt-6">
        <SettingsForm />
      </div>
    </div>
  );
}

import { PageHeader } from "@/components/ui";
import ResumeBuilder from "@/components/ResumeBuilder";

export default function NewResumePage() {
  return (
    <div>
      <PageHeader
        title="New resume"
        subtitle="Fill in your details and pick a template. The preview updates live."
      />
      <ResumeBuilder mode="create" />
    </div>
  );
}

import { BriefUploadForm } from "@/components/forms/BriefUploadForm";
import { SectionIntro } from "@/components/public/sections";

export const metadata = {
  title: "Upload a brief",
  description: "Upload a project brief for the GYVFT studio.",
};

export default function UploadBriefPage() {
  return (
    <section className="editorial-shell px-5 py-16 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionIntro
            copy="Already have a deck or notes? Upload them with your contact details. We’ll find the story inside."
            eyebrow="Upload a brief"
            title="Send the practical details."
          />
        </div>
        <BriefUploadForm />
      </div>
    </section>
  );
}

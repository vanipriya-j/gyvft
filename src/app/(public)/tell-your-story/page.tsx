import { StoryForm } from "@/components/forms/StoryForm";
import { SectionIntro } from "@/components/public/sections";

export const metadata = {
  title: "Tell your story",
  description: "Begin a GYVFT story-led keepsake, publication, film, or experience.",
};

export default function TellYourStoryPage() {
  return (
    <section className="editorial-shell px-5 py-16 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionIntro
            copy="Seven short steps. Drafts save in your browser. Tell us the story, audience, format, and timing."
            eyebrow="Tell your story"
            title="Start with what matters."
          />
        </div>
        <StoryForm />
      </div>
    </section>
  );
}

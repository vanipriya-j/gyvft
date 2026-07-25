import { PartnerForm } from "@/components/forms/PartnerForm";
import { SectionIntro } from "@/components/public/sections";

export const metadata = {
  title: "Become a merch partner",
  description: "Invite GYVFT to become your story-led merchandise partner.",
};

export default function BecomeMerchPartnerPage() {
  return (
    <section className="editorial-shell px-5 py-16 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionIntro
            copy="For organisations that need recurring merchandise, milestone pieces, event collections, and culture-led gifts with editorial care."
            eyebrow="Merch partner"
            title="Make GYVFT your story-led merchandise studio."
          />
        </div>
        <PartnerForm />
      </div>
    </section>
  );
}

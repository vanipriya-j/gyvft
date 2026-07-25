import { DiscoveryForm } from "@/components/forms/DiscoveryForm";
import { SectionIntro } from "@/components/public/sections";

export const metadata = {
  title: "Book a discovery",
  description: "Request a discovery conversation with GYVFT.",
};

export default function BookDiscoveryPage() {
  return (
    <section className="gift-shell px-5 py-16 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionIntro
            copy="A short conversation is often the easiest way to decide whether your story needs a keepsake, a campaign, a publication, or a merchandise system."
            eyebrow="Book discovery"
            title="Let us understand the moment before we suggest the medium."
          />
        </div>
        <DiscoveryForm />
      </div>
    </section>
  );
}

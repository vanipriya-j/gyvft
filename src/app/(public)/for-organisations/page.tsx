import { ButtonLink } from "@/components/ui/button";
import { MotionReveal } from "@/components/public/MotionReveal";
import { SectionIntro } from "@/components/public/sections";

export const metadata = {
  title: "For organisations",
  description: "Story-led merchandise, publications, and culture projects for organisations.",
};

export default function ForOrganisationsPage() {
  const offers = [
    "Employee onboarding kits that carry origin stories and values",
    "Founder, leadership, and institutional milestone keepsakes",
    "Event merchandise with editorial substance",
    "Alumni, customer, partner, and community story programmes",
  ];

  return (
    <div className="editorial-shell">
      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-24 lg:grid-cols-[1fr_0.8fr] lg:px-8">
        <MotionReveal>
          <SectionIntro
            copy="GYVFT helps organisations turn culture, memory, and moments into merchandise and media people actually keep."
            eyebrow="For organisations"
            title="Not swag. Story-led objects with a reason to exist."
          />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/become-a-merch-partner">Make us your merch partner</ButtonLink>
            <ButtonLink href="/upload-a-brief" variant="secondary">
              Upload a brief
            </ButtonLink>
          </div>
        </MotionReveal>
        <MotionReveal delay={0.12}>
          <div className="paper-panel rounded-[2rem] p-8">
            <p className="font-display text-3xl text-ink">Built for teams who care what the object says.</p>
            <div className="mt-8 space-y-5">
              {offers.map((offer) => (
                <div className="flex gap-4" key={offer}>
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-copper" />
                  <p className="text-lg leading-7 text-ink/72">{offer}</p>
                </div>
              ))}
            </div>
          </div>
        </MotionReveal>
      </section>
      <section className="bg-ink px-5 py-20 text-paper lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3">
          {[
            ["Editorial", "We clarify the narrative before designing the object."],
            ["Production", "We scope quantities, budgets, timelines, and fulfilment paths early."],
            ["Continuity", "We can become a recurring partner for seasonal and milestone needs."],
          ].map(([title, copy]) => (
            <MotionReveal key={title}>
              <div>
                <h2 className="font-display text-3xl">{title}</h2>
                <p className="mt-4 leading-7 text-paper/68">{copy}</p>
              </div>
            </MotionReveal>
          ))}
        </div>
      </section>
    </div>
  );
}

import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { MotionReveal } from "@/components/public/MotionReveal";
import { SectionIntro } from "@/components/public/sections";
import { publicMedia } from "@/config/public-media";

export const metadata = {
  title: "For organisations",
  description: "Story-led merchandise, gifts, publications, and culture projects for organisations.",
};

export default function ForOrganisationsPage() {
  const offers = [
    "Employee onboarding kits that carry origin stories and values",
    "Founder, leadership, and institutional milestone keepsakes",
    "Event merchandise with editorial substance",
    "Alumni, customer, partner, and community story programmes",
  ];

  return (
    <div className="gift-shell">
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
        <MotionReveal>
          <SectionIntro
            copy="GYVFT helps organisations turn culture, memory, and moments into merchandise and gifts people actually keep."
            eyebrow="For organisations"
            title="Not swag. Story-led objects with a reason to exist."
          />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/become-a-merch-partner">Make us your merch partner</ButtonLink>
            <ButtonLink href="/upload-a-brief" variant="secondary">
              Upload a brief
            </ButtonLink>
          </div>
          <ul className="mt-10 space-y-4">
            {offers.map((offer) => (
              <li className="flex gap-3 text-lg leading-7 text-ink/72" key={offer}>
                <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-coral" />
                <span>{offer}</span>
              </li>
            ))}
          </ul>
        </MotionReveal>
        <MotionReveal delay={0.12}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-[var(--shadow-soft)]">
            <Image
              alt={publicMedia.organisations.kit.alt}
              className="object-cover"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              src={publicMedia.organisations.kit.src}
            />
          </div>
        </MotionReveal>
      </section>
      <section className="ink-band px-5 py-20 text-paper lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3">
          {[
            ["Editorial", "We clarify the narrative before designing the object."],
            ["Production", "We scope quantities, budgets, timelines, and fulfilment paths early."],
            ["Continuity", "We can become a recurring partner for seasonal and milestone needs."],
          ].map(([title, copy]) => (
            <MotionReveal key={title}>
              <div>
                <h2 className="font-display text-3xl">{title}</h2>
                <p className="mt-4 leading-7 text-paper/70">{copy}</p>
              </div>
            </MotionReveal>
          ))}
        </div>
      </section>
    </div>
  );
}

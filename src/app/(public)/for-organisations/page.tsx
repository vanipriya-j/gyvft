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
    "Employee onboarding kits with origin stories and values",
    "Leadership and institutional milestone keepsakes",
    "Event merchandise with editorial substance",
    "Alumni, partner, and community story programmes",
  ];

  return (
    <div className="editorial-shell">
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
        <MotionReveal>
          <SectionIntro
            eyebrow="For organisations"
            title="Not swag. Story-led objects."
            copy="Turn culture, memory, and moments into merchandise and gifts people keep."
          />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/become-a-merch-partner">Make us your merch partner</ButtonLink>
            <ButtonLink href="/upload-a-brief" variant="secondary">
              Upload a brief
            </ButtonLink>
          </div>
          <ul className="mt-10 space-y-3">
            {offers.map((offer) => (
              <li className="flex gap-3 text-base leading-7 text-muted-text" key={offer}>
                <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-olive" />
                <span>{offer}</span>
              </li>
            ))}
          </ul>
        </MotionReveal>
        <MotionReveal delay={0.12}>
          <div className="relative aspect-[4/5] overflow-hidden border border-border">
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
            ["Production", "Quantities, budgets, timelines, and fulfilment — scoped early."],
            ["Continuity", "A recurring partner for seasonal and milestone needs."],
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

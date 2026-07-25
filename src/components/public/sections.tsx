import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { publicMedia } from "@/config/public-media";
import { MotionReveal } from "./MotionReveal";

export function SectionIntro({
  eyebrow,
  title,
  copy,
  tone = "ink",
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  tone?: "ink" | "paper";
}) {
  const titleClass = tone === "paper" ? "text-paper" : "text-ink";
  const copyClass = tone === "paper" ? "text-paper/72" : "text-muted-text";
  const eyeClass = tone === "paper" ? "text-saffron" : "text-olive";

  return (
    <div className="max-w-3xl">
      <p className={`text-xs font-medium uppercase tracking-[0.28em] ${eyeClass}`}>{eyebrow}</p>
      <h2
        className={`mt-4 font-display text-4xl leading-[1.08] tracking-[-0.02em] sm:text-5xl ${titleClass}`}
      >
        {title}
      </h2>
      {copy ? <p className={`mt-4 max-w-2xl text-lg leading-8 ${copyClass}`}>{copy}</p> : null}
    </div>
  );
}

const becomeItems = [
  {
    title: "Gifts & keepsakes",
    copy: "Objects made to be held, wrapped, and kept.",
    image: publicMedia.become.gifts,
  },
  {
    title: "Books & publications",
    copy: "Memory books, founder editions, illustrated volumes.",
    image: publicMedia.become.books,
  },
  {
    title: "Merchandise & kits",
    copy: "Apparel and collections that carry a story.",
    image: publicMedia.become.merch,
  },
] as const;

export function WhatStoryCanBecomeSection() {
  return (
    <section className="px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <MotionReveal>
          <SectionIntro
            eyebrow="What your story can become"
            title="From memory to object."
            copy="A real story, made into something people can open, wear, unwrap, or experience together."
          />
        </MotionReveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {becomeItems.map((item, index) => (
            <MotionReveal delay={index * 0.06} key={item.title}>
              <article className="group overflow-hidden border border-border bg-paper">
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image
                    alt={item.image.alt}
                    className="object-cover transition duration-700 group-hover:scale-[1.03]"
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    src={item.image.src}
                  />
                </div>
                <div className="px-5 py-6">
                  <h3 className="font-display text-2xl text-ink">{item.title}</h3>
                  <p className="mt-2 text-base leading-7 text-muted-text">{item.copy}</p>
                </div>
              </article>
            </MotionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const storyWorlds = [
  {
    title: "Celebrate",
    copy: "Weddings, birthdays, launches — joy made tangible.",
    image: publicMedia.worlds.celebrate,
  },
  {
    title: "Remember",
    copy: "Family histories, archives, private milestones.",
    image: publicMedia.worlds.remember,
  },
  {
    title: "Honour",
    copy: "People, craft, and moments worth marking.",
    image: publicMedia.worlds.honour,
  },
  {
    title: "Belong",
    copy: "Teams, communities, and shared identity.",
    image: publicMedia.worlds.belong,
  },
  {
    title: "Build Together",
    copy: "Ongoing programmes, kits, and culture work.",
    image: publicMedia.worlds.build,
  },
] as const;

export function StoryWorldsSection() {
  return (
    <section className="bg-surface/70 px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <MotionReveal>
          <SectionIntro
            eyebrow="Story worlds"
            title="Types of stories we tell."
            copy="Emotional worlds — not product aisles. Begin with the feeling; the form follows."
          />
        </MotionReveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-6">
          {storyWorlds.map((world, index) => {
            const wide = index < 2;
            return (
              <MotionReveal
                className={wide ? "md:col-span-1 xl:col-span-3" : "xl:col-span-2"}
                delay={index * 0.05}
                key={world.title}
              >
                <article className="group relative overflow-hidden border border-border bg-paper">
                  <div className={`relative ${wide ? "aspect-[16/10]" : "aspect-[4/5]"}`}>
                    <Image
                      alt={world.image.alt}
                      className="object-cover transition duration-700 group-hover:scale-[1.03]"
                      fill
                      sizes="(max-width: 1280px) 50vw, 33vw"
                      src={world.image.src}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#202202]/72 via-[#202202]/15 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-paper sm:p-6">
                      <h3 className="font-display text-2xl sm:text-3xl">{world.title}</h3>
                      <p className="mt-2 max-w-sm text-sm leading-6 text-paper/80 sm:text-base">
                        {world.copy}
                      </p>
                    </div>
                  </div>
                </article>
              </MotionReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function StoryTransformationSection() {
  return (
    <section className="px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        <MotionReveal>
          <div className="relative aspect-[5/4] overflow-hidden border border-border">
            <Image
              alt={publicMedia.transformation.feature.alt}
              className="object-cover"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              src={publicMedia.transformation.feature.src}
            />
          </div>
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <SectionIntro
            eyebrow="One transformation"
            title="A performance becomes a keepsake."
            copy="A night of music, movement, or memory — distilled into a book, a gift set, or a limited edition people can hold long after the applause."
          />
          <p className="mt-6 text-base leading-7 text-muted-text">
            We listen for the emotional centre, then choose the form that serves it — not the other way around.
          </p>
          <ButtonLink className="mt-8" href="/tell-your-story">
            Tell us your story
          </ButtonLink>
        </MotionReveal>
      </div>
    </section>
  );
}

export function ForOrganisationsSection() {
  const points = [
    "Onboarding kits with origin and values",
    "Recognition and milestone merchandise",
    "Event collections with editorial substance",
    "Anniversaries and founder editions",
  ];

  return (
    <section className="bg-surface/60 px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <MotionReveal>
          <div className="relative aspect-[4/5] overflow-hidden border border-border">
            <Image
              alt={publicMedia.organisations.kit.alt}
              className="object-cover"
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              src={publicMedia.organisations.kit.src}
            />
          </div>
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <SectionIntro
            eyebrow="For organisations"
            title="Culture you can hold."
            copy="Employee moments, customer experiences, festivals, and custom storytelling — as an ongoing practice."
          />
          <ul className="mt-8 space-y-3">
            {points.map((point) => (
              <li className="flex gap-3 text-base leading-7 text-muted-text" key={point}>
                <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-olive" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/become-a-merch-partner">Make us your merch partner</ButtonLink>
            <ButtonLink href="/for-organisations" variant="secondary">
              Explore for organisations
            </ButtonLink>
          </div>
        </MotionReveal>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    {
      n: "01",
      title: "Share the story",
      copy: "People, occasion, feeling — start wherever you are.",
    },
    {
      n: "02",
      title: "We shape the telling",
      copy: "We find the centre and clarify what it needs to say.",
    },
    {
      n: "03",
      title: "We make & deliver",
      copy: "Books, gifts, merch, experiences — designed and produced.",
    },
  ];

  return (
    <section className="px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <MotionReveal>
          <SectionIntro
            eyebrow="Simple process"
            title="Three calm steps."
            copy="Personal when it needs to be. Precise when production begins."
          />
        </MotionReveal>
        <div className="mt-12 grid gap-px border border-border bg-border md:grid-cols-3">
          {steps.map((step, index) => (
            <MotionReveal delay={index * 0.06} key={step.n}>
              <div className="min-h-52 bg-background px-6 py-8">
                <p className="text-xs font-medium tracking-[0.24em] text-olive">{step.n}</p>
                <h3 className="mt-8 font-display text-2xl text-ink">{step.title}</h3>
                <p className="mt-3 text-base leading-7 text-muted-text">{step.copy}</p>
              </div>
            </MotionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section className="px-5 pb-20 pt-4 lg:px-8 lg:pb-28">
      <MotionReveal className="relative mx-auto max-w-7xl overflow-hidden border border-border ink-band px-8 py-12 text-paper md:px-14 md:py-16">
        <div className="relative grid gap-8 lg:grid-cols-[1.3fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-saffron">
              Ready when you are
            </p>
            <h2 className="mt-4 max-w-3xl font-display text-4xl leading-tight sm:text-5xl">
              Bring us the story.
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-paper/72">
              Personal celebrations, organisational culture, or a recurring merch partnership.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <ButtonLink href="/tell-your-story">Tell us your story</ButtonLink>
            <ButtonLink
              className="border-paper/30 bg-transparent text-paper hover:bg-paper/10"
              href="/book-a-discovery"
              variant="secondary"
            >
              Book a discovery
            </ButtonLink>
          </div>
        </div>
        <p className="relative mt-10 text-sm text-paper/55">
          Prefer a brief?{" "}
          <Link
            className="underline decoration-olive/70 underline-offset-4 hover:text-paper"
            href="/upload-a-brief"
          >
            Upload a brief
          </Link>
        </p>
      </MotionReveal>
    </section>
  );
}

/** @deprecated Prefer FinalCtaSection */
export function EditorialCtaSection() {
  return <FinalCtaSection />;
}

/** @deprecated Replaced by StoryWorldsSection */
export function StoryCategoriesSection() {
  return null;
}

/** @deprecated Replaced by WhatStoryCanBecomeSection */
export function StoryOutputsSection() {
  return null;
}

/** @deprecated Replaced by StoryTransformationSection */
export function VisualExamplesSection() {
  return null;
}

/** @deprecated Inline CTA now lives in transformation / final CTA */
export function TellUsYourStorySection() {
  return null;
}

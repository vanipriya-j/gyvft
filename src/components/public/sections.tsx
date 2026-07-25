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
  copy: string;
  tone?: "ink" | "paper";
}) {
  const titleClass = tone === "paper" ? "text-paper" : "text-ink";
  const copyClass = tone === "paper" ? "text-paper/76" : "text-ink/70";
  const eyeClass = tone === "paper" ? "text-saffron" : "text-coral-deep";

  return (
    <div className="max-w-3xl">
      <p className={`font-brand text-xs font-bold uppercase tracking-[0.32em] ${eyeClass}`}>
        {eyebrow}
      </p>
      <h2 className={`mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-5xl lg:text-6xl ${titleClass}`}>
        {title}
      </h2>
      <p className={`mt-5 text-lg leading-8 ${copyClass}`}>{copy}</p>
    </div>
  );
}

const becomeItems = [
  {
    title: "Books and publications",
    copy: "Memory books, founder editions, anniversary publications, and illustrated volumes.",
    image: publicMedia.expressions.books,
    accent: "bg-saffron",
  },
  {
    title: "Gifts and keepsakes",
    copy: "Objects made to be held, wrapped, gifted, and kept on a shelf for years.",
    image: publicMedia.expressions.gifts,
    accent: "bg-coral",
  },
  {
    title: "Merchandise",
    copy: "Apparel, kits, and collections that carry a story instead of a slogan.",
    image: publicMedia.expressions.merch,
    accent: "bg-jade",
  },
  {
    title: "Events and experiences",
    copy: "Installations, guest gifts, stage moments, and tactile event worlds.",
    image: publicMedia.expressions.events,
    accent: "bg-plum",
  },
  {
    title: "Cultural and institutional stories",
    copy: "Archives, heritage projects, and commemorative pieces for organisations.",
    image: publicMedia.expressions.culture,
    accent: "bg-coral-deep",
  },
  {
    title: "Personal celebrations",
    copy: "Weddings, birthdays, remembrances, and family milestones made tangible.",
    image: publicMedia.expressions.celebrations,
    accent: "bg-saffron",
  },
] as const;

export function WhatStoryCanBecomeSection() {
  return (
    <section className="gift-shell px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <MotionReveal>
          <SectionIntro
            eyebrow="What your story can become"
            title="Gifts, books, merchandise, and objects with feeling."
            copy="GYVFT turns a real story into something people can open, wear, unwrap, display, or experience together."
          />
        </MotionReveal>

        <div className="mt-14 space-y-8">
          {becomeItems.map((item, index) => {
            const reverse = index % 2 === 1;
            return (
              <MotionReveal delay={index * 0.04} key={item.title}>
                <article
                  className={`grid items-center gap-6 overflow-hidden rounded-[2rem] bg-paper/70 p-4 shadow-[var(--shadow-soft)] sm:p-5 lg:grid-cols-2 ${
                    reverse ? "lg:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <div className="relative aspect-[5/4] overflow-hidden rounded-[1.5rem]">
                    <Image
                      alt={item.image.alt}
                      className="object-cover transition duration-700 hover:scale-105"
                      fill
                      sizes="(max-width: 1024px) 100vw, 45vw"
                      src={item.image.src}
                    />
                    <div className={`absolute left-4 top-4 h-3 w-16 rounded-full ${item.accent}`} />
                  </div>
                  <div className="px-2 py-4 sm:px-6">
                    <h3 className="font-display text-3xl tracking-[-0.03em] text-ink sm:text-4xl">
                      {item.title}
                    </h3>
                    <p className="mt-4 max-w-md text-lg leading-8 text-ink/68">{item.copy}</p>
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

export function VisualExamplesSection() {
  const tiles = [
    { ...publicMedia.hero.book, label: "Custom book", rotate: "-rotate-2" },
    { ...publicMedia.hero.giftBox, label: "Gift box", rotate: "rotate-2" },
    { ...publicMedia.hero.merchandise, label: "Merch drop", rotate: "-rotate-1" },
    { ...publicMedia.textures.box, label: "Keepsake packaging", rotate: "rotate-3" },
    { ...publicMedia.hero.framed, label: "Framed story object", rotate: "-rotate-3" },
    { ...publicMedia.textures.ribbon, label: "Ribbon & wrap", rotate: "rotate-1" },
  ];

  return (
    <section className="bg-ink px-5 py-20 text-paper lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <MotionReveal>
          <SectionIntro
            tone="paper"
            eyebrow="Story expressions"
            title="A studio of things you can hold."
            copy="Books, boxes, textiles, framed pieces, bottles, packaging, and event objects — composed like a gift atelier, not a boardroom pitch."
          />
        </MotionReveal>

        <div className="mt-14 columns-1 gap-5 sm:columns-2 lg:columns-3">
          {tiles.map((tile, index) => (
            <MotionReveal
              className={`mb-5 break-inside-avoid ${tile.rotate}`}
              delay={index * 0.05}
              key={tile.label}
            >
              <figure className="overflow-hidden rounded-[1.6rem] border-4 border-paper/15 bg-paper/10">
                <div className={`relative ${index % 3 === 0 ? "aspect-[4/5]" : "aspect-square"}`}>
                  <Image
                    alt={tile.alt}
                    className="object-cover"
                    fill
                    sizes="(max-width: 1024px) 50vw, 30vw"
                    src={tile.src}
                  />
                </div>
                <figcaption className="px-4 py-3 font-brand text-sm font-semibold tracking-wide text-paper/88">
                  {tile.label}
                </figcaption>
              </figure>
            </MotionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TellUsYourStorySection() {
  return (
    <section className="relative overflow-hidden px-5 py-20 lg:px-8 lg:py-28">
      <div className="absolute inset-0">
        <Image
          alt=""
          aria-hidden="true"
          className="object-cover opacity-25"
          fill
          sizes="100vw"
          src={publicMedia.textures.ribbon.src}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/92 to-background/70" />
      </div>
      <div className="relative mx-auto grid max-w-7xl items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <MotionReveal>
          <SectionIntro
            eyebrow="Tell us your story"
            title="Begin with the memory. We’ll find the form."
            copy="Share the people, the occasion, and the feeling. You do not need to know whether it becomes a book, a gift, a kit, or something that does not exist yet."
          />
        </MotionReveal>
        <MotionReveal delay={0.1}>
          <div className="rounded-[2rem] bg-coral p-8 text-paper shadow-[var(--shadow-pop)]">
            <p className="font-display text-3xl leading-tight tracking-[-0.03em]">
              A short conversation starts with your story — not a catalogue.
            </p>
            <ButtonLink className="mt-8 bg-ink hover:bg-ink-soft" href="/tell-your-story" variant="dark">
              Tell us your story
            </ButtonLink>
          </div>
        </MotionReveal>
      </div>
    </section>
  );
}

export function ForOrganisationsSection() {
  const points = [
    "Employee onboarding kits with origin and values",
    "Recognition and milestone merchandise",
    "Festival and conference collections",
    "Institutional anniversaries and founder editions",
  ];

  return (
    <section className="px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <MotionReveal>
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-[var(--shadow-soft)]">
            <Image
              alt={publicMedia.organisations.kit.alt}
              className="object-cover"
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              src={publicMedia.organisations.kit.src}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-6 text-paper">
              <p className="font-brand text-xs uppercase tracking-[0.28em] text-saffron">
                For organisations
              </p>
              <p className="mt-2 font-display text-3xl">Make us part of your story.</p>
            </div>
          </div>
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <SectionIntro
            eyebrow="Recurring partnership"
            title="Culture, merchandise, and storytelling — as an ongoing practice."
            copy="GYVFT can become your partner for employee moments, customer experiences, festivals, leadership milestones, and custom storytelling projects."
          />
          <ul className="mt-8 space-y-4">
            {points.map((point) => (
              <li className="flex gap-3 text-lg leading-7 text-ink/75" key={point}>
                <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-jade" />
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
      title: "Tell us the story",
      copy: "Occasion, people, feeling, constraints — start wherever you are.",
      tone: "bg-coral text-paper",
    },
    {
      n: "02",
      title: "We shape the narrative",
      copy: "We find the emotional centre and clarify what the piece needs to say.",
      tone: "bg-saffron text-ink",
    },
    {
      n: "03",
      title: "We propose expressions",
      copy: "Books, gifts, merch, packaging, experiences — whichever fits the story.",
      tone: "bg-jade text-paper",
    },
    {
      n: "04",
      title: "We create and deliver",
      copy: "Design, making, and production come together into something keepable.",
      tone: "bg-ink text-paper",
    },
  ];

  return (
    <section className="gift-shell px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <MotionReveal>
          <SectionIntro
            eyebrow="How it works"
            title="Four gentle steps from memory to object."
            copy="Personal when it needs to be. Precise when production begins."
          />
        </MotionReveal>
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <MotionReveal delay={index * 0.06} key={step.n}>
              <div className={`min-h-64 rounded-[1.8rem] p-6 ${step.tone}`}>
                <p className="font-brand text-sm font-bold tracking-[0.24em] opacity-80">
                  {step.n}
                </p>
                <h3 className="mt-10 font-display text-3xl leading-tight tracking-[-0.03em]">
                  {step.title}
                </h3>
                <p className="mt-4 text-base leading-7 opacity-85">{step.copy}</p>
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
    <section className="px-5 pb-20 pt-8 lg:px-8 lg:pb-28">
      <MotionReveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.2rem] ink-band px-8 py-12 text-paper md:px-14 md:py-16">
        <div className="absolute -right-10 top-0 h-48 w-48 rounded-full bg-coral/40 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-40 w-40 rounded-full bg-saffron/30 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.3fr_auto] lg:items-end">
          <div>
            <p className="font-brand text-xs font-bold uppercase tracking-[0.32em] text-saffron">
              Ready when you are
            </p>
            <h2 className="mt-4 max-w-3xl font-display text-4xl leading-tight tracking-[-0.04em] sm:text-6xl">
              Bring us the story. We’ll help it become a gift worth keeping.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-paper/75">
              Personal celebrations, organisational culture, or a recurring merch partnership —
              start with a conversation.
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
          <Link className="underline decoration-saffron/70 underline-offset-4 hover:text-paper" href="/upload-a-brief">
            Upload a brief
          </Link>
        </p>
      </MotionReveal>
    </section>
  );
}

/** @deprecated Prefer FinalCtaSection — kept for any residual imports */
export function EditorialCtaSection() {
  return <FinalCtaSection />;
}

/** @deprecated Homepage no longer uses category chips as a primary section */
export function StoryCategoriesSection() {
  return null;
}

/** @deprecated Replaced by WhatStoryCanBecomeSection */
export function StoryOutputsSection() {
  return null;
}

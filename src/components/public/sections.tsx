import { STORY_CATEGORIES, STORY_OUTPUTS } from "@/config/constants";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { MotionReveal } from "./MotionReveal";

export function SectionIntro({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="max-w-3xl">
      <Badge>{eyebrow}</Badge>
      <h2 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-6xl">
        {title}
      </h2>
      <p className="mt-5 text-lg leading-8 text-ink/68">{copy}</p>
    </div>
  );
}

export function StoryCategoriesSection() {
  return (
    <section className="editorial-shell px-5 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <MotionReveal>
          <SectionIntro
            copy="From intimate family histories to public-facing culture projects, GYVFT starts by finding the emotional centre of the story."
            eyebrow="Story categories"
            title="Milestones, memory, culture, and the people who made them."
          />
        </MotionReveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STORY_CATEGORIES.map((category, index) => (
            <MotionReveal delay={index * 0.04} key={category}>
              <div className="min-h-36 rounded-[1.5rem] border border-ink/10 bg-paper/70 p-6">
                <p className="font-display text-2xl text-ink">{category}</p>
                <p className="mt-4 text-sm leading-6 text-ink/62">
                  Framed with care, edited with restraint, and made tangible.
                </p>
              </div>
            </MotionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StoryOutputsSection() {
  return (
    <section className="bg-paper px-5 py-24 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <MotionReveal>
          <SectionIntro
            copy="The output follows the story: a keepsake for a family, a kit for employees, a publication for alumni, or an experience for an audience."
            eyebrow="What stories become"
            title="Editorial craft, made physical."
          />
        </MotionReveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {STORY_OUTPUTS.map((output, index) => (
            <MotionReveal delay={index * 0.05} key={output}>
              <div className="rounded-[1.5rem] border border-ink/10 bg-background/70 p-6">
                <p className="text-xl font-semibold text-ink">{output}</p>
              </div>
            </MotionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    {
      title: "Listen",
      copy: "We gather the occasion, people, constraints, and the feeling the final piece needs to hold.",
    },
    {
      title: "Shape",
      copy: "We define the narrative, formats, production path, budget, and timelines before making begins.",
    },
    {
      title: "Tell",
      copy: "Writers, designers, makers, and production partners bring the story into a finished keepsake or campaign.",
    },
  ];

  return (
    <section className="px-5 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <MotionReveal>
          <SectionIntro
            copy="A small, senior team keeps the process personal while coordinating the creative and production work behind the scenes."
            eyebrow="How it works"
            title="A calm path from first memory to finished piece."
          />
        </MotionReveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <MotionReveal delay={index * 0.08} key={step.title}>
              <div className="paper-panel min-h-72 rounded-[2rem] p-8">
                <span className="font-display text-6xl text-copper/50">0{index + 1}</span>
                <h3 className="mt-8 font-display text-3xl text-ink">{step.title}</h3>
                <p className="mt-4 leading-7 text-ink/65">{step.copy}</p>
              </div>
            </MotionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EditorialCtaSection() {
  return (
    <section className="px-5 py-20 lg:px-8">
      <MotionReveal className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-ink p-8 text-paper md:p-12">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-copper">
              Begin with the story
            </p>
            <h2 className="mt-4 max-w-3xl font-display text-4xl leading-tight tracking-[-0.04em] sm:text-6xl">
              Tell us what happened, who it matters to, and what it needs to become.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <ButtonLink href="/tell-your-story">Tell us your story</ButtonLink>
            <ButtonLink href="/book-a-discovery" variant="secondary">
              Book discovery
            </ButtonLink>
          </div>
        </div>
      </MotionReveal>
    </section>
  );
}

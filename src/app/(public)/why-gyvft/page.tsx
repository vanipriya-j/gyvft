import { ButtonLink } from "@/components/ui/button";
import { MotionReveal } from "@/components/public/MotionReveal";

export const metadata = {
  title: "Why GYVFT",
  description:
    "Most merchandise begins with a product. We begin with your story — then decide what deserves to exist because of it.",
};

export default function WhyGyvftPage() {
  return (
    <div className="editorial-shell">
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <MotionReveal>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-olive">Why GYVFT</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-[1.05] tracking-[-0.02em] text-ink sm:text-6xl lg:text-7xl">
            Most merchandise begins with a product.
          </h1>
        </MotionReveal>

        <MotionReveal className="mt-10 max-w-2xl space-y-3" delay={0.06}>
          <p className="text-xl leading-8 text-muted-text">A mug.</p>
          <p className="text-xl leading-8 text-muted-text">A T-shirt.</p>
          <p className="text-xl leading-8 text-muted-text">A diary.</p>
          <p className="text-xl leading-8 text-muted-text">A bottle.</p>
          <p className="pt-4 text-lg leading-8 text-muted-text">
            Then someone’s logo gets printed on it.
          </p>
        </MotionReveal>

        <MotionReveal className="mt-14 max-w-3xl" delay={0.1}>
          <p className="font-display text-3xl leading-snug text-ink sm:text-4xl">
            We work the other way around.
          </p>
          <p className="mt-6 text-lg leading-8 text-muted-text">We begin with your story.</p>
          <p className="mt-4 text-lg leading-8 text-muted-text">
            Then we decide what deserves to exist because of it.
          </p>
        </MotionReveal>

        <MotionReveal className="mt-14 max-w-2xl space-y-3" delay={0.14}>
          <p className="text-lg leading-8 text-muted-text">Sometimes that becomes a book.</p>
          <p className="text-lg leading-8 text-muted-text">Sometimes a keepsake.</p>
          <p className="text-lg leading-8 text-muted-text">Sometimes merchandise.</p>
          <p className="text-lg leading-8 text-muted-text">Sometimes an experience.</p>
          <p className="text-lg leading-8 text-muted-text">Sometimes something entirely unexpected.</p>
        </MotionReveal>

        <MotionReveal className="mt-16 max-w-3xl border-t border-border pt-12" delay={0.18}>
          <p className="font-display text-3xl leading-snug text-ink sm:text-4xl">
            We are not facilitators at the core.
          </p>
          <p className="mt-4 font-display text-3xl leading-snug text-ink sm:text-4xl">
            We are creators.
          </p>
        </MotionReveal>
      </section>

      <section className="border-t border-border bg-surface/60 px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <MotionReveal>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-olive">
              Created by the team behind Aarla
            </p>
            <h2 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl">
              The same creative practice, extended to your story.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-text">
              For years Aarla has told stories through books, illustrations, products and culture.
            </p>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-text">
              GYVFT simply extends that same creative practice to tell yours.
            </p>
            <ButtonLink
              className="mt-10"
              href="https://aarla.in"
              rel="noopener noreferrer"
              target="_blank"
            >
              Explore Aarla
            </ButtonLink>
          </MotionReveal>
        </div>
      </section>
    </div>
  );
}

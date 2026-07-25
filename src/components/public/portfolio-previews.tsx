import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { MotionReveal } from "@/components/public/MotionReveal";
import { StoryMedia } from "@/components/public/StoryMedia";
import { SectionIntro } from "@/components/public/sections";
import { stories } from "@/content/stories";

export function WhyGyvftPreviewSection() {
  return (
    <section className="border-y border-border bg-surface/50 px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <MotionReveal>
          <SectionIntro
            eyebrow="Why GYVFT"
            title="We begin with your story."
            copy="Most merchandise begins with a product. We work the other way around — then decide what deserves to exist because of the story."
          />
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <ButtonLink href="/why-gyvft" variant="secondary">
              Why GYVFT
            </ButtonLink>
            <ButtonLink href="/tell-your-story">Tell us your story</ButtonLink>
          </div>
        </MotionReveal>
      </div>
    </section>
  );
}

export function StoriesPreviewSection() {
  const preview = stories.slice(0, 3);

  return (
    <section className="px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <MotionReveal>
          <SectionIntro
            eyebrow="Stories"
            title="Stories We’ve Helped Tell"
            copy="Not a catalogue of products — a collection of stories that became books, keepsakes, gifts, merchandise and experiences."
          />
        </MotionReveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {preview.map((story, index) => (
            <MotionReveal delay={index * 0.05} key={story.slug}>
              <Link className="group block h-full" href={`/stories/${story.slug}`}>
                <article className="flex h-full flex-col overflow-hidden border border-border bg-paper transition group-hover:border-olive/40">
                  <div className="relative aspect-[4/3]">
                    {/* TODO: preview cards use story.hero from src/content/stories.ts */}
                    <StoryMedia className="border-0" media={story.hero} sizes="33vw" />
                  </div>
                  <div className="flex flex-1 flex-col px-5 py-5">
                    <h3 className="font-display text-2xl text-ink">{story.title}</h3>
                    <p className="mt-3 text-base leading-7 text-muted-text">{story.summary}</p>
                  </div>
                </article>
              </Link>
            </MotionReveal>
          ))}
        </div>

        <MotionReveal className="mt-10">
          <ButtonLink href="/stories" variant="secondary">
            View all stories
          </ButtonLink>
        </MotionReveal>
      </div>
    </section>
  );
}

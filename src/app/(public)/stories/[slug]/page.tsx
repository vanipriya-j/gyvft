import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { MotionReveal } from "@/components/public/MotionReveal";
import { StoryMedia } from "@/components/public/StoryMedia";
import {
  getGroupTitle,
  getRelatedStories,
  getStoryBySlug,
  stories,
} from "@/content/stories";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return stories.map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const story = getStoryBySlug(slug);
  if (!story) return {};
  return {
    title: story.title,
    description: story.summary,
  };
}

export default async function StoryDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const story = getStoryBySlug(slug);
  if (!story) notFound();

  const related = getRelatedStories(story, 3);
  const groupTitle = getGroupTitle(story.groupId);

  return (
    <div className="editorial-shell">
      <section className="mx-auto max-w-7xl px-5 pt-12 lg:px-8 lg:pt-16">
        <MotionReveal>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-olive">
            <Link className="hover:text-ink" href="/stories">
              Stories
            </Link>
            <span className="mx-2 text-border">/</span>
            {groupTitle}
          </p>
        </MotionReveal>
        <MotionReveal className="mt-6" delay={0.04}>
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            {/* TODO: hero media path lives in src/content/stories.ts → story.hero.src */}
            <StoryMedia media={story.hero} priority sizes="100vw" />
          </div>
        </MotionReveal>
        <MotionReveal className="mt-10 max-w-3xl" delay={0.08}>
          <h1 className="font-display text-5xl leading-[1.05] tracking-[-0.02em] text-ink sm:text-6xl">
            {story.title}
          </h1>
          <p className="mt-6 text-xl leading-8 text-muted-text">{story.introduction}</p>
        </MotionReveal>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="grid max-w-3xl gap-14">
          <MotionReveal>
            <h2 className="font-display text-3xl text-ink sm:text-4xl">The Story</h2>
            <p className="mt-5 text-lg leading-8 text-muted-text">{story.theStory}</p>
          </MotionReveal>
          <MotionReveal>
            <h2 className="font-display text-3xl text-ink sm:text-4xl">Our Interpretation</h2>
            <p className="mt-5 text-lg leading-8 text-muted-text">{story.ourInterpretation}</p>
          </MotionReveal>
          <MotionReveal>
            <h2 className="font-display text-3xl text-ink sm:text-4xl">What It Became</h2>
            <p className="mt-5 text-lg leading-8 text-muted-text">{story.whatItBecame}</p>
          </MotionReveal>
        </div>
      </section>

      {related.length ? (
        <section className="border-t border-border bg-surface/50 px-5 py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <MotionReveal>
              <h2 className="font-display text-3xl text-ink sm:text-4xl">Related Stories</h2>
            </MotionReveal>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {related.map((item, index) => (
                <MotionReveal delay={index * 0.05} key={item.slug}>
                  <Link className="group block" href={`/stories/${item.slug}`}>
                    <article className="overflow-hidden border border-border bg-paper transition group-hover:border-olive/40">
                      <div className="relative aspect-[4/3]">
                        <StoryMedia className="border-0" media={item.hero} sizes="33vw" />
                      </div>
                      <div className="px-5 py-5">
                        <h3 className="font-display text-xl text-ink">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-text">{item.summary}</p>
                      </div>
                    </article>
                  </Link>
                </MotionReveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-5 py-20 lg:px-8 lg:py-24">
        <MotionReveal className="mx-auto max-w-7xl border border-border ink-band px-8 py-12 text-paper md:px-14 md:py-16">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-saffron">
            Have a story like this?
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">Tell us.</h2>
          <ButtonLink className="mt-8" href="/tell-your-story">
            Tell us your story
          </ButtonLink>
        </MotionReveal>
      </section>
    </div>
  );
}

import Link from "next/link";
import { MotionReveal } from "@/components/public/MotionReveal";
import { StoryMedia } from "@/components/public/StoryMedia";
import { getStoriesByGroup, storyGroups } from "@/content/stories";

export const metadata = {
  title: "Stories",
  description:
    "Stories We've Helped Tell — a collection of stories that became books, keepsakes, gifts, merchandise and experiences.",
};

export default function StoriesPage() {
  return (
    <div className="editorial-shell">
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <MotionReveal>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-olive">Stories</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-[1.05] tracking-[-0.02em] text-ink sm:text-6xl">
            Stories We’ve Helped Tell
          </h1>
          <div className="mt-8 max-w-2xl space-y-4 text-lg leading-8 text-muted-text">
            <p>Every project begins with a story.</p>
            <p>Sometimes it is about a person.</p>
            <p>Sometimes an organisation.</p>
            <p>Sometimes a milestone.</p>
            <p>Sometimes a community.</p>
            <p className="pt-2">
              What follows is not a catalogue of products.
            </p>
            <p>
              It is a collection of stories that became books, keepsakes, badges, gifts, merchandise
              and experiences.
            </p>
          </div>
        </MotionReveal>
      </section>

      {storyGroups.map((group, groupIndex) => {
        const items = getStoriesByGroup(group.id);
        if (!items.length) return null;
        return (
          <section
            className={`px-5 py-16 lg:px-8 lg:py-20 ${groupIndex % 2 === 1 ? "bg-surface/50" : ""}`}
            key={group.id}
            id={group.id}
          >
            <div className="mx-auto max-w-7xl">
              <MotionReveal>
                <h2 className="font-display text-3xl text-ink sm:text-4xl">{group.title}</h2>
              </MotionReveal>
              <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {items.map((story, index) => (
                  <MotionReveal delay={index * 0.05} key={story.slug}>
                    <Link className="group block h-full" href={`/stories/${story.slug}`}>
                      <article className="flex h-full flex-col overflow-hidden border border-border bg-paper transition group-hover:border-olive/40">
                        <div className="relative aspect-[4/3]">
                          <StoryMedia
                            className="border-0"
                            media={story.hero}
                            sizes="(max-width: 1280px) 50vw, 33vw"
                          />
                        </div>
                        <div className="flex flex-1 flex-col px-5 py-6">
                          <h3 className="font-display text-2xl text-ink">{story.title}</h3>
                          <p className="mt-3 text-base leading-7 text-muted-text">{story.summary}</p>
                          <p className="mt-auto pt-6 text-sm font-medium text-olive-dark transition group-hover:text-ink">
                            Read the story
                          </p>
                        </div>
                      </article>
                    </Link>
                  </MotionReveal>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

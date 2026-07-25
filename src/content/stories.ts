/**
 * Central storytelling portfolio content for GYVFT.
 *
 * When final photography or art is ready, replace each media `src` path
 * (and set `isPlaceholder: false`) without changing page layouts.
 */

export type StoryGroupId =
  | "celebrating-people"
  | "building-communities"
  | "institutions-heritage"
  | "organisations-events"
  | "seasonal-personal-gifting";

export type StoryMedia = {
  /**
   * Intended final path under /public.
   * Swap the file in place later; keep this path stable when possible.
   */
  src: string;
  alt: string;
  /** TODO: set to false once the real asset exists at `src`. */
  isPlaceholder: boolean;
};

export type Story = {
  slug: string;
  title: string;
  groupId: StoryGroupId;
  /** One-line listing summary */
  summary: string;
  /** Short introduction under the hero */
  introduction: string;
  theStory: string;
  ourInterpretation: string;
  whatItBecame: string;
  hero: StoryMedia;
  /** Optional secondary media slots reserved for later assets */
  gallery?: StoryMedia[];
};

export type StoryGroup = {
  id: StoryGroupId;
  title: string;
};

export const storyGroups: StoryGroup[] = [
  { id: "celebrating-people", title: "Celebrating People" },
  { id: "building-communities", title: "Building Communities" },
  { id: "institutions-heritage", title: "Institutions & Heritage" },
  { id: "organisations-events", title: "Organisations & Events" },
  { id: "seasonal-personal-gifting", title: "Seasonal & Personal Gifting" },
];

function hero(slug: string, alt: string): StoryMedia {
  return {
    // TODO: replace with final photography/art at this path
    src: `/images/stories/${slug}/hero.jpg`,
    alt,
    isPlaceholder: true,
  };
}

export const stories: Story[] = [
  {
    slug: "thambi-100",
    title: "Thambi 100",
    groupId: "celebrating-people",
    summary: "Remembrance-day gift marking one hundred years of a remarkable life.",
    introduction: "Remembrance-day gift marking one hundred years of a remarkable life.",
    theStory: "A century of a life asked to be remembered with quiet dignity.",
    ourInterpretation:
      "We began with the person and the milestone, looking for a form that could hold remembrance without turning it into spectacle.",
    whatItBecame: "A remembrance-day gift shaped around that one-hundred-year life.",
    hero: hero("thambi-100", "Placeholder for Thambi 100 remembrance gift"),
  },
  {
    slug: "sruti-40",
    title: "Sruti 40",
    groupId: "celebrating-people",
    summary: "Celebrating four decades of music through commemorative creations.",
    introduction: "Celebrating four decades of music through commemorative creations.",
    theStory: "Forty years of music called for a celebration that felt worthy of the craft.",
    ourInterpretation:
      "We listened for the spirit of the music first, then considered which objects could carry that continuity.",
    whatItBecame: "Commemorative creations made for four decades of music.",
    hero: hero("sruti-40", "Placeholder for Sruti 40 commemorative creations"),
  },
  {
    slug: "dancer-gift-sets",
    title: "Dancer Gift Sets",
    groupId: "celebrating-people",
    summary: "Curated gifts celebrating dancers and artistic journeys.",
    introduction: "Curated gifts celebrating dancers and artistic journeys.",
    theStory: "Dancers and their journeys deserved gifts that recognised practice, devotion and artistry.",
    ourInterpretation:
      "We looked for a curated set that could honour movement and memory together.",
    whatItBecame: "Gift sets created for dancers and artistic journeys.",
    hero: hero("dancer-gift-sets", "Placeholder for dancer gift sets"),
  },
  {
    slug: "kumon-winner-gifts",
    title: "Kumon Winner Gifts",
    groupId: "building-communities",
    summary: "Recognition gifts celebrating student achievement.",
    introduction: "Recognition gifts celebrating student achievement.",
    theStory: "Student achievement within a learning community asked to be recognised with care.",
    ourInterpretation:
      "We sought a gift that could mark accomplishment while remaining personal to the student.",
    whatItBecame: "Recognition gifts for student achievement.",
    hero: hero("kumon-winner-gifts", "Placeholder for Kumon winner gifts"),
  },
  {
    slug: "kumon-delegate-gifting",
    title: "Kumon Delegate Gifting",
    groupId: "building-communities",
    summary: "Thoughtful delegate gifting for educators and learning communities.",
    introduction: "Thoughtful delegate gifting for educators and learning communities.",
    theStory: "Educators and learning communities gathered, and the occasion called for thoughtful gifting.",
    ourInterpretation:
      "We considered what would feel useful and considered in the hands of delegates who teach and guide.",
    whatItBecame: "Delegate gifting for educators and learning communities.",
    hero: hero("kumon-delegate-gifting", "Placeholder for Kumon delegate gifting"),
  },
  {
    slug: "sishyakulam",
    title: "Sishyakulam",
    groupId: "building-communities",
    summary: "Merchandise and keepsakes strengthening community identity.",
    introduction: "Merchandise and keepsakes strengthening community identity.",
    theStory: "A community wanted objects that could strengthen a shared sense of belonging.",
    ourInterpretation:
      "We began with identity and togetherness, then shaped merchandise and keepsakes around that feeling.",
    whatItBecame: "Merchandise and keepsakes for community identity.",
    hero: hero("sishyakulam", "Placeholder for Sishyakulam merchandise and keepsakes"),
  },
  {
    slug: "veeramakaliamman-temple-colouring-book",
    title: "Veeramakaliamman Temple Colouring Book",
    groupId: "institutions-heritage",
    summary: "Helping children experience a temple through illustration and creativity.",
    introduction: "Helping children experience a temple through illustration and creativity.",
    theStory: "A temple heritage asked to be opened gently to children through creativity.",
    ourInterpretation:
      "We looked toward illustration as a way for young hands and minds to enter the place with curiosity.",
    whatItBecame: "A colouring book inviting children into the temple through drawing.",
    hero: hero(
      "veeramakaliamman-temple-colouring-book",
      "Placeholder for Veeramakaliamman Temple colouring book",
    ),
  },
  {
    slug: "pycon-2025-happyfox",
    title: "PyCon 2025 for HappyFox",
    groupId: "organisations-events",
    summary: "Developer-focused event merchandise.",
    introduction: "Developer-focused event merchandise.",
    theStory: "A developer gathering needed merchandise that felt native to the community.",
    ourInterpretation:
      "We began with the culture of the event, then shaped merchandise for the people who would wear and carry it.",
    whatItBecame: "Event merchandise for PyCon 2025 with HappyFox.",
    hero: hero("pycon-2025-happyfox", "Placeholder for PyCon 2025 HappyFox merchandise"),
  },
  {
    slug: "photo-gauge-summer-care-pack",
    title: "Photo Gauge Summer Care Pack",
    groupId: "organisations-events",
    summary: "Seasonal employee appreciation.",
    introduction: "Seasonal employee appreciation.",
    theStory: "A team wanted a summer gesture of appreciation for the people behind the work.",
    ourInterpretation:
      "We shaped a seasonal pack around care and consideration rather than generic corporate gifting.",
    whatItBecame: "A summer care pack for employee appreciation.",
    hero: hero("photo-gauge-summer-care-pack", "Placeholder for Photo Gauge summer care pack"),
  },
  {
    slug: "barclays-team-award-badges",
    title: "Barclays Team Award Badges",
    groupId: "organisations-events",
    summary: "Recognition badges celebrating team achievement.",
    introduction: "Recognition badges celebrating team achievement.",
    theStory: "Team achievement asked for a mark of recognition that could be worn and kept.",
    ourInterpretation:
      "We focused on a badge form that could celebrate the team with clarity and restraint.",
    whatItBecame: "Recognition badges for team achievement.",
    hero: hero("barclays-team-award-badges", "Placeholder for Barclays team award badges"),
  },
  {
    slug: "private-diwali-hampers",
    title: "Private Diwali Hampers",
    groupId: "seasonal-personal-gifting",
    summary: "Curated festive gifting built around people rather than products.",
    introduction: "Curated festive gifting built around people rather than products.",
    theStory: "A private Diwali moment called for gifting that felt personal to the people receiving it.",
    ourInterpretation:
      "We began with the relationships and the season, then curated a hamper around that feeling.",
    whatItBecame: "Private Diwali hampers built around people rather than products.",
    hero: hero("private-diwali-hampers", "Placeholder for private Diwali hampers"),
  },
];

export function getStoryBySlug(slug: string): Story | undefined {
  return stories.find((story) => story.slug === slug);
}

export function getStoriesByGroup(groupId: StoryGroupId): Story[] {
  return stories.filter((story) => story.groupId === groupId);
}

export function getRelatedStories(story: Story, limit = 3): Story[] {
  const sameGroup = stories.filter((item) => item.groupId === story.groupId && item.slug !== story.slug);
  if (sameGroup.length >= limit) return sameGroup.slice(0, limit);
  const others = stories.filter((item) => item.slug !== story.slug && item.groupId !== story.groupId);
  return [...sameGroup, ...others].slice(0, limit);
}

export function getGroupTitle(groupId: StoryGroupId): string {
  return storyGroups.find((group) => group.id === groupId)?.title ?? groupId;
}

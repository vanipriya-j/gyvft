/**
 * Central storytelling portfolio content for GYVFT.
 *
 * Image paths follow docs/gyvft/case-studies.json under /images/gyvft/case-studies/.
 * Statuses: ready | review | reference-required (see docs/gyvft/review.md).
 */

export type StoryGroupId =
  | "celebrating-people"
  | "building-communities"
  | "institutions-heritage"
  | "organisations-events"
  | "seasonal-personal-gifting";

export type StoryStatus = "ready" | "review" | "reference-required";

export type StoryMedia = {
  src: string;
  alt: string;
  /**
   * True when no usable final image should be shown.
   * Forced for missing files and for reference-required entries in production.
   */
  isPlaceholder: boolean;
};

export type Story = {
  slug: string;
  title: string;
  groupId: StoryGroupId;
  status: StoryStatus;
  /** One-line listing summary */
  summary: string;
  /** Short introduction under the hero */
  introduction: string;
  theStory: string;
  ourInterpretation: string;
  whatItBecame: string;
  hero: StoryMedia;
  /** Editorial note for staging review */
  reviewNote?: string;
  /** What still needs to be supplied before publication */
  referenceNeeded?: string;
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

const CASE_BASE = "/images/gyvft/case-studies";

function heroFor(slug: string, alt: string): StoryMedia {
  const src = `${CASE_BASE}/${slug}/hero.png`;
  return {
    src,
    alt,
    // Resolved at render time in StoryMedia (server) so this module stays client-safe.
    isPlaceholder: false,
  };
}

export const stories: Story[] = [
  {
    slug: "thambi-100",
    title: "Thambi 100",
    groupId: "celebrating-people",
    status: "ready",
    summary: "Remembrance-day gift marking what would have been his 100th year.",
    introduction: "Remembrance-day gift marking what would have been his 100th year.",
    theStory:
      "A family wanted to remember Thambi on what would have been his hundredth year — after his death, not as a living birthday celebration.",
    ourInterpretation:
      "We began with quiet dignity: a form that could hold remembrance without turning it into spectacle.",
    whatItBecame: "A remembrance-day gift shaped around that one-hundred-year life.",
    hero: heroFor("thambi-100", "Thambi 100 remembrance gift"),
    reviewNote: "Commemorates what would have been his 100th year; never describe as a living centenarian celebration.",
  },
  {
    slug: "sruti-40",
    title: "Sruti 40",
    groupId: "celebrating-people",
    status: "ready",
    summary: "Celebrating four decades of music through commemorative creations.",
    introduction: "Celebrating four decades of music through commemorative creations.",
    theStory: "Forty years of music called for a celebration that felt worthy of the craft.",
    ourInterpretation:
      "We listened for the spirit of the music first, then considered which objects could carry that continuity.",
    whatItBecame: "Commemorative creations made for four decades of music.",
    hero: heroFor("sruti-40", "Sruti 40 commemorative creations"),
  },
  {
    slug: "various-dance-schools",
    title: "Various Dance Schools",
    groupId: "celebrating-people",
    status: "review",
    summary: "Logo-personalised Dance Class totes for multiple schools.",
    introduction:
      "An umbrella story about logo-personalised Dance Class totes made for dance schools — not a generic dancer gift set.",
    theStory:
      "Several dance schools needed everyday objects that could carry their identity into class and rehearsal.",
    ourInterpretation:
      "We treated each school’s logo as the starting point, shaping Dance Class totes that felt personal rather than generic merchandise.",
    whatItBecame:
      "Logo-personalised Dance Class totes for schools including Katakavardhana and Sri Lakshmi Narasimha Natyalaya, with further school executions under review.",
    hero: heroFor("various-dance-schools", "Dance Class totes for various dance schools"),
    reviewNote:
      "Approve schools/products and supply more actual executions if available. Chalanam currently has logo evidence only.",
  },
  {
    slug: "kumon-winner-gifts",
    title: "Kumon Winner Gifts",
    groupId: "building-communities",
    status: "review",
    summary: "Recognition gifts celebrating student achievement.",
    introduction: "Recognition gifts celebrating student achievement.",
    theStory: "Student achievement within a learning community asked to be recognised with care.",
    ourInterpretation:
      "We sought a gift that could mark accomplishment while remaining personal to the student.",
    whatItBecame: "Recognition gifts for student achievement.",
    hero: heroFor("kumon-winner-gifts", "Kumon winner gifts"),
    reviewNote:
      "Temporarily shares available Kumon imagery for staging. Confirm it is separate from Delegate Gifting before publication.",
  },
  {
    slug: "kumon-delegate-gifting",
    title: "Kumon Delegate Gifting",
    groupId: "building-communities",
    status: "ready",
    summary: "Thoughtful delegate gifting for educators and learning communities.",
    introduction: "Thoughtful delegate gifting for educators and learning communities.",
    theStory: "Educators and learning communities gathered, and the occasion called for thoughtful gifting.",
    ourInterpretation:
      "We assembled a guest hamper around useful, considered objects rather than generic conference swag.",
    whatItBecame:
      "Delegate gifting including a personalised note card, elephant tray, Mayil 15×17-inch tote and Chennai magnet.",
    hero: heroFor("kumon-delegate-gifting", "Kumon delegate gifting hamper"),
    reviewNote:
      "Retain the actual note card, elephant tray, Mayil 15×17-inch tote and Chennai magnet. Do not alter product proportions or place the Durai Adithya magnet inside Aarohana’s bag.",
  },
  {
    slug: "various-music-schools",
    title: "Various Music Schools",
    groupId: "building-communities",
    status: "review",
    summary: "Merchandise and keepsakes strengthening music-school identity.",
    introduction:
      "A portfolio of merchandise and keepsakes made with and for music schools — each product mapped to the school it belongs to.",
    theStory:
      "Music schools wanted objects that could strengthen belonging for students, teachers and visiting communities.",
    ourInterpretation:
      "We kept each school’s products distinct, claiming only the mappings confirmed in the editorial review.",
    whatItBecame:
      "Totes, magnets, T-shirts and keychains across Sishyakulam, Sunaadalahari, Gaana Vinyasa, Ninaad, Kala Sannidhi, Sugam Karnatica, Subha Santhosh and Sunada Bharathi.",
    hero: heroFor("various-music-schools", "Merchandise for various music schools"),
    reviewNote:
      "Preserve product-to-school mappings from docs/gyvft/review.md; do not reassign products between schools.",
  },
  {
    slug: "veeramakaliamman-temple-colouring-book",
    title: "Veeramakaliamman Temple Colouring Book",
    groupId: "institutions-heritage",
    status: "reference-required",
    summary: "Helping children experience a temple through illustration and creativity.",
    introduction: "Helping children experience a temple through illustration and creativity.",
    theStory: "A temple heritage asked to be opened gently to children through creativity.",
    ourInterpretation:
      "We looked toward illustration as a way for young hands and minds to enter the place with curiosity.",
    whatItBecame: "A colouring book inviting children into the temple through drawing.",
    hero: heroFor(
      "veeramakaliamman-temple-colouring-book",
      "Veeramakaliamman Temple colouring book",
    ),
    referenceNeeded: "Final cover and representative interior spreads or project photographs.",
  },
  {
    slug: "pycon-2025-happyfox",
    title: "PyCon 2025 for HappyFox",
    groupId: "organisations-events",
    status: "ready",
    summary: "Developer-focused event merchandise.",
    introduction: "Developer-focused event merchandise.",
    theStory: "A developer gathering needed merchandise that felt native to the community.",
    ourInterpretation:
      "We began with the culture of the event, then shaped merchandise for the people who would wear and carry it.",
    whatItBecame: "Event merchandise for PyCon 2025 with HappyFox.",
    hero: heroFor("pycon-2025-happyfox", "PyCon 2025 HappyFox merchandise"),
  },
  {
    slug: "photo-gauge-summer-care-pack",
    title: "Photo Gauge Summer Care Pack",
    groupId: "organisations-events",
    status: "reference-required",
    summary: "Seasonal employee appreciation.",
    introduction: "Seasonal employee appreciation.",
    theStory: "A team wanted a summer gesture of appreciation for the people behind the work.",
    ourInterpretation:
      "We shaped a seasonal pack around care and consideration rather than generic corporate gifting.",
    whatItBecame: "A summer care pack for employee appreciation.",
    hero: heroFor("photo-gauge-summer-care-pack", "Photo Gauge summer care pack"),
    referenceNeeded: "Actual care-pack contents, packaging, insert card or presentation photographs.",
  },
  {
    slug: "natwest-team-event-badges",
    title: "NatWest Team Event Badges",
    groupId: "organisations-events",
    status: "ready",
    summary: "Recognition badges made for a NatWest team event.",
    introduction: "Recognition badges made for a NatWest team event.",
    theStory: "A NatWest team event asked for a mark of recognition that could be worn and kept.",
    ourInterpretation:
      "We focused on a badge form that could celebrate the team with clarity and restraint.",
    whatItBecame: "Team-event badges for NatWest.",
    hero: heroFor("natwest-team-event-badges", "NatWest team event badges"),
    reviewNote: "Remove all Barclays naming; this project was NatWest team-event badges.",
  },
  {
    slug: "private-diwali-hampers",
    title: "Private Diwali Hampers",
    groupId: "seasonal-personal-gifting",
    status: "reference-required",
    summary: "Curated festive gifting built around people rather than products.",
    introduction: "Curated festive gifting built around people rather than products.",
    theStory: "A private Diwali moment called for gifting that felt personal to the people receiving it.",
    ourInterpretation:
      "We began with the relationships and the season, then curated a hamper around that feeling.",
    whatItBecame: "Private Diwali hampers built around people rather than products.",
    hero: heroFor("private-diwali-hampers", "Private Diwali hampers"),
    referenceNeeded: "Actual hamper contents, packaging, note card or recipient photographs.",
  },
  {
    slug: "chinmay-brand-identity",
    title: "Chinmay — Brand Identity",
    groupId: "organisations-events",
    status: "ready",
    summary: "A branding project for Chinmay.",
    introduction: "A branding project — identity work, not a gifting hamper.",
    theStory: "Chinmay needed a clear visual identity that could carry across materials and moments.",
    ourInterpretation:
      "We treated this as branding first: language, mark and system before any object.",
    whatItBecame: "Brand identity work for Chinmay.",
    hero: heroFor("chinmay-brand-identity", "Chinmay brand identity"),
    reviewNote: "Position as a branding project, not as a gifting hamper.",
  },
  {
    slug: "bits-2001-reunion",
    title: "BITS 2001 Reunion Yearbook",
    groupId: "building-communities",
    status: "review",
    summary: "A reunion yearbook for the BITS 2001 batch.",
    introduction: "A reunion yearbook gathering a batch’s shared years into one keepable volume.",
    theStory: "The BITS 2001 batch wanted a yearbook that could hold reunion memory with care.",
    ourInterpretation:
      "We began with the batch’s story and shaped a publication that could travel home with everyone.",
    whatItBecame: "A reunion yearbook for BITS 2001.",
    hero: heroFor("bits-2001-reunion", "BITS 2001 reunion yearbook"),
    reviewNote: "Interim visual; may be replaced. Approve scope before publication.",
  },
  {
    slug: "tm-karthik-crew-gifting",
    title: "TM Karthik — Crew Gifting",
    groupId: "organisations-events",
    status: "ready",
    summary: "Recurring crew gifting across multiple productions.",
    introduction:
      "Recurring post-production gifting across The Father, Flowers, Aha Kalyanam and Meeting Mr Green.",
    theStory:
      "TM Karthik’s productions needed a thoughtful way to thank crews after the work was done.",
    ourInterpretation:
      "We framed this as a recurring practice — gifts that could return across plays rather than a one-off merch drop.",
    whatItBecame:
      "Crew gifting across The Father, Flowers, Aha Kalyanam and Meeting Mr Green.",
    hero: heroFor("tm-karthik-crew-gifting", "TM Karthik crew gifting"),
  },
  {
    slug: "jannal-oram",
    title: "Jannal Oram — Performance Merchandise",
    groupId: "organisations-events",
    status: "ready",
    summary: "Performance merchandise for Jannal Oram.",
    introduction: "Merchandise made for the Jannal Oram performance world.",
    theStory: "A performance needed objects that could travel with the audience beyond the evening.",
    ourInterpretation:
      "We stayed close to the approved project references and shaped merchandise around that world.",
    whatItBecame: "Performance merchandise for Jannal Oram.",
    hero: heroFor("jannal-oram", "Jannal Oram performance merchandise"),
  },
  {
    slug: "root360",
    title: "Root360 — Apparel Programme",
    groupId: "organisations-events",
    status: "ready",
    summary: "An organisation apparel and merchandise programme.",
    introduction: "An organisation apparel and merchandise programme for Root360.",
    theStory: "Root360 needed apparel that could carry organisational identity into everyday wear.",
    ourInterpretation:
      "We treated apparel as a programme — consistent, wearable, and true to the organisation.",
    whatItBecame: "An apparel and merchandise programme for Root360.",
    hero: heroFor("root360", "Root360 apparel programme"),
  },
  {
    slug: "cardiologist-visual-communication",
    title: "Cardiologist Visual Communication",
    groupId: "institutions-heritage",
    status: "ready",
    summary: "Visual communication for two distinct cardiology commissions.",
    introduction:
      "An umbrella story covering separate outputs for Dr Harapriya and Dr Saileela — kept distinct, not merged.",
    theStory:
      "Two cardiology commissions needed visual communication with clinical clarity and human warmth.",
    ourInterpretation:
      "We held the commissions apart: Little Hearts design for Dr Harapriya’s Mending Tiny Hearts Foundation, and technical diagrams for Dr Saileela’s paper.",
    whatItBecame:
      "Distinct visual outcomes for Dr Harapriya and Dr Saileela within one umbrella story.",
    hero: heroFor("cardiologist-visual-communication", "Cardiologist visual communication"),
    reviewNote: "Do not merge the two doctors or commissions into a single undifferentiated project.",
  },
];

/** Old slugs permanently redirected in next.config.ts */
export const storySlugRedirects: Record<string, string> = {
  "dancer-gift-sets": "various-dance-schools",
  sishyakulam: "various-music-schools",
  "barclays-team-award-badges": "natwest-team-event-badges",
};

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

/** Stories that still need editorial review or missing references (for handoff reports). */
export function getStoriesNeedingAttention(): Story[] {
  return stories.filter((story) => story.status !== "ready");
}

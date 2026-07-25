/**
 * Central image registry for the public website.
 * Paths point to locally hosted, optimised assets under public/images/aarla-source/.
 * See IMAGE_SOURCES.md for provenance and usage notes.
 */
const base = "/images/aarla-source/optimized";

export const publicMedia = {
  hero: {
    atmosphere: {
      src: `${base}/street-madras-coffee.jpg`,
      alt: "Warm street gathering with people sharing coffee and conversation",
    },
  },
  become: {
    gifts: {
      src: `${base}/gift-tumbler-bowl.jpg`,
      alt: "Green metal tumbler and bowl arranged as a gift set",
    },
    books: {
      src: `${base}/remember-drawing.jpg`,
      alt: "Illustrated scene of a grandmother and child drawing together",
    },
    merch: {
      src: `${base}/merch-nourish-kit.jpg`,
      alt: "Soft bag, bottle, and tiffin arranged as a merchandise kit",
    },
  },
  worlds: {
    celebrate: {
      src: `${base}/celebrate-gathering.jpg`,
      alt: "People gathered in a warmly lit doorway",
    },
    remember: {
      src: `${base}/remember-drawing.jpg`,
      alt: "Illustrated grandmother and child drawing together",
    },
    honour: {
      src: `${base}/honour-performance.jpg`,
      alt: "Classical dance performance with ghungroos in the foreground",
    },
    belong: {
      src: `${base}/street-madras-coffee.jpg`,
      alt: "Community gathering on a warm street",
    },
    build: {
      src: `${base}/merch-nourish-kit.jpg`,
      alt: "Curated kit of everyday objects made to share",
    },
  },
  transformation: {
    feature: {
      src: `${base}/honour-performance.jpg`,
      alt: "A performance moment that becomes a keepable story object",
    },
  },
  organisations: {
    kit: {
      src: `${base}/merch-nourish-kit.jpg`,
      alt: "Bag, bottle, and tiffin kit for organisational merchandise",
    },
  },
} as const;

export type PublicMediaImage = {
  src: string;
  alt: string;
};

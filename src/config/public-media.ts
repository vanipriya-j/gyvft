/**
 * Central image registry for the public website.
 * Paths follow docs/gyvft/homepage.json under /images/gyvft/homepage/.
 * Until those files are present, pages fall back via PublicImage / legacy paths
 * kept here as `fallbackSrc` for server components that need a guaranteed file.
 */
const base = "/images/gyvft/homepage";
const legacy = "/images/aarla-source/optimized";

export const publicMedia = {
  brand: {
    logo: {
      src: "/images/brand/gyvft-logo.png",
      alt: "GYVFT",
    },
  },
  hero: {
    atmosphere: {
      src: `${base}/01-home-hero_01.png`,
      alt: "Warm gathering atmosphere for the GYVFT homepage hero",
    },
  },
  become: {
    gifts: {
      src: `${base}/02-gifts-keepsakes.png`,
      fallbackSrc: `${legacy}/gift-tumbler-bowl.jpg`,
      alt: "Gifts and keepsakes arranged as a story-led set",
    },
    books: {
      src: `${base}/03-books-publications.png`,
      fallbackSrc: `${legacy}/remember-drawing.jpg`,
      alt: "Books and publications made from memory",
    },
    merch: {
      src: `${base}/04-merchandise-kits.png`,
      fallbackSrc: `${legacy}/merch-nourish-kit.jpg`,
      alt: "Merchandise and kits that carry a story",
    },
  },
  worlds: {
    celebrate: {
      src: `${base}/05-celebrate.png`,
      fallbackSrc: `${legacy}/celebrate-gathering.jpg`,
      alt: "Celebrate — joy made tangible",
    },
    remember: {
      src: `${base}/06-remember.png`,
      fallbackSrc: `${legacy}/remember-drawing.jpg`,
      alt: "Remember — family histories and private milestones",
    },
    honour: {
      src: `${base}/07-honour.png`,
      fallbackSrc: `${legacy}/honour-performance.jpg`,
      alt: "Honour — performance and devotion",
    },
    belong: {
      src: `${base}/08-belong.png`,
      fallbackSrc: `${legacy}/street-madras-coffee.jpg`,
      alt: "Belong — community gathering",
    },
    build: {
      src: `${base}/09-build-together.png`,
      fallbackSrc: `${legacy}/merch-nourish-kit.jpg`,
      alt: "Build together — shared objects",
    },
  },
  transformation: {
    feature: {
      src: `${base}/10-performance-to-keepsake.png`,
      fallbackSrc: `${legacy}/honour-performance.jpg`,
      alt: "A performance moment that becomes a keepable story object",
    },
  },
  organisations: {
    home: {
      src: `${base}/14-for-organisations.png`,
      fallbackSrc: `${legacy}/merch-nourish-kit.jpg`,
      alt: "For organisations — story-led merchandise",
    },
    kit: {
      src: `${base}/for-organisations.png`,
      fallbackSrc: `${legacy}/merch-nourish-kit.jpg`,
      alt: "Organisation merchandise and kits",
    },
  },
} as const;

export type PublicMediaImage = {
  src: string;
  alt: string;
  fallbackSrc?: string;
};

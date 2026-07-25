/**
 * Central image registry for the public website.
 *
 * Replace these temporary Unsplash placeholders with owned GYVFT assets later.
 * Keep keys stable so page components do not need structural edits.
 */
export const publicMedia = {
  hero: {
    book: {
      src: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=1200&q=80",
      alt: "Open hardcover book with warm paper pages",
    },
    giftBox: {
      src: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1200&q=80",
      alt: "Wrapped gift box with ribbon",
    },
    merchandise: {
      src: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80",
      alt: "Folded apparel and merchandise textures",
    },
    framed: {
      src: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1200&q=80",
      alt: "Framed illustrated art print",
    },
    keepsake: {
      src: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=1200&q=80",
      alt: "Ribbon and keepsake packaging details",
    },
  },
  expressions: {
    books: {
      src: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1400&q=80",
      alt: "Stack of richly coloured hardback books",
    },
    gifts: {
      src: "https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?auto=format&fit=crop&w=1400&q=80",
      alt: "Gift wrap, paper, and ribbon textures",
    },
    merch: {
      src: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1400&q=80",
      alt: "Soft textile merchandise close-up",
    },
    events: {
      src: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1400&q=80",
      alt: "Celebration table styling with florals and objects",
    },
    culture: {
      src: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1400&q=80",
      alt: "Gallery wall of framed artworks",
    },
    celebrations: {
      src: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1400&q=80",
      alt: "Festive celebration details with colour and texture",
    },
  },
  textures: {
    paper: {
      src: "https://images.unsplash.com/photo-1604186838328-41f2f0af3d3a?auto=format&fit=crop&w=1600&q=80",
      alt: "Handmade paper texture",
    },
    ribbon: {
      src: "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=1200&q=80",
      alt: "Satin ribbon close-up",
    },
    box: {
      src: "https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=1200&q=80",
      alt: "Open gift box with soft tissue",
    },
  },
  organisations: {
    kit: {
      src: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1400&q=80",
      alt: "Curated product kit and packaging",
    },
  },
} as const;

export type PublicMediaImage = {
  src: string;
  alt: string;
};

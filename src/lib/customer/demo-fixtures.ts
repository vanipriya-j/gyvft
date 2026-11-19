import "server-only";
import { createHash } from "node:crypto";
export const demoKey = (s: string) => {
  const h = createHash("sha256").update(`gyvft-demo-v1:${s}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4000-8000-${h.slice(20, 32)}`;
};
export const demoScenarios = {
  single: {
    people: [
      ["Ananya", "Friend", "Coffee, reading and quiet mornings"],
      ["Amma", "Family", "Gardening and Carnatic music"],
    ],
    active: [["A birthday gift for Ananya", 3, 1, 7]],
    past: [
      "A thank-you for a helpful friend",
      "Amma’s birthday coffee ritual",
      "A little Diwali warmth",
    ],
    occasions: [
      "Ananya’s birthday",
      "Amma’s birthday",
      "A friendship anniversary",
    ],
  },
  business: {
    people: [
      [
        "Nila",
        "Meridian Studio · People team",
        "Illustration and sustainable stationery",
      ],
      ["Vikram", "Meridian Studio · Design team", "Coffee and architecture"],
      ["Sana", "Meridian Studio · New joiner", "Journaling and plants"],
      ["Rohit", "Meridian Studio · Client", "Travel and useful keepsakes"],
      ["Priya", "Meridian Studio · Leadership", "Books and meaningful design"],
      ["Dev", "Meridian Studio · Operations", "Practical everyday accessories"],
    ],
    active: [
      ["A warm welcome for our new team", 3, 12, 12],
      ["Thanking our client partners", 8, 25, 5],
      ["Celebrating five years together", 6, 18, 18],
    ],
    past: [
      "New joiner welcome kits",
      "Meridian’s annual day",
      "A thank-you to our mentors",
      "A festive note for the team",
      "Partner appreciation gifts",
    ],
    occasions: [
      "December onboarding",
      "Studio founding day",
      "Team service anniversaries",
      "Client partner gathering",
      "New year with the team",
    ],
  },
  communities: {
    people: [
      ["Leela", "Alumni network", "Shared memories and campus stories"],
      ["Aditya", "Alumni network", "Cricket and travel"],
      ["Farah", "Book club", "Literary fiction and illustrated art"],
      ["Karthik", "Book club", "Coffee and history"],
      ["Revathi", "Neighbourhood", "Gardening and local crafts"],
      ["Ashwin", "Neighbourhood", "Cycling and community events"],
      ["Maya", "Family", "Music and hand-written messages"],
    ],
    active: [
      ["Keepsakes for our alumni reunion", 3, 30, 21],
      ["A year of stories with our book club", 5, 14, 15],
      ["A small thank-you to our neighbours", 2, 20, 28],
    ],
    past: [
      "Our neighbourhood’s festive gathering",
      "A farewell for our book-club host",
      "Alumni volunteers, with gratitude",
      "Community reading-day keepsakes",
      "A thank-you to our gardening circle",
    ],
    occasions: [
      "Alumni reunion",
      "Book club anniversary",
      "Neighbourhood gathering",
      "Community reading day",
      "Volunteer appreciation",
      "Maya’s birthday",
    ],
  },
  family: {
    people: [
      ["Appa", "Family · Father", "Filter coffee and old film music"],
      ["Amma", "Family · Mother", "Gardening and devotional music"],
      ["Tara", "Family · Daughter", "Space, drawing and bright colours"],
      ["Arjun", "Family · Brother", "Cycling and travel"],
      ["Isha", "Friends", "Books and pottery"],
      ["Ravi", "Friends", "Coffee and cricket"],
      ["Paati", "Family · Grandmother", "Family photographs and flowers"],
    ],
    active: [
      ["Appa’s sixtieth, with all our love", 4, 10, 14],
      ["Little keepsakes for Tara’s birthday friends", 1, 24, 25],
    ],
    past: [
      "Amma’s garden-inspired birthday",
      "Our anniversary, in little memories",
      "A welcome for a new home",
      "Tara’s last birthday return gifts",
      "Diwali with our extended family",
      "Paati’s favourite family moments",
    ],
    occasions: [
      "Appa’s sixtieth birthday",
      "Tara’s birthday",
      "Amma’s birthday",
      "Our wedding anniversary",
      "Arjun’s birthday",
      "Paati’s birthday",
    ],
  },
} as const;

export const demoOccasionContexts = {
  single: [
    { person: 0, relationship: "Friend" },
    { person: 1, relationship: "Family" },
    { person: 0, relationship: "Friend" },
  ],
  business: Array.from({ length: 5 }, () => ({
    person: null,
    relationship: "Meridian Studio",
  })),
  communities: [
    { person: 0, relationship: "Alumni network" },
    { person: 2, relationship: "Book club" },
    { person: 4, relationship: "Neighbourhood" },
    { person: 3, relationship: "Book club" },
    { person: 5, relationship: "Neighbourhood" },
    { person: 6, relationship: "Family" },
  ],
  family: [
    { person: 0, relationship: "Family · Father" },
    { person: 2, relationship: "Family · Daughter" },
    { person: 1, relationship: "Family · Mother" },
    { person: null, relationship: "Family" },
    { person: 3, relationship: "Family · Brother" },
    { person: 6, relationship: "Family · Grandmother" },
  ],
} satisfies Record<string, { person: number | null; relationship: string }[]>;

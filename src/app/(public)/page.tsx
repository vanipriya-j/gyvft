import type { Metadata } from "next";
import { CustomerHomepage } from "@/components/public/customer-homepage";

export const metadata: Metadata = {
  title: "Gifts that feel like them",
  description:
    "Keep your people and occasions together, explore gifts curated by Aarla, and make every gift feel personal. Create your GYVFT account.",
  openGraph: {
    title: "GYVFT — You know them. Let’s gift like it.",
    description:
      "Your people, their moments, and gifts that mean something. A little space for more thoughtful gifting, with Aarla by your side.",
    images: [
      {
        url: "/website-review/diwali-gifting.webp",
        width: 1200,
        height: 900,
        alt: "Aarla’s festive gifts and keepsakes",
      },
    ],
  },
};

export default function HomePage() {
  return <CustomerHomepage />;
}

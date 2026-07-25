import type { Metadata } from "next";
import { Fraunces, Newsreader, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-brand",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "GYVFT — Your story. Our telling.",
    template: "%s — GYVFT",
  },
  description:
    "We turn people, milestones and memories into gifts, books, merchandise and experiences.",
  openGraph: {
    title: "GYVFT — Your story. Our telling.",
    description:
      "We turn people, milestones and memories into gifts, books, merchandise and experiences.",
    siteName: "GYVFT",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${fraunces.variable} ${newsreader.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}

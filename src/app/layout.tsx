import type { Metadata } from "next";
import { Inter, PT_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const ptSerif = PT_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
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
      className={`${inter.variable} ${ptSerif.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}

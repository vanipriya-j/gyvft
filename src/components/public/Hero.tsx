"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ButtonLink } from "@/components/ui/button";
import { publicMedia } from "@/config/public-media";

const collage = [
  {
    ...publicMedia.hero.book,
    className: "left-[4%] top-[8%] h-[42%] w-[34%] -rotate-6",
    delay: 0.1,
  },
  {
    ...publicMedia.hero.giftBox,
    className: "right-[6%] top-[4%] h-[36%] w-[30%] rotate-5",
    delay: 0.18,
  },
  {
    ...publicMedia.hero.merchandise,
    className: "bottom-[10%] left-[10%] h-[34%] w-[28%] rotate-3",
    delay: 0.26,
  },
  {
    ...publicMedia.hero.framed,
    className: "bottom-[8%] right-[8%] h-[40%] w-[32%] -rotate-3",
    delay: 0.34,
  },
  {
    ...publicMedia.hero.keepsake,
    className: "left-[38%] top-[34%] h-[30%] w-[24%] rotate-2",
    delay: 0.42,
  },
] as const;

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative isolate min-h-[calc(100svh-4.5rem)] overflow-hidden bg-ink text-paper">
      <div className="absolute inset-0">
        <Image
          alt=""
          aria-hidden="true"
          className="object-cover opacity-30"
          fill
          priority
          sizes="100vw"
          src={publicMedia.textures.paper.src}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-ink via-plum/80 to-jade/50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(240,162,2,0.28),transparent_28rem)]" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:px-8 lg:py-20">
        <div className="relative z-10 max-w-2xl">
          <motion.p
            className="font-brand text-sm font-bold uppercase tracking-[0.36em] text-saffron"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            GYVFT
          </motion.p>
          <motion.h1
            className="mt-5 font-display text-5xl font-semibold leading-[0.92] tracking-[-0.05em] sm:text-7xl lg:text-8xl"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08 }}
          >
            Your story. Our telling.
          </motion.h1>
          <motion.p
            className="mt-6 max-w-xl text-lg leading-8 text-paper/82 sm:text-xl"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.16 }}
          >
            We turn people, milestones and memories into gifts, books, merchandise and experiences.
          </motion.p>
          <motion.div
            className="mt-9 flex flex-col gap-3 sm:flex-row"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.24 }}
          >
            <ButtonLink href="/tell-your-story">Tell us your story</ButtonLink>
            <ButtonLink
              className="border-paper/30 bg-transparent text-paper hover:border-saffron hover:bg-paper/10"
              href="/become-a-merch-partner"
              variant="secondary"
            >
              Make us your merch partner
            </ButtonLink>
          </motion.div>
        </div>

        <div className="relative mx-auto aspect-[5/6] w-full max-w-xl lg:max-w-none">
          <motion.div
            aria-hidden="true"
            className="absolute -left-6 top-8 h-28 w-28 rounded-full bg-coral/50 blur-2xl"
            animate={reduceMotion ? undefined : { y: [0, -12, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute bottom-10 right-0 h-32 w-32 rounded-full bg-saffron/40 blur-2xl"
            animate={reduceMotion ? undefined : { y: [0, 14, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          {collage.map((item) => (
            <motion.div
              key={item.src}
              className={`hero-collage-frame absolute overflow-hidden rounded-[1.4rem] ${item.className}`}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 18 }}
              animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: item.delay, ease: [0.22, 1, 0.36, 1] }}
            >
              <Image
                alt={item.alt}
                className="object-cover"
                fill
                priority
                sizes="(max-width: 1024px) 45vw, 22vw"
                src={item.src}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

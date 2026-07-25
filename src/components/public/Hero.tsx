"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { BrandLogo } from "@/components/public/BrandLogo";
import { ButtonLink } from "@/components/ui/button";
import { publicMedia } from "@/config/public-media";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative isolate min-h-[calc(100svh-4.5rem)] overflow-hidden">
      <div className="absolute inset-0">
        <Image
          alt={publicMedia.hero.atmosphere.alt}
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src={publicMedia.hero.atmosphere.src}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#f6f1e8]/94 via-[#f6f1e8]/78 to-[#f6f1e8]/28" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f6f1e8]/70 via-transparent to-[#f6f1e8]/35" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-7xl items-end px-5 pb-16 pt-24 lg:items-center lg:px-8 lg:pb-24 lg:pt-20">
        <div className="max-w-2xl">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <BrandLogo className="sm:hidden" height={36} priority />
            <BrandLogo className="hidden sm:block" height={48} priority />
          </motion.div>
          <motion.h1
            className="mt-4 font-display text-5xl leading-[1.02] tracking-[-0.02em] text-ink sm:text-6xl lg:text-7xl"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.06 }}
          >
            Your story. Our telling.
          </motion.h1>
          <motion.p
            className="mt-5 max-w-xl text-lg leading-8 text-muted-text sm:text-xl"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12 }}
          >
            We turn people, milestones and memories into gifts, books, merchandise and experiences.
          </motion.p>
          <motion.div
            className="mt-8 flex flex-col gap-3 sm:flex-row"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18 }}
          >
            <ButtonLink href="/tell-your-story">Tell us your story</ButtonLink>
            <ButtonLink href="/become-a-merch-partner" variant="secondary">
              Make us your merch partner
            </ButtonLink>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

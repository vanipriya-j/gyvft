"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ButtonLink } from "@/components/ui/button";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="ink-gradient relative isolate min-h-[calc(100svh-4rem)] overflow-hidden text-paper">
      <motion.div
        aria-hidden="true"
        animate={reduceMotion ? undefined : { x: [0, 24, 0], y: [0, -18, 0] }}
        className="absolute -right-28 top-10 h-80 w-80 rounded-full bg-copper/30 blur-3xl"
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        animate={reduceMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.35, 0.5, 0.35] }}
        className="absolute bottom-0 left-[-12rem] h-[28rem] w-[28rem] rounded-full bg-mist/25 blur-3xl"
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(251,247,238,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(251,247,238,0.06)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col justify-center px-5 py-24 lg:px-8">
        <motion.p
          className="text-sm font-semibold uppercase tracking-[0.34em] text-copper"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          GYVFT
        </motion.p>
        <motion.h1
          className="mt-7 max-w-5xl font-display text-6xl font-semibold leading-[0.9] tracking-[-0.06em] sm:text-7xl lg:text-9xl"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.08 }}
        >
          Your story. Our telling.
        </motion.h1>
        <motion.p
          className="mt-8 max-w-2xl text-xl leading-8 text-paper/76 sm:text-2xl"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.18 }}
        >
          We turn personal milestones, institutional memory, and brand culture into objects,
          publications, films, and merchandise people want to keep.
        </motion.p>
        <motion.div
          className="mt-10 flex flex-col gap-4 sm:flex-row"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.28 }}
        >
          <ButtonLink href="/tell-your-story">Tell us your story</ButtonLink>
          <ButtonLink href="/become-a-merch-partner" variant="secondary">
            Make us your merch partner
          </ButtonLink>
        </motion.div>
      </div>
    </section>
  );
}

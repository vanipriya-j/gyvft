"use client";

import { useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, Check, Gift, Heart, Play, Users, X } from "lucide-react";
import styles from "./customer-homepage.module.css";

const films = {
  story: {
    title: "You know the person. Why is finding their gift so hard?",
    description:
      "The GYVFT story, in 65 seconds. The film includes on-screen text.",
    file: "/website-review/gyvft-your-story.mp4",
    source:
      "https://drive.google.com/file/d/1QH-fy3S12JQq4ImBJkIJvrsky9FIUgch/view",
    poster: "/website-review/film-poster.jpg",
  },
  solution: {
    title: "GYVFT — for you, your people and your organisation",
    description:
      "See how a thoughtful intention becomes a personal gift, with Aarla’s help.",
    file: "/website-review/gyvft-how-it-works.mp4",
    source:
      "https://docs.google.com/videos/d/1QoGE-DeP817FJ1AayzLX4dHAY4pb3yqYUI1W-DW-7jU/play",
    poster: "/website-review/solution-poster.jpg",
  },
};

export function FilmButton({
  film = "story",
  children,
  className,
}: {
  film?: keyof typeof films;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const selected = films[film];
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setFailed(false);
      }}
    >
      <Dialog.Trigger className={className}>
        <Play size={16} fill="currentColor" aria-hidden="true" />
        {children}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.filmOverlay} />
        <Dialog.Content className={styles.filmDialog}>
          <div className={styles.filmHeading}>
            <Dialog.Title>{selected.title}</Dialog.Title>
            <Dialog.Close aria-label="Close film" className={styles.closeFilm}>
              <X size={22} />
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.filmDescription}>
            {selected.description}
          </Dialog.Description>
          {open && (
            <video
              key={film}
              controls
              autoPlay
              playsInline
              preload="none"
              poster={selected.poster}
              aria-label={selected.title}
              onError={() => setFailed(true)}
            >
              <source src={selected.file} type="video/mp4" />
              {film === "solution" && (
                <track
                  kind="captions"
                  src="/website-review/solution.en.vtt"
                  srcLang="en"
                  label="English"
                  default
                />
              )}
              Your browser does not support this video. Use the original film
              link below.
            </video>
          )}
          <p
            className={styles.filmFallback}
            role={failed ? "alert" : undefined}
          >
            {failed
              ? "The film could not load. "
              : "Prefer to watch separately? "}
            <a href={selected.source} target="_blank" rel="noopener noreferrer">
              Open the original film{" "}
              <span className={styles.srOnly}>(opens in a new tab)</span>
            </a>
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const tabs = [
  { name: "Your gifts", icon: Gift },
  { name: "Occasions", icon: CalendarDays },
  { name: "Circles", icon: Users },
] as const;

export function WorkspacePreview() {
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState("daily");
  return (
    <div className={styles.workspace}>
      <div className={styles.workspaceTop}>
        <span className={styles.workspaceBrand}>
          My GYVFT<span className={styles.brandStar}>✳</span>
        </span>
        <span className={styles.exampleLabel}>An example of your space</span>
      </div>
      <div
        className={styles.previewTabs}
        role="tablist"
        aria-label="Explore your GYVFT space"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.name}
            type="button"
            role="tab"
            id={`preview-tab-${index}`}
            aria-controls={`preview-panel-${index}`}
            aria-selected={active === index}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              let next = active;
              if (event.key === "ArrowRight") next = (active + 1) % tabs.length;
              else if (event.key === "ArrowLeft")
                next = (active + tabs.length - 1) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              setActive(next);
              document.getElementById(`preview-tab-${next}`)?.focus();
            }}
          >
            <tab.icon size={16} aria-hidden="true" />
            {tab.name}
          </button>
        ))}
      </div>
      <div
        className={styles.previewPanel}
        role="tabpanel"
        tabIndex={0}
        id={`preview-panel-${active}`}
        aria-labelledby={`preview-tab-${active}`}
      >
        {active === 0 && (
          <>
            <div className={styles.previewTitle}>
              <div>
                <p>A birthday, made personal</p>
                <h3>Something for Amma.</h3>
              </div>
              <span className={styles.pill}>2 options ready</span>
            </div>
            <p className={styles.previewIntro}>
              Useful little things. Beautiful details. A note that makes her
              smile.
            </p>
            <fieldset className={styles.optionGrid}>
              <legend className={styles.srOnly}>
                Try choosing a gift in this example
              </legend>
              {[
                {
                  id: "daily",
                  label: "Everyday favourites",
                  detail: "Little things for her everyday rituals",
                  image: "merch-nourish-kit",
                },
                {
                  id: "keepsake",
                  label: "A little keepsake",
                  detail: "Something lovely for her table",
                  image: "gift-tumbler-bowl",
                },
              ].map((option) => (
                <label
                  className={`${styles.sampleOption} ${chosen === option.id ? styles.selectedOption : ""}`}
                  key={option.id}
                >
                  <input
                    type="radio"
                    name="sample-gift"
                    value={option.id}
                    checked={chosen === option.id}
                    onChange={() => setChosen(option.id)}
                  />
                  <Image
                    src={`/images/aarla-source/optimized/${option.image}.jpg`}
                    width={600}
                    height={450}
                    sizes="(max-width: 600px) 40vw, 240px"
                    alt=""
                  />
                  <span className={styles.optionCopy}>
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </span>
                  <span className={styles.optionCheck} aria-hidden="true">
                    {chosen === option.id && (
                      <Check size={13} strokeWidth={3} />
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
            <p className={styles.previewHint} aria-live="polite">
              <Check size={15} aria-hidden="true" />
              {chosen === "daily"
                ? "Everyday favourites"
                : "A little keepsake"}{" "}
              selected in this example. Make your own choice—or customise a
              copy.
            </p>
          </>
        )}
        {active === 1 && (
          <>
            <div className={styles.previewTitle}>
              <div>
                <p>Room for the moments that matter</p>
                <h3>A few things to look forward to.</h3>
              </div>
              <CalendarDays size={24} aria-hidden="true" />
            </div>
            <div className={styles.occasionList}>
              {[
                {
                  mon: "DEC",
                  day: "12",
                  title: "Amma’s birthday",
                  subtitle: "Family · Every year",
                  letter: "AM",
                  color: "rose",
                },
                {
                  mon: "DEC",
                  day: "20",
                  title: "A thank-you for the team",
                  subtitle: "Work · Year-end gathering",
                  letter: "MS",
                  color: "olive",
                },
                {
                  mon: "JAN",
                  day: "08",
                  title: "Our book club turns five",
                  subtitle: "Book club · Anniversary",
                  letter: "BC",
                  color: "peach",
                },
              ].map((occasion) => (
                <div className={styles.occasionRow} key={occasion.title}>
                  <span className={styles.dateTile}>
                    <small>{occasion.mon}</small>
                    <strong>{occasion.day}</strong>
                  </span>
                  <div>
                    <h4>{occasion.title}</h4>
                    <p>{occasion.subtitle}</p>
                  </div>
                  <span
                    className={`${styles.avatar} ${styles[occasion.color]}`}
                  >
                    {occasion.letter}
                  </span>
                </div>
              ))}
            </div>
            <p className={styles.previewHint}>
              <Heart size={15} aria-hidden="true" />
              An occasion can start with a date. The gift can come later.
            </p>
          </>
        )}
        {active === 2 && (
          <>
            <div className={styles.previewTitle}>
              <div>
                <p>For every part of your world</p>
                <h3>Your people belong here.</h3>
              </div>
              <Users size={24} aria-hidden="true" />
            </div>
            <div className={styles.circleGrid}>
              {[
                {
                  title: "Our family",
                  tag: "The people who feel like home",
                  initials: ["AM", "AP", "SR"],
                  color: "rose",
                },
                {
                  title: "The book club",
                  tag: "One more chapter together",
                  initials: ["RV", "NK", "SJ"],
                  color: "olive",
                },
              ].map((circle) => (
                <div className={styles.sampleCircle} key={circle.title}>
                  <div className={styles.avatarStack}>
                    {circle.initials.map((initials) => (
                      <span
                        className={`${styles.avatar} ${styles[circle.color]}`}
                        key={initials}
                      >
                        {initials}
                      </span>
                    ))}
                  </div>
                  <h4>{circle.title}</h4>
                  <p>{circle.tag}</p>
                  <span className={styles.circleMeta}>
                    People · Shared occasions
                  </span>
                </div>
              ))}
            </div>
            <p className={styles.previewHint}>
              <Heart size={15} aria-hidden="true" />
              Invite people when you’re ready. Sharing a profile is their
              choice.
            </p>
          </>
        )}
      </div>
      {tabs.map(
        (tab, index) =>
          index !== active && (
            <div
              key={tab.name}
              role="tabpanel"
              hidden
              id={`preview-panel-${index}`}
              aria-labelledby={`preview-tab-${index}`}
            />
          ),
      )}
    </div>
  );
}

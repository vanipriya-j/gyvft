import Image from "next/image";
import Link from "@/components/ui/navigation-link";
import {
  CalendarDays,
  Check,
  Gift,
  Heart,
  Sparkles,
  Users,
} from "lucide-react";
import { FilmButton, WorkspacePreview } from "./customer-homepage-interactions";
import styles from "./customer-homepage.module.css";

const signup = "/account/login?mode=signup";

export function CustomerHomepage() {
  return (
    <div className={styles.site}>
      <section
        className={`${styles.container} ${styles.hero}`}
        aria-labelledby="home-heading"
      >
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true">✳</span> For the people who matter
          </p>
          <h1 id="home-heading">
            You know them.
            <br />
            <span className={styles.heroPromise}>
              Give something that feels <em>like them.</em>
            </span>
          </h1>
          <p className={styles.heroDescription}>
            Their little quirks. Their big days. The things they love.
            <br className={styles.desktopBreak} /> Put those details at the
            heart of your next gift.
          </p>
          <p className={styles.heroPractical}>
            Keep their details and dates in GYVFT. Let Aarla help with the gift.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href={signup}>
              Create my GYVFT
            </Link>
            <FilmButton className={styles.filmButton}>
              Why GYVFT? <span className={styles.buttonMeta}>65 sec</span>
            </FilmButton>
          </div>
          <p className={styles.heroNote}>
            Start with one person. The gift can come later.
          </p>
        </div>
        <div className={styles.heroVisual}>
          <Image
            className={styles.heroImage}
            src="/website-review/diwali-gifting.webp"
            alt="Colourful Aarla Diwali tote, brass lamps, sweets and thoughtful keepsakes arranged as a gift"
            width={1200}
            height={900}
            sizes="(max-width: 760px) 100vw, 50vw"
            priority
          />
          <div className={styles.photoCaption}>
            <span>A little thought.</span>
            <span>A lasting connection.</span>
          </div>
          <div className={styles.momentCard}>
            <span className={styles.momentIcon}>
              <CalendarDays size={22} aria-hidden="true" />
            </span>
            <div>
              <small>There’s always someone to celebrate</small>
              <strong>A birthday. A reunion. A just-because.</strong>
            </div>
            <Heart
              className={styles.momentHeart}
              size={19}
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      <div
        className={`${styles.container} ${styles.promiseStrip}`}
        aria-label="What you can do with GYVFT"
      >
        <span>
          <CalendarDays size={18} aria-hidden="true" />
          Keep their special days close
        </span>
        <span>
          <Gift size={18} aria-hidden="true" />
          Choose from Aarla’s curated ideas
        </span>
        <span>
          <Heart size={18} aria-hidden="true" />
          Make every gift a little more personal
        </span>
      </div>

      <section
        className={`${styles.container} ${styles.productSection}`}
        id="your-space"
        aria-labelledby="space-heading"
      >
        <div className={styles.productCopy}>
          <p className={styles.eyebrow}>First, make a little space for them</p>
          <h2 id="space-heading">
            A home for your
            <br />
            <em>thoughtful side.</em>
          </h2>
          <p>
            A passing “I love that.” A birthday you don’t want to miss. Save the
            details in GYVFT, so you have somewhere to start when the next
            occasion comes around.
          </p>
          <ul className={styles.featureList}>
            <li>
              <Check size={17} aria-hidden="true" />
              <span>People notes that make gifts personal</span>
            </li>
            <li>
              <Check size={17} aria-hidden="true" />
              <span>Occasions you can plan around</span>
            </li>
            <li>
              <Check size={17} aria-hidden="true" />
              <span>Gift options, choices and updates in one place</span>
            </li>
          </ul>
          <FilmButton film="solution" className={styles.textFilmButton}>
            See how GYVFT helps
          </FilmButton>
          <p className={styles.previewInstruction}>
            Try the tabs to take a look inside.
          </p>
        </div>
        <WorkspacePreview />
      </section>

      <section
        className={styles.howSection}
        id="how-it-works"
        aria-labelledby="how-heading"
      >
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>
                Then, turn the thought into a gift
              </p>
              <h2 id="how-heading">
                From “what should I get?”
                <br />
                to <em>“this is so them.”</em>
              </h2>
            </div>
            <p>
              When you’re ready, share a little about them. Aarla brings the
              possibilities, and you choose what feels right.
            </p>
          </div>
          <div className={styles.steps}>
            <article>
              <span className={styles.stepIcon}>
                <Heart size={26} aria-hidden="true" />
              </span>
              <h3>Start with what you know.</h3>
              <p>
                Tell us who it’s for, what they love, your budget and when you
                need it.
              </p>
            </article>
            <article>
              <span className={styles.stepIcon}>
                <Sparkles size={26} aria-hidden="true" />
              </span>
              <h3>See what Aarla imagines.</h3>
              <p>
                Explore gift options curated around your brief. Choose a
                favourite or customise a copy.
              </p>
            </article>
            <article>
              <span className={styles.stepIcon}>
                <Gift size={26} aria-hidden="true" />
              </span>
              <h3>Make it theirs.</h3>
              <p>
                Review your quote and design before we make it. Keep the
                decisions and updates together in your account.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section
        className={`${styles.container} ${styles.storiesSection}`}
        id="gift-stories"
        aria-labelledby="stories-heading"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Here’s what that can become</p>
            <h2 id="stories-heading">
              Thoughtfulness you can <em>hold.</em>
            </h2>
          </div>
          <Link className={styles.textLink} href="/stories">
            More gifting stories
          </Link>
        </div>
        <div className={styles.storyGrid}>
          {[
            {
              image: "diwali-gifting",
              label: "For a festive hello",
              title: "A Diwali gift with a little more heart.",
              copy: "A considered collection, shaped around the people receiving it.",
              href: "/stories/private-diwali-hampers",
              alt: "A festive Aarla gift collection with a printed tote, lamps and sweets",
            },
            {
              image: "kumon-delegate-gifting",
              label: "For a community that gives so much",
              title: "A thoughtful thank-you for educators.",
              copy: "Personal notes and useful keepsakes, brought together for Kumon.",
              href: "/stories/kumon-delegate-gifting",
              alt: "Kumon delegate gifting with useful keepsakes and a personal note",
            },
            {
              image: "tm-karthik-crew-gifting",
              label: "For the people behind the scenes",
              title: "A curtain call for the whole crew.",
              copy: "Gifts that carry a production’s story beyond the final performance.",
              href: "/stories/tm-karthik-crew-gifting",
              alt: "Personalised gifts made for TM Karthik’s theatre crews",
            },
          ].map((story) => (
            <Link
              href={story.href}
              className={styles.storyCard}
              key={story.href}
            >
              <div className={styles.storyImage}>
                <Image
                  src={`/website-review/${story.image}.webp`}
                  width={1200}
                  height={900}
                  sizes="(max-width: 760px) 100vw, 33vw"
                  alt={story.alt}
                />
              </div>
              <p className={styles.storyLabel}>{story.label}</p>
              <h3>{story.title}</h3>
              <p>{story.copy}</p>
              <span className={styles.storyLink}>See the story</span>
            </Link>
          ))}
        </div>
      </section>

      <section
        className={`${styles.container} ${styles.circlesSection}`}
        id="your-people"
        aria-labelledby="people-heading"
      >
        <div className={styles.circleIllustration} aria-hidden="true">
          <div className={styles.peopleOrbit}>
            <span className={`${styles.personChip} ${styles.personOne}`}>
              Amma <span>♡</span>
            </span>
            <span className={`${styles.personChip} ${styles.personTwo}`}>
              The book club
            </span>
            <div className={styles.orbitCenter}>
              <Users size={37} />
              <span>Your people</span>
            </div>
            <span className={`${styles.personChip} ${styles.personThree}`}>
              Our team
            </span>
            <span className={`${styles.personChip} ${styles.personFour}`}>
              Old friends <span>✳</span>
            </span>
          </div>
        </div>
        <div>
          <p className={styles.eyebrow}>And it doesn’t stop with one person</p>
          <h2 id="people-heading">
            Some gifts say “I see you.”
            <br />
            Others say <em>“we belong.”</em>
          </h2>
          <p>
            Keep close to family and friends. Bring your book club, alumni group
            or team into a Circle. Share occasions and invite people to tell you
            a little about themselves.
          </p>
          <p className={styles.circlesNote}>
            Start on your own. Circles are there whenever you need them. Your
            gifts and private notes stay yours.
          </p>
          <div className={styles.inlineActions}>
            <Link href={signup} className={styles.oliveButton}>
              Create my GYVFT
            </Link>
            <Link href="/account/gifts/new" className={styles.textLink}>
              Start a team gift
            </Link>
          </div>
        </div>
      </section>

      <section
        className={`${styles.container} ${styles.savingSection}`}
        id="aarla-benefit"
        aria-labelledby="saving-heading"
      >
        <div className={styles.savingMark}>
          5<span>%</span>
        </div>
        <div>
          <p className={styles.eyebrow}>Your GYVFT extra</p>
          <h2 id="saving-heading">5% at Aarla. Every time.</h2>
          <p>Enjoy 5% off every time you shop at Aarla through GYVFT.</p>
          <p className={styles.savingTerms}>
            Each code is single-use and valid for 24 hours. Use your account
            email at Aarla checkout. For eligible Aarla store purchases;
            separate from custom gift quotes.
          </p>
        </div>
        <Link className={styles.outlineButton} href="/account/shop?to=%2F">
          Shop through GYVFT
        </Link>
      </section>

      <section
        className={`${styles.container} ${styles.faqSection}`}
        id="faqs"
        aria-labelledby="questions-heading"
      >
        <div>
          <p className={styles.eyebrow}>FAQs</p>
          <h2 id="questions-heading">
            Questions before
            <br />
            <em>you join?</em>
          </h2>
        </div>
        <div className={styles.faqList}>
          <details>
            <summary>Can I use the Aarla saving every time I shop?</summary>
            <p>
              Yes. Your 5% saving is an ongoing GYVFT benefit. Start your Aarla
              shopping through your GYVFT account each time. We reuse your
              available code or prepare a new one if it has been used or has
              expired. Each code is for you, works once and is valid for 24
              hours. This applies to eligible Aarla store purchases, separately
              from custom gift quotes.
            </p>
          </details>
          <details>
            <summary>Do I need a gift in mind to join?</summary>
            <p>
              No. Start by adding someone you care about, noting an upcoming
              occasion, or saving an idea. When you’re ready to gift, Aarla can
              help you find the right direction.
            </p>
          </details>
          <details>
            <summary>Can I gift for just one person?</summary>
            <p>
              Absolutely. Start with a gift for one person, or tell us about a
              family gathering, community celebration or team. Share your
              quantity and budget in your brief so we can explore what fits.
            </p>
          </details>
          <details>
            <summary>Who comes up with the gift options?</summary>
            <p>
              Aarla curates options around your brief. You can choose a
              recommendation, customise a copy, or ask for another direction.
              Your account keeps those choices and conversations together.
            </p>
          </details>
          <details>
            <summary>Do I have to create a Circle?</summary>
            <p>
              No. Your account works for your own gifting. Circles are optional
              spaces for families, friends, communities and teams. People join
              by invitation and choose whether to share their profile.
            </p>
          </details>
          <details>
            <summary>What happens after I choose a gift?</summary>
            <p>
              You review the quote and any design approvals in your gift’s
              workspace before production. Aarla then handles making and packing
              your gifts, and coordinates delivery with you.
            </p>
          </details>
        </div>
      </section>

      <section className={styles.finalSection} aria-labelledby="join-heading">
        <div className={styles.container}>
          <span className={styles.finalFlower} aria-hidden="true">
            ✳
          </span>
          <p className={styles.eyebrow}>
            Someone just came to mind, didn’t they?
          </p>
          <h2 id="join-heading">
            Start with <em>them.</em>
          </h2>
          <p>
            Add someone you care about. Keep a little note, save their special
            day, or start a gift. Make the space your own.
          </p>
          <Link className={styles.primaryButton} href={signup}>
            Create my GYVFT
          </Link>
          <p className={styles.finalSignin}>
            Already have a space here?{" "}
            <Link href="/account/login">Sign in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

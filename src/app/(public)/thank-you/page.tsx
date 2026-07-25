import { ButtonLink } from "@/components/ui/button";

export const metadata = {
  title: "Thank you",
};

export default function ThankYouPage() {
  return (
    <section className="gift-shell px-5 py-28 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[2rem] bg-paper/90 p-8 shadow-[var(--shadow-soft)] md:p-12">
        <p className="font-brand text-xs font-bold uppercase tracking-[0.28em] text-coral-deep">
          We received it
        </p>
        <h1 className="mt-5 font-display text-5xl font-semibold tracking-[-0.05em] text-ink md:text-7xl">
          Thank you for trusting us with the beginning.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
          The GYVFT studio will review your story and respond with the next thoughtful step —
          whether that becomes a gift, a book, merchandise, or something new.
        </p>
        <ButtonLink className="mt-8" href="/" variant="dark">
          Return home
        </ButtonLink>
      </div>
    </section>
  );
}

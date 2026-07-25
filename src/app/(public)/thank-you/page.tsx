import { ButtonLink } from "@/components/ui/button";

export const metadata = {
  title: "Thank you",
};

export default function ThankYouPage() {
  return (
    <section className="editorial-shell px-5 py-28 lg:px-8">
      <div className="mx-auto max-w-3xl border border-border bg-paper px-8 py-12 md:px-12">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-olive">We received it</p>
        <h1 className="mt-5 font-display text-4xl leading-tight text-ink sm:text-5xl md:text-6xl">
          Thank you for trusting us with the beginning.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-text">
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

import { ButtonLink } from "@/components/ui/button";

export const metadata = {
  title: "Thank you",
};

export default function ThankYouPage() {
  return (
    <section className="editorial-shell px-5 py-28 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[2rem] bg-paper/80 p-8 md:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-copper-deep">
          We received it
        </p>
        <h1 className="mt-5 font-display text-5xl font-semibold tracking-[-0.05em] text-ink md:text-7xl">
          Thank you for trusting us with the beginning.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
          The GYVFT studio will review your submission and respond with the next thoughtful step.
        </p>
        <ButtonLink className="mt-8" href="/" variant="dark">
          Return home
        </ButtonLink>
      </div>
    </section>
  );
}

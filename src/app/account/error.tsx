"use client";
export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <section className="rounded-3xl border border-border bg-paper p-10">
      <h1 className="font-serif text-3xl">
        We couldn’t load your story just now.
      </h1>
      <p className="my-5 text-muted-text">
        Please try again. If you sent a message or payment reference, check the
        timeline before resending.
      </p>
      <button
        className="rounded-full bg-olive-dark px-6 py-3 text-white"
        onClick={reset}
      >
        Try again
      </button>
    </section>
  );
}

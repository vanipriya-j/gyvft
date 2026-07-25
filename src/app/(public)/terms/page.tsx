export const metadata = {
  title: "Terms",
};

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-24 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-coral-deep">GYVFT</p>
      <h1 className="mt-4 font-display text-5xl text-ink">Terms</h1>
      <div className="mt-8 space-y-5 text-lg leading-8 text-ink/72">
        <p>
          Public enquiries do not create an engagement until scope, commercial terms, timeline,
          and deliverables are agreed in writing.
        </p>
        <p>
          Please submit only materials you are authorised to share. Ownership, licensing, and
          production rights are confirmed project by project.
        </p>
        <p>GYVFT may decline projects that are unsafe, unlawful, or outside our editorial remit.</p>
      </div>
    </section>
  );
}

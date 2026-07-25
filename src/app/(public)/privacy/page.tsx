export const metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy"
      sections={[
        "We collect the information you choose to submit through public forms so we can respond to your enquiry and scope the work.",
        "We do not ask public analytics events to carry personal information. Optional third-party tags load only after consent.",
        "Submitted briefs and contact details are used for opportunity review, studio communication, and operational follow-up.",
      ]}
    />
  );
}

function PolicyPage({ title, sections }: { title: string; sections: string[] }) {
  return (
    <section className="mx-auto max-w-4xl px-5 py-24 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-copper-deep">GYVFT</p>
      <h1 className="mt-4 font-display text-5xl text-ink">{title}</h1>
      <div className="mt-8 space-y-5 text-lg leading-8 text-ink/72">
        {sections.map((section) => (
          <p key={section}>{section}</p>
        ))}
      </div>
      <p className="mt-10 text-sm text-ink/55">For privacy requests, contact hello@gyvft.com.</p>
    </section>
  );
}

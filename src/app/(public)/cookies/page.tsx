export const metadata = {
  title: "Cookies",
};

export default function CookiesPage() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-24 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-olive">GYVFT</p>
      <h1 className="mt-4 font-display text-5xl text-ink">Cookies</h1>
      <div className="mt-8 space-y-5 text-lg leading-8 text-muted-text">
        <p>Necessary storage keeps consent choices, drafts, forms, and security controls working.</p>
        <p>
          Analytics cookies help us understand anonymous journeys. Advertising cookies support
          campaign measurement. Both are optional and controlled through the consent banner.
        </p>
        <p>You can clear your browser storage to reset your choice at any time.</p>
      </div>
    </section>
  );
}

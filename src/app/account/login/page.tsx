import { CustomerAuth } from "@/components/customer/auth";
export default function LoginPage() {
  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-24">
      <section className="py-8">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[.25em] text-olive">
          My GYVFT
        </p>
        <h1 className="font-serif text-4xl leading-tight md:text-6xl">
          Every story deserves
          <br />a place to grow.
        </h1>
        <p className="mt-7 max-w-md text-lg leading-relaxed text-muted-text">
          Follow your enquiry, watch your gifting project take shape, and stay
          in touch with our team.
        </p>
        <div className="mt-10 space-y-4 border-l-2 border-olive pl-5 text-sm">
          <p>Your enquiries and projects, together.</p>
          <p>A clear timeline and your next steps.</p>
          <p>Conversations that stay with your story.</p>
        </div>
      </section>
      <section className="rounded-3xl border border-border bg-paper p-7 shadow-sm md:p-10">
        <h2 className="mb-2 font-serif text-3xl">Welcome back</h2>
        <p className="mb-8 text-sm text-muted-text">
          Use the same email you shared with us. New here? Create an account and
          verify your email to find your enquiries.
        </p>
        <CustomerAuth />
      </section>
    </div>
  );
}

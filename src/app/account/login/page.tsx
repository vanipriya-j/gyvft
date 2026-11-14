import { CustomerAuth } from "@/components/customer/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;
  const resetToken =
    typeof reset === "string" && reset.length <= 512 ? reset : undefined;

  return (
    <div className="grid gap-12 lg:grid-cols-2 lg:gap-24">
      <section className="py-8">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[.25em] text-olive">
          My GYVFT
        </p>
        <h1 className="font-serif text-4xl leading-tight md:text-6xl">
          Your enquiry,
          <br />a little closer.
        </h1>
        <p className="mt-7 max-w-md text-lg leading-relaxed text-muted-text">
          Sign in to see the request you shared with us, check its status, and
          follow the next steps.
        </p>
        <div className="mt-10 space-y-4 border-l-2 border-olive pl-5 text-sm">
          <p>Your requests, together in one place.</p>
          <p>A clear status and your next step.</p>
          <p>Access using your email and password.</p>
        </div>
      </section>
      <section className="rounded-3xl border border-border bg-paper p-7 shadow-sm md:p-10">
        <h2 className="mb-2 font-serif text-3xl">
          {resetToken ? "Choose a new password" : "Your customer account"}
        </h2>
        <p className="mb-8 text-sm leading-relaxed text-muted-text">
          {resetToken
            ? "Use the secure link from your email to restore access to My GYVFT."
            : "Use the same email you shared with us. New here? Create an account to find your enquiries."}
        </p>
        <CustomerAuth
          key={resetToken ? "reset" : "signin"}
          resetToken={resetToken}
        />
      </section>
    </div>
  );
}

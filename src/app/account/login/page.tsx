import { CustomerAuth } from "@/components/customer/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; next?: string; mode?: string }>;
}) {
  const { reset, next, mode } = await searchParams;
  const resetToken =
    typeof reset === "string" && reset.length <= 512 ? reset : undefined;
  const initialMode =
    mode === "forgot" ? "recover" : mode === "signup" ? "signup" : "login";

  return (
    <div className="mx-auto grid max-w-5xl items-start gap-7 py-3 md:py-7 lg:grid-cols-2 lg:gap-16">
      <section className="py-2 md:py-5">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[.15em] text-olive">
          My GYVFT
        </p>
        <h1 className="font-serif text-3xl leading-tight md:text-5xl">
          A little space for
          <br />
          <span className="italic text-action">your people.</span>
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-muted-text">
          Keep their special days close. Find gifts that feel like them. Let
          Aarla help turn a thoughtful intention into something personal.
        </p>
        <div className="mt-6 hidden space-y-3 border-l-2 border-olive pl-5 text-sm md:block">
          <p>Your people, occasions and saved ideas.</p>
          <p>Aarla’s curated options, ready for your choice.</p>
          <p>Every gift and its next step, together.</p>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-paper p-6 shadow-sm md:p-8">
        <h2 className="mb-2 font-serif text-3xl">
          {resetToken
            ? "Choose a new password"
            : initialMode === "signup"
              ? "Make yourself at home."
              : initialMode === "recover"
                ? "Let’s get you back in."
                : "Welcome back."}
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-muted-text">
          {resetToken
            ? "Use the secure link from your email to restore access to My GYVFT."
            : initialMode === "signup"
              ? "Just your email and a password to begin. You can add your people and occasions whenever you’re ready."
              : initialMode === "recover"
                ? "We’ll send a secure reset link to your account email."
                : "Sign in for your people, your plans and the gifts taking shape."}
        </p>
        <CustomerAuth
          key={resetToken ? "reset" : initialMode}
          resetToken={resetToken}
          next={
            next && next.startsWith("/account/") && !next.startsWith("//")
              ? next
              : undefined
          }
          initialMode={initialMode}
        />
      </section>
    </div>
  );
}

import Link from "next/link";
import { customerEmail, projectsFor } from "@/lib/customer/data";
import { stages } from "@/lib/customer/model";
import { signOut } from "./actions";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const email = await customerEmail();
  const ready = Boolean(process.env.DATABASE_URL);
  const projects = ready ? await projectsFor(email) : [];
  return (
    <>
      <div className="mb-12 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-olive">
            Your corner of GYVFT
          </p>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">
            Your stories, taking shape.
          </h1>
          <p className="mt-4 text-muted-text">{email}</p>
        </div>
        <form action={signOut}>
          <button className="rounded-full border border-border px-5 py-2 text-sm">
            Sign out
          </button>
        </form>
      </div>
      <div className="mb-8 flex gap-8 border-b border-border pb-4 text-sm">
        <span>
          {projects.filter((p) => p.kind === "enquiry").length} enquiries
        </span>
        <span>
          {projects.filter((p) => p.kind === "project").length} projects
        </span>
      </div>
      {!projects.length ? (
        <section className="rounded-3xl border border-border bg-paper px-7 py-16 text-center">
          <h2 className="font-serif text-3xl">
            {ready
              ? "Your next story starts here."
              : "We’re preparing your customer space."}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-text">
            {ready
              ? "Enquiries submitted with your verified email will appear here. If you used another address, contact our team to help connect your story."
              : "Your account is ready. Project updates will appear once your customer space is connected."}
          </p>
          <Link
            className="mt-7 inline-block rounded-full bg-olive-dark px-6 py-3 text-white"
            href="/tell-your-story"
          >
            Tell us your story
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {projects.map((p) => (
            <Link
              href={`/account/projects/${p.id}`}
              key={p.id}
              className="rounded-3xl border border-border bg-paper p-7 transition hover:shadow-lg"
            >
              <div className="flex justify-between gap-3 text-xs uppercase tracking-wider text-olive">
                <span>
                  {p.kind}
                  {p.organisation_name ? ` · ${p.organisation_name}` : ""}
                </span>
                <span>View story →</span>
              </div>
              <h2 className="mt-5 font-serif text-2xl">{p.title}</h2>
              <p className="mt-4 inline-block rounded-full bg-surface px-3 py-1 text-sm">
                {stages[p.stage]}
              </p>
              <p className="mt-5 text-sm leading-relaxed text-muted-text">
                {p.next_action}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

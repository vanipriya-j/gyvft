/* eslint-disable @next/next/no-img-element -- Media is re-authorized on every read so permissions can be withdrawn. */
import Link from "next/link";
import { getSql } from "@/lib/database/client";
import { publicMoments } from "@/lib/customer/moments";
export const dynamic = "force-dynamic";
export const metadata = { title: "Little thoughts, lasting moments" };
export default async function GiftMoments() {
  const photos = await publicMoments(),
    testimonials =
      await getSql()`SELECT t.rating,t.body,CASE WHEN COALESCE(f.name,'')='' THEN 'A GYVFT customer' ELSE split_part(f.name,' ',1) END AS first_name FROM gyvft_gift_testimonials t JOIN customer_projects p ON p.id=t.project_id LEFT JOIN gyvft_customer_profiles f ON f.account_id=p.customer_account_id WHERE t.public_permission AND t.featured ORDER BY t.updated_at DESC LIMIT 12`;
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <p className="mb-3 text-xs uppercase tracking-widest text-olive">
        Given with a little thought
      </p>
      <h1 className="font-serif text-3xl md:text-5xl">
        The gift is only the beginning.
      </h1>
      <p className="mt-4 max-w-xl text-muted-text">
        A few moments our customers have chosen to share.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
          <figure key={p.id}>
            <img
              className="aspect-square w-full rounded-xl object-cover"
              src={`/api/customer-assets/moment/${p.id}`}
              alt={p.caption || p.kind}
            />
            <figcaption className="mt-2 text-sm">
              {p.caption || p.kind}
            </figcaption>
          </figure>
        ))}
      </div>
      {testimonials.map((t, i) => (
        <blockquote
          key={i}
          className="my-8 max-w-2xl border-l-2 border-olive pl-5"
        >
          <p className="text-olive">{"★".repeat(t.rating)}</p>
          <p className="mt-2 font-serif text-xl">{t.body}</p>
          <footer className="mt-2 text-sm text-muted-text">
            {t.first_name}
          </footer>
        </blockquote>
      ))}
      {!photos.length && !testimonials.length && (
        <p className="my-10">
          Every story starts with a thought. Yours could be next.
        </p>
      )}
      <Link
        className="mt-8 inline-flex rounded-lg bg-action px-5 py-3 text-white"
        href="/tell-your-story"
      >
        Start your gifting story →
      </Link>
    </main>
  );
}

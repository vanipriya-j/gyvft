import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteHeader } from "@/components/public/SiteHeader";
import { getSql } from "@/lib/database/client";

type LandingPage = {
  id: string;
  internal_name: string;
  seo_title: string | null;
  seo_description: string | null;
  primary_cta_label: string | null;
  primary_cta_href: string | null;
};

type LandingBlock = {
  id: string;
  block_type: string;
  position: number;
  content: Record<string, unknown>;
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchLandingPage(slug);
  if (!page) return {};
  return {
    title: page.page.seo_title ?? page.page.internal_name,
    description: page.page.seo_description ?? "A GYVFT published landing page.",
  };
}

export default async function LandingPageRoute({ params }: PageProps) {
  const { slug } = await params;
  const data = await fetchLandingPage(slug);
  if (!data) notFound();

  const hero = data.blocks.find((block) => block.block_type === "hero");
  const otherBlocks = data.blocks.filter((block) => block.block_type !== "hero");

  return (
    <AnalyticsProvider>
      <SiteHeader />
      <main className="editorial-shell">
        <section className="ink-gradient px-5 py-24 text-paper lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-saffron">GYVFT</p>
            <h1 className="mt-6 max-w-5xl font-display text-5xl leading-[1.05] tracking-[-0.02em] md:text-7xl">
              {readString(hero?.content.title) ?? data.page.internal_name}
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-paper/72">
              {readString(hero?.content.copy) ?? data.page.seo_description}
            </p>
            {data.page.primary_cta_href && data.page.primary_cta_label ? (
              <ButtonLink className="mt-10" href={data.page.primary_cta_href}>
                {data.page.primary_cta_label}
              </ButtonLink>
            ) : null}
          </div>
        </section>
        <section className="mx-auto max-w-5xl space-y-8 px-5 py-20 lg:px-8">
          {otherBlocks.map((block) => (
            <LandingBlockView block={block} key={block.id} />
          ))}
        </section>
      </main>
      <SiteFooter />
      <ConsentBanner />
    </AnalyticsProvider>
  );
}

async function fetchLandingPage(slug: string): Promise<{ page: LandingPage; blocks: LandingBlock[] } | null> {
  try {
    const sql = getSql();
    const pages = await sql<LandingPage[]>`
      SELECT id, internal_name, seo_title, seo_description, primary_cta_label, primary_cta_href
      FROM landing_pages
      WHERE slug = ${slug} AND status = 'published' AND deleted_at IS NULL
      LIMIT 1
    `;
    const page = pages[0];
    if (!page) return null;
    const blocks = await sql<LandingBlock[]>`
      SELECT id, block_type, position, content
      FROM landing_page_blocks
      WHERE landing_page_id = ${page.id}::uuid
      ORDER BY position ASC
    `;
    return { page, blocks };
  } catch {
    return null;
  }
}

function LandingBlockView({ block }: { block: LandingBlock }) {
  const title = readString(block.content.title);
  const copy = readString(block.content.copy);
  const items = readStringArray(block.content.items);

  if (block.block_type === "cta") {
    const href = readString(block.content.href) ?? "/tell-your-story";
    const label = readString(block.content.label) ?? "Tell us your story";
    return (
      <div className="rounded-[2rem] bg-ink p-8 text-paper">
        {title ? <h2 className="font-display text-4xl">{title}</h2> : null}
        {copy ? <p className="mt-4 max-w-2xl text-paper/70">{copy}</p> : null}
        <ButtonLink className="mt-6" href={href}>
          {label}
        </ButtonLink>
      </div>
    );
  }

  return (
    <article className="rounded-[2rem] border border-ink/10 bg-paper/75 p-8">
      {title ? <h2 className="font-display text-4xl text-ink">{title}</h2> : null}
      {copy ? <p className="mt-4 text-lg leading-8 text-ink/70">{copy}</p> : null}
      {items.length ? (
        <ul className="mt-6 grid gap-3">
          {items.map((item) => (
            <li className="flex gap-3 text-ink/72" key={item}>
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-copper" />
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

import { notFound } from "next/navigation";
import { deleteLandingPageAction } from "@/actions/studio-landing-pages";
import { LandingPageForm } from "@/components/studio/landing-page-form";
import { Card, EmptyState, PageHeader, SubmitButton, formatDateTime } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { getLandingPageDetail, listCampaigns } from "@/repositories/studio";

export default async function StudioLandingPageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStudioUser({ roles: ["owner", "admin"] });
  const { id } = await params;
  const [detail, campaigns] = await Promise.all([getLandingPageDetail(id), listCampaigns({ limit: 100 })]);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.page.internal_name}
        description={`Last updated ${formatDateTime(detail.page.updated_at)}`}
        action={
          <form action={deleteLandingPageAction}>
            <input type="hidden" name="landingPageId" value={detail.page.id} />
            <SubmitButton destructive>Delete</SubmitButton>
          </form>
        }
      />
      <LandingPageForm page={detail.page} campaigns={campaigns.rows} />
      <Card>
        <h2 className="text-lg font-semibold text-slate-950">Blocks</h2>
        {detail.blocks.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No blocks" description="No landing page block records are attached to this page." />
          </div>
        ) : (
          <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
            {JSON.stringify(detail.blocks, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  );
}

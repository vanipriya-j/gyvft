import { LandingPageForm } from "@/components/studio/landing-page-form";
import { PageHeader } from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { listCampaigns } from "@/repositories/studio";

export default async function NewStudioLandingPagePage() {
  await requireStudioUser({ roles: ["owner", "admin"] });
  const campaigns = await listCampaigns({ limit: 100 });
  return (
    <div className="space-y-6">
      <PageHeader title="New landing page" description="Create a landing page record. Publishing only reflects database status." />
      <LandingPageForm campaigns={campaigns.rows} />
    </div>
  );
}

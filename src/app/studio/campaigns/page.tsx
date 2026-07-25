import { deleteCampaignAction, saveCampaignAction } from "@/actions/studio-campaigns";
import { CopyButton } from "@/components/studio/copy-button";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  PageHeader,
  SubmitButton,
  formatDate,
  humanize,
  inputClassName,
  selectClassName,
  statusTone,
} from "@/components/studio/ui";
import { requireStudioUser } from "@/lib/auth/session";
import { listCampaigns } from "@/repositories/studio";

type SearchParams = Record<string, string | string[] | undefined>;

function first(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function campaignUrl(input: { landing_page: string | null; source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null }) {
  const base = input.landing_page || process.env.NEXT_PUBLIC_APP_URL || "https://gyvft.example";
  const url = new URL(base, process.env.NEXT_PUBLIC_APP_URL || "https://gyvft.example");
  if (input.source) url.searchParams.set("utm_source", input.source);
  if (input.medium) url.searchParams.set("utm_medium", input.medium);
  if (input.campaign) url.searchParams.set("utm_campaign", input.campaign);
  if (input.content) url.searchParams.set("utm_content", input.content);
  if (input.term) url.searchParams.set("utm_term", input.term);
  return url.toString();
}

export default async function StudioCampaignsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStudioUser({ roles: ["owner", "admin"] });
  const params = await searchParams;
  const query = first(params, "query");
  const result = await listCampaigns({ query, limit: 100 });

  return (
    <div className="space-y-6">
      <PageHeader title="Campaigns" description="Create campaign records and build copyable UTM URLs." />
      <Card>
        <h2 className="text-lg font-semibold text-slate-950">New campaign</h2>
        <form action={saveCampaignAction} className="mt-4 grid gap-4 md:grid-cols-4">
          <Field label="Name">
            <input className={inputClassName} name="name" required />
          </Field>
          <Field label="Status">
            <select className={selectClassName} name="status" defaultValue="draft">
              {["draft", "active", "paused", "completed"].map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source">
            <input className={inputClassName} name="source" placeholder="newsletter" />
          </Field>
          <Field label="Medium">
            <input className={inputClassName} name="medium" placeholder="email" />
          </Field>
          <Field label="Campaign">
            <input className={inputClassName} name="campaign" placeholder="founder_story_launch" />
          </Field>
          <Field label="Content">
            <input className={inputClassName} name="content" />
          </Field>
          <Field label="Term">
            <input className={inputClassName} name="term" />
          </Field>
          <Field label="Landing page or URL">
            <input className={inputClassName} name="landingPage" placeholder="/tell-your-story" />
          </Field>
          <div className="md:col-span-4">
            <SubmitButton>Create campaign</SubmitButton>
          </div>
        </form>
      </Card>

      {result.rows.length === 0 ? (
        <EmptyState title="No campaigns" description="No campaign records exist yet." />
      ) : (
        <div className="space-y-4">
          {result.rows.map((campaign) => {
            const url = campaignUrl(campaign);
            return (
              <Card key={campaign.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">{campaign.name}</h2>
                      <Badge tone={statusTone(campaign.status)}>{humanize(campaign.status)}</Badge>
                    </div>
                    <p className="mt-2 break-all rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{url}</p>
                    <p className="mt-2 text-sm text-slate-500">Created {formatDate(campaign.created_at)}</p>
                  </div>
                  <CopyButton value={url} />
                </div>
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">Edit campaign</summary>
                  <form action={saveCampaignAction} className="mt-4 grid gap-4 md:grid-cols-4">
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <Field label="Name">
                      <input className={inputClassName} name="name" defaultValue={campaign.name} required />
                    </Field>
                    <Field label="Status">
                      <select className={selectClassName} name="status" defaultValue={campaign.status}>
                        {["draft", "active", "paused", "completed"].map((status) => (
                          <option key={status} value={status}>
                            {humanize(status)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Source">
                      <input className={inputClassName} name="source" defaultValue={campaign.source ?? ""} />
                    </Field>
                    <Field label="Medium">
                      <input className={inputClassName} name="medium" defaultValue={campaign.medium ?? ""} />
                    </Field>
                    <Field label="Campaign">
                      <input className={inputClassName} name="campaign" defaultValue={campaign.campaign ?? ""} />
                    </Field>
                    <Field label="Content">
                      <input className={inputClassName} name="content" defaultValue={campaign.content ?? ""} />
                    </Field>
                    <Field label="Term">
                      <input className={inputClassName} name="term" defaultValue={campaign.term ?? ""} />
                    </Field>
                    <Field label="Landing page or URL">
                      <input className={inputClassName} name="landingPage" defaultValue={campaign.landing_page ?? ""} />
                    </Field>
                    <div className="flex gap-2 md:col-span-4">
                      <SubmitButton>Save campaign</SubmitButton>
                    </div>
                  </form>
                  <form action={deleteCampaignAction} className="mt-3">
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <SubmitButton destructive>Delete campaign</SubmitButton>
                  </form>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

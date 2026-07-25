import { saveLandingPageAction } from "@/actions/studio-landing-pages";
import { Card, Field, SubmitButton, inputClassName, selectClassName, humanize } from "@/components/studio/ui";
import type { Campaign, LandingPage } from "@/repositories/studio";

export function LandingPageForm({
  page,
  campaigns,
}: {
  page?: LandingPage;
  campaigns: Campaign[];
}) {
  return (
    <Card>
      <form action={saveLandingPageAction} className="grid gap-5 md:grid-cols-2">
        {page ? <input type="hidden" name="landingPageId" value={page.id} /> : null}
        <Field label="Internal name">
          <input className={inputClassName} name="internalName" defaultValue={page?.internal_name ?? ""} required />
        </Field>
        <Field label="Slug">
          <input className={inputClassName} name="slug" defaultValue={page?.slug ?? ""} required />
        </Field>
        <Field label="Status">
          <select className={selectClassName} name="status" defaultValue={page?.status ?? "draft"}>
            {["draft", "published", "archived"].map((status) => (
              <option key={status} value={status}>
                {humanize(status)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Campaign">
          <select className={selectClassName} name="campaignId" defaultValue={page?.campaign_id ?? ""}>
            <option value="">None</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="SEO title">
          <input className={inputClassName} name="seoTitle" defaultValue={page?.seo_title ?? ""} />
        </Field>
        <Field label="SEO description">
          <input className={inputClassName} name="seoDescription" defaultValue={page?.seo_description ?? ""} />
        </Field>
        <Field label="Social image path">
          <input className={inputClassName} name="socialImagePath" defaultValue={page?.social_image_path ?? ""} />
        </Field>
        <Field label="Form destination">
          <input className={inputClassName} name="formDestination" defaultValue={page?.form_destination ?? ""} />
        </Field>
        <Field label="Primary CTA label">
          <input className={inputClassName} name="primaryCtaLabel" defaultValue={page?.primary_cta_label ?? ""} />
        </Field>
        <Field label="Primary CTA href">
          <input className={inputClassName} name="primaryCtaHref" defaultValue={page?.primary_cta_href ?? ""} />
        </Field>
        <div className="md:col-span-2">
          <SubmitButton>{page ? "Save landing page" : "Create landing page"}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

import { storyRequestSchema } from "@/lib/customer/story-request";
export function CustomerStoryDetails({ value }: { value: unknown }) {
  const parsed = storyRequestSchema.safeParse(value);
  if (!parsed.success) return null;
  const s = parsed.data;
  const rows = [
    ["Occasion", s.occasion_type],
    ["Occasion details", s.occasion_other],
    ["Who this is for", s.audiences.join(", ")],
    ["Preferred formats", s.preferred_formats.join(", ")],
    ["Target date", s.target_date || "Not specified"],
    ["Date precision", s.target_date_precision],
    ["Quantity range", s.quantity_range],
    ["Budget range", s.budget_range],
    ["Primary city", s.primary_city],
    ["Multiple locations", s.multiple_locations ? "Yes" : "No"],
    ["Location notes", s.location_notes],
    ["Contact name", s.full_name],
    ["Email", s.email],
    ["Phone", s.phone],
    ["Organisation", s.organisation_name],
    ["Designation", s.designation],
    ["Preferred contact", s.preferred_contact_method],
    ["Contact permission", s.communication_consent ? "Yes" : "No"],
    ["Marketing updates", s.marketing_consent ? "Yes" : "No"],
  ];
  return (
    <section className="rounded-3xl border border-border bg-paper p-6 md:p-8">
      <h2 className="font-serif text-2xl">Your request details</h2>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm font-medium">{label}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-text">
                {value}
              </dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

import { giftBriefSchema, recipientCount } from "@/lib/validation/gift-brief";
export function CustomerGiftBrief({ value }: { value: unknown }) {
  const parsed = giftBriefSchema.safeParse(value);
  if (!parsed.success) return null;
  const brief = parsed.data;
  const budget = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(brief.budget_amount);
  return (
    <section className="rounded-3xl border border-border bg-paper p-6 md:p-8">
      <h2 className="font-serif text-2xl">Your gifting details</h2>
      <p className="mt-3 text-sm text-muted-text">
        {brief.recipient_type === "person"
          ? "One person"
          : brief.recipient_type === "group"
            ? `One group · ${recipientCount(brief)} recipients`
            : `${recipientCount(brief)} separate individuals`}
      </p>
      <div className="mt-5 space-y-5">
        {brief.recipients.map((person, i) => (
          <article key={i} className="rounded-2xl border border-border p-5">
            <h3 className="font-medium">{person.name}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-text">
              {person.description}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <dt className="font-medium">Likes and interests</dt>
              <dd className="whitespace-pre-wrap text-muted-text">
                {person.likes || "Not shared yet"}
              </dd>
              <dt className="font-medium">Dislikes / things to avoid</dt>
              <dd className="whitespace-pre-wrap text-muted-text">
                {person.dislikes || "Not shared yet"}
              </dd>
            </dl>
          </article>
        ))}
        <dl className="space-y-3 whitespace-pre-wrap text-sm">
          <dt className="font-medium">Occasion details</dt>
          <dd className="text-muted-text">{brief.occasion_description}</dd>
          <dt className="font-medium">What the gift should communicate</dt>
          <dd className="text-muted-text">{brief.gift_message}</dd>
          <dt className="font-medium">Preferred budget</dt>
          <dd className="text-muted-text">
            {budget}{" "}
            {brief.budget_basis === "total" ? "in total" : "per recipient"}
          </dd>
          <dt className="font-medium">Requested delivery date</dt>
          <dd className="text-muted-text">
            {new Intl.DateTimeFormat("en-IN", {
              dateStyle: "long",
              timeZone: "Asia/Kolkata",
            }).format(new Date(brief.delivery_date + "T00:00:00Z"))}
          </dd>
        </dl>
        <p className="text-xs text-muted-text">
          These are your preferences. Pricing and delivery feasibility will be
          confirmed by GYVFT.
        </p>
      </div>
    </section>
  );
}

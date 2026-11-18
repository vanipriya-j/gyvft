import { z } from "zod";
const text = (max: number) => z.string().trim().max(max);
export const catalogue = [
  {
    id: "bottle",
    name: "Bottle",
    icon: "bottle",
    fields: { Capacity: ["500 ml", "750 ml", "1 litre"] },
  },
  {
    id: "dabara",
    name: "Dabara tumbler",
    icon: "cup",
    fields: { Set: ["One tumbler + dabara", "Pair of sets"] },
  },
  {
    id: "frame",
    name: "Framed art",
    icon: "frame",
    fields: {
      Size: ["A5", "A4", "A3"],
      Orientation: ["Portrait", "Landscape"],
    },
  },
  {
    id: "tee",
    name: "T-shirt",
    icon: "tee",
    fields: { For: ["Adult", "Kids"], Size: ["S", "M", "L", "XL", "XXL"] },
  },
  { id: "magnet", name: "Magnet", icon: "magnet", fields: {} },
] as const;
export const kidsSizes = [
  "2–4 years",
  "4–6 years",
  "6–8 years",
  "8–10 years",
  "10–12 years",
];
export const packagingChoices = [
  "Let GYVFT recommend",
  "Individual Aarla shopping bags",
  "Card box",
  "Trousseau packaging",
  "Poly bag",
  "Gift wrapping",
  "No additional gift packaging",
] as const;
export const contentSchema = z.object({
  key: text(80).min(1),
  name: text(160).min(2),
  quantity: z.number().int().min(1).max(1000),
  unit_paise: z.number().int().min(0).max(99999999).nullable().default(null),
});
export type GiftContent = z.infer<typeof contentSchema>;
export const pricingSchema = z
  .object({
    mode: z.enum(["none", "indicative", "range"]).default("none"),
    basis: z.enum(["per_set", "order"]).default("per_set"),
    quantity: z.number().int().min(1).max(10000).default(1),
    low_paise: z.number().int().min(1).max(999999999).nullable().default(null),
    high_paise: z.number().int().min(1).max(999999999).nullable().default(null),
    packaging_included: z.boolean().default(false),
  })
  .superRefine((p, c) => {
    if (p.mode !== "none" && p.low_paise === null)
      c.addIssue({ code: "custom", message: "Add an indicative amount." });
    if (
      p.mode === "range" &&
      (p.high_paise === null ||
        p.low_paise === null ||
        p.high_paise < p.low_paise)
    )
      c.addIssue({ code: "custom", message: "Check the price range." });
  });
export type GiftPricing = z.infer<typeof pricingSchema>;
export const curatedOptionSchema = z
  .object({
    title: text(160).min(2),
    description: text(2000),
    pricing: pricingSchema.default({}),
    contents: z.array(contentSchema).min(1).max(40),
  })
  .superRefine((v, c) => {
    if (new Set(v.contents.map((l) => l.key)).size !== v.contents.length)
      c.addIssue({
        code: "custom",
        message: "Each content row needs a distinct key.",
      });
  });
const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("catalogue"), id: z.string().max(30) }),
  z.object({
    kind: z.literal("curated"),
    optionId: z.string().uuid(),
    key: text(80).min(1),
  }),
]);
export const draftSchema = z.object({
  label: text(60).min(1),
  recipients: z.number().int().min(1).max(10000),
  lines: z
    .array(
      z.object({
        key: z.string().uuid(),
        source: sourceSchema,
        quantity: z.number().int().min(1).max(1000),
        variants: z.record(text(60), text(120)).default({}),
        name: text(160).optional(),
        unit_paise: z.number().nullable().optional(),
      }),
    )
    .max(40),
  design: z.enum(["existing", "suggested", "custom"]),
  design_notes: text(2000),
  personalisation: text(2000),
  packaging: z.enum(packagingChoices),
  notes: text(2000),
  extra_budget_paise: z
    .number()
    .int()
    .min(0)
    .max(99999999)
    .nullable()
    .default(null),
  extra_idea: text(500).default(""),
  based_on: z.string().uuid().nullable().default(null),
});
export type GiftDraft = z.infer<typeof draftSchema>;
export type GiftOption = {
  operator_hidden?: boolean;
  id: string;
  title: string;
  description: string;
  contents: GiftContent[];
  has_image: boolean;
  published: boolean;
  hidden: boolean;
  pricing: GiftPricing;
  created_at: string;
};
export type SavedGiftDraft = {
  id: string;
  version: number;
  document: GiftDraft;
  updated_at: string;
  hidden: boolean;
};
export type GiftSelection = {
  id: string;
  draft_id: string;
  draft_version: number;
  snapshot: GiftDraft;
  created_at: string;
  quoted: boolean;
};
export function emptyGiftDraft(label = "Option C"): GiftDraft {
  return {
    label,
    recipients: 1,
    lines: [],
    design: "existing",
    design_notes: "",
    personalisation: "",
    packaging: "Let GYVFT recommend",
    notes: "",
    extra_budget_paise: null,
    extra_idea: "",
    based_on: null,
  };
}
export function validateVariants(
  productId: string,
  variants: Record<string, string>,
) {
  const product = catalogue.find((p) => p.id === productId);
  if (!product) throw Error("Choose a product from the catalogue.");
  const fields: Record<string, readonly string[]> = { ...product.fields };
  if (productId === "tee" && variants.For === "Kids") fields.Size = kidsSizes;
  if (
    Object.keys(variants).some((k) => !fields[k]) ||
    Object.entries(fields).some(([k, v]) => !v.includes(variants[k]))
  )
    throw Error("Choose valid product options.");
  return product;
}
/** Estimates never turn an unpriced item into a free product. Delivery is always separate. */
export function giftEstimate(draft: GiftDraft) {
  let known = 0;
  let unknown = 0;
  for (const line of draft.lines) {
    if (line.unit_paise == null) unknown++;
    else known += line.unit_paise * line.quantity;
  }
  return { perRecipient: known, total: known * draft.recipients, unknown };
}
export function normaliseGiftDraft(
  raw: unknown,
  options: Pick<GiftOption, "id" | "contents">[],
): GiftDraft {
  const draft = draftSchema.parse(raw);
  if (draft.based_on && !options.some((o) => o.id === draft.based_on))
    throw Error("Source option unavailable.");
  const keys = new Set<string>();
  for (const line of draft.lines) {
    if (keys.has(line.key)) throw Error("Duplicate product row.");
    keys.add(line.key);
    if (line.source.kind === "catalogue") {
      const p = validateVariants(line.source.id, line.variants);
      line.name = p.name;
      line.unit_paise = null;
    } else {
      const source = line.source;
      const item = options
        .find((o) => o.id === source.optionId)
        ?.contents.find((c) => c.key === source.key);
      if (!item)
        throw Error("A curated item is unavailable. Refresh your options.");
      line.name = item.name;
      line.unit_paise = item.unit_paise;
      line.variants = {};
    }
  }
  return draft;
}

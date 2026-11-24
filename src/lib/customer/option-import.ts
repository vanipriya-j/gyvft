import { z } from "zod";
import { curatedOptionSchema } from "./gift-workspace-model";

const rupees = z
  .number()
  .finite()
  .positive()
  .max(9999999.99)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    "Use at most two decimal places.",
  );
const importSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).default(""),
    contents: z
      .array(
        z
          .object({
            name: z.string().trim().min(2).max(160),
            quantity: z.number().int().min(1).max(1000).default(1),
          })
          .strict(),
      )
      .min(1)
      .max(40),
    pricing: z
      .object({
        mode: z.enum(["none", "indicative", "range"]).default("none"),
        basis: z.enum(["per_set", "order"]).default("per_set"),
        quantity: z.number().int().min(1).max(10000).default(1),
        low_inr: rupees.nullable().optional(),
        high_inr: rupees.nullable().optional(),
        packaging_included: z.boolean().default(false),
      })
      .strict()
      .default({}),
  })
  .strict()
  .superRefine((data, context) => {
    if (
      data.pricing.mode === "none" &&
      (data.pricing.low_inr != null || data.pricing.high_inr != null)
    )
      context.addIssue({
        code: "custom",
        path: ["pricing"],
        message: "Choose indicative or range when supplying an amount.",
      });
    if (data.pricing.mode === "indicative" && data.pricing.high_inr != null)
      context.addIssue({
        code: "custom",
        path: ["pricing", "high_inr"],
        message: "Use range mode for two amounts.",
      });
  });

export type ImportedOption = z.infer<typeof curatedOptionSchema>;
export const optionImportExample = JSON.stringify(
  {
    title: "Team appreciation kit",
    description: "A coordinated set for the people who make a difference.",
    contents: [
      { name: "Branded T-shirt", quantity: 1 },
      { name: "Journal", quantity: 1 },
      { name: "Water bottle", quantity: 1 },
    ],
    pricing: {
      mode: "none",
      basis: "per_set",
      quantity: 1,
      packaging_included: false,
    },
  },
  null,
  2,
);

export function parseOptionImport(input: string): ImportedOption {
  if (input.length > 12000)
    throw Error("Keep the pasted option under 12,000 characters.");
  let text = input.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) text = fence[1];
  let raw: unknown;
  if (text.startsWith("{")) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw Error(
        "This JSON could not be read. Check commas, quotes and brackets.",
      );
    }
  } else {
    const fields: Record<string, string> = {};
    let current = "";
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(
        /^(title|description|items|contents|price|price basis|sets|packaging)\s*:\s*(.*)$/i,
      );
      if (match) {
        current = match[1].toLowerCase();
        if (fields[current] !== undefined)
          throw Error(`Use ${current} only once per option.`);
        fields[current] = match[2];
      } else if (current) fields[current] += "\n" + line;
      else if (line.trim())
        throw Error(
          "Use Title:, Description:, Items: and Price: labels, or paste JSON from GPT.",
        );
    }
    const items = (fields.items || fields.contents || "")
      .split(/\r?\n/)
      .map((s) => s.trim().replace(/^[-•*]\s*/, ""))
      .filter(Boolean)
      .map((line) => {
        const item = line.match(/^(\d+)\s*[x×]\s*(.+)$/i);
        return {
          name: item ? item[2].trim() : line,
          quantity: item ? Number(item[1]) : 1,
        };
      });
    const price = (fields.price || "").trim();
    const amount = price.match(
      /^(?:₹|Rs\.?|INR)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)(?:\s*(?:-|–|to)\s*(?:₹|Rs\.?|INR)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?))?$/i,
    );
    if (
      price &&
      !/^(?:none|unpriced|price on request)$/i.test(price) &&
      !amount
    )
      throw Error(
        "Use a clear rupee amount for Price: (for example 1100 or 1000–1200), or write unpriced.",
      );
    const basis = (fields["price basis"] || "per_set").trim().toLowerCase();
    if (!["per_set", "order"].includes(basis))
      throw Error("Price basis must be per_set or order.");
    const packaging = (fields.packaging || "not included").trim().toLowerCase();
    if (!["included", "not included"].includes(packaging))
      throw Error("Packaging must be included or not included.");
    raw = {
      title: (fields.title || "").trim(),
      description: (fields.description || "").trim(),
      contents: items,
      pricing: {
        mode: amount ? (amount[2] ? "range" : "indicative") : "none",
        basis,
        quantity: fields.sets ? Number(fields.sets.trim()) : 1,
        low_inr: amount ? Number(amount[1].replaceAll(",", "")) : null,
        high_inr: amount?.[2] ? Number(amount[2].replaceAll(",", "")) : null,
        packaging_included: packaging === "included",
      },
    };
  }
  try {
    const data = importSchema.parse(raw);
    return curatedOptionSchema.parse({
      title: data.title,
      description: data.description,
      contents: data.contents.map((item, index) => ({
        ...item,
        key: `import-${index + 1}`,
        unit_paise: null,
      })),
      pricing: {
        ...data.pricing,
        low_paise:
          data.pricing.low_inr == null
            ? null
            : Math.round(data.pricing.low_inr * 100),
        high_paise:
          data.pricing.high_inr == null
            ? null
            : Math.round(data.pricing.high_inr * 100),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      throw Error(
        `Check ${issue.path.join(".") || "the option"}: ${issue.message}`,
      );
    }
    throw error;
  }
}

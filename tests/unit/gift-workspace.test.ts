import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  emptyGiftDraft,
  normaliseGiftDraft,
  pricingSchema,
  validateVariants,
  giftEstimate,
  curatedOptionSchema,
} from "@/lib/customer/gift-workspace-model";
const option = {
  id: randomUUID(),
  contents: [
    {
      key: "gift",
      name: "Hand-curated keepsake",
      quantity: 1,
      unit_paise: null,
    },
  ],
};
function manual() {
  const d = emptyGiftDraft();
  d.based_on = option.id;
  d.lines = [
    {
      key: randomUUID(),
      source: { kind: "curated", optionId: option.id, key: "gift" },
      quantity: 2,
      variants: {},
      name: "Tampered",
      unit_paise: 0,
    },
  ];
  return d;
}
describe("gift workspace commercial and ownership model", () => {
  it("supports optional indicative prices and bounded ranges", () => {
    expect(pricingSchema.parse({}).mode).toBe("none");
    expect(pricingSchema.safeParse({ mode: "indicative" }).success).toBe(false);
    expect(
      pricingSchema.safeParse({
        mode: "range",
        low_paise: 55000,
        high_paise: 45000,
      }).success,
    ).toBe(false);
    expect(
      pricingSchema.safeParse({
        mode: "range",
        low_paise: 45000,
        high_paise: 55000,
        quantity: 20,
      }).success,
    ).toBe(true);
  });
  it("allows manually curated content without catalogue or Shopify identifiers", () => {
    expect(
      curatedOptionSchema.safeParse({
        title: "Option A",
        description: "One curated hamper",
        contents: option.contents,
      }).success,
    ).toBe(true);
  });
  it("resolves curated names and prices from the same request, not customer input", () => {
    const d = normaliseGiftDraft(manual(), [option]);
    expect(d.lines[0].name).toBe(option.contents[0].name);
    expect(d.lines[0].unit_paise).toBeNull();
    expect(() => normaliseGiftDraft(manual(), [])).toThrow();
  });
  it("rejects cross-request source references even when item keys match", () => {
    expect(() =>
      normaliseGiftDraft(manual(), [{ ...option, id: randomUUID() }]),
    ).toThrow();
  });
  it("does not give unpriced products a zero-priced estimate", () => {
    expect(giftEstimate(normaliseGiftDraft(manual(), [option]))).toEqual({
      perRecipient: 0,
      total: 0,
      unknown: 1,
    });
  });
  it("checks tee sizes against kids/adult variants", () => {
    expect(() => validateVariants("tee", { For: "Kids", Size: "M" })).toThrow();
    expect(() =>
      validateVariants("tee", { For: "Adult", Size: "6–8 years" }),
    ).toThrow();
    expect(
      validateVariants("tee", { For: "Kids", Size: "6–8 years" }).name,
    ).toBe("T-shirt");
  });
  it("rejects arbitrary variant keys and catalogue products", () => {
    expect(() =>
      validateVariants("frame", {
        Size: "A4",
        Orientation: "Portrait",
        price: "1",
      }),
    ).toThrow();
    expect(() => validateVariants("invented", {})).toThrow();
  });
  it("canonicalises catalogue prices and rejects duplicate line keys", () => {
    const d = emptyGiftDraft();
    const line = {
      key: randomUUID(),
      source: { kind: "catalogue" as const, id: "magnet" },
      quantity: 1,
      variants: {},
      name: "Free magnet",
      unit_paise: 0,
    };
    d.lines = [line];
    expect(normaliseGiftDraft(d, []).lines[0]).toMatchObject({
      name: "Magnet",
      unit_paise: null,
    });
    d.lines.push(line);
    expect(() => normaliseGiftDraft(d, [])).toThrow();
  });
  it("rejects missing variants, unsafe quantities and invalid packaging", () => {
    const d = emptyGiftDraft();
    d.lines = [
      {
        key: randomUUID(),
        source: { kind: "catalogue", id: "frame" },
        quantity: 1,
        variants: {},
      },
    ];
    expect(() => normaliseGiftDraft(d, [])).toThrow();
    d.lines[0].quantity = 0;
    expect(() => normaliseGiftDraft(d, [])).toThrow();
  });
});

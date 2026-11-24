import { describe, it, expect } from "vitest";
import {
  parseOptionImport,
  optionImportExample,
} from "@/lib/customer/option-import";
import { optionGallery } from "@/lib/customer/option-image-model";
describe("option import", () => {
  it("uses a reviewable unpriced template without inventing costs", () => {
    const result = parseOptionImport(optionImportExample);
    expect(result.contents).toHaveLength(3);
    expect(result.pricing).toMatchObject({
      mode: "none",
      low_paise: null,
      high_paise: null,
    });
  });
  it("converts explicit rupees once, preserves quantities and rejects unexpected fields", () => {
    const raw = {
      title: "Team gift",
      contents: [{ name: "Journal", quantity: 2 }],
      pricing: {
        mode: "range",
        low_inr: 1000.25,
        high_inr: 1200,
        basis: "per_set",
        quantity: 4,
      },
    };
    const result = parseOptionImport(
      "```json\n" + JSON.stringify(raw) + "\n```",
    );
    expect(result.pricing).toMatchObject({
      low_paise: 100025,
      high_paise: 120000,
      quantity: 4,
    });
    expect(result.contents[0].quantity).toBe(2);
    expect(() =>
      parseOptionImport(JSON.stringify({ ...raw, publish: true })),
    ).toThrow("Unrecognized key");
    expect(() =>
      parseOptionImport(
        JSON.stringify({
          ...raw,
          pricing: { mode: "range", low_inr: 1200, high_inr: 1000 },
        }),
      ),
    ).toThrow();
  });
  it("parses labelled text while rejecting ambiguous amounts rather than guessing", () => {
    const result = parseOptionImport(
      "Title: Team gift\nDescription: A thoughtful set.\nItems:\n- 2 x Journals\n- 1 × Bottle\nPrice: ₹1,000–₹1,200\nPrice basis: per_set\nSets: 4\nPackaging: included",
    );
    expect(result.contents.map((c) => c.quantity)).toEqual([2, 1]);
    expect(result.pricing).toMatchObject({
      mode: "range",
      low_paise: 100000,
      high_paise: 120000,
      packaging_included: true,
    });
    expect(() =>
      parseOptionImport(
        "Title: Team gift\nItems:\n- Journal\nPrice: maybe 1200 plus tax",
      ),
    ).toThrow("clear rupee amount");
    expect(() =>
      parseOptionImport(
        "Title: Team gift\nTitle: Other gift\nItems:\n- Journal",
      ),
    ).toThrow("only once");
  });
  it("rejects malformed, overlong, missing-item and sub-paise imports", () => {
    for (const text of [
      "{bad json}",
      "x".repeat(12001),
      JSON.stringify({ title: "No items", contents: [] }),
      JSON.stringify({
        title: "Test gift",
        contents: [{ name: "Bottle" }],
        pricing: { mode: "indicative", low_inr: 100.001 },
      }),
    ])
      expect(() => parseOptionImport(text)).toThrow();
  });
});
it("keeps legacy covers first and does not mutate the supplied image order", () => {
  const images = [
    { id: "third", kind: "gift-option-image" as const, position: 3 },
    { id: "second", kind: "gift-option-image" as const, position: 2 },
  ];
  expect(
    optionGallery({ id: "cover", has_image: true, images }).map((i) => i.id),
  ).toEqual(["cover", "second", "third"]);
  expect(images[0].id).toBe("third");
  expect(optionGallery({ id: "legacy", has_image: true })).toHaveLength(1);
  expect(optionGallery({ id: "empty", has_image: false, images })).toEqual([]);
});

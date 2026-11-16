import { describe, expect, it } from "vitest";
import {
  productionAllowed,
  dispatchAllowed,
  quoteTotal,
  deliverySchema,
  secureLink,
} from "@/lib/customer/pilot-model";
import { validImage } from "@/lib/customer/images";
import { parseCatalogue } from "@/lib/customer/catalogue";

describe("B2C payment and fulfilment rules", () => {
  it("requires a verified rounded-up 50% advance and approved design", () => {
    expect(productionAllowed(5000, 10001, true)).toBe(false);
    expect(productionAllowed(5001, 10001, true)).toBe(true);
    expect(productionAllowed(10001, 10001, false)).toBe(false);
    expect(productionAllowed(0, 0, true)).toBe(false);
  });
  it("requires all fulfilment prerequisites before dispatch", () => {
    expect(dispatchAllowed(10000, 10000, true, true, "AWB123")).toBe(true);
    expect(dispatchAllowed(9999, 10000, true, true, "AWB123")).toBe(false);
    expect(dispatchAllowed(10000, 10000, false, true, "AWB123")).toBe(false);
    expect(dispatchAllowed(10000, 10000, true, false, "AWB123")).toBe(false);
    expect(dispatchAllowed(10000, 10000, true, true, "  ")).toBe(false);
  });
  it("calculates quantities and charges without allowing unsafe totals", () => {
    const item = {
      name: "Personalised gifts",
      quantity: 3,
      unit_paise: 45000,
      item_type: "gift" as const,
      personalisation: "",
    };
    expect(
      quoteTotal([
        item,
        { ...item, quantity: 1, unit_paise: 15000, item_type: "fee" },
      ]),
    ).toBe(150000);
    expect(() => quoteTotal([{ ...item, unit_paise: 0 }])).toThrow();
    expect(() =>
      quoteTotal([{ ...item, quantity: 100000, unit_paise: 999999999 }]),
    ).toThrow();
  });
  it("rejects executable or credential-bearing tracking URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://tracking.test",
      "https://user:pass@tracking.test",
    ])
      expect(secureLink(url)).toBeNull();
    expect(secureLink("https://tracking.test/123")).toBe(
      "https://tracking.test/123",
    );
  });
  it("checks screenshot bytes rather than trusting the filename", () => {
    expect(
      validImage(Buffer.from('<svg onload="alert(1)"/>'), "image/png"),
    ).toBe(false);
    expect(validImage(Buffer.alloc(3 * 1024 * 1024), "image/png")).toBe(false);
  });
  it("requires recipient and address details with an Indian PIN code", () => {
    expect(
      deliverySchema.safeParse({
        recipient_name: "Sam",
        phone: "9876543210",
        address: "12 Market Road",
        city: "Chennai",
        state: "Tamil Nadu",
        postal_code: "600001",
      }).success,
    ).toBe(true);
    expect(
      deliverySchema.safeParse({
        recipient_name: "Sam",
        phone: "9876543210",
        address: "12 Market Road",
        city: "Chennai",
        state: "Tamil Nadu",
        postal_code: "60001",
      }).success,
    ).toBe(false);
  });
});

describe("honest Aarla discovery cards", () => {
  const product = {
    id: 1,
    title: "Gift",
    handle: "gift",
    created_at: "2026-11-15",
    images: [{ src: "https://cdn.shopify.com/s/files/1/gift.png" }],
    variants: [
      { price: "400.00", compare_at_price: "500.00", available: true },
    ],
  };
  it("uses available variant prices and real markdowns", () => {
    const [p] = parseCatalogue({
      products: [
        {
          ...product,
          variants: [{ price: "10.00", available: false }, ...product.variants],
        },
      ],
    });
    expect(p.pricePaise).toBe(40000);
    expect(p.comparePaise).toBe(50000);
    expect(p.available).toBe(true);
    expect(p.href).toContain("https://aarla.in/products/gift?");
  });
  it("does not invent offers or accept third-party image hosts", () => {
    expect(
      parseCatalogue({
        products: [
          {
            ...product,
            variants: [
              { price: "400.00", compare_at_price: "300.00", available: true },
            ],
          },
        ],
      })[0].comparePaise,
    ).toBeNull();
    expect(
      parseCatalogue({
        products: [
          { ...product, images: [{ src: "https://evil.test/image" }] },
        ],
      }),
    ).toEqual([]);
    expect(parseCatalogue(null)).toEqual([]);
  });
});

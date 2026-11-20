import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkPin,
  createParcel,
  manifestPayload,
  parseTracking,
  requestPickup,
  trackParcels,
  type DelhiveryConfig,
} from "@/services/shipping/delhivery";
import {
  carrierStatus,
  parcelSchema,
  shipmentSchema,
  type Shipment,
} from "@/lib/customer/shipping-model";
const config: DelhiveryConfig = {
  environment: "staging",
  token: "test-only-token",
  client_name: "Fixture",
  warehouse_name: "Fixture warehouse",
  origin_pin: "600034",
  seller_name: "Fixture",
  seller_gstin: "33ABCDE1234F1Z5",
  enabled: false,
  version: 1,
};
const shipment: Shipment = {
  ...shipmentSchema.parse({
    id: "11111111-1111-4111-8111-111111111111",
    project_id: "22222222-2222-4222-8222-222222222222",
    expected_version: 0,
    request_id: "33333333-3333-4333-8333-333333333333",
    method: "delhivery",
    label: "Office",
    gift_sets: 60,
    recipient_name: "Test recipient",
    phone: "+91 98765 43210",
    address: "10 Example Road",
    city: "Chennai",
    state: "Tamil Nadu",
    postal_code: "600034",
  }),
  provider_reference: "g-fixture",
  tracking_reference: "123456789012",
  status: "booked",
  booking_state: "booked",
  tracking_url: "",
  provider_status: "Manifested",
  provider_time: null,
  pickup_state: "none",
  pickup_reference: null,
  version: 1,
  created_at: "2026-11-20T00:00:00Z",
  last_sync_at: null,
};
const parcel = parcelSchema.parse({
  weight_g: 1000,
  length_cm: 20,
  width_cm: 15,
  height_cm: 10,
  declared_value_paise: 60000,
  description: "Custom gifts",
  hsn_code: "4911",
  invoice_reference: "INV-TEST",
});
afterEach(() => vi.unstubAllGlobals());
describe("Delhivery documented contract", () => {
  it("uses prepaid form encoding, stable order reference, grams/cm and actual invoice fields", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        packages: [
          { status: "Success", waybill: "123456789012", refnum: "g-fixture" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await createParcel(config, shipment, parcel)).toBe("123456789012");
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(
      "https://staging-express.delhivery.com/api/cmu/create.json",
    );
    expect(options.headers.Authorization).toBe("Token test-only-token");
    expect(options.redirect).toBe("error");
    const form = new URLSearchParams(options.body);
    expect(form.get("format")).toBe("json");
    const body = JSON.parse(form.get("data")!);
    expect(body.pickup_location.name).toBe(config.warehouse_name);
    expect(body.shipments[0]).toMatchObject({
      order: "g-fixture",
      phone: "9876543210",
      payment_mode: "Prepaid",
      cod_amount: "0",
      quantity: "60",
      total_amount: "600.00",
      weight: "1000",
      shipment_length: "20",
      seller_inv: "INV-TEST",
    });
    expect(
      manifestPayload(config, shipment, { ...parcel, ewaybill: "123456789012" })
        .shipments[0],
    ).toHaveProperty("ewbn", "123456789012");
  });
  it("does not silently accept a failed or mismatched manifest", async () => {
    for (const data of [
      { success: false, packages: [] },
      {
        success: true,
        packages: [
          { status: "Success", waybill: "123456789012", refnum: "different" },
        ],
      },
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
      await expect(createParcel(config, shipment, parcel)).rejects.toThrow(
        "UNCONFIRMED",
      );
    }
  });
  it("checks the exact PIN, prepaid availability and embargo remarks", async () => {
    for (const [pin, pre_paid, remarks, expected] of [
      [600034, "Y", "", true],
      [600035, "Y", "", false],
      [600034, "N", "", false],
      [600034, "Y", "Embargo", false],
    ] as const) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          Response.json({
            delivery_codes: [{ postal_code: { pin, pre_paid, remarks } }],
          }),
        ),
      );
      expect((await checkPin(config, "600034")).serviceable).toBe(expected);
    }
  });
  it("matches tracking identity, interprets India time and keeps returns distinct from delivery", () => {
    const data = (status: string, type: string, ref = "g-fixture") => ({
      ShipmentData: [
        {
          Shipment: {
            AWB: shipment.tracking_reference,
            ReferenceNo: ref,
            Status: {
              Status: status,
              StatusType: type,
              StatusDateTime: "2026-11-20T10:30:00",
            },
          },
        },
      ],
    });
    expect(
      parseTracking(
        data("Delivered", "DL"),
        shipment.tracking_reference,
        "g-fixture",
      ),
    ).toMatchObject({
      status: "delivered",
      provider_time: "2026-11-20T05:00:00.000Z",
    });
    expect(
      parseTracking(
        data("Delivered", "RT"),
        shipment.tracking_reference,
        "g-fixture",
      )?.status,
    ).toBe("returned");
    expect(() =>
      parseTracking(
        data("Delivered", "DL", "other"),
        shipment.tracking_reference,
        "g-fixture",
      ),
    ).toThrow("MISMATCH");
    expect(carrierStatus("Undelivered", "UD")).toBe("exception");
    expect(carrierStatus("Delivered", "UD")).not.toBe("delivered");
  });
  it("sends one pickup request with physical parcel count", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ pickup_id: 12345 }));
    vi.stubGlobal("fetch", fetcher);
    expect(
      await requestPickup(config, {
        date: "2026-11-25",
        time: "14:00:00",
        packages: 2,
      }),
    ).toBe("12345");
    const [url, options] = fetcher.mock.calls[0];
    expect(url.endsWith("/fm/request/new/")).toBe(true);
    expect(JSON.parse(options.body)).toMatchObject({
      expected_package_count: 2,
      pickup_location: config.warehouse_name,
    });
  });
  it("bounds batches and fails safely without exposing provider response bodies", async () => {
    await expect(trackParcels(config, [])).rejects.toThrow("BATCH_INVALID");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("secret-provider-details", { status: 401 }),
        ),
    );
    await expect(checkPin(config, "600034")).rejects.toThrow(
      /^DELHIVERY_HTTP_401$/,
    );
  });
  it("requires invoice details and an existing e-waybill for high declared value", () => {
    expect(
      parcelSchema.safeParse({ ...parcel, declared_value_paise: 5000000 })
        .success,
    ).toBe(false);
    expect(
      parcelSchema.safeParse({
        ...parcel,
        declared_value_paise: 5000000,
        ewaybill: "123456789012",
      }).success,
    ).toBe(true);
  });
});

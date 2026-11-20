// Explicit disposable localhost fixture; never included in a deployed application.
import postgres from "postgres";
import { appendFileSync, mkdirSync } from "node:fs";
const db = new URL(process.env.DATABASE_URL || "");
if (
  !["localhost", "127.0.0.1"].includes(db.hostname) ||
  !/^\/gyvft_shipping_browser_/.test(db.pathname)
)
  throw Error("Dedicated local shipping fixture required");
process.env.RESEND_API_KEY = "";
process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = "";
globalThis.__gyvftSql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 5,
});
const original = globalThis.fetch,
  parcels = new Map();
let n = 0;
mkdirSync("work", { recursive: true });
globalThis.fetch = async (input, init) => {
  const u = new URL(
    typeof input === "string" ? input : input.url || String(input),
  );
  if (
    ["track.delhivery.com", "staging-express.delhivery.com"].includes(
      u.hostname,
    )
  ) {
    const kind = u.pathname.includes("create.json")
      ? "manifest"
      : u.pathname.includes("request/new")
        ? "pickup"
        : u.pathname.includes("pin-codes")
          ? "pin"
          : "tracking";
    appendFileSync(
      "work/shipping-browser-calls.jsonl",
      JSON.stringify({ kind }) + "\n",
    );
    if (kind === "pin")
      return Response.json({
        delivery_codes: [
          {
            postal_code: {
              pin: 600034,
              pre_paid: "Y",
              remarks: "",
              city: "Chennai",
            },
          },
        ],
      });
    if (kind === "manifest") {
      await new Promise((r) => setTimeout(r, 350));
      const d = JSON.parse(new URLSearchParams(init.body).get("data"));
      const ref = d.shipments[0].order,
        awb = String(876543210000 + ++n);
      parcels.set(awb, ref);
      return Response.json({
        success: true,
        packages: [{ status: "Success", waybill: awb, refnum: ref }],
      });
    }
    if (kind === "pickup") {
      const count = JSON.parse(init.body).expected_package_count;
      if (count !== 2) throw Error("Pickup must count two physical parcels");
      return Response.json({ pickup_id: "LOCAL-PICKUP-2" });
    }
    const awbs = u.searchParams.get("waybill")?.split(",") || [
      ...parcels.keys(),
    ];
    return Response.json({
      ShipmentData: awbs
        .filter((a) => parcels.has(a))
        .map((awb) => ({
          Shipment: {
            AWB: awb,
            ReferenceNo: parcels.get(awb),
            Status: {
              Status: "Delivered",
              StatusType: "DL",
              StatusDateTime: "2026-11-24T12:00:00",
            },
          },
        })),
    });
  }
  if (!["localhost", "127.0.0.1"].includes(u.hostname))
    throw Error("External access blocked by shipping fixture");
  return original(input, init);
};

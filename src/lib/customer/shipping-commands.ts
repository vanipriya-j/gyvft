import "server-only";
import { z } from "zod";
import {
  shipmentsForProject,
  saveShippingPlan,
  saveShipment,
  archiveShipment,
  manualShipmentStatus,
  bookDelhivery,
  refreshDelhivery,
  scheduleDelhiveryPickup,
} from "./shipping";
import {
  shippingSettingsStatus,
  saveShippingSettings,
  testShippingConnection,
  shippingError,
} from "./shipping-settings";
export async function shippingCommand(raw: Record<string, unknown>) {
  const { op, ...data } = raw;
  if (op === "shipping_settings_status")
    return { ok: true, settings: await shippingSettingsStatus() };
  if (op === "shipping_settings_save") {
    await saveShippingSettings(data);
    return {
      ok: true,
      settings: await shippingSettingsStatus(),
      message:
        "Delhivery settings saved. The API key will not be displayed again. No shipment was booked.",
    };
  }
  if (op === "shipping_settings_test")
    return {
      ok: true,
      ...(await testShippingConnection(
        z.enum(["staging", "production"]).parse(data.environment),
      )),
    };
  const id = z.string().uuid().parse(data.project_id);
  if (op === "shipping_detail")
    return { ok: true, shipping: await shipmentsForProject(id) };
  if (op === "shipping_plan") await saveShippingPlan(data);
  else if (op === "shipping_save") await saveShipment(data);
  else if (op === "shipping_archive") await archiveShipment(data);
  else if (op === "shipping_manual") await manualShipmentStatus(data);
  else if (op === "shipping_book") await bookDelhivery(data);
  else if (op === "shipping_refresh")
    await refreshDelhivery(id, z.string().uuid().parse(data.id));
  else if (op === "shipping_pickup") await scheduleDelhiveryPickup(data);
  else throw shippingError("Unknown shipping command.");
  const shipping = await shipmentsForProject(id);
  const parcel = shipping.shipments.find((s) => s.id === data.id);
  return {
    ok: true,
    shipping,
    message:
      op === "shipping_book"
        ? parcel?.booking_state === "booked"
          ? "Delhivery parcel booked. Schedule or confirm its warehouse pickup separately."
          : "Booking still needs confirmation. Check the existing carrier reference; do not book again."
        : op === "shipping_pickup"
          ? shipping.shipments
              .filter((s) => Array.isArray(data.ids) && data.ids.includes(s.id))
              .every((s) => s.pickup_state === "requested")
            ? "Warehouse pickup requested. Actual dispatch is confirmed by tracking."
            : "Pickup still needs confirmation. Check existing requests in Delhivery One."
          : "Shipping updated.",
  };
}

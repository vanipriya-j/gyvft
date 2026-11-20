"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import {
  shippingMethods,
  shippingStates,
  allocationMessage,
  type Shipment,
  type ShippingView,
} from "@/lib/customer/shipping-model";
type Post = (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
export function OperationsShipments({
  projectId,
  post,
  onUpdated,
}: {
  projectId: string;
  post: Post;
  onUpdated?: () => Promise<void>;
}) {
  const [view, setView] = useState<ShippingView | null>(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [method, setMethod] = useState<Shipment["method"]>("delhivery"),
    [editing, setEditing] = useState<Shipment | null>(null);
  const newId = useRef(""),
    locked = useRef(false),
    key = useRef<{ value: string; id: string } | null>(null),
    editor = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let active = true;
    post({ op: "shipping_detail", project_id: projectId })
      .then((r) => {
        if (active) setView(r.shipping as ShippingView);
      })
      .catch((e) => {
        if (active) {
          setMessage(e.message);
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [post, projectId]);
  async function run(
    op: string,
    payload: Record<string, unknown> = {},
    label = op,
  ) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(label);
    setMessage("");
    setFailed(false);
    try {
      const value = JSON.stringify({ op, project_id: projectId, ...payload });
      if (key.current?.value !== value)
        key.current = { value, id: crypto.randomUUID() };
      const r = await post({
        op,
        project_id: projectId,
        ...payload,
        request_id: key.current.id,
      });
      key.current = null;
      setView(r.shipping as ShippingView);
      setMessage(String(r.message || "Updated."));
      if (op !== "shipping_detail") await onUpdated?.().catch(() => undefined);
      return true;
    } catch (e) {
      setFailed(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Shipping could not be confirmed. Reload to check before retrying.",
      );
      const r = await post({
        op: "shipping_detail",
        project_id: projectId,
      }).catch(() => null);
      if (r) setView(r.shipping as ShippingView);
      return false;
    } finally {
      locked.current = false;
      setBusy("");
    }
  }
  const field = (
    name: string,
    label: string,
    options: {
      type?: string;
      value?: string | number;
      required?: boolean;
      min?: number;
      max?: number;
      step?: string;
    } = {},
  ) => (
    <label className="app-label" key={name}>
      {label}
      <input
        className="app-input"
        name={name}
        type={options.type || "text"}
        defaultValue={options.value}
        required={options.required}
        min={options.min}
        max={options.max}
        step={options.step}
        maxLength={
          options.type === "number"
            ? undefined
            : name === "address"
              ? 1500
              : 160
        }
      />
    </label>
  );
  function button(id: string, label: string, primary = false) {
    return (
      <button
        className={`app-button app-pending-button ${primary ? "primary" : ""}`}
        aria-label={label}
        disabled={!!busy}
        aria-busy={busy === id}
      >
        <span style={{ visibility: busy === id ? "hidden" : "visible" }}>
          {label}
        </span>
        {busy === id && (
          <span className="app-button-pending">
            <LoaderCircle size={16} className="app-spinner" />
            Working…
          </span>
        )}
      </button>
    );
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    if (!editing && !newId.current) newId.current = crypto.randomUUID();
    const ok = await run(
      "shipping_save",
      {
        id: editing?.id || newId.current,
        expected_version: editing?.version || 0,
        method,
        label: String(f.get("label")),
        gift_sets: Number(f.get("gift_sets")),
        ...Object.fromEntries(
          [
            "recipient_name",
            "phone",
            "address",
            "city",
            "state",
            "postal_code",
            "courier_name",
          ].map((k) => [k, String(f.get(k) || "")]),
        ),
      },
      "destination",
    );
    if (ok) {
      newId.current = "";
      setEditing(null);
      form.reset();
    }
  }
  const pickup =
    view?.shipments.filter(
      (s) =>
        s.method === "delhivery" &&
        s.booking_state === "booked" &&
        s.status === "booked" &&
        s.pickup_state === "none",
    ) || [];
  return (
    <section className="app-panel full">
      <h2>Shipments & collection</h2>
      <p className="app-muted">
        One order can use Delhivery, Porter, another courier or store pickup.
        Record each physical parcel and its gift-set quantity separately.
      </p>
      {!view && !message && <p role="status">Loading delivery plan…</p>}
      {view && !view.available && (
        <p className="app-alert">
          Shipping awaits its approved database update. Existing order controls
          remain available.
        </p>
      )}
      {view?.available && (
        <>
          <form
            key={view.plan?.version || 0}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(
                "shipping_plan",
                {
                  expected_sets: Number(f.get("expected_sets")),
                  expected_version: view.plan?.version || 0,
                  confirmed_manifest: f.has("confirmed_manifest"),
                },
                "plan",
              );
            }}
            aria-busy={busy === "plan"}
          >
            <div className="app-fields">
              {field("expected_sets", "Confirmed gift sets in this order", {
                type: "number",
                value: view.plan?.expected_sets || 1,
                min: 1,
                max: 100000,
                required: true,
              })}
            </div>
            <label className="app-check">
              <input name="confirmed_manifest" type="checkbox" required />I
              checked this count and the delivery arrangement against the
              approved order.
            </label>
            <div className="app-actions">
              {button(
                "plan",
                view.plan ? "Update gift-set count" : "Confirm delivery plan",
              )}
            </div>
          </form>
          {view.plan && (
            <>
              <p className="app-soft mt-4">
                {view.allocated}/{view.plan.expected_sets} sets allocated ·{" "}
                {view.dispatched}/{view.plan.expected_sets} dispatched ·{" "}
                {view.delivered}/{view.plan.expected_sets} delivered or
                collected
              </p>
              <p className="app-note">
                {allocationMessage(view.plan.expected_sets, view.allocated)}{" "}
                {view.missing > 0
                  ? `${view.missing} parcel address/contact details pending. Enquiry planning can continue; booking needs a complete destination.`
                  : ""}
              </p>
              <div className="app-stack">
                {view.shipments.map((s) => (
                  <article className="app-soft" key={s.id}>
                    <div className="app-row">
                      <div>
                        <h3>
                          {s.label} · {s.gift_sets} sets
                        </h3>
                        <p>
                          {shippingMethods[s.method]} ·{" "}
                          {shippingStates[s.status]}
                        </p>
                      </div>
                      <span className="app-badge">
                        {s.booking_state === "uncertain"
                          ? "Check booking"
                          : s.booking_state === "creating"
                            ? "Booking in progress"
                            : s.tracking_reference || "Not dispatched"}
                      </span>
                    </div>
                    <p className="app-note whitespace-pre-wrap">
                      {[
                        s.recipient_name,
                        s.address,
                        [s.city, s.state, s.postal_code]
                          .filter(Boolean)
                          .join(", "),
                        s.phone,
                      ]
                        .filter(Boolean)
                        .join("\n")}
                    </p>
                    {s.method === "delhivery" &&
                      s.booking_state !== "draft" && (
                        <>
                          <p className="app-note">
                            Carrier reference: {s.provider_reference}.{" "}
                            {s.provider_status
                              ? `Last carrier status: ${s.provider_status}.`
                              : "Booking is not dispatch confirmation."}{" "}
                            Pickup:{" "}
                            {{
                              none: "Not requested",
                              requesting: "Request in progress",
                              requested: "Requested",
                              uncertain: "Check existing request",
                            }[s.pickup_state] || "Check existing request"}
                            {s.pickup_reference
                              ? ` · ${s.pickup_reference}`
                              : ""}
                            .
                          </p>
                          {s.has_sync_issue && (
                            <p role="status" className="app-note">
                              Carrier refresh pending. The last confirmed status
                              is shown.
                            </p>
                          )}
                          <div className="app-actions">
                            <button
                              type="button"
                              className="app-button"
                              disabled={!!busy}
                              onClick={() =>
                                void run(
                                  "shipping_refresh",
                                  { id: s.id },
                                  "tracking:" + s.id,
                                )
                              }
                            >
                              {busy === "tracking:" + s.id
                                ? "Checking…"
                                : s.booking_state === "uncertain" ||
                                    s.booking_state === "creating"
                                  ? "Check booking by reference"
                                  : "Refresh carrier tracking"}
                            </button>
                            <a
                              className="app-button quiet"
                              href="https://one.delhivery.com"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Labels & booking reconciliation in Delhivery One ↗
                            </a>
                          </div>
                        </>
                      )}
                    {s.booking_state === "draft" && s.status === "draft" && (
                      <div className="app-actions">
                        <button
                          type="button"
                          disabled={!!busy}
                          className="app-button"
                          onClick={() => {
                            setEditing(s);
                            setMethod(s.method);
                            editor.current?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                          }}
                        >
                          Edit parcel details
                        </button>
                        <button
                          type="button"
                          className="app-button quiet"
                          disabled={!!busy}
                          onClick={() =>
                            void run(
                              "shipping_archive",
                              { id: s.id, expected_version: s.version },
                              "archive:" + s.id,
                            )
                          }
                        >
                          Remove unbooked parcel
                        </button>
                      </div>
                    )}
                    {s.method === "delhivery" &&
                      s.booking_state === "draft" && (
                        <details className="mt-3">
                          <summary>Book this parcel with Delhivery</summary>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              void run(
                                "shipping_book",
                                {
                                  id: s.id,
                                  expected_version: s.version,
                                  confirmed: f.has("confirmed"),
                                  parcel: {
                                    weight_g: Number(f.get("weight_g")),
                                    length_cm: Number(f.get("length_cm")),
                                    width_cm: Number(f.get("width_cm")),
                                    height_cm: Number(f.get("height_cm")),
                                    declared_value_paise: Math.round(
                                      Number(f.get("declared_value")) * 100,
                                    ),
                                    description: String(f.get("description")),
                                    hsn_code: String(f.get("hsn_code")),
                                    invoice_reference: String(
                                      f.get("invoice_reference"),
                                    ),
                                    ewaybill: String(f.get("ewaybill") || ""),
                                  },
                                },
                                "book:" + s.id,
                              );
                            }}
                          >
                            <div className="app-fields mt-3">
                              {field("weight_g", "Packed weight (grams)", {
                                type: "number",
                                required: true,
                                min: 1,
                                max: 50000,
                              })}
                              {field("length_cm", "Length (cm)", {
                                type: "number",
                                required: true,
                                min: 0.1,
                                max: 250,
                                step: "0.1",
                              })}
                              {field("width_cm", "Width (cm)", {
                                type: "number",
                                required: true,
                                min: 0.1,
                                max: 250,
                                step: "0.1",
                              })}
                              {field("height_cm", "Height (cm)", {
                                type: "number",
                                required: true,
                                min: 0.1,
                                max: 250,
                                step: "0.1",
                              })}
                              {field(
                                "declared_value",
                                "This parcel's invoice value (₹)",
                                {
                                  type: "number",
                                  required: true,
                                  min: 0.01,
                                  step: "0.01",
                                },
                              )}
                              {field("description", "Contents description", {
                                required: true,
                              })}
                              {field(
                                "hsn_code",
                                "Invoice HSN code(s), comma separated",
                                { required: true },
                              )}
                              {field("invoice_reference", "Invoice reference", {
                                required: true,
                              })}
                              {field(
                                "ewaybill",
                                "Existing e-waybill number, when required",
                              )}
                            </div>
                            <p className="app-note">
                              Prepaid parcel service. Use actual packed
                              dimensions, weight and invoice particulars. This
                              records one parcel, not a multi-piece freight
                              consignment; confirm your account's limits. Full
                              payment and packing must be complete.
                            </p>
                            <label className="app-check">
                              <input
                                name="confirmed"
                                type="checkbox"
                                required
                              />
                              I checked the address, invoice and parcel details
                              and authorise this live Delhivery booking.
                            </label>
                            <div className="app-actions">
                              {button(
                                "book:" + s.id,
                                "Book live Delhivery parcel",
                                true,
                              )}
                            </div>
                          </form>
                        </details>
                      )}
                    {s.method !== "delhivery" &&
                      !["delivered", "collected", "returned"].includes(
                        s.status,
                      ) && (
                        <form
                          className="mt-3"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void run(
                              "shipping_manual",
                              {
                                id: s.id,
                                expected_version: s.version,
                                status: String(f.get("status")),
                                tracking_reference: String(
                                  f.get("tracking_reference") || "",
                                ),
                                tracking_url: String(
                                  f.get("tracking_url") || "",
                                ),
                                confirmed: f.has("confirmed"),
                              },
                              "manual:" + s.id,
                            );
                          }}
                        >
                          <div className="app-fields">
                            <label className="app-label">
                              Actual status
                              <select name="status" className="app-input">
                                {(s.method === "pickup"
                                  ? s.status === "draft" ||
                                    s.status === "exception"
                                    ? ["ready_for_pickup"]
                                    : ["collected", "exception"]
                                  : s.status === "draft" ||
                                      s.status === "exception"
                                    ? s.status === "exception"
                                      ? ["in_transit", "returned"]
                                      : ["in_transit"]
                                    : ["delivered", "exception", "returned"]
                                ).map((v) => (
                                  <option key={v} value={v}>
                                    {shippingStates[v as Shipment["status"]]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {s.method !== "pickup" &&
                              field(
                                "tracking_reference",
                                "Courier booking/tracking reference",
                                { required: true, value: s.tracking_reference },
                              )}
                            {s.method !== "pickup" &&
                              field(
                                "tracking_url",
                                "Tracking link (optional HTTPS)",
                                { value: s.tracking_url },
                              )}
                          </div>
                          <label className="app-check">
                            <input name="confirmed" type="checkbox" required />I
                            verified this actual shipment or handover status.
                          </label>
                          <div className="app-actions">
                            {button("manual:" + s.id, "Record verified status")}
                          </div>
                        </form>
                      )}
                  </article>
                ))}
              </div>
              {pickup.length > 0 && (
                <details className="app-soft mt-4">
                  <summary>
                    Request one warehouse pickup for {pickup.length} booked
                    parcel{pickup.length === 1 ? "" : "s"}
                  </summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void run(
                        "shipping_pickup",
                        {
                          ids: pickup.map((s) => s.id),
                          date: String(f.get("date")),
                          time: String(f.get("time")) + ":00",
                          confirmed: f.has("confirmed"),
                        },
                        "pickup",
                      );
                    }}
                  >
                    <div className="app-fields mt-3">
                      {field("date", "Pickup date (India time)", {
                        type: "date",
                        required: true,
                      })}
                      {field("time", "Pickup time (India time)", {
                        type: "time",
                        required: true,
                      })}
                    </div>
                    <label className="app-check">
                      <input type="checkbox" name="confirmed" required />
                      These parcels are packed and no existing pickup request
                      covers them. I authorise the pickup request.
                    </label>
                    <div className="app-actions">
                      {button("pickup", "Request warehouse pickup", true)}
                    </div>
                  </form>
                </details>
              )}
              <details className="app-soft mt-4" open={!!editing}>
                <summary>
                  {editing
                    ? "Edit unbooked parcel"
                    : "Add a parcel or store collection"}
                </summary>
                <form
                  key={editing?.id || "new"}
                  ref={editor}
                  onSubmit={save}
                  aria-busy={busy === "destination"}
                >
                  <label className="app-label mt-3">
                    Delivery method
                    <select
                      className="app-input"
                      value={method}
                      onChange={(e) =>
                        setMethod(e.target.value as Shipment["method"])
                      }
                    >
                      {Object.entries(shippingMethods).map(([v, l]) => (
                        <option value={v} key={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="app-fields">
                    {field("label", "Destination label", {
                      required: true,
                      value: editing?.label,
                    })}
                    {field(
                      "gift_sets",
                      "Gift sets in this parcel / collection",
                      {
                        type: "number",
                        min: 1,
                        max: view.plan.expected_sets,
                        required: true,
                        value: editing?.gift_sets || 1,
                      },
                    )}
                    {field(
                      "recipient_name",
                      "Recipient or collection contact",
                      { required: true, value: editing?.recipient_name },
                    )}
                    {field("phone", "Delivery contact phone", {
                      value: editing?.phone,
                    })}
                    {field(
                      "address",
                      method === "pickup"
                        ? "Store collection address"
                        : "Address (may be confirmed later)",
                      { value: editing?.address },
                    )}
                    {method !== "pickup" &&
                      field("city", "City", { value: editing?.city })}
                    {method !== "pickup" &&
                      field("state", "State", { value: editing?.state })}
                    {method !== "pickup" &&
                      field("postal_code", "PIN code", {
                        value: editing?.postal_code,
                      })}
                    {method === "other" &&
                      field("courier_name", "Courier name", {
                        required: true,
                        value: editing?.courier_name,
                      })}
                  </div>
                  <p className="app-note">
                    Missing addresses can stay pending during planning.
                    Delhivery booking requires complete contact/address details;
                    bulk office delivery needs no employee home addresses.
                  </p>
                  <div className="app-actions">
                    {button(
                      "destination",
                      editing ? "Save parcel changes" : "Add to delivery plan",
                      true,
                    )}
                    {editing && (
                      <button
                        type="button"
                        className="app-button"
                        onClick={() => setEditing(null)}
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                </form>
              </details>
            </>
          )}
        </>
      )}
      <p
        className={failed ? "app-alert mt-3" : "app-note mt-3"}
        role={failed ? "alert" : "status"}
      >
        {message}
      </p>
      <p className="app-note">
        Booking is not dispatch. Partial delivery does not complete the whole
        order. Shopify remains the official order/payment record; these actions
        do not automatically mark its single batch line fulfilled.
      </p>
    </section>
  );
}

"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import type { ShippingSettingsStatus } from "@/lib/customer/shipping-settings";
type Post = (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
export function ShippingSettings({ post }: { post: Post }) {
  const [data, setData] = useState<ShippingSettingsStatus | null>(null),
    [environment, setEnvironment] = useState<"staging" | "production">(
      "staging",
    ),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  const lock = useRef(false),
    pending = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    let active = true;
    post({ op: "shipping_settings_status" })
      .then((r) => {
        if (active) setData(r.settings as ShippingSettingsStatus);
      })
      .catch((e) => {
        if (active) {
          setFailed(true);
          setMessage(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [post]);
  const current = data?.settings.find((s) => s.environment === environment);
  async function run(op: string, payload: Record<string, unknown> = {}) {
    if (lock.current) return;
    lock.current = true;
    setBusy(op);
    setMessage("");
    setFailed(false);
    try {
      const key = JSON.stringify({ op, environment, ...payload });
      if (pending.current?.key !== key)
        pending.current = { key, id: crypto.randomUUID() };
      const result = await post({
        op,
        environment,
        ...payload,
        ...(op === "shipping_settings_save"
          ? { request_id: pending.current.id }
          : {}),
      });
      pending.current = null;
      setMessage(String(result.message || "Updated."));
      if (result.settings) setData(result.settings as ShippingSettingsStatus);
      else {
        const r = await post({ op: "shipping_settings_status" });
        setData(r.settings as ShippingSettingsStatus);
      }
    } catch (e) {
      setFailed(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not confirm the settings change.",
      );
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    await run("shipping_settings_save", {
      expected_version: current?.version || 0,
      api_key: String(f.get("api_key") || ""),
      client_name: String(f.get("client_name") || ""),
      warehouse_name: String(f.get("warehouse_name") || ""),
      origin_pin: String(f.get("origin_pin") || ""),
      seller_name: String(f.get("seller_name") || ""),
      seller_gstin: String(f.get("seller_gstin") || ""),
      enabled: f.has("enabled"),
    });
    const token = form.elements.namedItem("api_key") as HTMLInputElement | null;
    if (token) token.value = "";
  }
  function button(op: string, label: string, primary = false) {
    return (
      <button
        type={op === "shipping_settings_save" ? "submit" : "button"}
        aria-label={label}
        aria-busy={busy === op}
        disabled={
          !!busy ||
          !data?.available ||
          (op === "shipping_settings_save" && !data.encryptionReady) ||
          (op === "shipping_settings_test" && !current)
        }
        className={`app-button app-pending-button ${primary ? "primary" : ""}`}
        onClick={
          op === "shipping_settings_test" ? () => void run(op) : undefined
        }
      >
        <span style={{ visibility: busy === op ? "hidden" : "visible" }}>
          {label}
        </span>
        {busy === op && (
          <span className="app-button-pending">
            <LoaderCircle size={16} className="app-spinner" />
            Working…
          </span>
        )}
      </button>
    );
  }
  return (
    <section className="app-panel mb-4">
      <h2>Delhivery connection</h2>
      <p className="app-muted">
        API bookings and tracking for Delhivery parcels. Porter, other couriers
        and store pickup remain manual.
      </p>
      {!data && !message && (
        <p className="app-note" role="status">
          Loading connection settings…
        </p>
      )}
      {data && !data.available && (
        <p className="app-alert">
          Shipping is awaiting its approved database update. No setup or
          migration runs when you open this page.
        </p>
      )}
      {data?.available && !data.encryptionReady && (
        <p className="app-alert">
          Server encryption needs INTEGRATION_ENCRYPTION_KEY (at least 32
          characters) before API tokens can be saved. Your Delhivery token
          belongs in this form.
        </p>
      )}
      <label className="app-label mt-3">
        Environment
        <select
          className="app-input"
          value={environment}
          onChange={(e) => {
            setEnvironment(e.target.value as "staging" | "production");
            setMessage("");
          }}
          disabled={!!busy}
        >
          <option value="staging">Test / staging</option>
          <option value="production">Live / production</option>
        </select>
      </label>
      <form
        key={environment + ":" + (current?.version || 0)}
        onSubmit={save}
        aria-busy={!!busy}
      >
        <fieldset disabled={!!busy || !data?.available}>
          <label className="app-label">
            Delhivery API key
            <input
              name="api_key"
              className="app-input"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              maxLength={500}
              placeholder={
                current?.has_key
                  ? "A key is stored. Leave blank to keep it."
                  : "Paste the token for this environment"
              }
              required={!current}
            />
          </label>
          <p className="app-note">
            Encrypted on the server. The stored key is never returned to this
            browser. Use a different token for staging and production.
          </p>
          <div className="app-fields">
            {(
              [
                ["client_name", "Exact Delhivery client name"],
                ["warehouse_name", "Registered pickup warehouse name"],
                ["origin_pin", "Pickup PIN code"],
                ["seller_name", "Seller name"],
                ["seller_gstin", "Seller GSTIN registered with Delhivery"],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="app-label">
                {label}
                <input
                  className="app-input"
                  name={name}
                  defaultValue={String(current?.[name] || "")}
                  required
                  maxLength={
                    name === "origin_pin"
                      ? 6
                      : name === "seller_gstin"
                        ? 15
                        : 160
                  }
                  pattern={name === "origin_pin" ? "[1-9][0-9]{5}" : undefined}
                />
              </label>
            ))}
          </div>
          {environment === "production" && (
            <label className="app-check">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={!!current?.enabled}
              />
              I confirmed the registered warehouse and authorise live Delhivery
              bookings from this account.
            </label>
          )}
          <div className="app-actions">
            {button("shipping_settings_save", "Save Delhivery settings", true)}
            {button("shipping_settings_test", "Test saved API connection")}
          </div>
          {current && (
            <p className="app-note">
              {current.tested_at
                ? `Connection checked ${new Date(current.tested_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"}.`
                : "Saved credentials have not been connection-tested."}{" "}
              {environment === "production"
                ? current.enabled
                  ? "Live bookings enabled."
                  : "Live bookings disabled."
                : "Staging never books real customer shipments."}
            </p>
          )}
        </fieldset>
      </form>
      <p
        role={failed ? "alert" : "status"}
        className={failed ? "app-alert mt-3" : "app-note mt-3"}
      >
        {message}
      </p>
      <p className="app-note">
        Saving or testing credentials creates no shipment. Pickup warehouse
        names are case-sensitive; register the warehouse in Delhivery One first.
      </p>
    </section>
  );
}

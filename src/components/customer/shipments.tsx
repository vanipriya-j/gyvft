"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/navigation-link";
import {
  shippingMethods,
  shippingStates,
  type ShippingView,
} from "@/lib/customer/shipping-model";
export function CustomerShipments({
  projectId,
  initial,
}: {
  projectId: string;
  initial: ShippingView;
}) {
  const router = useRouter(),
    totals = useRef(`${initial.dispatched}:${initial.delivered}`);
  const [view, setView] = useState<ShippingView>(initial),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async (followup: boolean) => {
      try {
        const r = await fetch(
          `/api/customer/shipments?project_id=${encodeURIComponent(projectId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await r.json();
        if (!r.ok)
          throw Error(
            body.error?.message ||
              "Delivery updates are temporarily unavailable.",
          );
        if (active) {
          const next = `${body.shipping.dispatched}:${body.shipping.delivered}`;
          if (totals.current !== next) {
            totals.current = next;
            router.refresh();
          }
          setView(body.shipping);
          setError("");
          if (!followup && body.shipping.plan)
            timer = setTimeout(() => void load(true), 3000);
        }
      } catch (e) {
        if (active && !controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "Delivery updates are temporarily unavailable.",
          );
      }
    };
    void load(false);
    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [projectId, router]);
  if (!view?.plan) return null;
  return (
    <section className="app-panel">
      <h2>Your deliveries</h2>
      <p className="app-muted">
        {view.delivered} of {view.plan.expected_sets} gift sets delivered or
        collected. Each destination has its own progress.
      </p>
      {error && (
        <p className="app-muted text-sm" role="status">
          {error} Your last confirmed delivery details are shown.
        </p>
      )}
      {view.missing > 0 && (
        <p className="app-muted text-sm">
          The team is confirming {view.missing} destination
          {view.missing === 1 ? "" : "s"}. Other destinations keep their own
          delivery status.
        </p>
      )}
      {!view.shipments.length && (
        <p className="app-muted text-sm">
          Your delivery plan is being prepared.
        </p>
      )}
      {view.shipments.map((s) => (
        <article className="app-row" key={s.id}>
          <div>
            <h3>
              {s.label} · {s.gift_sets} gift set{s.gift_sets === 1 ? "" : "s"}
            </h3>
            <p>
              {shippingMethods[s.method]} · {shippingStates[s.status]}
            </p>
            {s.city && (
              <p className="app-muted text-sm">
                {s.city}
                {s.postal_code ? ` · ${s.postal_code}` : ""}
              </p>
            )}
            {s.method === "pickup" && s.address && (
              <p className="app-muted text-sm whitespace-pre-wrap">
                Collect from: {s.address}
              </p>
            )}
            {s.tracking_reference && (
              <p className="app-muted text-sm">
                Tracking / booking reference: {s.tracking_reference}
              </p>
            )}
            {s.has_sync_issue && (
              <p className="app-muted text-sm">
                The latest carrier update is delayed. Your last confirmed status
                is shown.
              </p>
            )}
            {s.tracking_url && (
              <a
                className="app-button mt-2"
                href={s.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Track this parcel ↗
              </a>
            )}
          </div>
        </article>
      ))}
      <Link
        className="app-button mt-3"
        href={`/account/projects/${projectId}?view=messages`}
      >
        Ask about a delivery →
      </Link>
    </section>
  );
}

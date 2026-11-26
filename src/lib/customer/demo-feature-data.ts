import "server-only";
import { demoAccounts } from "./demo-accounts";
import { demoKey, demoScenarios } from "./demo-fixtures";
import type { Shipment, ShippingView } from "./shipping-model";
export const demoProjectSpecs = demoAccounts.flatMap((account) => {
  const scenario = demoScenarios[account.kind],
    active = scenario.active.map((g) => ({
      stage: Number(g[1]),
      quantity: Number(g[2]),
    })),
    past = scenario.past.map((_, i) => ({
      stage: 10,
      quantity: account.kind === "single" ? 1 : 10 + i * 4,
    }));
  return [...active, ...past].map((gift, index) => ({
    accountId: account.id,
    projectId: demoKey(`${account.kind}:gift:${index}`),
    submissionKey: `gyvft-demo-v1-${account.kind}-${index}`,
    kind: account.kind,
    ...gift,
  }));
});
export function sampleRequirementSource(id: string) {
  return (
    demoProjectSpecs.find(
      (p) => demoKey(`${p.projectId}:demo-requirement`) === id,
    ) || null
  );
}
export function sampleGallerySource(id: string) {
  for (const p of demoProjectSpecs)
    for (const index of [0, 1]) {
      const option = demoKey(`${p.projectId}:option:${index}`);
      if (demoKey(`${option}:demo-extra`) === id)
        return {
          ...p,
          optionId: option,
          sourceOptionId: demoKey(`${p.projectId}:option:${1 - index}`),
        };
    }
  return null;
}
export function sampleGalleryImages(projectId: string, optionId: string) {
  const p = demoProjectSpecs.find((p) => p.projectId === projectId);
  if (
    !p ||
    ![
      demoKey(`${projectId}:option:0`),
      demoKey(`${projectId}:option:1`),
    ].includes(optionId)
  )
    return [];
  return [
    {
      id: demoKey(`${optionId}:demo-extra`),
      kind: "gift-option-image" as const,
      position: 2,
    },
  ];
}
/** A complete readable PDF, generated only from owned fictional brief text. */
export function sampleRequirementPdf(title: string, brief: string) {
  const plain = (title + "\n\n" + brief)
      .replace(/[^\x20-\x7e\n]/g, " ")
      .slice(0, 1600),
    lines = plain
      .split(/\n|(?<=.{75})\s/)
      .slice(0, 30)
      .map((line) => line.replace(/([\\()])/g, "\\$1"));
  const stream = `BT /F1 11 Tf 48 780 Td 14 TL (FICTIONAL GYVFT REQUIREMENT) Tj T* ${lines.map((line) => `(${line}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, obj] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => String(o).padStart(10, "0") + " 00000 n ")
    .join(
      "\n",
    )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
export function sampleShipping(
  spec: (typeof demoProjectSpecs)[number],
  stage = spec.stage,
  now = new Date(),
): ShippingView {
  const total = spec.quantity,
    parts =
      spec.kind === "business" && total > 1
        ? [Math.ceil(total * 0.7), total - Math.ceil(total * 0.7)]
        : [total],
    dispatched = stage >= 9,
    done = stage >= 10;
  const shipments: Shipment[] =
    stage < 8
      ? []
      : parts.map((count, index) => ({
          id: demoKey(`${spec.projectId}:sample-shipment:${index}`),
          project_id: spec.projectId,
          method:
            index === 1
              ? "porter"
              : spec.kind === "single"
                ? "pickup"
                : "other",
          label:
            index === 1 ? "Sample · recipient homes" : "Sample · main delivery",
          gift_sets: count,
          recipient_name:
            index === 1 ? "Sample employee group" : "Sample gifting host",
          phone: "0000000000",
          address: "Fictional address · demonstration only",
          city: index === 1 ? "Bengaluru" : "Chennai",
          state: index === 1 ? "Karnataka" : "Tamil Nadu",
          postal_code: index === 1 ? "560001" : "600001",
          courier_name: index === 1 ? "Porter · sample" : "Sample courier",
          tracking_reference: `DEMO-${spec.kind.toUpperCase()}-${index + 1}`,
          tracking_url: "",
          status: done
            ? spec.kind === "single"
              ? "collected"
              : "delivered"
            : dispatched
              ? "in_transit"
              : spec.kind === "single"
                ? "ready_for_pickup"
                : "booked",
          booking_state: "booked",
          provider_reference: `DEMO-${spec.projectId}-${index}`,
          provider_status: done
            ? "Sample delivery completed"
            : "Sample progress only",
          provider_time: null,
          pickup_state: "none",
          pickup_reference: null,
          version: 1,
          created_at: new Date(now.getTime() - 30 * 86400000).toISOString(),
          last_sync_at: null,
          dispatched_at: dispatched
            ? new Date(now.getTime() - 3 * 86400000).toISOString()
            : null,
          has_sync_issue: false,
        }));
  return {
    available: true,
    plan: stage >= 4 ? { expected_sets: total, version: 1 } : null,
    shipments,
    allocated: shipments.length ? total : 0,
    dispatched: shipments.length && dispatched ? total : 0,
    delivered: shipments.length && done ? total : 0,
    missing: 0,
  };
}

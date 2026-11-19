import "server-only";
import { z } from "zod";
import { getSql } from "@/lib/database/client";
import type { CustomerAccount } from "./session";
import { indiaToday } from "./dashboard-model";
import { pageOf } from "./home-model";
import { homeGifts, homeOccasions, homePayments } from "./home-data";
import { homeInspiration } from "./home-content";
import { savedIdeasFor } from "./saved-ideas";
import { aarlaCatalogue } from "./catalogue";
import { recordCustomerEvent } from "./observability";
export const homeQuery = z
  .object({
    section: z
      .enum([
        "all",
        "gifts",
        "occasions",
        "aarla",
        "saved",
        "payments",
        "inspiration",
      ])
      .default("all"),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
    limit: z.coerce.number().int().min(1).max(20).default(6),
  })
  .strict();
export class CatalogueUnavailable extends Error {}
export type HomeSection<T> =
  | { status: "ready"; data: T }
  | { status: "setup_required" | "unavailable"; data: null };
async function section<T>(load: () => Promise<T>): Promise<HomeSection<T>> {
  try {
    return { status: "ready", data: await load() };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error ? error.code : null;
    const setup = code === "42P01" || code === "42703";
    await recordCustomerEvent("app.error", {
      metadata: {
        route: "/api/customer/home",
        operation: "home",
        code: setup
          ? "HOME_SETUP_REQUIRED"
          : error instanceof CatalogueUnavailable
            ? "HOME_CATALOGUE_UNAVAILABLE"
            : "HOME_READ_FAILED",
        status: 503,
      },
    });
    return { status: setup ? "setup_required" : "unavailable", data: null };
  }
}
/** Call directly from an authenticated Server Component, or through the BFF.
 * Personal data is never placed in a shared cache. Each section fails separately. */
export async function customerHome(
  account: CustomerAccount,
  query: z.infer<typeof homeQuery>,
  now = new Date(),
  options: { deferExternalCatalogue?: boolean } = {},
) {
  const today = indiaToday(now),
    { offset, limit } = query;
  const loaders = {
    gifts: () => homeGifts(account.id, offset, limit),
    occasions: () => homeOccasions(account.id, today, offset, limit),
    saved: () => savedIdeasFor(account.id, offset, limit),
    payments: () => homePayments(account.id, today, offset, limit),
    inspiration: async () => {
      const idea = homeInspiration();
      if (!idea) return null;
      const rows =
        await getSql()`SELECT story_slug FROM gyvft_customer_saved_ideas WHERE account_id=${account.id}::uuid AND story_slug=${idea.id}`;
      return { ...idea, saved: rows.length > 0 };
    },
    aarla: async () => {
      const catalogue = await aarlaCatalogue();
      if (!catalogue.available) throw new CatalogueUnavailable();
      let saved: { product_id: string }[] = [],
        savingAvailable = true;
      try {
        saved = await getSql()<
          { product_id: string }[]
        >`SELECT product_id FROM gyvft_customer_saved_products WHERE account_id=${account.id}::uuid`;
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error.code === "42P01" || error.code === "42703")
        )
          savingAvailable = false;
        else throw error;
      }
      const savedIds = new Set(saved.map((s) => s.product_id));
      const available = catalogue.allProducts
        .filter((p) => p.available)
        .map((p) => ({ ...p, saved: savedIds.has(p.id) }));
      return {
        ...pageOf(available, offset, limit),
        savingAvailable,
        currency: "INR",
        priceNotice: "Prices and availability are confirmed at Aarla.",
      };
    },
  };
  // Invoke only the requested section on next/previous; don't refetch everything.
  const requested = (
    name: Exclude<z.infer<typeof homeQuery>["section"], "all">,
  ) => query.section === "all" || query.section === name;
  const [gifts, occasions, saved, payments, inspiration, aarla] =
    await Promise.all([
      requested("gifts") ? section(loaders.gifts) : undefined,
      requested("occasions") ? section(loaders.occasions) : undefined,
      requested("saved") ? section(loaders.saved) : undefined,
      requested("payments") ? section(loaders.payments) : undefined,
      requested("inspiration") ? section(loaders.inspiration) : undefined,
      requested("aarla") && !options.deferExternalCatalogue
        ? section(loaders.aarla)
        : undefined,
    ]);
  return {
    version: 1 as const,
    generatedAt: now.toISOString(),
    today,
    timeZone: "Asia/Kolkata" as const,
    account: { displayName: null as string | null },
    sections: {
      ...(gifts ? { gifts } : {}),
      ...(occasions ? { occasions } : {}),
      ...(saved ? { saved } : {}),
      ...(payments ? { payments } : {}),
      ...(inspiration ? { inspiration } : {}),
      ...(aarla ? { aarla } : {}),
    },
  };
}

export type CustomerHome = Awaited<ReturnType<typeof customerHome>>;

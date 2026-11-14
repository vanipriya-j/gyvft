"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCustomerAccount } from "@/lib/customer/session";
import { getSql } from "@/lib/database/client";
import { ownedProject } from "@/lib/customer/data";
import { dateKey } from "@/lib/customer/dashboard-model";
import { stories } from "@/content/stories";
import { assertPublicFormRateLimit } from "@/lib/security/memory-guards";
import { recordCustomerEvent } from "@/lib/customer/observability";
const date = z
  .string()
  .refine((value) => dateKey(value) === value, "Choose a valid date.");
const optionalDate = z.union([date, z.literal("")]);
function limit(id: string) {
  assertPublicFormRateLimit({
    ip: id,
    formKey: "customer-dashboard",
    limit: 30,
    windowMs: 60000,
  });
}
async function failure(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "42P01" || code === "42703")
    return {
      ok: false,
      message:
        "This feature needs the latest database setup. Please ask GYVFT to finish setup.",
    };
  await recordCustomerEvent("app.error", {
    metadata: {
      route: "/account",
      code: "DASHBOARD_WRITE_FAILED",
      status: 500,
    },
  });
  return {
    ok: false,
    message: "We couldn’t save that. Please try again shortly.",
  };
}
export async function addOccasion(data: FormData) {
  const account = await requireCustomerAccount();
  const parsed = z
    .object({ title: z.string().trim().min(2).max(160), occasion_date: date })
    .safeParse({
      title: data.get("title"),
      occasion_date: data.get("occasion_date"),
    });
  if (!parsed.success)
    return {
      ok: false,
      message: "Add an occasion name and a valid occasion date.",
    };
  try {
    limit(account.id);
    await getSql()`INSERT INTO gyvft_customer_occasions (account_id,title,occasion_date,repeats_annually) VALUES (${account.id}::uuid,${parsed.data.title},${parsed.data.occasion_date}::date,${data.get("repeats_annually") === "on"}) ON CONFLICT DO NOTHING`;
    revalidatePath("/account");
    return { ok: true, message: "Occasion saved to your private calendar." };
  } catch (error) {
    return failure(error);
  }
}
export async function removeOccasion(id: string, _data: FormData) {
  void _data;
  const account = await requireCustomerAccount();
  if (!z.string().uuid().safeParse(id).success)
    return { ok: false, message: "Occasion unavailable." };
  try {
    limit(account.id);
    const removed =
      await getSql()`DELETE FROM gyvft_customer_occasions WHERE id=${id}::uuid AND account_id=${account.id}::uuid RETURNING id`;
    revalidatePath("/account");
    return {
      ok: removed.length > 0,
      message: removed.length ? "Occasion removed." : "Occasion unavailable.",
    };
  } catch (error) {
    return failure(error);
  }
}
export async function saveIdea(data: FormData) {
  const account = await requireCustomerAccount();
  const slug = String(data.get("slug") || "");
  const intent = data.get("intent");
  if (
    !stories.some((s) => s.slug === slug && s.status === "ready") ||
    !["save", "remove"].includes(String(intent))
  )
    return { ok: false, message: "Idea unavailable." };
  try {
    limit(account.id);
    if (intent === "save")
      await getSql()`INSERT INTO gyvft_customer_saved_ideas(account_id,story_slug) VALUES (${account.id}::uuid,${slug}) ON CONFLICT DO NOTHING`;
    else
      await getSql()`DELETE FROM gyvft_customer_saved_ideas WHERE account_id=${account.id}::uuid AND story_slug=${slug}`;
    revalidatePath("/account");
    return {
      ok: true,
      message: intent === "save" ? "Idea saved." : "Idea removed.",
    };
  } catch (error) {
    return failure(error);
  }
}
export async function saveRequestDates(id: string, data: FormData) {
  const account = await requireCustomerAccount();
  if (!(await ownedProject(id, account.id)))
    return { ok: false, message: "Request unavailable." };
  const parsed = z
    .object({ occasion_date: optionalDate, delivery_date: optionalDate })
    .safeParse({
      occasion_date: data.get("occasion_date") || "",
      delivery_date: data.get("delivery_date") || "",
    });
  if (!parsed.success)
    return {
      ok: false,
      message: "Use valid occasion and delivery dates, or leave them blank.",
    };
  try {
    limit(account.id);
    const rows =
      await getSql()`UPDATE customer_projects SET occasion_date=${parsed.data.occasion_date || null}::date,delivery_date=${parsed.data.delivery_date || null}::date WHERE id=${id}::uuid AND customer_account_id=${account.id}::uuid RETURNING id`;
    revalidatePath("/account");
    revalidatePath(`/account/projects/${id}`);
    return {
      ok: rows.length > 0,
      message: rows.length
        ? "Your occasion and requested delivery dates are saved."
        : "Request unavailable.",
    };
  } catch (error) {
    return failure(error);
  }
}

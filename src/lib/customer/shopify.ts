import "server-only";
import { getSql } from "@/lib/database/client";
import { after } from "next/server";
import { demoAccountIds, isDemoAccount } from "./demo-accounts";
import { quoteTotal, type OrderItem } from "./pilot-model";
export const CUSTOMER_LOOKUP = `query GYVFTCustomer($query:String!){customers(first:20,query:$query){nodes{id email}}}`;
export const CUSTOMER_CREATE = `mutation GYVFTCustomerCreate($input:CustomerInput!){customerCreate(input:$input){customer{id email} userErrors{field message}}}`;
export const ORDER_LOOKUP = `query GYVFTOrder($query:String!){orders(first:2,query:$query){nodes{id name customer{id} totalPriceSet{shopMoney{amount currencyCode}} totalReceivedSet{shopMoney{amount currencyCode}}}}}`;
export const ORDER_CREATE = `mutation GYVFTOrderCreate($order:OrderCreateOrderInput!,$options:OrderCreateOptionsInput){orderCreate(order:$order,options:$options){order{id name} userErrors{field message}}}`;
// A specified partial amount is Shopify Plus-only. Omit it to record the full
// outstanding balance, and call only when GYVFT has verified the whole total.
export const RECORD_PAYMENT = `mutation GYVFTRecordPayment($id:ID!){orderCreateManualPayment(id:$id,paymentMethodName:"GYVFT verified direct UPI"){order{id name} userErrors{field message}}}`;
export class ShopifyError extends Error {}
type Customer = { id: string; email: string | null };
type ShopOrder = {
  id: string;
  name: string;
  customer: { id: string } | null;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  totalReceivedSet: { shopMoney: { amount: string; currencyCode: string } };
};
export function shopifyConfigured() {
  return Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
}
export async function shopifyRequest<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN || "aarla-merch.myshopify.com";
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!token)
    throw new ShopifyError(
      "Configure the Shopify server connection before syncing.",
    );
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain))
    throw new ShopifyError("Use the store’s myshopify.com domain.");
  const response = await fetch(
    `https://${domain}/admin/api/2026-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new ShopifyError(
      "Shopify did not confirm the request. Check the connection and access scopes.",
    );
  const result = await response.json();
  if (result.errors?.length || !result.data)
    throw new ShopifyError(
      "Shopify could not complete this operation. Check app permissions and customer-data access.",
    );
  return result.data as T;
}
async function findCustomer(email: string): Promise<Customer | null> {
  const data = await shopifyRequest<{ customers: { nodes: Customer[] } }>(
    CUSTOMER_LOOKUP,
    { query: `email:${JSON.stringify(email)}` },
  );
  const found = data.customers.nodes.filter(
    (c) => c.email?.toLowerCase() === email.toLowerCase(),
  );
  if (found.length > 1)
    throw new ShopifyError(
      "More than one exact customer match needs manual review.",
    );
  return found[0] || null;
}
export async function syncShopifyCustomer(accountId: string) {
  if (isDemoAccount(accountId)) return null;
  if (!shopifyConfigured()) return null;
  const sql = getSql();
  const [existing] =
    await sql`SELECT id,email,shopify_customer_id FROM gyvft_customer_accounts WHERE id=${accountId}::uuid`;
  if (!existing) throw new ShopifyError("Customer account unavailable.");
  if (existing.shopify_customer_id) return String(existing.shopify_customer_id);
  const [claim] =
    await sql`UPDATE gyvft_customer_accounts SET shopify_sync_state='syncing',shopify_sync_attempted_at=now() WHERE id=${accountId}::uuid AND shopify_customer_id IS NULL AND (shopify_sync_state!='syncing' OR shopify_sync_attempted_at<now()-interval '5 minutes') RETURNING id`;
  if (!claim) return null;
  try {
    let customer = await findCustomer(existing.email);
    if (!customer) {
      const created = await shopifyRequest<{
        customerCreate: { customer: Customer | null; userErrors: unknown[] };
      }>(CUSTOMER_CREATE, {
        input: { email: existing.email, tags: ["GYVFT"] },
      });
      customer = created.customerCreate.customer;
      if (!customer) customer = await findCustomer(existing.email);
      if (!customer)
        throw new ShopifyError("Shopify customer creation needs review.");
    }
    await sql`UPDATE gyvft_customer_accounts SET shopify_customer_id=${customer.id},shopify_sync_state='synced' WHERE id=${accountId}::uuid`;
    return customer.id;
  } catch (error) {
    await sql`UPDATE gyvft_customer_accounts SET shopify_sync_state='failed' WHERE id=${accountId}::uuid`;
    throw error;
  }
}
export function scheduleCustomerSync(accountId: string) {
  if (isDemoAccount(accountId)) return;
  if (shopifyConfigured())
    after(async () => {
      try {
        await syncShopifyCustomer(accountId);
      } catch {
        /* Durable pending/failed account state is retried from the operator desk. */
      }
    });
}
export async function syncPendingCustomers() {
  const sql = getSql();
  const accounts =
    await sql`SELECT id FROM gyvft_customer_accounts WHERE shopify_customer_id IS NULL AND id NOT IN ${sql(demoAccountIds)} ORDER BY created_at LIMIT 3`;
  let linked = 0;
  for (const a of accounts) {
    try {
      if (await syncShopifyCustomer(a.id)) linked++;
    } catch {
      /* Keep each failure retryable without stopping the rest. */
    }
  }
  return linked;
}
const states: Record<string, string> = {
  andamanandnicobarislands: "AN",
  andhrapradesh: "AP",
  arunachalpradesh: "AR",
  assam: "AS",
  bihar: "BR",
  chandigarh: "CH",
  chhattisgarh: "CG",
  delhi: "DL",
  goa: "GA",
  gujarat: "GJ",
  haryana: "HR",
  himachalpradesh: "HP",
  jammuandkashmir: "JK",
  jharkhand: "JH",
  karnataka: "KA",
  kerala: "KL",
  ladakh: "LA",
  lakshadweep: "LD",
  madhyapradesh: "MP",
  maharashtra: "MH",
  manipur: "MN",
  meghalaya: "ML",
  mizoram: "MZ",
  nagaland: "NL",
  odisha: "OR",
  puducherry: "PY",
  punjab: "PB",
  rajasthan: "RJ",
  sikkim: "SK",
  tamilnadu: "TN",
  telangana: "TS",
  tripura: "TR",
  uttarpradesh: "UP",
  uttarakhand: "UK",
  westbengal: "WB",
  dadraandnagarhavelianddamananddiu: "DH",
};
export function provinceCode(state: string) {
  const value = state.trim().toUpperCase();
  return Object.values(states).includes(value)
    ? value
    : states[state.toLowerCase().replace(/[^a-z]/g, "")] || null;
}
export async function createOrSyncShopifyOrder(id: string, confirmed: boolean) {
  const sql = getSql();
  const [p] =
    await sql`SELECT p.*,a.email,a.shopify_customer_id FROM customer_projects p JOIN gyvft_customer_accounts a ON a.id=p.customer_account_id WHERE p.id=${id}::uuid`;
  if (!p || p.kind !== "project" || p.customer_type !== "b2c" || !p.total_paise)
    throw new ShopifyError("Convert the approved quote to a B2C order first.");
  if (String(p.submission_key || "").startsWith("gyvft-demo-"))
    throw new ShopifyError("Sample requests cannot create Shopify orders.");
  const customerId =
    p.shopify_customer_id || (await syncShopifyCustomer(p.customer_account_id));
  if (!customerId)
    throw new ShopifyError(
      "Customer linking is still pending. Retry after it completes.",
    );
  const query = p.shopify_order_id
    ? `id:${String(p.shopify_order_id).split("/").at(-1)}`
    : `tag:gyvft_${id}`;
  const found = await shopifyRequest<{ orders: { nodes: ShopOrder[] } }>(
    ORDER_LOOKUP,
    { query },
  );
  if (found.orders.nodes.length > 1)
    throw new ShopifyError(
      "Multiple Shopify orders need manual reconciliation.",
    );
  const order = found.orders.nodes[0];
  if (order) {
    if (
      order.customer?.id !== customerId ||
      order.totalPriceSet.shopMoney.currencyCode !== "INR" ||
      Math.round(Number(order.totalPriceSet.shopMoney.amount) * 100) !==
        Number(p.total_paise)
    )
      throw new ShopifyError(
        "The Shopify customer or order total needs manual reconciliation.",
      );
    await sql`UPDATE customer_projects SET shopify_order_id=${order.id},shopify_order_reference=${order.name},shopify_order_state='linked' WHERE id=${id}::uuid`;
    const received = Math.round(
        Number(order.totalReceivedSet.shopMoney.amount) * 100,
      ),
      verified = Number(p.paid_paise);
    if (received > verified)
      throw new ShopifyError(
        "Shopify has more received payment than GYVFT. Reconcile before syncing.",
      );
    if (received === verified) {
      await sql`UPDATE customer_projects SET shopify_payment_state='idle' WHERE id=${id}::uuid`;
    } else if (confirmed) {
      if (verified !== Number(p.total_paise))
        throw new ShopifyError(
          "The order is linked. Additional partial receipts remain verified in GYVFT; sync the Shopify balance after the full order total is verified, or reconcile it manually in Shopify.",
        );
      const [lock] =
        await sql`UPDATE customer_projects SET shopify_payment_state='syncing',shopify_payment_version=shopify_payment_version+1 WHERE id=${id}::uuid AND shopify_payment_state='idle' AND shopify_payment_version=${p.shopify_payment_version} RETURNING id`;
      if (!lock)
        throw new ShopifyError(
          "A previous payment sync needs reconciliation. Check Shopify before recording more payment.",
        );
      try {
        const result = await shopifyRequest<{
          orderCreateManualPayment: { order: unknown; userErrors: unknown[] };
        }>(RECORD_PAYMENT, {
          id: order.id,
        });
        if (
          !result.orderCreateManualPayment.order ||
          result.orderCreateManualPayment.userErrors.length
        )
          throw new ShopifyError("Shopify payment recording needs review.");
        await sql`UPDATE customer_projects SET shopify_payment_state='idle' WHERE id=${id}::uuid`;
      } catch (error) {
        await sql`UPDATE customer_projects SET shopify_payment_state='uncertain' WHERE id=${id}::uuid`;
        throw error;
      }
    }
    return order.name;
  }
  if (
    p.shopify_order_state === "uncertain" ||
    p.shopify_order_state === "creating"
  )
    throw new ShopifyError(
      "A previous creation is not confirmed. Check Shopify and link its reference; another order will not be created automatically.",
    );
  if (p.shopify_order_reference)
    throw new ShopifyError(
      "A manual Shopify order reference already exists. Reconcile it before creating another order.",
    );
  if (!confirmed)
    throw new ShopifyError(
      "Review the approved prices, taxes, delivery charges and customer details before creation.",
    );
  const [approvedQuote] =
    await sql`SELECT id,version,status,amount_paise,gift_selection_id FROM customer_project_approvals WHERE project_id=${id}::uuid AND kind='proposal' ORDER BY version DESC LIMIT 1`;
  const [selectedGift] =
    await sql`SELECT id,snapshot FROM gyvft_gift_selections WHERE project_id=${id}::uuid ORDER BY created_at DESC,id DESC LIMIT 1`;
  const [openChange] =
    await sql`SELECT id FROM gyvft_gift_changes WHERE project_id=${id}::uuid AND status='open' LIMIT 1`;
  if (
    !approvedQuote ||
    approvedQuote.status !== "approved" ||
    Number(approvedQuote.amount_paise) !== Number(p.total_paise) ||
    (selectedGift && approvedQuote.gift_selection_id !== selectedGift.id) ||
    openChange
  )
    throw new ShopifyError(
      "Approve the latest exact quote and resolve changes before creating the official order.",
    );
  const [address] =
    await sql`SELECT * FROM customer_delivery_addresses WHERE project_id=${id}::uuid`;
  const items =
    await sql`SELECT * FROM customer_order_items WHERE project_id=${id}::uuid`;
  const [design] =
    await sql`SELECT status FROM customer_project_approvals WHERE project_id=${id}::uuid AND kind='design' ORDER BY version DESC LIMIT 1`;
  if (!address || !provinceCode(address.state))
    throw new ShopifyError(
      "Save a complete Indian shipping address with a recognised state.",
    );
  if (
    design?.status !== "approved" ||
    Number(p.paid_paise) < Math.ceil(Number(p.total_paise) / 2)
  )
    throw new ShopifyError(
      "Latest design approval and verified 50% advance are required.",
    );
  if (quoteTotal(items as unknown as OrderItem[]) !== Number(p.total_paise))
    throw new ShopifyError("Line items do not match the approved total.");
  const name = String(address.recipient_name).trim().split(/\s+/);
  const phone = String(address.phone).replace(/[^0-9+]/g, "");
  if (!/^\+?[0-9]{10,15}$/.test(phone))
    throw new ShopifyError("Check the recipient phone number.");
  const payload = {
    currency: "INR",
    email: p.email,
    customer: { toAssociate: { id: customerId } },
    shippingAddress: {
      firstName: name.shift(),
      lastName: name.join(" "),
      address1: address.address,
      city: address.city,
      provinceCode: provinceCode(address.state),
      countryCode: "IN",
      zip: address.postal_code,
      phone: phone.startsWith("+")
        ? phone
        : phone.length === 10
          ? `+91${phone}`
          : `+${phone}`,
    },
    // GYVFT sells the approved custom batch as one Shopify line. Its exact total
    // avoids per-recipient rounding, and the approved breakdown stays in notes.
    lineItems: [
      {
        title: `GYVFT custom gift order · ${p.title}`,
        quantity: 1,
        priceSet: {
          shopMoney: {
            amount: (Number(p.total_paise) / 100).toFixed(2),
            currencyCode: "INR",
          },
        },
        requiresShipping: true,
        properties: [
          { name: "GYVFT request", value: id },
          { name: "Approved quote", value: `v${approvedQuote.version}` },
          ...(selectedGift?.snapshot?.recipients
            ? [
                {
                  name: "Recipients",
                  value: String(selectedGift.snapshot.recipients),
                },
              ]
            : []),
        ],
      },
    ],
    tags: ["GYVFT", `gyvft_${id}`],
    sourceIdentifier: id,
    note: [
      `GYVFT personal gifting request ${id}. Approved quote v${approvedQuote.version}.`,
      "Single custom batch. The approved total includes taxes and the listed charges.",
      ...items.map(
        (i) =>
          `${i.quantity} × ${i.name}: INR ${(Number(i.unit_paise) / 100).toFixed(2)} each${i.personalisation ? ` · ${i.personalisation}` : ""}`,
      ),
      ...(selectedGift?.snapshot
        ? [`Approved gift: ${JSON.stringify(selectedGift.snapshot)}`]
        : []),
    ].join("\n"),
    financialStatus:
      Number(p.paid_paise) >= Number(p.total_paise) ? "PAID" : "PARTIALLY_PAID",
    transactions: [
      {
        kind: "SALE",
        status: "SUCCESS",
        gateway: "manual",
        amountSet: {
          shopMoney: {
            amount: (Number(p.paid_paise) / 100).toFixed(2),
            currencyCode: "INR",
          },
        },
      },
    ],
  };
  const claimed =
    await sql`UPDATE customer_projects SET shopify_order_state='creating',shopify_order_attempted_at=now() WHERE id=${id}::uuid AND shopify_order_state='pending' AND shopify_order_id IS NULL AND shopify_order_reference IS NULL AND total_paise=${p.total_paise} AND paid_paise=${p.paid_paise}
      AND (SELECT a.id FROM customer_project_approvals a WHERE a.project_id=${id}::uuid AND a.kind='proposal' ORDER BY a.version DESC LIMIT 1)=${approvedQuote.id}::uuid
      AND (SELECT a.status FROM customer_project_approvals a WHERE a.id=${approvedQuote.id}::uuid)='approved'
      AND COALESCE((SELECT s.id FROM gyvft_gift_selections s WHERE s.project_id=${id}::uuid ORDER BY s.created_at DESC,s.id DESC LIMIT 1),'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE(${selectedGift?.id || null}::uuid,'00000000-0000-0000-0000-000000000000'::uuid)
      AND EXISTS(SELECT 1 FROM customer_delivery_addresses a WHERE a.project_id=${id}::uuid AND a.recipient_name=${address.recipient_name} AND a.phone=${address.phone} AND a.address=${address.address} AND a.city=${address.city} AND a.state=${address.state} AND a.postal_code=${address.postal_code})
      AND NOT EXISTS(SELECT 1 FROM gyvft_gift_changes c WHERE c.project_id=${id}::uuid AND c.status='open') RETURNING id`;
  if (!claimed.length)
    throw new ShopifyError("Order creation is already in progress.");
  try {
    const result = await shopifyRequest<{
      orderCreate: {
        order: { id: string; name: string } | null;
        userErrors: unknown[];
      };
    }>(ORDER_CREATE, {
      order: payload,
      options: { sendReceipt: false, sendFulfillmentReceipt: false },
    });
    if (!result.orderCreate.order) {
      await sql`UPDATE customer_projects SET shopify_order_state='pending' WHERE id=${id}::uuid`;
      throw new ShopifyError(
        "Shopify rejected the order details. Check the customer, prices and shipping address.",
      );
    }
    const created = result.orderCreate.order;
    await sql`UPDATE customer_projects SET shopify_order_id=${created.id},shopify_order_reference=${created.name},shopify_order_state='linked' WHERE id=${id}::uuid`;
    return created.name;
  } catch (error) {
    await sql`UPDATE customer_projects SET shopify_order_state='uncertain' WHERE id=${id}::uuid AND shopify_order_state='creating'`;
    throw error;
  }
}

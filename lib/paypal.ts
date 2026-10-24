// PayPal Orders v2, server side only. Kept minimal: Square is the planned provider.
// Env (names only): NEXT_PUBLIC_PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY, PAYPAL_ENV=sandbox|live (default sandbox).
import type { CartLine, PricedLine } from "./products.ts";
import { variantLabel } from "./products.ts";
import { STORE_CURRENCY, type ProviderOrder } from "./payments.ts";

function baseUrl(): string {
  return process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function paypalConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET_KEY);
}

async function accessToken(): Promise<string> {
  const auth = Buffer.from(`${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET_KEY}`).toString("base64");
  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`PayPal auth failed (${res.status})`);
  return data.access_token;
}

async function call(path: string, init: { method: string; body?: unknown; headers?: Record<string, string> }) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const money = (pence: number) => ({ currency_code: STORE_CURRENCY, value: (pence / 100).toFixed(2) });

// The sku carries product id, colour and size so the order can be re-priced from the catalogue when verifying.
const toSku = (l: CartLine) => `${l.id}|${l.color ?? ""}|${l.size ?? ""}`;

/** Create the order from catalogue-priced lines. Returns the PayPal approval URL. */
export async function createPayPalOrder(lines: PricedLine[], totalPence: number, returnUrl: string, cancelUrl: string) {
  const { status, data } = await call("/v2/checkout/orders", {
    method: "POST",
    body: {
      intent: "CAPTURE",
      purchase_units: [{
        description: "ZAYVI Order",
        amount: { ...money(totalPence), breakdown: { item_total: money(totalPence) } },
        items: lines.map((l) => ({
          name: l.name.slice(0, 127),
          sku: toSku(l),
          description: variantLabel(l).slice(0, 127) || undefined,
          quantity: String(l.qty),
          unit_amount: money(Math.round(l.price * 100)),
          category: "PHYSICAL_GOODS",
        })),
      }],
      application_context: { return_url: returnUrl, cancel_url: cancelUrl, brand_name: "ZAYVI", user_action: "PAY_NOW" },
    },
  });
  const approve = (data.links as { rel: string; href: string }[] | undefined)?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
  if (!approve) throw new Error(`PayPal did not return an approval link (${status})`);
  return approve;
}

/** Look the order up and capture it if the buyer has approved it. Returns the latest PayPal order body. */
export async function captureIfApproved(orderId: string): Promise<PayPalOrder> {
  const got = await call(`/v2/checkout/orders/${orderId}`, { method: "GET" });
  if (got.status !== 200) throw new Error(`PayPal order lookup failed (${got.status})`);
  if (got.data.status !== "APPROVED") return got.data;
  // PayPal-Request-Id makes a repeated capture (page reload, double click) return the same result.
  const cap = await call(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST", body: {}, headers: { "PayPal-Request-Id": `capture-${orderId}` },
  });
  if (cap.status === 200 || cap.status === 201) return cap.data;
  if (cap.status === 422) {
    // Either already captured (a parallel request won) or e.g. INSTRUMENT_DECLINED.
    const again = await call(`/v2/checkout/orders/${orderId}`, { method: "GET" });
    if (again.status === 200 && again.data.status === "COMPLETED") return again.data;
    return { ...got.data, status: "DECLINED" };
  }
  throw new Error(`PayPal capture failed (${cap.status})`);
}

export type PayPalOrder = {
  status?: string;
  purchase_units?: {
    items?: { sku?: string; quantity?: string }[];
    payments?: { captures?: { status?: string; amount?: { currency_code?: string; value?: string } }[] };
  }[];
};

/** Turn a PayPal order (GET or capture response) into the provider-neutral shape verifyPaid checks. */
export function fromPayPal(order: PayPalOrder): ProviderOrder {
  const unit = order.purchase_units?.[0];
  const captures = unit?.payments?.captures ?? [];
  const items: CartLine[] = (unit?.items ?? []).map((it) => {
    const [id, color, size] = (it.sku ?? "").split("|");
    return { id: Number(id), qty: Number(it.quantity), color: color || undefined, size: size || undefined };
  });
  const done = captures.filter((c) => c.status === "COMPLETED");
  const currencies = new Set(done.map((c) => c.amount?.currency_code));
  const amountPence = done.reduce((s, c) => s + Math.round(Number(c.amount?.value) * 100), 0);
  let state: ProviderOrder["state"] = "pending";
  if (order.status === "COMPLETED" && done.length > 0 && done.length === captures.length) state = "completed";
  else if (order.status === "VOIDED" || order.status === "DECLINED" || captures.some((c) => c.status === "DECLINED" || c.status === "FAILED")) state = "failed";
  return { state, amountPence, currency: currencies.size === 1 ? String([...currencies][0]) : "", items };
}

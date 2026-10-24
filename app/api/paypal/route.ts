import { NextRequest, NextResponse } from "next/server";
import { priceCart } from "@/lib/products";
import { createPayPalOrder, paypalConfigured } from "@/lib/paypal";

// Create the PayPal order on the server from catalogue prices (never browser prices).
export async function POST(req: NextRequest) {
  if (!paypalConfigured()) return NextResponse.json({ error: "Checkout is not set up yet." }, { status: 503 });
  try {
    const { items } = await req.json();
    let priced;
    try {
      priced = priceCart(items);
    } catch (e) {
      return NextResponse.json({ error: (e instanceof Error ? e.message : "Your basket could not be checked.") }, { status: 400 });
    }
    const store = process.env.NEXT_PUBLIC_STORE_URL || req.nextUrl.origin;
    const url = await createPayPalOrder(priced.lines, priced.totalPence, `${store}/success`, store);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("PayPal checkout failed", err);
    return NextResponse.json({ error: "Checkout is unavailable right now. Please try again." }, { status: 500 });
  }
}

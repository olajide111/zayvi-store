import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { priceCart } from '@/lib/products';

// Card checkout via Stripe. Not used by the store page today (it pays through PayPal); kept ready.
// The client is created per request so the site still builds without a Stripe key.
export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: 'Card checkout is not set up.' }, { status: 503 });
  try {
    const { items } = await req.json();
    let lines;
    try {
      lines = priceCart(items).lines; // prices from the catalogue, never from the browser
    } catch (e) {
      return NextResponse.json({ error: (e instanceof Error ? e.message : "Your basket could not be checked.") }, { status: 400 });
    }
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lines.map((l) => ({
        price_data: { currency: 'gbp', product_data: { name: l.name }, unit_amount: Math.round(l.price * 100) },
        quantity: l.qty,
      })),
      mode: 'payment',
      success_url: process.env.NEXT_PUBLIC_STORE_URL + '/success',
      cancel_url: process.env.NEXT_PUBLIC_STORE_URL,
      shipping_address_collection: { allowed_countries: ['GB', 'US', 'CA', 'AU', 'NG'] },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout failed', err);
    return NextResponse.json({ error: 'Checkout is unavailable right now. Please try again.' }, { status: 500 });
  }
}

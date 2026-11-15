import { NextRequest, NextResponse } from "next/server";

import { zayviCommerceRequest } from "@/lib/database/zayvi-rest";
import {
  createOrderNumber,
  normalizeAddress,
  normalizeEmail,
  prepareOrderItems,
} from "@/lib/orders";

type CreatedOrder = {
  id: string;
  order_number: string;
  total_minor: number;
  currency: string;
  payment_status: string;
  order_status: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body?.customer?.email);
    const customerName =
      typeof body?.customer?.name === "string"
        ? body.customer.name.trim().slice(0, 120)
        : "";
    const shippingAddress = normalizeAddress(body?.shippingAddress);
    const billingAddress = body?.billingAddress
      ? normalizeAddress(body.billingAddress)
      : null;

    const currency =
      typeof body?.currency === "string"
        ? body.currency.trim().toUpperCase()
        : "GBP";

    if (currency !== "GBP") {
      return NextResponse.json(
        {
          error:
            "This storefront catalogue is currently priced in GBP. NGN checkout will be enabled after server-side currency pricing is added.",
        },
        { status: 400 }
      );
    }

    const { items, totalMinor } = prepareOrderItems(body?.items);
    if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) {
      return NextResponse.json(
        { error: "The order total is invalid." },
        { status: 400 }
      );
    }

    const orderNumber = createOrderNumber();

    const created = await zayviCommerceRequest<CreatedOrder[]>("orders", {
      method: "POST",
      prefer: "return=representation",
      body: {
        order_number: orderNumber,
        source: "storefront",
        store_ref: "zayvi-main",
        customer_email: email,
        customer_name: customerName || shippingAddress.name,
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        country_code: shippingAddress.countryCode,
        currency,
        subtotal_minor: totalMinor,
        shipping_minor: 0,
        tax_minor: 0,
        total_minor: totalMinor,
        order_status: "awaiting_payment",
        payment_status: "pending",
      },
    });

    const order = Array.isArray(created) ? created[0] : undefined;
    if (!order?.id) {
      throw new Error("ZAYVI did not return the newly created order.");
    }

    try {
      await zayviCommerceRequest("order_items", {
        method: "POST",
        prefer: "return=minimal",
        body: items.map((item) => ({
          ...item,
          order_id: order.id,
        })),
      });
    } catch (error) {
      await zayviCommerceRequest("orders", {
        method: "DELETE",
        query: "id=eq." + encodeURIComponent(order.id),
        prefer: "return=minimal",
      }).catch(() => undefined);
      throw error;
    }

    return NextResponse.json(
      {
        orderId: order.id,
        orderNumber: order.order_number,
        amountMinor: order.total_minor,
        currency: order.currency,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The order could not be created.";

    const clientError =
      message.includes("valid") ||
      message.includes("Required") ||
      message.includes("unavailable") ||
      message.includes("empty") ||
      message.includes("too large");

    console.error("ZAYVI order creation failed", error);

    return NextResponse.json(
      {
        error: clientError
          ? message
          : "We could not create your order right now. Please try again.",
      },
      { status: clientError ? 400 : 500 }
    );
  }
}

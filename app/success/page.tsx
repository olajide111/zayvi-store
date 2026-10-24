import type { Metadata } from "next";
import PaymentStatus from "./PaymentStatus";

export const metadata: Metadata = { title: "Your order · ZAYVI", robots: { index: false } };

// PayPal sends the buyer back here as /success?token=<order id>&PayerID=...
// Nothing here says "confirmed" until the server has captured and verified the payment.
export default async function Success({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await searchParams;
  return <PaymentStatus orderId={typeof token === "string" ? token : null} />;
}

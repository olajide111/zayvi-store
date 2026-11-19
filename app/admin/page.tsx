import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminSignIn from "@/components/admin/AdminSignIn";
import { kredalTestReturnPath, returnedKredalOrderId } from "@/lib/kredal-test-return";
import { ADMIN_COOKIE, isAdminSessionCookieValid } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Admin sign in | Zayvi Store" };

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[]; order_id?: string | string[] }>;
}) {
  const { next, order_id } = await searchParams;
  let destination = "/admin/dashboard";
  if (next === "product-images") destination = "/admin/product-images";
  if (next === "payments") {
    const orderId = returnedKredalOrderId(order_id);
    destination = orderId ? kredalTestReturnPath(orderId) : "/admin/payments";
  }
  const cookieStore = await cookies();

  if (isAdminSessionCookieValid(cookieStore.get(ADMIN_COOKIE)?.value)) redirect(destination);

  return <AdminSignIn destination={destination} />;
}

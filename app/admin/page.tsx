import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminSignIn from "@/components/admin/AdminSignIn";
import { ADMIN_COOKIE, isAdminSessionCookieValid } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Admin sign in | Zayvi Store" };

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = next === "product-images" ? "/admin/product-images" : "/admin/dashboard";
  const cookieStore = await cookies();

  if (isAdminSessionCookieValid(cookieStore.get(ADMIN_COOKIE)?.value)) redirect(destination);

  return <AdminSignIn destination={destination} />;
}

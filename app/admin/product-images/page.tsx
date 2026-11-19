import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";
import ProductImageUpload from "@/components/admin/ProductImageUpload";
import { ADMIN_COOKIE, isAdminSessionCookieValid } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Product images | Zayvi Store" };

export default async function ProductImagesPage() {
  const cookieStore = await cookies();
  if (!isAdminSessionCookieValid(cookieStore.get(ADMIN_COOKIE)?.value)) redirect("/admin?next=product-images");

  return (
    <main className="min-h-screen">
      <AdminPageHeading section="Catalogue" title="Product images" description="Upload product photography and copy the image URL into a product listing.">
        <Link href="/admin/products" prefetch={false} className={adminAction}>Products</Link>
      </AdminPageHeading>
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-8">
        <ProductImageUpload />
      </div>
    </main>
  );
}

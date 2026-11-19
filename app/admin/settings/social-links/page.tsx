import Link from "next/link";
import AdminPageHeading, { adminAction } from "@/components/admin/AdminPageHeading";
import SocialLinksForm from "./SocialLinksForm";

export default function SocialLinksPage() {
  return (
    <main className="min-h-screen">
      <AdminPageHeading section="Store setup" title="Social links" description="Add your store’s social profiles to the storefront footer.">
        <Link href="/admin/settings" className={adminAction}>Store setup</Link>
      </AdminPageHeading>
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-8">
        <SocialLinksForm />
      </div>
    </main>
  );
}

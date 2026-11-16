import type { ReactNode } from "react";

import AdminMobileNav from "@/components/admin/AdminMobileNav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AdminMobileNav />
    </>
  );
}

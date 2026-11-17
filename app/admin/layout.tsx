import type { ReactNode } from "react";
import AdminWorkspace from "@/components/admin/AdminWorkspace";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminWorkspace>{children}</AdminWorkspace>;
}

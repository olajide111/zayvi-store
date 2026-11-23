import type { ReactNode } from "react";
import AdminWorkspace from "@/components/admin/AdminWorkspace";
import AdminOrderSearch from '@/components/admin/AdminOrderSearch';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminOrderSearch><AdminWorkspace>{children}</AdminWorkspace></AdminOrderSearch>;
}

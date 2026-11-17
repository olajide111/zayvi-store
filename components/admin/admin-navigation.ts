import {
  Activity, Archive, BarChart3, Boxes, ClipboardList, CreditCard, FileText, Globe2,
  House, ImagePlus, Inbox, Layers3, Package, Palette, RotateCcw, ScanSearch, Settings,
  ShieldCheck, Truck, Users, Warehouse,
} from "lucide-react";

export const adminPrimary = [
  { label: "Home", title: "Overview", href: "/admin/dashboard", icon: House },
  { label: "Orders", title: "Orders", href: "/admin/orders", icon: Package },
  { label: "Products", title: "Products", href: "/admin/products", icon: Layers3 },
  { label: "Inventory", title: "Inventory", href: "/admin/inventory", icon: Boxes },
  { label: "Payments", title: "Payments", href: "/admin/payments", icon: CreditCard },
] as const;

export const adminGroups = [
  {
    label: "Operations",
    items: [
      { title: "Operations Inbox", href: "/admin/operations-inbox", icon: Inbox },
      { title: "Returns", href: "/admin/returns", icon: RotateCcw },
      { title: "Purchase Orders", href: "/admin/purchase-orders", icon: ClipboardList },
      { title: "Replenishment", href: "/admin/replenishment", icon: Warehouse },
      { title: "Suppliers", href: "/admin/suppliers", icon: Truck },
      { title: "Operations Audit", href: "/admin/operations-audit", icon: Archive },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Sales Analytics", href: "/admin/analytics", icon: BarChart3 },
      { title: "Supplier Performance", href: "/admin/supplier-performance", icon: Activity },
      { title: "Product Discovery", href: "/admin/discovery", icon: ScanSearch },
      { title: "Sourcing", href: "/admin/sourcing", icon: Boxes },
    ],
  },
  {
    label: "Store",
    items: [
      { title: "Customers", href: "/admin/customers", icon: Users },
      { title: "Markets", href: "/admin/markets", icon: Globe2 },
      { title: "Content publishing", href: "/admin/content", icon: FileText },
      { title: "Themes", href: "/admin/themes", icon: Palette },
      { title: "Product Images", href: "/admin/product-images", icon: ImagePlus },
      { title: "Shipping", href: "/admin/shipping", icon: Truck },
      { title: "System Readiness", href: "/admin/system-readiness", icon: ShieldCheck },
      { title: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
] as const;

export function isAdminRouteActive(pathname: string, href: string) {
  return pathname === href ||
    (href !== "/admin" && href !== "/admin/dashboard" && pathname.startsWith(href + "/"));
}

import {
  Activity, Archive, BarChart3, Boxes, ClipboardList, CreditCard, FileText, Globe2,
  House, ImagePlus, Inbox, Layers3, Link2, Package, Palette, RotateCcw, ScanSearch, Settings,
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
      { title: "Fulfilment & automation", href: "/admin/automation", icon: Truck },
      { title: "Operations Inbox", href: "/admin/operations-inbox", icon: Inbox },
      { title: "Returns", href: "/admin/returns", icon: RotateCcw },
      { title: "Purchase Orders", href: "/admin/purchase-orders", icon: ClipboardList },
      { title: "Replenishment", href: "/admin/replenishment", icon: Warehouse },
      { title: "Customers", href: "/admin/customers", icon: Users },
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
    label: "Storefront",
    items: [
      { title: "Content publishing", href: "/admin/content", icon: FileText },
      { title: "Social links", href: "/admin/settings/social-links", icon: Link2 },
      { title: "Themes", href: "/admin/themes", icon: Palette },
      { title: "Hammy Store pilot", href: "/admin/pilots/hammy", icon: Palette },
      { title: "Product Images", href: "/admin/product-images", icon: ImagePlus },
    ],
  },
  {
    label: "Setup",
    items: [
      { title: "Setup & launch", href: "/admin/launch", icon: ShieldCheck },
      { title: "Design your store", href: "/admin/get-started", icon: Palette },
      { title: "Markets", href: "/admin/markets", icon: Globe2 },
      { title: "Shipping", href: "/admin/shipping", icon: Truck },
      { title: "System Readiness", href: "/admin/system-readiness", icon: ShieldCheck },
      { title: "Store setup", href: "/admin/settings", icon: Settings },
    ],
  },
] as const;

export function isAdminRouteActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/admin" || href === "/admin/dashboard" || !pathname.startsWith(href + "/")) return false;
  // Prefer a named child page over its parent settings section.
  return ![...adminPrimary, ...adminGroups.flatMap(({ items }) => [...items])].some((item) =>
    item.href.startsWith(href + "/") &&
    (pathname === item.href || pathname.startsWith(item.href + "/")),
  );
}

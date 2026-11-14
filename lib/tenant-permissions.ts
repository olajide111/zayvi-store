import type { TenantPermissionPolicy, TenantRequestContext } from "./tenant-access";

/**
 * Versioned tenant role-to-permission policy.
 *
 * Platform support access is intentionally excluded: it requires a separate,
 * time-bound, reason-coded grant and must never be inherited from a tenant role.
 */

export const TENANT_PERMISSION_POLICY_VERSION = "1.0.0";

export const TENANT_PERMISSIONS = [
  "tenant.read", "tenant.update", "tenant.members.manage",
  "store.read", "store.create", "store.update", "store.domain.manage",
  "catalogue.read", "catalogue.write", "catalogue.publish",
  "supplier.read", "supplier.manage", "supplier.verify",
  "inventory.read", "inventory.manage",
  "orders.read", "orders.manage", "refunds.manage",
  "finance.read", "finance.manage",
  "intelligence.read", "intelligence.run",
  "integrations.manage", "api_keys.manage",
  "subscriptions.read", "subscriptions.manage",
  "audit.read", "data.export",
] as const;

export type TenantPermission = (typeof TENANT_PERMISSIONS)[number];
export type TenantRole =
  | "owner" | "administrator" | "store_manager" | "catalog_manager"
  | "supplier_manager" | "fulfilment" | "finance" | "support"
  | "analyst" | "read_only";

const all = [...TENANT_PERMISSIONS] as TenantPermission[];

const ROLE_PERMISSIONS: Record<TenantRole, readonly TenantPermission[]> = {
  owner: all,
  administrator: all.filter((p) => p !== "subscriptions.manage"),
  store_manager: [
    "tenant.read", "store.read", "store.update", "catalogue.read",
    "catalogue.write", "catalogue.publish", "supplier.read", "inventory.read",
    "inventory.manage", "orders.read", "orders.manage", "refunds.manage",
    "intelligence.read", "intelligence.run", "audit.read",
  ],
  catalog_manager: [
    "tenant.read", "store.read", "catalogue.read", "catalogue.write",
    "catalogue.publish", "supplier.read", "inventory.read",
    "intelligence.read", "intelligence.run",
  ],
  supplier_manager: [
    "tenant.read", "catalogue.read", "supplier.read", "supplier.manage",
    "supplier.verify", "inventory.read", "inventory.manage",
    "intelligence.read",
  ],
  fulfilment: [
    "tenant.read", "store.read", "catalogue.read", "inventory.read",
    "inventory.manage", "orders.read", "orders.manage",
  ],
  finance: [
    "tenant.read", "orders.read", "refunds.manage", "finance.read",
    "finance.manage", "subscriptions.read", "audit.read",
  ],
  support: [
    "tenant.read", "store.read", "catalogue.read", "supplier.read",
    "inventory.read", "orders.read", "audit.read",
  ],
  analyst: [
    "tenant.read", "store.read", "catalogue.read", "supplier.read",
    "inventory.read", "orders.read", "finance.read", "intelligence.read",
    "intelligence.run", "audit.read",
  ],
  read_only: [
    "tenant.read", "store.read", "catalogue.read", "supplier.read",
    "inventory.read", "orders.read", "subscriptions.read",
  ],
};

export function isTenantRole(value: string): value is TenantRole {
  return Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, value);
}

export function hasTenantPermission(
  role: string,
  permission: string,
): boolean {
  if (!isTenantRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission as TenantPermission);
}

export function permissionsForTenantRole(role: string): readonly TenantPermission[] {
  if (!isTenantRole(role)) return [];
  return [...ROLE_PERMISSIONS[role]];
}

/** Adapter used by the tenant access pipeline; never grants platform support. */
export const tenantPermissionPolicy: TenantPermissionPolicy = {
  async hasPermission(context: TenantRequestContext, permission: string) {
    return hasTenantPermission(context.role, permission);
  },
};

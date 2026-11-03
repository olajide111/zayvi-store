import test from "node:test";
import assert from "node:assert/strict";
import {
  decideMarketPublication,
} from "../lib/market-publication-policy";
import {
  hasTenantPermission,
  permissionsForTenantRole,
} from "../lib/tenant-permissions";
import {
  withAuthorisedTenant,
  TenantAccessError,
  type TenantAccessDependencies,
} from "../lib/tenant-access";

const basePublication = {
  productId: "product-1",
  marketCode: "GB",
  rating: 92,
  availability: "available" as const,
  availabilityVerified: true,
  stockCheckedAt: "2026-11-03T10:00:00.000Z",
  complianceStatus: "approved" as const,
  deliveryEstimateDays: 3,
  deliveryEstimateVerified: true,
  contribution: 12,
  minimumContribution: 5,
  evidenceCount: 2,
  verifiedEvidenceCount: 2,
  evidenceFresh: true,
  humanApprovalRequired: false,
  globalAutoPublishEnabled: true,
  marketAutoPublishEnabled: true,
  assessmentVersionSupported: true,
  evaluatedAt: "2026-11-03T11:00:00.000Z",
};

test("publication requires all hard gates and both market switches", () => {
  const result = decideMarketPublication(basePublication);
  assert.equal(result.decision, "auto_publish");
  assert.equal(result.publishAllowed, true);
});

test("invalid explicit publication timestamp is rejected", () => {
  assert.throws(
    () => decideMarketPublication({ ...basePublication, evaluatedAt: "not-a-date" }),
    /valid date-time/,
  );
});

test("verified evidence cannot exceed total evidence", () => {
  assert.throws(
    () => decideMarketPublication({ ...basePublication, verifiedEvidenceCount: 3 }),
    /between zero and the total/,
  );
});

test("high rating cannot override disabled market auto-publish", () => {
  const result = decideMarketPublication({
    ...basePublication,
    marketAutoPublishEnabled: false,
  });
  assert.equal(result.decision, "admin_review");
  assert.equal(result.publishAllowed, false);
});

test("tenant roles do not grant platform support access", () => {
  assert.equal(hasTenantPermission("owner", "platform.support_access"), false);
  assert.equal(hasTenantPermission("unknown", "tenant.read"), false);
  assert.ok(permissionsForTenantRole("read_only").includes("catalogue.read"));
  assert.ok(!permissionsForTenantRole("read_only").includes("catalogue.publish"));
});

function dependencies(overrides: Partial<TenantAccessDependencies<string, string>> = {}) {
  const events: string[] = [];
  const deps: TenantAccessDependencies<string, string> = {
    identityProvider: {
      async verifyAccessToken(token) {
        events.push("verified");
        if (token !== "valid-token") throw new Error("invalid token");
        return { issuer: "https://identity.example", subject: "user-123", mfaVerified: true };
      },
    },
    membershipDirectory: {
      async findMemberships() {
        events.push("discover");
        return [
          {
            tenantId: "tenant-a", tenantName: "A", tenantStatus: "active" as const,
            membershipId: "membership-a", membershipStatus: "active" as const,
            role: "owner",
          },
          {
            tenantId: "tenant-b", tenantName: "B", tenantStatus: "active" as const,
            membershipId: "membership-b", membershipStatus: "active" as const,
            role: "read_only",
          },
        ];
      },
      async isMembershipActive() {
        events.push("recheck");
        return true;
      },
    },
    permissions: {
      async hasPermission(context, permission) {
        events.push("permission");
        return context.role === "owner" && permission === "catalogue.publish";
      },
    },
    transactions: {
      async withTenantTransaction(tenantId, work) {
        events.push("transaction:" + tenantId);
        return work();
      },
    },
    async execute(context) {
      events.push("execute:" + context.tenantId);
      return context.tenantId;
    },
    ...overrides,
  };
  return { deps, events };
}

test("user must select one of multiple active tenants", async () => {
  const { deps } = dependencies();
  await assert.rejects(
    () => withAuthorisedTenant({
      token: "valid-token",
      requiredPermission: "catalogue.publish",
      dependencies: deps,
    }),
    (error: unknown) => error instanceof TenantAccessError &&
      error.code === "TENANT_SELECTION_REQUIRED",
  );
});

test("browser-selected tenant must match an active membership", async () => {
  const { deps } = dependencies();
  await assert.rejects(
    () => withAuthorisedTenant({
      token: "valid-token",
      selectedTenantId: "tenant-evil",
      requiredPermission: "catalogue.publish",
      dependencies: deps,
    }),
    (error: unknown) => error instanceof TenantAccessError &&
      error.code === "TENANT_ACCESS_DENIED",
  );
});

test("membership and permission are rechecked inside the transaction", async () => {
  const { deps, events } = dependencies();
  const result = await withAuthorisedTenant({
    token: "valid-token",
    selectedTenantId: "tenant-a",
    requiredPermission: "catalogue.publish",
    dependencies: deps,
  });
  assert.equal(result, "tenant-a");
  assert.ok(events.indexOf("transaction:tenant-a") < events.indexOf("recheck"));
  assert.ok(events.indexOf("recheck") < events.indexOf("permission"));
  assert.ok(events.indexOf("permission") < events.indexOf("execute:tenant-a"));
});

test("revoked membership inside transaction is denied", async () => {
  const { deps } = dependencies({
    membershipDirectory: {
      async findMemberships() {
        return [{
          tenantId: "tenant-a", tenantName: "A", tenantStatus: "active",
          membershipId: "membership-a", membershipStatus: "active", role: "owner",
        }];
      },
      async isMembershipActive() { return false; },
    },
  });
  await assert.rejects(
    () => withAuthorisedTenant({
      token: "valid-token",
      selectedTenantId: "tenant-a",
      requiredPermission: "catalogue.publish",
      dependencies: deps,
    }),
    (error: unknown) => error instanceof TenantAccessError &&
      error.code === "TENANT_ACCESS_DENIED",
  );
});

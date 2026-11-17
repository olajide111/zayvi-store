import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
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
import {
  parseKredalSignatureHeader,
  verifyKredalWebhookSignature,
} from "../lib/kredal-signature";
import {
  createSupplierApiKey,
  hashSupplierApiKey,
  isSupplierApiKey,
} from "../lib/supplier-api-key";
import {
  createVendorSession,
  verifyVendorSessionValue,
  VENDOR_SESSION_MAX_AGE,
} from "../lib/vendor-auth";

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


test("Kredal webhook signature accepts a valid fresh event", () => {
  const secret = "test_kredal_webhook_secret";
  const timestamp = 1794781800;
  const rawBody = JSON.stringify({
    id: "evt_123",
    type: "payment.paid",
    data: { reference: "ZV-20261115-ABC123" },
  });
  const signature = crypto
    .createHmac("sha256", secret)
    .update(String(timestamp) + "." + rawBody, "utf8")
    .digest("hex");

  assert.equal(
    verifyKredalWebhookSignature({
      rawBody,
      signatureHeader: `t=${timestamp},v1=${signature}`,
      secret,
      nowSeconds: timestamp + 30,
    }),
    true,
  );
});

test("Kredal webhook signature rejects stale, malformed and tampered events", () => {
  const secret = "test_kredal_webhook_secret";
  const timestamp = 1794781800;
  const rawBody = '{"id":"evt_123","type":"payment.paid"}';
  const signature = crypto
    .createHmac("sha256", secret)
    .update(String(timestamp) + "." + rawBody, "utf8")
    .digest("hex");

  assert.equal(
    verifyKredalWebhookSignature({
      rawBody,
      signatureHeader: `t=${timestamp},v1=${signature}`,
      secret,
      nowSeconds: timestamp + 301,
    }),
    false,
  );

  assert.equal(
    verifyKredalWebhookSignature({
      rawBody: rawBody + " ",
      signatureHeader: `t=${timestamp},v1=${signature}`,
      secret,
      nowSeconds: timestamp,
    }),
    false,
  );

  assert.equal(parseKredalSignatureHeader("invalid"), null);
  assert.equal(
    verifyKredalWebhookSignature({
      rawBody,
      signatureHeader: `t=${timestamp},v1=abcd`,
      secret,
      nowSeconds: timestamp,
    }),
    false,
  );
});


test("supplier API keys use the expected format and stable hash", () => {
  const first = createSupplierApiKey();
  const second = createSupplierApiKey();

  assert.equal(isSupplierApiKey(first.apiKey), true);
  assert.equal(isSupplierApiKey(second.apiKey), true);
  assert.match(first.secretHash, /^[a-f0-9]{64}$/);
  assert.equal(hashSupplierApiKey(first.apiKey), first.secretHash);
  assert.notEqual(first.apiKey, second.apiKey);
  assert.notEqual(first.secretHash, second.secretHash);
  assert.equal(isSupplierApiKey("zv_vendor_invalid"), false);
});

test("vendor session accepts valid signed state and rejects tampering and expiry", () => {
  const previousSecret = process.env.ZAYVI_UPLOAD_SECRET;
  process.env.ZAYVI_UPLOAD_SECRET = "vendor-session-test-secret";

  try {
    const now = 1_800_000_000;
    const session = createVendorSession(
      {
        accountId: "11111111-1111-1111-1111-111111111111",
        supplierId: "22222222-2222-2222-2222-222222222222",
        role: "editor",
        email: "vendor@example.com",
      },
      now
    );

    const verified = verifyVendorSessionValue(session, now + 60);
    assert.equal(verified?.role, "editor");
    assert.equal(verified?.email, "vendor@example.com");

    const [payload, signature] = session.split(".");
    assert.ok(payload);
    assert.ok(signature);

    const tamperedPayload =
      Buffer.from(
        JSON.stringify({
          accountId: "11111111-1111-1111-1111-111111111111",
          supplierId: "99999999-9999-9999-9999-999999999999",
          role: "owner",
          email: "vendor@example.com",
          exp: now + VENDOR_SESSION_MAX_AGE,
        }),
        "utf8"
      ).toString("base64url");

    assert.equal(
      verifyVendorSessionValue(`${tamperedPayload}.${signature}`, now + 60),
      null
    );

    assert.equal(
      verifyVendorSessionValue(
        session,
        now + VENDOR_SESSION_MAX_AGE + 1
      ),
      null
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.ZAYVI_UPLOAD_SECRET;
    } else {
      process.env.ZAYVI_UPLOAD_SECRET = previousSecret;
    }
  }
});

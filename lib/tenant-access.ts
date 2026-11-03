/**
 * Provider-neutral tenant access orchestration.
 *
 * This module deliberately does not decode JWTs or trust browser-supplied roles.
 * A configured IdentityProviderAdapter must verify the token's signature,
 * issuer, audience and expiry before returning an identity. Membership lookup,
 * permissions and tenant-scoped database transactions are injected adapters.
 *
 * No production identity provider or database is wired by this module alone.
 */

export type VerifiedIdentity = {
  issuer: string;
  subject: string;
  authenticationTime?: number;
  mfaVerified: boolean;
};

export type TenantMembershipCandidate = {
  tenantId: string;
  tenantName: string;
  tenantStatus: "active" | "suspended" | "closed" | "pending";
  membershipId: string;
  membershipStatus: "active" | "invited" | "suspended" | "removed";
  role: string;
};

export type TenantRequestContext = {
  identity: VerifiedIdentity;
  tenantId: string;
  membershipId: string;
  role: string;
};

export interface IdentityProviderAdapter<Token = unknown> {
  /** Must verify signature, issuer, audience, expiry and required token claims. */
  verifyAccessToken(token: Token): Promise<VerifiedIdentity>;
}

export interface TenantMembershipDirectory {
  /** Must query only memberships for this verified issuer + subject pair. */
  findMemberships(identity: Pick<VerifiedIdentity, "issuer" | "subject">):
    Promise<TenantMembershipCandidate[]>;
}

export interface TenantPermissionPolicy {
  hasPermission(context: TenantRequestContext, permission: string): Promise<boolean>;
}

export interface TenantTransactionRunner {
  /**
   * Must begin a DB transaction, set app.tenant_id transaction-locally using
   * a parameterised query, execute work, then commit/rollback before releasing
   * the pooled connection. The DB role must not bypass RLS.
   */
  withTenantTransaction<T>(
    tenantId: string,
    work: () => Promise<T>,
  ): Promise<T>;
}

export class TenantAccessError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHENTICATED"
      | "NO_ACTIVE_MEMBERSHIP"
      | "TENANT_SELECTION_REQUIRED"
      | "TENANT_ACCESS_DENIED"
      | "PERMISSION_DENIED",
    message: string,
  ) {
    super(message);
    this.name = "TenantAccessError";
  }
}

export type TenantAccessDependencies<Token, T> = {
  identityProvider: IdentityProviderAdapter<Token>;
  membershipDirectory: TenantMembershipDirectory;
  permissions: TenantPermissionPolicy;
  transactions: TenantTransactionRunner;
  execute: (context: TenantRequestContext) => Promise<T>;
};

/**
 * Resolve a verified identity to an active membership and run work inside
 * a tenant-scoped transaction. selectedTenantId is only a selector: it is
 * accepted only when present in the verified identity's active memberships.
 */
export async function withAuthorisedTenant<Token, T>(input: {
  token: Token | null | undefined;
  selectedTenantId?: string | null;
  requiredPermission: string;
  dependencies: TenantAccessDependencies<Token, T>;
}): Promise<T> {
  if (input.token === null || input.token === undefined) {
    throw new TenantAccessError("UNAUTHENTICATED", "A verified sign-in is required.");
  }

  const identity = await input.dependencies.identityProvider.verifyAccessToken(input.token);
  if (!identity.issuer.trim() || !identity.subject.trim()) {
    throw new TenantAccessError("UNAUTHENTICATED", "The verified identity is incomplete.");
  }

  const candidates = await input.dependencies.membershipDirectory.findMemberships({
    issuer: identity.issuer,
    subject: identity.subject,
  });

  const activeMemberships = candidates.filter(
    (item) => item.tenantStatus === "active" && item.membershipStatus === "active",
  );

  if (activeMemberships.length === 0) {
    throw new TenantAccessError(
      "NO_ACTIVE_MEMBERSHIP",
      "No active organisation membership is available for this account.",
    );
  }

  if (!input.selectedTenantId && activeMemberships.length > 1) {
    throw new TenantAccessError(
      "TENANT_SELECTION_REQUIRED",
      "Select one of your active organisations to continue.",
    );
  }

  const membership = input.selectedTenantId
    ? activeMemberships.find((item) => item.tenantId === input.selectedTenantId)
    : activeMemberships[0];

  if (!membership) {
    throw new TenantAccessError(
      "TENANT_ACCESS_DENIED",
      "This account does not have active access to the selected organisation.",
    );
  }

  const context: TenantRequestContext = {
    identity,
    tenantId: membership.tenantId,
    membershipId: membership.membershipId,
    role: membership.role,
  };

  const allowed = await input.dependencies.permissions.hasPermission(
    context,
    input.requiredPermission,
  );
  if (!allowed) {
    throw new TenantAccessError(
      "PERMISSION_DENIED",
      "Your organisation role does not permit this action.",
    );
  }

  return input.dependencies.transactions.withTenantTransaction(
    context.tenantId,
    () => input.dependencies.execute(context),
  );
}

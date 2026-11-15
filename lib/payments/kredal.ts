import "server-only";

const DEFAULT_KREDAL_API_URL = "https://api.kredal.africa";

function getConfig() {
  const platformKey = process.env.KREDAL_PLATFORM_KEY;
  const apiUrl = process.env.KREDAL_API_URL || DEFAULT_KREDAL_API_URL;

  if (!platformKey) {
    throw new Error("Kredal Pay is not configured.");
  }

  return {
    apiUrl: apiUrl.replace(/\/$/, ""),
    platformKey,
  };
}

async function kredalRequest<T>(
  path: string,
  init: RequestInit = {},
  connectionId?: string
): Promise<T> {
  const { apiUrl, platformKey } = getConfig();
  const headers = new Headers(init.headers);

  headers.set("Authorization", `Bearer ${platformKey}`);
  headers.set("Accept", "application/json");

  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (connectionId) {
    headers.set("Kredal-Account", connectionId);
  }

  const response = await fetch(apiUrl + path, {
    ...init,
    headers,
    cache: "no-store",
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    console.error("Kredal API request failed", {
      path,
      status: response.status,
    });
    throw new Error("Kredal Pay could not complete the request.");
  }

  return body as T;
}

export type KredalConnection = {
  id: string;
  status?: "pending" | "active" | "revoked";
  approve_url?: string;
};

export async function createKredalConnection(input: {
  sellerRef: string;
  sellerName: string;
}) {
  return kredalRequest<KredalConnection>("/v1/platform/connections", {
    method: "POST",
    body: JSON.stringify({
      seller_ref: input.sellerRef,
      seller_name: input.sellerName,
    }),
  });
}

export async function getKredalConnection(connectionId: string) {
  return kredalRequest<KredalConnection>(
    "/v1/platform/connections/" + encodeURIComponent(connectionId)
  );
}

export async function disconnectKredalConnection(connectionId: string) {
  return kredalRequest<unknown>(
    "/v1/platform/connections/" + encodeURIComponent(connectionId),
    { method: "DELETE" }
  );
}

export type CreateKredalPaymentInput = {
  connectionId: string;
  amountMinor: number;
  reference: string;
  idempotencyKey: string;
  description?: string;
  customerEmail?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  expiresInHours?: number;
};

export type KredalPayment = {
  id?: string;
  reference?: string;
  status?: string;
  checkout_url?: string;
  amount_minor?: number;
  currency?: string;
};

export async function createKredalPayment(input: CreateKredalPaymentInput) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Kredal payment amount must be a positive integer in kobo.");
  }

  if (!input.reference || input.reference.length > 64) {
    throw new Error("Kredal payment reference is invalid.");
  }

  return kredalRequest<KredalPayment>(
    "/v1/kpay/payments",
    {
      method: "POST",
      headers: {
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        amount_minor: input.amountMinor,
        reference: input.reference,
        description: input.description,
        customer_email: input.customerEmail,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
        expires_in_hours: input.expiresInHours,
      }),
    },
    input.connectionId
  );
}

export async function getKredalPayment(
  connectionId: string,
  idOrReference: string
) {
  return kredalRequest<KredalPayment>(
    "/v1/kpay/payments/" + encodeURIComponent(idOrReference),
    {},
    connectionId
  );
}

export async function cancelKredalPayment(
  connectionId: string,
  idOrReference: string
) {
  return kredalRequest<KredalPayment>(
    "/v1/kpay/payments/" + encodeURIComponent(idOrReference) + "/cancel",
    { method: "POST" },
    connectionId
  );
}

export async function refundKredalPayment(input: {
  connectionId: string;
  idOrReference: string;
  idempotencyKey: string;
  amountMinor?: number;
}) {
  if (
    input.amountMinor !== undefined &&
    (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
  ) {
    throw new Error("Refund amount must be a positive integer in minor units.");
  }

  return kredalRequest<KredalPayment>(
    "/v1/kpay/payments/" +
      encodeURIComponent(input.idOrReference) +
      "/refund",
    {
      method: "POST",
      headers: {
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(
        input.amountMinor === undefined
          ? {}
          : { amount_minor: input.amountMinor }
      ),
    },
    input.connectionId
  );
}

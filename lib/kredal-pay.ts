import "server-only";

type KredalRequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  connectionId?: string;
  idempotencyKey?: string;
  body?: unknown;
};

export type KredalConnection = {
  id: string;
  status?: "pending" | "active" | "revoked";
  approve_url?: string;
};

export type KredalPayment = {
  id?: string;
  reference?: string;
  status?: string;
  payment_state?: string;
  order_status?: string;
  hold_state?: string | null;
  refunded_minor?: number;
  refunds?: Array<Record<string, unknown>>;
  checkout_url?: string;
  amount_minor?: number;
  currency?: string;
};

function getKredalConfig() {
  const apiUrl = (process.env.KREDAL_API_URL || "https://api.kredal.africa").replace(
    /\/$/,
    ""
  );
  const platformKey = process.env.KREDAL_PLATFORM_KEY;

  if (!platformKey) {
    throw new Error("Kredal Pay is not configured.");
  }

  return { apiUrl, platformKey };
}

async function kredalRequest<T>(
  path: string,
  options: KredalRequestOptions = {}
): Promise<T> {
  const { apiUrl, platformKey } = getKredalConfig();
  const headers = new Headers({
    Authorization: "Bearer " + platformKey,
    Accept: "application/json",
  });

  if (options.connectionId) {
    headers.set("Kredal-Account", options.connectionId);
  }

  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey);
  }

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl + path, {
    method: options.method || "GET",
    headers,
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    console.error("Kredal Pay request failed", {
      path,
      status: response.status,
    });
    throw new Error("Kredal Pay could not complete the request.");
  }

  return payload as T;
}

export function createKredalStoreConnection(input: {
  sellerRef: string;
  sellerName: string;
}) {
  if (!input.sellerRef.trim() || !input.sellerName.trim()) {
    throw new Error("Kredal seller reference and name are required.");
  }

  return kredalRequest<KredalConnection>("/v1/platform/connections", {
    method: "POST",
    body: {
      seller_ref: input.sellerRef.trim(),
      seller_name: input.sellerName.trim(),
    },
  });
}

export function getKredalStoreConnection(connectionId: string) {
  if (!connectionId.trim()) {
    throw new Error("Kredal connection id is required.");
  }

  return kredalRequest<KredalConnection>(
    "/v1/platform/connections/" + encodeURIComponent(connectionId.trim())
  );
}

export function disconnectKredalStore(connectionId: string) {
  if (!connectionId.trim()) {
    throw new Error("Kredal connection id is required.");
  }

  return kredalRequest<unknown>(
    "/v1/platform/connections/" + encodeURIComponent(connectionId.trim()),
    { method: "DELETE" }
  );
}

export function createKredalPayment(input: {
  connectionId: string;
  amountMinor: number;
  reference: string;
  idempotencyKey: string;
  description?: string;
  customerEmail?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  expiresInHours?: number;
}) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Kredal amount must be a positive integer in kobo.");
  }

  if (
    !/^[A-Za-z0-9_.:-]{1,64}$/.test(input.reference) ||
    !input.idempotencyKey.trim()
  ) {
    throw new Error("Kredal payment reference is invalid.");
  }

  return kredalRequest<KredalPayment>("/v1/kpay/payments", {
    method: "POST",
    connectionId: input.connectionId,
    idempotencyKey: input.idempotencyKey,
    body: {
      amount_minor: input.amountMinor,
      reference: input.reference,
      description: input.description,
      customer_email: input.customerEmail,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      expires_in_hours: input.expiresInHours,
    },
  });
}

export function getKredalPayment(
  connectionId: string,
  idOrReference: string
) {
  return kredalRequest<KredalPayment>(
    "/v1/kpay/payments/" + encodeURIComponent(idOrReference),
    { connectionId }
  );
}

export function cancelKredalPayment(
  connectionId: string,
  idOrReference: string
) {
  return kredalRequest<KredalPayment>(
    "/v1/kpay/payments/" + encodeURIComponent(idOrReference) + "/cancel",
    { method: "POST", connectionId }
  );
}

export function refundKredalPayment(input: {
  connectionId: string;
  idOrReference: string;
  idempotencyKey: string;
  amountMinor?: number;
}) {
  if (
    input.amountMinor !== undefined &&
    (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
  ) {
    throw new Error("Refund amount must be a positive integer in kobo.");
  }

  return kredalRequest<KredalPayment>(
    "/v1/kpay/payments/" +
      encodeURIComponent(input.idOrReference) +
      "/refund",
    {
      method: "POST",
      connectionId: input.connectionId,
      idempotencyKey: input.idempotencyKey,
      body:
        input.amountMinor === undefined
          ? {}
          : { amount_minor: input.amountMinor },
    }
  );
}


export type KredalEventEnvelope = {
  id: string;
  type: string;
  created_at?: string;
  schema_version?: string;
  livemode?: boolean;
  business_id?: string;
  sequence: number;
  data: Record<string, unknown>;
};

export type KredalEventPage = {
  data?: KredalEventEnvelope[];
  events?: KredalEventEnvelope[];
  has_more?: boolean;
  next_after?: number | string | null;
};

export function listKredalEvents(after?: number | string) {
  const query =
    after === undefined || after === null || String(after) === ""
      ? ""
      : "?after=" + encodeURIComponent(String(after));

  return kredalRequest<KredalEventPage>("/v1/kpay/events" + query);
}

import "server-only";

type RestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: string;
  prefer?: string;
};

function getDatabaseConfig() {
  const url = process.env.ZAYVI_SUPABASE_URL;
  const serviceRoleKey = process.env.ZAYVI_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("ZAYVI database is not configured.");
  }

  return {
    url: url.replace(/\/$/, ""),
    serviceRoleKey,
  };
}

export async function zayviCommerceRequest<T>(
  resource: string,
  options: RestOptions = {}
): Promise<T> {
  const { url, serviceRoleKey } = getDatabaseConfig();
  const method = options.method ?? "GET";
  const endpoint =
    url +
    "/rest/v1/" +
    resource.replace(/^\//, "") +
    (options.query ? "?" + options.query : "");

  const headers = new Headers({
    apikey: serviceRoleKey,
    Authorization: "Bearer " + serviceRoleKey,
    Accept: "application/json",
    "Accept-Profile": "commerce",
    "Content-Profile": "commerce",
  });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.prefer) {
    headers.set("Prefer", options.prefer);
  }

  const response = await fetch(endpoint, {
    method,
    headers,
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    console.error("ZAYVI database request failed", {
      resource,
      method,
      status: response.status,
    });
    throw new Error("ZAYVI could not store this order.");
  }

  return data as T;
}

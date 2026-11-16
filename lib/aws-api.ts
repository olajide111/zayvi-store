import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

type AwsApiResult = {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
};

type AwsApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

function queryObject(url: URL) {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of url.searchParams.entries()) {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  }

  return query;
}

export async function callZayviAwsApi(
  path: string,
  options: AwsApiOptions = {}
): Promise<AwsApiResult> {
  const endpoint = process.env.ZAYVI_AWS_API_URL;
  const roleArn = process.env.AWS_ROLE_ARN;
  const region = process.env.AWS_REGION || "eu-west-2";
  const method = options.method || "GET";
  const requestBody =
    options.body === undefined ? undefined : JSON.stringify(options.body);

  if (!endpoint || !roleArn) {
    return {
      ok: false,
      status: 503,
      data: null,
      error: "AWS Preview integration is not configured.",
    };
  }

  try {
    const credentials = await awsCredentialsProvider({ roleArn })();
    const url = new URL(path, endpoint.endsWith("/") ? endpoint : `${endpoint}/`);

    const signer = new SignatureV4({
      credentials,
      region,
      service: "execute-api",
      sha256: Sha256,
    });

    const request = new HttpRequest({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port ? Number(url.port) : undefined,
      method,
      path: url.pathname || "/",
      query: queryObject(url),
      headers: {
        host: url.host,
        ...(requestBody ? { "content-type": "application/json" } : {}),
      },
      body: requestBody,
    });

    const signed = await signer.sign(request);

    const response = await fetch(url, {
      method,
      headers: signed.headers as Record<string, string>,
      body: requestBody,
      cache: "no-store",
    });

    const text = await response.text();
    let data: unknown = text;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // Keep non-JSON responses as text for diagnostics.
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? undefined : "AWS API request failed.",
    };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      data: null,
      error: error instanceof Error ? error.message : "AWS API request failed.",
    };
  }
}

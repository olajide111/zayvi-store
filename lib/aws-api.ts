import crypto from "node:crypto";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

type AwsApiResult = {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function signingKey(secret: string, date: string, region: string, service: string) {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function canonicalQuery(url: URL) {
  return [...url.searchParams.entries()]
    .sort(([aKey, aValue], [bKey, bValue]) =>
      aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey)
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");
}

export async function callZayviAwsApi(path: string): Promise<AwsApiResult> {
  const endpoint = process.env.ZAYVI_AWS_API_URL;
  const roleArn = process.env.AWS_ROLE_ARN;
  const region = process.env.AWS_REGION || "eu-west-2";

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
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const service = "execute-api";
    const payloadHash = sha256("");

    const signedHeaderNames = ["host", "x-amz-date"];
    const canonicalHeaderValues: Record<string, string> = {
      host: url.host,
      "x-amz-date": amzDate,
    };

    if (credentials.sessionToken) {
      signedHeaderNames.push("x-amz-security-token");
      canonicalHeaderValues["x-amz-security-token"] = credentials.sessionToken;
    }

    signedHeaderNames.sort();
    const signedHeaders = signedHeaderNames.join(";");
    const canonicalHeaders =
      signedHeaderNames
        .map((name) => `${name}:${canonicalHeaderValues[name].trim()}\n`)
        .join("");

    const canonicalRequest = [
      "GET",
      url.pathname || "/",
      canonicalQuery(url),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256(canonicalRequest),
    ].join("\n");

    const signature = crypto
      .createHmac(
        "sha256",
        signingKey(credentials.secretAccessKey, dateStamp, region, service)
      )
      .update(stringToSign, "utf8")
      .digest("hex");

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      "x-amz-date": amzDate,
      authorization,
    };

    if (credentials.sessionToken) {
      headers["x-amz-security-token"] = credentials.sessionToken;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
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

import { NodeSha256 } from "./aws-signing";
import https from "node:https";
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


async function invokePreviewLambda(
  path: string,
  options: AwsApiOptions,
  credentials: Awaited<ReturnType<ReturnType<typeof awsCredentialsProvider>>>,
  region: string
): Promise<AwsApiResult> {
  const method = options.method || "GET";
  const target = new URL(path, "https://zayvi.local");
  const lambdaName = process.env.ZAYVI_AWS_LAMBDA_NAME || "zayvi-preview-api";
  const invokePath =
    `/2015-03-31/functions/${encodeURIComponent(lambdaName)}/invocations`;
  const hostname = `lambda.${region}.amazonaws.com`;

  const eventBody = JSON.stringify({
    version: "2.0",
    rawPath: target.pathname,
    rawQueryString: target.searchParams.toString(),
    queryStringParameters: Object.fromEntries(target.searchParams.entries()),
    requestContext: {
      http: {
        method,
        path: target.pathname,
      },
    },
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
    isBase64Encoded: false,
  });

  const signer = new SignatureV4({
    credentials,
    region,
    service: "lambda",
    sha256: NodeSha256,
  });

  const signed = await signer.sign({
    protocol: "https:",
    hostname,
    method: "POST",
    path: invokePath,
    headers: {
      host: hostname,
      "content-type": "application/json",
    },
    body: eventBody,
  });

  const result = await new Promise<{ status: number; text: string }>(
    (resolve, reject) => {
      const request = https.request(
        {
          protocol: "https:",
          hostname,
          method: "POST",
          path: invokePath,
          headers: signed.headers as Record<string, string>,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on("end", () => {
            resolve({
              status: response.statusCode || 500,
              text: Buffer.concat(chunks).toString("utf8"),
            });
          });
        }
      );

      request.on("error", reject);
      request.write(eventBody);
      request.end();
    }
  );

  if (result.status < 200 || result.status >= 300) {
    let data: unknown = result.text;
    try {
      data = result.text ? JSON.parse(result.text) : null;
    } catch {}
    return {
      ok: false,
      status: result.status,
      data,
      error: "AWS Lambda invoke failed.",
    };
  }

  const functionResponse = JSON.parse(result.text || "{}") as {
    statusCode?: number;
    body?: string;
  };
  const status = Number(functionResponse.statusCode || 500);
  let data: unknown = functionResponse.body || null;

  try {
    data = functionResponse.body ? JSON.parse(functionResponse.body) : null;
  } catch {}

  return {
    ok: status >= 200 && status < 300,
    status,
    data,
    error:
      status >= 200 && status < 300
        ? undefined
        : "Zayvi Lambda request failed.",
  };
}

export async function callZayviAwsApi(
  path: string,
  options: AwsApiOptions = {}
): Promise<AwsApiResult> {
  const endpoint = process.env.ZAYVI_AWS_API_URL;
  const roleArn =
    process.env.AWS_BACKEND_ROLE_ARN || process.env.AWS_ROLE_ARN;
  const region = process.env.AWS_REGION || "eu-west-2";
  const method = options.method || "GET";
  const requestBody =
    options.body === undefined ? undefined : JSON.stringify(options.body);

  if (!roleArn || (process.env.VERCEL_ENV !== "preview" && !endpoint)) {
    return {
      ok: false,
      status: 503,
      data: null,
      error: "AWS backend integration is not configured.",
    };
  }

  try {
    const credentials = await awsCredentialsProvider({ roleArn })();

    if (process.env.VERCEL_ENV === "preview") {
      return await invokePreviewLambda(path, options, credentials, region);
    }

    const url = new URL(
      path,
      endpoint!.endsWith("/") ? endpoint! : `${endpoint!}/`
    );

    const signer = new SignatureV4({
      credentials,
      region,
      service: "execute-api",
      sha256: NodeSha256,
    });

    const signed = await signer.sign({
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

    const result = await new Promise<{
      status: number;
      text: string;
    }>((resolve, reject) => {
      const request = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port ? Number(url.port) : undefined,
          method,
          path: `${url.pathname}${url.search}`,
          headers: signed.headers as Record<string, string>,
        },
        (response) => {
          const chunks: Buffer[] = [];

          response.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });

          response.on("end", () => {
            resolve({
              status: response.statusCode || 500,
              text: Buffer.concat(chunks).toString("utf8"),
            });
          });
        }
      );

      request.on("error", reject);

      if (requestBody) {
        request.write(requestBody);
      }

      request.end();
    });

    let data: unknown = result.text;

    try {
      data = result.text ? JSON.parse(result.text) : null;
    } catch {
      // Keep non-JSON responses as text for diagnostics.
    }

    const ok = result.status >= 200 && result.status < 300;

    return {
      ok,
      status: result.status,
      data,
      error: ok ? undefined : "AWS API request failed.",
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

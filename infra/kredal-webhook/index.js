/* eslint-disable @typescript-eslint/no-require-imports -- Shared CommonJS code for the AWS Lambda archive. */
const { GetSecretValueCommand, SecretsManagerClient } = require("@aws-sdk/client-secrets-manager");
const { InvokeCommand, LambdaClient } = require("@aws-sdk/client-lambda");
const {
  parseKredalSignatureHeader,
  verifyKredalWebhookSignature,
} = require("./kredal-signature.cjs");

const secrets = new SecretsManagerClient({});
const lambda = new LambdaClient({});
const toleranceSeconds = 300;
let cachedSecret;
let secretExpiresAt = 0;

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

async function getSigningSecret() {
  if (cachedSecret && secretExpiresAt > Date.now()) return cachedSecret;

  const { SecretString } = await secrets.send(
    new GetSecretValueCommand({ SecretId: process.env.KREDAL_WEBHOOK_SECRET_ARN })
  );
  if (!SecretString || !SecretString.trim()) {
    throw new Error("Kredal signing secret is empty");
  }

  cachedSecret = SecretString;
  secretExpiresAt = Date.now() + 60_000;
  return cachedSecret;
}

exports.handler = async (request) => {
  if (
    request.requestContext?.http?.method !== "POST" ||
    request.routeKey !== "POST /api/payments/kredal/webhook" ||
    request.rawPath !== "/api/payments/kredal/webhook"
  ) {
    return respond(404, { error: "Unknown webhook route." });
  }

  const signatureHeader = request.headers?.["x-kredal-signature"];
  const signature = parseKredalSignatureHeader(signatureHeader);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!signature || Math.abs(nowSeconds - signature.timestamp) > toleranceSeconds) {
    return respond(401, { error: "Invalid or stale Kredal signature." });
  }

  const rawBody = request.isBase64Encoded
    ? Buffer.from(request.body || "", "base64").toString("utf8")
    : request.body || "";
  if (Buffer.byteLength(rawBody, "utf8") > 1024 * 1024) {
    return respond(413, { error: "Kredal event exceeds the maximum body size." });
  }

  try {
    const secret = await getSigningSecret();
    if (!verifyKredalWebhookSignature({ rawBody, signatureHeader, secret, nowSeconds, toleranceSeconds })) {
      return respond(401, { error: "Invalid or stale Kredal signature." });
    }
  } catch {
    console.error("Kredal webhook signing secret could not be loaded");
    return respond(503, { error: "Kredal webhook verification is unavailable." });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return respond(400, { error: "Invalid Kredal webhook payload." });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.livemode !== false ||
    !Number.isSafeInteger(payload.sequence) ||
    payload.sequence < 0
  ) {
    return respond(400, { error: "Unsupported Kredal test event envelope." });
  }

  try {
    const result = await lambda.send(new InvokeCommand({
      FunctionName: process.env.COMMERCE_LAMBDA_NAME,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(JSON.stringify({
        version: "2.0",
        rawPath: "/payment-events/kredal",
        requestContext: { http: { method: "POST" } },
        body: JSON.stringify({ payload }),
      })),
    }));

    if (result.FunctionError) {
      throw new Error("Commerce Lambda invocation failed");
    }

    const { statusCode, body } = JSON.parse(Buffer.from(result.Payload).toString("utf8"));
    if (statusCode === 400) {
      return respond(400, { error: "Unsupported Kredal test event." });
    }
    if (statusCode !== 200) {
      console.error("Kredal webhook could not be persisted", { backendStatus: statusCode });
      return respond(502, { error: "Kredal event could not be persisted." });
    }

    const outcome = JSON.parse(body);
    if (outcome.duplicate) {
      console.info("Kredal webhook duplicate", { sequence: payload.sequence });
    } else if (outcome.ignored) {
      console.info("Kredal webhook ignored", { sequence: payload.sequence });
    } else if (outcome.applied) {
      console.info("Kredal webhook applied", { sequence: payload.sequence });
    } else {
      console.warn("Kredal webhook stored without applying an update", { sequence: payload.sequence });
    }
    return respond(200, { received: true });
  } catch {
    console.error("Kredal webhook storage request failed");
    return respond(502, { error: "Kredal event could not be persisted." });
  }
};

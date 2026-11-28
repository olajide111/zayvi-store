const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { Pool } = require("pg");
const { Signer } = require("@aws-sdk/rds-signer");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { createMerchantPrivateService } = require("../../lib/merchant-private-service");

let service;

async function configure() {
  const {
    AWS_LAMBDA_FUNCTION_NAME, AWS_REGION, DB_HOST, DB_PORT, DB_NAME, DB_AUTH_MODE,
    ZAYVI_MERCHANT_PROVIDER_ISSUER, ZAYVI_MERCHANT_PROOF_SECRET_ARN, ZAYVI_MERCHANT_SECRETS_ENDPOINT,
  } = process.env;
  const port = Number(DB_PORT);
  if (AWS_LAMBDA_FUNCTION_NAME !== "zayvi-preview-merchant-registration" || AWS_REGION !== "eu-west-2" ||
      DB_AUTH_MODE !== "iam" || !DB_HOST || !DB_NAME || !Number.isInteger(port) || port < 1 || port > 65535 ||
      !/^https:\/\/cognito-idp\.eu-west-2\.amazonaws\.com\/eu-west-2_[A-Za-z0-9]+$/.test(ZAYVI_MERCHANT_PROVIDER_ISSUER ?? "") ||
      !/^arn:aws:secretsmanager:eu-west-2:001961766018:secret:zayvi\/preview\/merchant-registration-proof-[A-Za-z0-9]{6}$/.test(ZAYVI_MERCHANT_PROOF_SECRET_ARN ?? "") ||
      !/^https:\/\/vpce-[a-z0-9-]+\.secretsmanager\.eu-west-2\.vpce\.amazonaws\.com$/.test(ZAYVI_MERCHANT_SECRETS_ENDPOINT ?? "")) {
    throw new Error("Private merchant registration Lambda is not configured.");
  }

  const client = new SecretsManagerClient({
    region: AWS_REGION, endpoint: ZAYVI_MERCHANT_SECRETS_ENDPOINT, maxAttempts: 1,
  });
  let proof;
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: ZAYVI_MERCHANT_PROOF_SECRET_ARN }), {
      abortSignal: AbortSignal.timeout(3000),
    });
    if (!/^[a-fA-F0-9]{64}$/.test(response.SecretString ?? "")) throw new Error();
    proof = Buffer.from(response.SecretString, "hex");
  } catch {
    throw new Error("Private merchant proof secret is unavailable.");
  } finally {
    client.destroy();
  }

  const ca = readFileSync(join(__dirname, "global-bundle.pem"), "utf8");
  function pool(user) {
    const signer = new Signer({ hostname: DB_HOST, port, username: user, region: AWS_REGION });
    const connectionPool = new Pool({
      host: DB_HOST, port, database: DB_NAME, user,
      password: () => signer.getAuthToken(),
      ssl: { ca, rejectUnauthorized: true },
      application_name: "zayvi-merchant-registration",
      max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 4000, statement_timeout: 4000,
    });
    connectionPool.on("error", () => console.error("Private merchant database connection failed."));
    return connectionPool;
  }

  const applicationPool = pool("zayvi_app");
  const registrationPool = pool("zayvi_merchant_registrar");
  return createMerchantPrivateService(
    { deployment: "preview", providerIssuer: ZAYVI_MERCHANT_PROVIDER_ISSUER },
    proof,
    {
      applicationPool, registrationPool,
      lookup: { query: (sql, parameters) => applicationPool.query(sql, parameters) },
    },
  );
}

exports.handler = async event => {
  service ??= configure().catch(error => {
    service = undefined;
    throw error;
  });
  const dispatch = await service;
  return dispatch(event);
};

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { Pool } = require("pg");
const { Signer } = require("@aws-sdk/rds-signer");
const { createMerchantPrivateService } = require("../../lib/merchant-private-service");

let service;

function configure() {
  const {
    AWS_LAMBDA_FUNCTION_NAME, AWS_REGION, DB_HOST, DB_PORT, DB_NAME, DB_AUTH_MODE,
    ZAYVI_MERCHANT_PROVIDER_ISSUER, ZAYVI_MERCHANT_REGISTRATION_PROOF_KEY,
  } = process.env;
  const port = Number(DB_PORT);
  if (AWS_LAMBDA_FUNCTION_NAME !== "zayvi-preview-merchant-registration" || AWS_REGION !== "eu-west-2" ||
      DB_AUTH_MODE !== "iam" || !DB_HOST || !DB_NAME || !Number.isInteger(port) || port < 1 || port > 65535 ||
      !/^https:\/\/cognito-idp\.eu-west-2\.amazonaws\.com\/eu-west-2_[A-Za-z0-9]+$/.test(ZAYVI_MERCHANT_PROVIDER_ISSUER ?? "") ||
      !/^[a-fA-F0-9]{64}$/.test(ZAYVI_MERCHANT_REGISTRATION_PROOF_KEY ?? "")) {
    throw new Error("Private merchant registration Lambda is not configured.");
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
    Buffer.from(ZAYVI_MERCHANT_REGISTRATION_PROOF_KEY, "hex"),
    {
      applicationPool, registrationPool,
      lookup: { query: (sql, parameters) => applicationPool.query(sql, parameters) },
    },
  );
}

exports.handler = async event => {
  service ??= configure();
  return service(event);
};

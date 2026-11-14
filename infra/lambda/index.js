const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { Signer } = require("@aws-sdk/rds-signer");

let pool;

function getPool() {
  if (pool) return pool;

  const required = [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "AWS_REGION",
    "DB_AUTH_MODE"
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      `Missing database configuration: ${missing.join(", ")}`
    );
  }

  if (process.env.DB_AUTH_MODE !== "iam") {
    throw new Error("Only IAM database authentication is supported.");
  }

  const signer = new Signer({
    hostname: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    region: process.env.AWS_REGION
  });

  const ca = fs.readFileSync(
    path.join(__dirname, "global-bundle.pem"),
    "utf8"
  );

  pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,

    // node-postgres supports a dynamic password callback.
    // A fresh RDS IAM token is generated whenever a new DB connection is made.
    password: () => signer.getAuthToken(),

    ssl: {
      ca,
      rejectUnauthorized: true
    },

    application_name: "zayvi-api",
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000
  });

  pool.on("error", (error) => {
    console.error("Unexpected idle PostgreSQL client error:", {
      name: error?.name,
      message: error?.message
    });
  });

  return pool;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const method =
    event?.requestContext?.http?.method || "GET";

  const routePath =
    event?.rawPath || "/";

  if (method === "GET" && routePath.endsWith("/health")) {
    return response(200, {
      status: "ok",
      service: "zayvi-api"
    });
  }

  if (method === "GET" && routePath.endsWith("/ready")) {
    try {
      const result = await getPool().query(
        "SELECT 1 AS ready"
      );

      return response(200, {
        status: "ready",
        database: result.rows[0]?.ready === 1
      });
    } catch (error) {
      console.error("Database readiness check failed:", {
        name: error?.name,
        message: error?.message
      });

      return response(503, {
        status: "not_ready"
      });
    }
  }

  return response(404, {
    error: "not_found"
  });
};

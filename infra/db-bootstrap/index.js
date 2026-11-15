const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");
const {
  SecretsManagerClient,
  GetSecretValueCommand
} = require("@aws-sdk/client-secrets-manager");

const required = [
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "MASTER_SECRET_ARN",
  "AWS_REGION",
  "APP_DB_USER"
];

function requireEnvironment() {
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      `Missing bootstrap configuration: ${missing.join(", ")}`
    );
  }
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function stripTransactionWrapper(sql) {
  return sql
    .replace(/^\s*BEGIN;\s*/i, "")
    .replace(/\s*COMMIT;\s*$/i, "")
    .trim();
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

async function readMasterSecret() {
  const secrets = new SecretsManagerClient({
    region: process.env.AWS_REGION
  });

  const result = await secrets.send(
    new GetSecretValueCommand({
      SecretId: process.env.MASTER_SECRET_ARN
    })
  );

  if (!result.SecretString) {
    throw new Error("RDS master secret contains no SecretString.");
  }

  const secret = JSON.parse(result.SecretString);

  if (!secret.username || !secret.password) {
    throw new Error(
      "RDS master secret is missing username or password."
    );
  }

  return secret;
}

async function ensureApplicationRole(client) {
  const appUser = process.env.APP_DB_USER;
  const role = quoteIdentifier(appUser);

  const result = await client.query(
    `
      SELECT
        rolname,
        rolsuper,
        rolcreatedb,
        rolcreaterole,
        rolreplication,
        rolbypassrls
      FROM pg_roles
      WHERE rolname = $1
    `,
    [appUser]
  );

  if (result.rowCount === 0) {
    await client.query(`CREATE ROLE ${role} LOGIN`);
  } else {
    const existing = result.rows[0];

    if (
      existing.rolsuper ||
      existing.rolcreatedb ||
      existing.rolcreaterole ||
      existing.rolreplication ||
      existing.rolbypassrls
    ) {
      throw new Error(
        `${appUser} unexpectedly has elevated PostgreSQL privileges.`
      );
    }

    await client.query(`ALTER ROLE ${role} LOGIN`);
  }

  await client.query(`GRANT rds_iam TO ${role}`);

  await client.query(
    `GRANT CONNECT ON DATABASE ${quoteIdentifier(
      process.env.DB_NAME
    )} TO ${role}`
  );

  await client.query(
    `GRANT USAGE ON SCHEMA public TO ${role}`
  );
}

async function ensureMigrationLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS zayvi_schema_migrations (
      migration_name text PRIMARY KEY,
      checksum_sha256 text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(
    `REVOKE ALL ON zayvi_schema_migrations FROM PUBLIC`
  );
}

async function applyMigrations(client) {
  const migrationDirectory =
    path.join(__dirname, "migrations");

  const files = fs
    .readdirSync(migrationDirectory)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();

  const applied = [];

  for (const file of files) {
    const source = fs.readFileSync(
      path.join(migrationDirectory, file),
      "utf8"
    );

    const checksum = sha256(source);

    const existing = await client.query(
      `
        SELECT checksum_sha256
        FROM zayvi_schema_migrations
        WHERE migration_name = $1
      `,
      [file]
    );

    if (existing.rowCount > 0) {
      if (existing.rows[0].checksum_sha256 !== checksum) {
        throw new Error(
          `Migration ${file} changed after it was applied.`
        );
      }

      continue;
    }

    const migration = stripTransactionWrapper(source);

    await client.query("BEGIN");

    try {
      await client.query(migration);

      await client.query(
        `
          INSERT INTO zayvi_schema_migrations
            (migration_name, checksum_sha256)
          VALUES ($1, $2)
        `,
        [file, checksum]
      );

      await client.query("COMMIT");

      applied.push(file);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  return applied;
}

exports.handler = async () => {
  requireEnvironment();

  const secret = await readMasterSecret();

  const ca = fs.readFileSync(
    path.join(__dirname, "global-bundle.pem"),
    "utf8"
  );

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: secret.username,
    password: secret.password,
    ssl: {
      ca,
      rejectUnauthorized: true
    },
    connectionTimeoutMillis: 10000,
    application_name: "zayvi-db-bootstrap"
  });

  try {
    await client.connect();

    await ensureApplicationRole(client);
    await ensureMigrationLedger(client);

    const appliedMigrations =
      await applyMigrations(client);

    const appRole = await client.query(
      `
        SELECT
          rolname,
          rolcanlogin,
          rolsuper,
          rolcreatedb,
          rolcreaterole,
          rolreplication,
          rolbypassrls
        FROM pg_roles
        WHERE rolname = $1
      `,
      [process.env.APP_DB_USER]
    );

    return {
      status: "bootstrap_complete",
      migrationsApplied: appliedMigrations,
      applicationRole: appRole.rows[0]?.rolname || null,
      privilegedApplicationRole:
        Boolean(
          appRole.rows[0]?.rolsuper ||
          appRole.rows[0]?.rolcreatedb ||
          appRole.rows[0]?.rolcreaterole ||
          appRole.rows[0]?.rolreplication ||
          appRole.rows[0]?.rolbypassrls
        )
    };
  } finally {
    await client.end().catch(() => {});
  }
};

const readFile = require("node:fs").readFileSync;
const { join } = require("node:path");
const { createHash } = require("node:crypto");

const merchantFiles = [
  "identity-membership-directory.sql",
  "owner-login-attempts.sql",
  "owner-rate-limits.sql",
  "owner-sessions.sql",
  "merchant-registration.sql",
  "merchant-registration-iam.sql",
  "merchant-sessions.sql",
];

async function applyMerchantMigrations(client, directory) {
  const migrations = merchantFiles.map(file => {
    const source = readFile(join(directory, file), "utf8");
    const sql = /^\s*(?:(?:--[^\n]*\n)\s*)*BEGIN;([\s\S]*?)COMMIT;\s*$/i.exec(source)?.[1];
    if (!sql?.trim()) throw new Error("Invalid merchant migration wrapper.");
    return {
      name: "merchant-registration/" + file,
      checksum: createHash("sha256").update(source).digest("hex"),
      sql,
    };
  });

  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(829871026491::bigint)");
    const { rows } = await client.query(
      "SELECT migration_name, checksum_sha256 FROM public.zayvi_schema_migrations WHERE migration_name = ANY($1::text[])",
      [migrations.map(entry => entry.name)],
    );
    const checksums = new Map(rows.map(entry => [entry.migration_name, entry.checksum_sha256]));
    if (checksums.size && (checksums.size !== migrations.length ||
      migrations.some(entry => checksums.get(entry.name) !== entry.checksum))) {
      throw new Error("Merchant migration ledger is incomplete or has unexpected checksums.");
    }
    if (!checksums.size) {
      for (const entry of migrations) {
        await client.query(entry.sql);
        await client.query(
          "INSERT INTO public.zayvi_schema_migrations (migration_name, checksum_sha256) VALUES ($1,$2)",
          [entry.name, entry.checksum],
        );
      }
    }
    await client.query("COMMIT");
    return checksums.size ? [] : migrations.map(entry => entry.name);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

module.exports = { applyMerchantMigrations, merchantFiles };

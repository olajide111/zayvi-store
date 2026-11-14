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
    throw new Error(`Missing database configuration: ${missing.join(", ")}`);
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

function parseBody(event) {
  if (!event?.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return JSON.parse(raw);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normalizeProduct(row) {
  const attributes = row.attributes || {};
  return {
    id: row.id,
    canonicalCode: row.canonical_code,
    slug: row.slug,
    name: row.name,
    category: attributes.category || row.product_type || "Uncategorised",
    image: attributes.image || "",
    emoji: attributes.emoji || "",
    desc: attributes.desc || "",
    longDesc: attributes.longDesc || "",
    features: Array.isArray(attributes.features) ? attributes.features : [],
    colors: Array.isArray(attributes.colors) ? attributes.colors : [],
    sizes: Array.isArray(attributes.sizes) ? attributes.sizes : [],
    badge: attributes.badge || undefined,
    price: row.customer_price === null ? null : Number(row.customer_price),
    currency: row.currency_code || "GBP",
    status: row.tenant_status,
    lifecycleStatus: row.lifecycle_status,
    publicationStatus: row.publication_status,
    availabilityStatus: row.availability_status,
    updatedAt: row.updated_at
  };
}

async function withTenant(client, work) {
  await client.query("BEGIN");

  try {
    const tenantSlug = process.env.TENANT_SLUG || "zayvi";
    const tenantResult = await client.query(
      "SELECT id FROM tenants WHERE slug = $1 AND status = 'active' LIMIT 1",
      [tenantSlug]
    );

    if (tenantResult.rowCount === 0) {
      throw new Error("Active tenant not found.");
    }

    const tenantId = tenantResult.rows[0].id;

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [tenantId]
    );

    const result = await work(client, tenantId);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function listProducts() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            cp.id,
            cp.canonical_code,
            cp.slug,
            cp.name,
            cp.product_type,
            cp.lifecycle_status,
            cp.attributes,
            tcp.status AS tenant_status,
            tpm.customer_price,
            tpm.currency_code,
            tpm.publication_status,
            tpm.availability_status,
            tcp.updated_at
          FROM tenant_catalogue_products tcp
          JOIN catalogue_products cp
            ON cp.id = tcp.product_id
          LEFT JOIN tenant_product_markets tpm
            ON tpm.tenant_id = tcp.tenant_id
           AND tpm.tenant_catalogue_product_id = tcp.id
           AND tpm.market_code = 'GB'
          WHERE tcp.tenant_id = $1
            AND tcp.status <> 'archived'
          ORDER BY tcp.updated_at DESC, cp.name ASC
        `,
        [tenantId]
      );

      return result.rows.map(normalizeProduct);
    });
  } finally {
    client.release();
  }
}

async function createProduct(input) {
  const name = String(input?.name || "").trim();
  const category = String(input?.category || "").trim();
  const image = String(input?.image || "").trim();
  const desc = String(input?.desc || "").trim();
  const longDesc = String(input?.longDesc || desc).trim();
  const emoji = String(input?.emoji || "").trim();
  const badge = input?.badge ? String(input.badge).trim() : null;
  const price = Number(input?.price);

  if (!name || !category) {
    const error = new Error("Name and category are required.");
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(price) || price < 0) {
    const error = new Error("Price must be a non-negative number.");
    error.statusCode = 400;
    throw error;
  }

  const slug = slugify(input?.slug || name);
  if (!slug) {
    const error = new Error("A valid product slug is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const storeResult = await tx.query(
        "SELECT id FROM stores WHERE tenant_id = $1 AND slug = 'main' LIMIT 1",
        [tenantId]
      );

      if (storeResult.rowCount === 0) {
        throw new Error("Main store not found.");
      }

      const canonicalCode =
        String(input?.canonicalCode || "").trim() ||
        `ZAYVI-${Date.now().toString(36).toUpperCase()}`;

      const attributes = {
        category,
        image,
        emoji,
        desc,
        longDesc,
        badge,
        features: Array.isArray(input?.features) ? input.features : [],
        colors: Array.isArray(input?.colors) ? input.colors : [],
        sizes: Array.isArray(input?.sizes) ? input.sizes : []
      };

      const canonical = await tx.query(
        `
          INSERT INTO catalogue_products (
            canonical_code,
            slug,
            name,
            brand_name,
            product_type,
            lifecycle_status,
            attributes
          )
          VALUES ($1, $2, $3, 'ZAYVI', $4, 'active', $5::jsonb)
          RETURNING id
        `,
        [canonicalCode, slug, name, category, JSON.stringify(attributes)]
      );

      const tenantProduct = await tx.query(
        `
          INSERT INTO tenant_catalogue_products (
            tenant_id,
            store_id,
            product_id,
            merchant_sku,
            status,
            listing_overrides
          )
          VALUES ($1, $2, $3, $4, 'active', '{}'::jsonb)
          RETURNING id
        `,
        [tenantId, storeResult.rows[0].id, canonical.rows[0].id, canonicalCode]
      );

      await tx.query(
        `
          INSERT INTO tenant_product_markets (
            tenant_id,
            tenant_catalogue_product_id,
            market_code,
            availability_status,
            compliance_status,
            publication_status,
            requires_human_approval,
            customer_price,
            currency_code,
            price_observed_at
          )
          VALUES (
            $1, $2, 'GB', 'available', 'pending',
            'pending_review', true, $3, 'GBP', now()
          )
        `,
        [tenantId, tenantProduct.rows[0].id, price]
      );

      const result = await tx.query(
        `
          SELECT
            cp.id,
            cp.canonical_code,
            cp.slug,
            cp.name,
            cp.product_type,
            cp.lifecycle_status,
            cp.attributes,
            tcp.status AS tenant_status,
            tpm.customer_price,
            tpm.currency_code,
            tpm.publication_status,
            tpm.availability_status,
            tcp.updated_at
          FROM tenant_catalogue_products tcp
          JOIN catalogue_products cp ON cp.id = tcp.product_id
          LEFT JOIN tenant_product_markets tpm
            ON tpm.tenant_id = tcp.tenant_id
           AND tpm.tenant_catalogue_product_id = tcp.id
           AND tpm.market_code = 'GB'
          WHERE tcp.tenant_id = $1
            AND cp.id = $2
          LIMIT 1
        `,
        [tenantId, canonical.rows[0].id]
      );

      return normalizeProduct(result.rows[0]);
    });
  } finally {
    client.release();
  }
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const method = event?.requestContext?.http?.method || "GET";
  const routePath = event?.rawPath || "/";

  if (method === "GET" && routePath.endsWith("/health")) {
    return response(200, {
      status: "ok",
      service: "zayvi-api"
    });
  }

  if (method === "GET" && routePath.endsWith("/ready")) {
    try {
      const result = await getPool().query("SELECT 1 AS ready");

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

  if (method === "GET" && routePath.endsWith("/products")) {
    try {
      const products = await listProducts();
      return response(200, {
        source: "postgresql",
        total: products.length,
        products
      });
    } catch (error) {
      console.error("Catalogue list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(500, {
        error: "catalogue_unavailable"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/products")) {
    try {
      const product = await createProduct(parseBody(event));
      return response(201, {
        product
      });
    } catch (error) {
      console.error("Catalogue create failed:", {
        name: error?.name,
        message: error?.message
      });

      return response(error?.statusCode || 500, {
        error:
          error?.statusCode === 400
            ? error.message
            : "catalogue_create_failed"
      });
    }
  }

  return response(404, {
    error: "not_found"
  });
};

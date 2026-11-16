const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
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
    currency: row.currency_code || null,
    marketCode: row.market_code || null,
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

async function listProducts(marketCode = "GB") {
  const normalizedMarket = String(marketCode || "GB").trim().toUpperCase();

  if (!["GB", "NG"].includes(normalizedMarket)) {
    const error = new Error("Unsupported market.");
    error.statusCode = 400;
    throw error;
  }

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
            tpm.market_code,
            tpm.publication_status,
            tpm.availability_status,
            tcp.updated_at
          FROM tenant_catalogue_products tcp
          JOIN catalogue_products cp
            ON cp.id = tcp.product_id
          LEFT JOIN tenant_product_markets tpm
            ON tpm.tenant_id = tcp.tenant_id
           AND tpm.tenant_catalogue_product_id = tcp.id
           AND tpm.market_code = $2
          WHERE tcp.tenant_id = $1
            AND tcp.status <> 'archived'
          ORDER BY tcp.updated_at DESC, cp.name ASC
        `,
        [tenantId, normalizedMarket]
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
            $1, $2, 'NG', 'unknown', 'not_assessed',
            'not_listed', true, NULL, 'NGN', NULL
          )
          ON CONFLICT (tenant_id, tenant_catalogue_product_id, market_code)
          DO NOTHING
        `,
        [tenantId, tenantProduct.rows[0].id]
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


async function updateProduct(productId, input) {
  const allowedStatuses = new Set(["draft", "active", "paused", "archived"]);
  const allowedPublicationStatuses = new Set([
    "not_listed",
    "pending_review",
    "published",
    "held",
    "rejected",
    "withdrawn"
  ]);

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const existing = await tx.query(
        `
          SELECT
            cp.id,
            cp.slug,
            cp.name,
            cp.product_type,
            cp.attributes,
            tcp.id AS tenant_product_id,
            tcp.status AS tenant_status,
            tpm.id AS market_id,
            tpm.customer_price,
            tpm.publication_status
          FROM tenant_catalogue_products tcp
          JOIN catalogue_products cp
            ON cp.id = tcp.product_id
          LEFT JOIN tenant_product_markets tpm
            ON tpm.tenant_id = tcp.tenant_id
           AND tpm.tenant_catalogue_product_id = tcp.id
           AND tpm.market_code = 'GB'
          WHERE tcp.tenant_id = $1
            AND cp.id = $2
          LIMIT 1
        `,
        [tenantId, productId]
      );

      if (existing.rowCount === 0) {
        const error = new Error("Product not found.");
        error.statusCode = 404;
        throw error;
      }

      const row = existing.rows[0];
      const currentAttributes = row.attributes || {};
      const name =
        input?.name === undefined ? row.name : String(input.name || "").trim();
      const category =
        input?.category === undefined
          ? currentAttributes.category || row.product_type || "Uncategorised"
          : String(input.category || "").trim();
      const image =
        input?.image === undefined
          ? currentAttributes.image || ""
          : String(input.image || "").trim();
      const desc =
        input?.desc === undefined
          ? currentAttributes.desc || ""
          : String(input.desc || "").trim();
      const longDesc =
        input?.longDesc === undefined
          ? currentAttributes.longDesc || desc
          : String(input.longDesc || "").trim();
      const price =
        input?.price === undefined ? Number(row.customer_price) : Number(input.price);
      const status =
        input?.status === undefined ? row.tenant_status : String(input.status);
      const publicationStatus =
        input?.publicationStatus === undefined
          ? row.publication_status
          : String(input.publicationStatus);

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

      if (!allowedStatuses.has(status)) {
        const error = new Error("Invalid product status.");
        error.statusCode = 400;
        throw error;
      }

      if (!allowedPublicationStatuses.has(publicationStatus)) {
        const error = new Error("Invalid publication status.");
        error.statusCode = 400;
        throw error;
      }

      const nextAttributes = {
        ...currentAttributes,
        category,
        image,
        desc,
        longDesc
      };

      if (input?.emoji !== undefined) {
        nextAttributes.emoji = String(input.emoji || "").trim();
      }

      if (input?.badge !== undefined) {
        nextAttributes.badge = input.badge ? String(input.badge).trim() : null;
      }

      if (Array.isArray(input?.features)) nextAttributes.features = input.features;
      if (Array.isArray(input?.colors)) nextAttributes.colors = input.colors;
      if (Array.isArray(input?.sizes)) nextAttributes.sizes = input.sizes;

      const slug =
        input?.slug === undefined ? row.slug : slugify(input.slug || name);

      if (!slug) {
        const error = new Error("A valid product slug is required.");
        error.statusCode = 400;
        throw error;
      }

      await tx.query(
        `
          UPDATE catalogue_products
          SET
            slug = $1,
            name = $2,
            product_type = $3,
            attributes = $4::jsonb,
            updated_at = now()
          WHERE id = $5
        `,
        [slug, name, category, JSON.stringify(nextAttributes), productId]
      );

      await tx.query(
        `
          UPDATE tenant_catalogue_products
          SET
            status = $1,
            updated_at = now()
          WHERE tenant_id = $2
            AND id = $3
        `,
        [status, tenantId, row.tenant_product_id]
      );

      if (row.market_id) {
        await tx.query(
          `
            UPDATE tenant_product_markets
            SET
              customer_price = $1,
              publication_status = $2,
              price_observed_at = now(),
              updated_at = now()
            WHERE tenant_id = $3
              AND id = $4
          `,
          [price, publicationStatus, tenantId, row.market_id]
        );
      }

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
        [tenantId, productId]
      );

      return normalizeProduct(result.rows[0]);
    });
  } finally {
    client.release();
  }
}


async function updateProductMarket(productId, marketCode, input) {
  const normalizedMarket = String(marketCode || "").trim().toUpperCase();
  const allowedAvailability = new Set([
    "unknown",
    "available",
    "limited_stock",
    "out_of_stock",
    "unavailable",
    "restricted"
  ]);
  const allowedPublication = new Set([
    "not_listed",
    "pending_review",
    "published",
    "held",
    "rejected",
    "withdrawn"
  ]);

  if (!["GB", "NG"].includes(normalizedMarket)) {
    const error = new Error("Unsupported market.");
    error.statusCode = 400;
    throw error;
  }

  const price =
    input?.price === null || input?.price === undefined
      ? null
      : Number(input.price);
  const availabilityStatus = String(
    input?.availabilityStatus || "unknown"
  ).trim();
  const publicationStatus = String(
    input?.publicationStatus || "not_listed"
  ).trim();

  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    const error = new Error("Market price must be a non-negative number.");
    error.statusCode = 400;
    throw error;
  }

  if (!allowedAvailability.has(availabilityStatus)) {
    const error = new Error("Invalid market availability status.");
    error.statusCode = 400;
    throw error;
  }

  if (!allowedPublication.has(publicationStatus)) {
    const error = new Error("Invalid market publication status.");
    error.statusCode = 400;
    throw error;
  }

  if (availabilityStatus === "available" && price === null) {
    const error = new Error("An available market product requires an explicit price.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const market = await tx.query(
        `
          SELECT currency_code
          FROM commerce_markets
          WHERE code = $1
            AND enabled = true
          LIMIT 1
        `,
        [normalizedMarket]
      );

      if (market.rowCount === 0) {
        const error = new Error("The selected market is not enabled.");
        error.statusCode = 409;
        throw error;
      }

      const product = await tx.query(
        `
          SELECT tcp.id AS tenant_product_id
          FROM tenant_catalogue_products tcp
          WHERE tcp.tenant_id = $1
            AND tcp.product_id = $2
          LIMIT 1
        `,
        [tenantId, productId]
      );

      if (product.rowCount === 0) {
        const error = new Error("Product not found.");
        error.statusCode = 404;
        throw error;
      }

      const currencyCode = market.rows[0].currency_code;

      const result = await tx.query(
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
            $1, $2, $3, $4, 'pending', $5, true, $6, $7,
            CASE WHEN $6::numeric IS NULL THEN NULL ELSE now() END
          )
          ON CONFLICT (tenant_id, tenant_catalogue_product_id, market_code)
          DO UPDATE SET
            availability_status = EXCLUDED.availability_status,
            publication_status = EXCLUDED.publication_status,
            customer_price = EXCLUDED.customer_price,
            currency_code = EXCLUDED.currency_code,
            price_observed_at =
              CASE
                WHEN EXCLUDED.customer_price IS NULL THEN NULL
                ELSE now()
              END,
            updated_at = now()
          RETURNING
            market_code,
            currency_code,
            customer_price,
            availability_status,
            publication_status,
            compliance_status,
            price_observed_at,
            updated_at
        `,
        [
          tenantId,
          product.rows[0].tenant_product_id,
          normalizedMarket,
          availabilityStatus,
          publicationStatus,
          price,
          currencyCode
        ]
      );

      const row = result.rows[0];

      return {
        productId,
        marketCode: row.market_code,
        currency: row.currency_code,
        price: row.customer_price === null ? null : Number(row.customer_price),
        availabilityStatus: row.availability_status,
        publicationStatus: row.publication_status,
        complianceStatus: row.compliance_status,
        priceObservedAt: row.price_observed_at,
        updatedAt: row.updated_at
      };
    });
  } finally {
    client.release();
  }
}



async function listOrders() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            o.id,
            o.order_number,
            o.customer_name,
            o.customer_email,
            o.total,
            o.currency_code,
            o.payment_status,
            o.fulfilment_status,
            o.order_status,
            o.created_at
          FROM commerce_orders o
          WHERE o.tenant_id = $1
          ORDER BY o.created_at DESC
          LIMIT 250
        `,
        [tenantId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        orderNumber: row.order_number,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        total: Number(row.total),
        currency: row.currency_code,
        paymentStatus: row.payment_status,
        fulfilmentStatus: row.fulfilment_status,
        orderStatus: row.order_status,
        createdAt: row.created_at
      }));
    });
  } finally {
    client.release();
  }
}

async function listCustomers() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            c.id,
            c.display_name,
            c.email,
            c.phone,
            c.status,
            c.first_order_at,
            c.last_order_at,
            c.created_at,
            COUNT(o.id) FILTER (
              WHERE o.order_status <> 'cancelled'
            )::int AS order_count,
            COALESCE(
              SUM(o.total) FILTER (WHERE o.payment_status = 'paid'),
              0
            )::numeric AS lifetime_value
          FROM commerce_customers c
          LEFT JOIN commerce_orders o
            ON o.tenant_id = c.tenant_id
           AND o.customer_id = c.id
          WHERE c.tenant_id = $1
          GROUP BY
            c.id,
            c.display_name,
            c.email,
            c.phone,
            c.status,
            c.first_order_at,
            c.last_order_at,
            c.created_at
          ORDER BY c.updated_at DESC
          LIMIT 250
        `,
        [tenantId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        name: row.display_name,
        email: row.email,
        phone: row.phone,
        status: row.status,
        orderCount: Number(row.order_count || 0),
        lifetimeValue: Number(row.lifetime_value || 0),
        firstOrderAt: row.first_order_at,
        lastOrderAt: row.last_order_at,
        createdAt: row.created_at
      }));
    });
  } finally {
    client.release();
  }
}

function createOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `ZV-${stamp}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

async function createOrder(input) {
  const customerName = String(input?.customerName || "").trim();
  const customerEmail = String(input?.customerEmail || "").trim().toLowerCase();
  const phone = input?.phone ? String(input.phone).trim() : null;
  const idempotencyKey = String(input?.idempotencyKey || "").trim();
  const marketCode = String(input?.marketCode || "GB").trim().toUpperCase();
  const items = Array.isArray(input?.items) ? input.items : [];

  if (!["GB", "NG"].includes(marketCode)) {
    const error = new Error("Unsupported order market.");
    error.statusCode = 400;
    throw error;
  }

  if (!customerName || !customerEmail || !customerEmail.includes("@")) {
    const error = new Error("Customer name and a valid email are required.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
    const error = new Error("A valid order idempotency key is required.");
    error.statusCode = 400;
    throw error;
  }

  if (items.length === 0 || items.length > 50) {
    const error = new Error("Order must contain between 1 and 50 items.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedItems = items.map((item) => {
    const id = String(item?.id || "").trim();
    const quantity = Number(item?.qty);
    const selectedColor =
      item?.selectedColor === undefined
        ? undefined
        : String(item.selectedColor || "").trim();
    const selectedSize =
      item?.selectedSize === undefined
        ? undefined
        : String(item.selectedSize || "").trim();

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      const error = new Error("Invalid product identifier.");
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      const error = new Error("Each item quantity must be between 1 and 20.");
      error.statusCode = 400;
      throw error;
    }

    return { id, quantity, selectedColor, selectedSize };
  });

  const requestFingerprint = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        customerName,
        customerEmail,
        phone,
        marketCode,
        items: normalizedItems
      })
    )
    .digest("hex");

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const storeResult = await tx.query(
        "SELECT id FROM stores WHERE tenant_id = $1 AND slug = 'main' AND status = 'active' LIMIT 1",
        [tenantId]
      );

      if (storeResult.rowCount === 0) {
        throw new Error("Active main store not found.");
      }

      const storeId = storeResult.rows[0].id;

      const replay = await tx.query(
        `
          SELECT
            id,
            order_number,
            customer_name,
            customer_email,
            total,
            currency_code,
            order_status,
            payment_status,
            fulfilment_status,
            created_at,
            request_fingerprint
          FROM commerce_orders
          WHERE tenant_id = $1
            AND idempotency_key = $2
          LIMIT 1
        `,
        [tenantId, idempotencyKey]
      );

      if (replay.rowCount > 0) {
        const existing = replay.rows[0];

        if (existing.request_fingerprint !== requestFingerprint) {
          const error = new Error(
            "This idempotency key was already used for a different order request."
          );
          error.statusCode = 409;
          throw error;
        }

        return {
          id: existing.id,
          orderNumber: existing.order_number,
          customerName: existing.customer_name,
          customerEmail: existing.customer_email,
          total: Number(existing.total),
          currency: existing.currency_code,
          orderStatus: existing.order_status,
          paymentStatus: existing.payment_status,
          fulfilmentStatus: existing.fulfilment_status,
          createdAt: existing.created_at,
          purchasingEnabled: false,
          idempotentReplay: true
        };
      }

      const marketResult = await tx.query(
        `
          SELECT currency_code
          FROM commerce_markets
          WHERE code = $1
            AND enabled = true
          LIMIT 1
        `,
        [marketCode]
      );

      if (marketResult.rowCount === 0) {
        const error = new Error("The selected market is not enabled.");
        error.statusCode = 409;
        throw error;
      }

      const marketCurrency = marketResult.rows[0].currency_code;
      const productIds = normalizedItems.map((item) => item.id);

      const productResult = await tx.query(
        `
          SELECT
            cp.id AS product_id,
            cp.name,
            tcp.id AS tenant_product_id,
            tcp.merchant_sku,
            tcp.status AS tenant_status,
            cp.lifecycle_status,
            cp.attributes,
            tpm.customer_price,
            tpm.currency_code,
            tpm.availability_status
          FROM tenant_catalogue_products tcp
          JOIN catalogue_products cp
            ON cp.id = tcp.product_id
          JOIN tenant_product_markets tpm
            ON tpm.tenant_id = tcp.tenant_id
           AND tpm.tenant_catalogue_product_id = tcp.id
           AND tpm.market_code = $3
          WHERE tcp.tenant_id = $1
            AND cp.id = ANY($2::uuid[])
        `,
        [tenantId, productIds, marketCode]
      );

      const productMap = new Map(
        productResult.rows.map((row) => [row.product_id, row])
      );

      const pricedLines = normalizedItems.map((item) => {
        const row = productMap.get(item.id);

        if (
          !row ||
          row.tenant_status !== "active" ||
          row.lifecycle_status !== "active" ||
          row.availability_status !== "available" ||
          row.customer_price === null
        ) {
          const error = new Error("A product in the order is no longer available.");
          error.statusCode = 409;
          throw error;
        }

        const colors = Array.isArray(row.attributes?.colors)
          ? row.attributes.colors.map((colour) => colour?.name).filter(Boolean)
          : [];
        const sizes = Array.isArray(row.attributes?.sizes)
          ? row.attributes.sizes.filter((size) => typeof size === "string")
          : [];

        if (item.selectedColor && !colors.includes(item.selectedColor)) {
          const error = new Error("A selected colour is not available for this product.");
          error.statusCode = 409;
          throw error;
        }

        if (sizes.length > 0 && !item.selectedSize) {
          const error = new Error("A size selection is required for this product.");
          error.statusCode = 409;
          throw error;
        }

        if (item.selectedSize && !sizes.includes(item.selectedSize)) {
          const error = new Error("A selected size is not available for this product.");
          error.statusCode = 409;
          throw error;
        }

        const unitPrice = Number(row.customer_price);

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          const error = new Error("A product has invalid pricing.");
          error.statusCode = 409;
          throw error;
        }

        return {
          ...item,
          product: row,
          unitPrice,
          lineTotal: Math.round(unitPrice * 100) * item.quantity / 100
        };
      });

      const currencySet = new Set(
        pricedLines.map((line) => line.product.currency_code)
      );

      if (currencySet.size !== 1 || !currencySet.has(marketCurrency)) {
        const error = new Error("Order items do not match the selected market currency.");
        error.statusCode = 409;
        throw error;
      }

      const subtotal =
        pricedLines.reduce(
          (sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity,
          0
        ) / 100;

      const customer = await tx.query(
        `
          INSERT INTO commerce_customers (
            tenant_id,
            store_id,
            email,
            display_name,
            phone,
            first_order_at,
            last_order_at
          )
          VALUES ($1, $2, $3, $4, $5, now(), now())
          ON CONFLICT (tenant_id, store_id, email) DO UPDATE
          SET
            display_name = EXCLUDED.display_name,
            phone = COALESCE(EXCLUDED.phone, commerce_customers.phone),
            first_order_at = COALESCE(commerce_customers.first_order_at, now()),
            last_order_at = now(),
            updated_at = now()
          RETURNING id
        `,
        [tenantId, storeId, customerEmail, customerName, phone]
      );

      const orderResult = await tx.query(
        `
          INSERT INTO commerce_orders (
            tenant_id,
            store_id,
            customer_id,
            order_number,
            market_code,
            currency_code,
            order_status,
            payment_status,
            fulfilment_status,
            customer_name,
            customer_email,
            subtotal,
            shipping_total,
            tax_total,
            total,
            source,
            idempotency_key,
            request_fingerprint
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            'draft', 'unpaid', 'unfulfilled',
            $7, $8, $9, 0, 0, $9, 'preview',
            $10, $11
          )
          RETURNING *
        `,
        [
          tenantId,
          storeId,
          customer.rows[0].id,
          createOrderNumber(),
          marketCode,
          marketCurrency,
          customerName,
          customerEmail,
          subtotal,
          idempotencyKey,
          requestFingerprint
        ]
      );

      const order = orderResult.rows[0];

      for (const line of pricedLines) {
        await tx.query(
          `
            INSERT INTO commerce_order_items (
              tenant_id,
              order_id,
              tenant_catalogue_product_id,
              product_id,
              product_name,
              merchant_sku,
              quantity,
              unit_price,
              line_total,
              currency_code,
              selected_options
            )
            VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11::jsonb
            )
          `,
          [
            tenantId,
            order.id,
            line.product.tenant_product_id,
            line.product.product_id,
            line.product.name,
            line.product.merchant_sku,
            line.quantity,
            line.unitPrice,
            line.lineTotal,
            marketCurrency,
            JSON.stringify(
              {
                ...(line.selectedColor ? { color: line.selectedColor } : {}),
                ...(line.selectedSize ? { size: line.selectedSize } : {})
              }
            )
          ]
        );
      }

      return {
        id: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        total: Number(order.total),
        currency: order.currency_code,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        fulfilmentStatus: order.fulfilment_status,
        createdAt: order.created_at,
        purchasingEnabled: false,
        idempotentReplay: false
      };
    });
  } finally {
    client.release();
  }
}



async function getOrder(orderId) {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const orderResult = await tx.query(
        `
          SELECT
            o.id,
            o.order_number,
            o.customer_id,
            o.customer_name,
            o.customer_email,
            o.market_code,
            o.currency_code,
            o.order_status,
            o.payment_status,
            o.fulfilment_status,
            o.subtotal,
            o.shipping_total,
            o.tax_total,
            o.total,
            o.source,
            o.created_at,
            o.updated_at
          FROM commerce_orders o
          WHERE o.tenant_id = $1
            AND o.id = $2
          LIMIT 1
        `,
        [tenantId, orderId]
      );

      if (orderResult.rowCount === 0) {
        const error = new Error("Order not found.");
        error.statusCode = 404;
        throw error;
      }

      const itemResult = await tx.query(
        `
          SELECT
            oi.id,
            oi.product_id,
            oi.product_name,
            oi.merchant_sku,
            oi.quantity,
            oi.unit_price,
            oi.line_total,
            oi.currency_code,
            oi.selected_options
          FROM commerce_order_items oi
          WHERE oi.tenant_id = $1
            AND oi.order_id = $2
          ORDER BY oi.created_at ASC
        `,
        [tenantId, orderId]
      );

      const paymentAttemptResult = await tx.query(
        `
          SELECT
            pa.id,
            pa.provider,
            pa.provider_reference,
            pa.status,
            pa.amount,
            pa.currency_code,
            pa.failure_code,
            pa.failure_message,
            pa.provider_payload,
            pa.created_at,
            pa.updated_at
          FROM commerce_payment_attempts pa
          WHERE pa.tenant_id = $1
            AND pa.order_id = $2
          ORDER BY pa.created_at DESC
          LIMIT 1
        `,
        [tenantId, orderId]
      );

      const latestAttempt = paymentAttemptResult.rows[0] || null;
      let paymentEvents = [];

      if (latestAttempt) {
        const paymentEventResult = await tx.query(
          `
            SELECT
              pe.external_event_id,
              pe.event_type,
              pe.provider_sequence,
              pe.processing_status,
              pe.processing_note,
              pe.received_at,
              pe.processed_at
            FROM commerce_payment_events pe
            WHERE pe.tenant_id = $1
              AND pe.payment_attempt_id = $2
            ORDER BY pe.received_at DESC
            LIMIT 20
          `,
          [tenantId, latestAttempt.id]
        );

        paymentEvents = paymentEventResult.rows.map((event) => ({
          eventId: event.external_event_id,
          eventType: event.event_type,
          sequence:
            event.provider_sequence === null ||
            event.provider_sequence === undefined
              ? null
              : Number(event.provider_sequence),
          processingStatus: event.processing_status,
          processingNote: event.processing_note,
          receivedAt: event.received_at,
          processedAt: event.processed_at
        }));
      }

      const row = orderResult.rows[0];
      const fulfilmentBlocked =
        row.source === "preview" || row.payment_status !== "paid";
      const fulfilmentBlockReason =
        row.source === "preview"
          ? "Preview/test orders cannot enter real fulfilment."
          : row.payment_status !== "paid"
            ? "Payment must be confirmed before fulfilment."
            : null;

      return {
        id: row.id,
        orderNumber: row.order_number,
        customerId: row.customer_id,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        marketCode: row.market_code,
        currency: row.currency_code,
        orderStatus: row.order_status,
        paymentStatus: row.payment_status,
        fulfilmentStatus: row.fulfilment_status,
        subtotal: Number(row.subtotal),
        shippingTotal: Number(row.shipping_total),
        taxTotal: Number(row.tax_total),
        total: Number(row.total),
        source: row.source,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        fulfilmentSafety: {
          blocked: fulfilmentBlocked,
          reason: fulfilmentBlockReason
        },
        paymentAttempt: latestAttempt
          ? {
              id: latestAttempt.id,
              provider: latestAttempt.provider,
              providerReference: latestAttempt.provider_reference,
              status: latestAttempt.status,
              amount: Number(latestAttempt.amount),
              currency: latestAttempt.currency_code,
              failureCode: latestAttempt.failure_code,
              failureMessage: latestAttempt.failure_message,
              providerState:
                latestAttempt.provider_payload?.payment_state ||
                latestAttempt.provider_payload?.status ||
                null,
              holdState: latestAttempt.provider_payload?.hold_state || null,
              createdAt: latestAttempt.created_at,
              updatedAt: latestAttempt.updated_at
            }
          : null,
        paymentEvents,
        items: itemResult.rows.map((item) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          sku: item.merchant_sku,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          lineTotal: Number(item.line_total),
          currency: item.currency_code,
          selectedOptions: item.selected_options || {}
        }))
      };
    });
  } finally {
    client.release();
  }
}

async function updateOrderStatus(orderId, input) {
  const allowedOrderStatuses = new Set([
    "draft",
    "pending_payment",
    "confirmed",
    "cancelled",
    "completed"
  ]);
  const allowedFulfilmentStatuses = new Set([
    "unfulfilled",
    "processing",
    "fulfilled",
    "cancelled"
  ]);

  const requestedOrderStatus =
    input?.orderStatus === undefined ? undefined : String(input.orderStatus);
  const requestedFulfilmentStatus =
    input?.fulfilmentStatus === undefined
      ? undefined
      : String(input.fulfilmentStatus);

  if (input?.paymentStatus !== undefined) {
    const error = new Error("Payment status is provider-controlled and cannot be changed manually.");
    error.statusCode = 400;
    throw error;
  }

  if (
    requestedOrderStatus !== undefined &&
    !allowedOrderStatuses.has(requestedOrderStatus)
  ) {
    const error = new Error("Invalid order status.");
    error.statusCode = 400;
    throw error;
  }

  if (
    requestedFulfilmentStatus !== undefined &&
    !allowedFulfilmentStatuses.has(requestedFulfilmentStatus)
  ) {
    const error = new Error("Invalid fulfilment status.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    await withTenant(client, async (tx, tenantId) => {
      const existing = await tx.query(
        `
          SELECT order_status, payment_status, fulfilment_status, source
          FROM commerce_orders
          WHERE tenant_id = $1
            AND id = $2
          LIMIT 1
        `,
        [tenantId, orderId]
      );

      if (existing.rowCount === 0) {
        const error = new Error("Order not found.");
        error.statusCode = 404;
        throw error;
      }

      const current = existing.rows[0];
      const nextOrderStatus = requestedOrderStatus ?? current.order_status;
      const nextFulfilmentStatus =
        requestedFulfilmentStatus ?? current.fulfilment_status;

      if (
        nextOrderStatus === "confirmed" &&
        current.payment_status !== "paid"
      ) {
        const error = new Error("An unpaid order cannot be confirmed.");
        error.statusCode = 409;
        throw error;
      }

      if (
        ["processing", "fulfilled"].includes(nextFulfilmentStatus) &&
        current.payment_status !== "paid"
      ) {
        const error = new Error("Unpaid orders cannot enter fulfilment.");
        error.statusCode = 409;
        throw error;
      }
      if (
        ["processing", "fulfilled"].includes(nextFulfilmentStatus) &&
        current.source === "preview"
      ) {
        const error = new Error(
          "Preview/test orders cannot enter real fulfilment."
        );
        error.statusCode = 409;
        throw error;
      }


      if (
        nextOrderStatus === "completed" &&
        nextFulfilmentStatus !== "fulfilled"
      ) {
        const error = new Error("Only fulfilled orders can be completed.");
        error.statusCode = 409;
        throw error;
      }

      await tx.query(
        `
          UPDATE commerce_orders
          SET
            order_status = $1,
            fulfilment_status = $2,
            updated_at = now()
          WHERE tenant_id = $3
            AND id = $4
        `,
        [nextOrderStatus, nextFulfilmentStatus, tenantId, orderId]
      );
    });

    return await getOrder(orderId);
  } finally {
    client.release();
  }
}

async function listInventory(marketCode = "GB") {
  const normalizedMarket = String(marketCode || "GB").trim().toUpperCase();

  if (!["GB", "NG"].includes(normalizedMarket)) {
    const error = new Error("Unsupported inventory market.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            tcp.id,
            cp.canonical_code,
            cp.name,
            cp.attributes,
            tcp.status AS product_status,
            tpm.market_code,
            tpm.availability_status,
            tpm.publication_status,
            tpm.compliance_status,
            tpm.requires_human_approval,
            tpm.customer_price,
            tpm.currency_code,
            tpm.price_observed_at,
            il.id AS inventory_level_id,
            il.on_hand,
            il.reserved,
            il.safety_stock,
            il.updated_at AS inventory_updated_at,
            loc.id AS location_id,
            loc.code AS location_code,
            loc.name AS location_name,
            loc.location_type,
            tcp.updated_at
          FROM tenant_catalogue_products tcp
          JOIN catalogue_products cp
            ON cp.id = tcp.product_id
          LEFT JOIN tenant_product_markets tpm
            ON tpm.tenant_id = tcp.tenant_id
           AND tpm.tenant_catalogue_product_id = tcp.id
           AND tpm.market_code = $2
          LEFT JOIN commerce_inventory_locations loc
            ON loc.tenant_id = tcp.tenant_id
           AND loc.store_id = tcp.store_id
           AND loc.market_code = $2
           AND loc.location_type = 'own_stock'
           AND loc.status = 'active'
          LEFT JOIN commerce_inventory_levels il
            ON il.tenant_id = tcp.tenant_id
           AND il.location_id = loc.id
           AND il.tenant_catalogue_product_id = tcp.id
          WHERE tcp.tenant_id = $1
            AND tcp.status <> 'archived'
          ORDER BY cp.name ASC
        `,
        [tenantId, normalizedMarket]
      );

      return result.rows.map((row) => {
        const onHand = row.on_hand === null ? null : Number(row.on_hand);
        const reserved = row.reserved === null ? 0 : Number(row.reserved);
        const safetyStock = row.safety_stock === null ? 0 : Number(row.safety_stock);
        const availableToSell =
          onHand === null ? null : Math.max(0, onHand - reserved - safetyStock);

        return {
          id: row.id,
          sku: row.canonical_code,
          name: row.name,
          image: row.attributes?.image || "",
          status: row.product_status,
          marketCode: row.market_code || normalizedMarket,
          availabilityStatus: row.availability_status || "unknown",
          publicationStatus: row.publication_status || "not_listed",
          complianceStatus: row.compliance_status || "pending",
          requiresHumanApproval:
            row.requires_human_approval === null ||
            row.requires_human_approval === undefined
              ? true
              : Boolean(row.requires_human_approval),
          inventoryManaged: Boolean(row.inventory_level_id),
          inventoryLevelId: row.inventory_level_id || null,
          locationId: row.location_id || null,
          locationCode: row.location_code || null,
          locationName: row.location_name || null,
          locationType: row.location_type || null,
          onHand,
          reserved,
          safetyStock,
          availableToSell,
          price: row.customer_price === null ? null : Number(row.customer_price),
          currency:
            row.currency_code || (normalizedMarket === "NG" ? "NGN" : "GBP"),
          priceObservedAt: row.price_observed_at,
          updatedAt: row.inventory_updated_at || row.updated_at
        };
      });
    });
  } finally {
    client.release();
  }
}

async function adjustInventory(input) {
  const productId = String(input?.productId || "").trim();
  const marketCode = String(input?.marketCode || "").trim().toUpperCase();
  const delta = Number(input?.quantityDelta);
  const safetyStock =
    input?.safetyStock === undefined ? undefined : Number(input.safetyStock);
  const note = String(input?.note || "").trim().slice(0, 500);

  if (!/^[0-9a-f-]{36}$/i.test(productId)) {
    const error = new Error("A valid catalogue product id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!["GB", "NG"].includes(marketCode)) {
    const error = new Error("Inventory market must be GB or NG.");
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isSafeInteger(delta) || Math.abs(delta) > 100000) {
    const error = new Error("Inventory adjustment must be a whole number.");
    error.statusCode = 400;
    throw error;
  }

  if (delta === 0 && safetyStock === undefined) {
    const error = new Error("Provide a stock adjustment or safety-stock change.");
    error.statusCode = 400;
    throw error;
  }

  if (
    safetyStock !== undefined &&
    (!Number.isSafeInteger(safetyStock) || safetyStock < 0 || safetyStock > 100000)
  ) {
    const error = new Error("Safety stock must be a non-negative whole number.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const product = await tx.query(
        `
          SELECT tcp.id, tcp.store_id
          FROM tenant_catalogue_products tcp
          WHERE tcp.tenant_id = $1
            AND tcp.id = $2
            AND tcp.status <> 'archived'
          LIMIT 1
        `,
        [tenantId, productId]
      );

      if (product.rowCount === 0) {
        const error = new Error("Inventory product not found.");
        error.statusCode = 404;
        throw error;
      }

      const storeId = product.rows[0].store_id;
      const location = await tx.query(
        `
          SELECT id
          FROM commerce_inventory_locations
          WHERE tenant_id = $1
            AND store_id = $2
            AND market_code = $3
            AND location_type = 'own_stock'
            AND status = 'active'
          ORDER BY created_at ASC
          LIMIT 1
        `,
        [tenantId, storeId, marketCode]
      );

      if (location.rowCount === 0) {
        const error = new Error("Active own-stock location not found for this market.");
        error.statusCode = 409;
        throw error;
      }

      const locationId = location.rows[0].id;

      await tx.query(
        `
          INSERT INTO commerce_inventory_levels (
            tenant_id,
            location_id,
            tenant_catalogue_product_id,
            on_hand,
            reserved,
            safety_stock
          )
          VALUES ($1, $2, $3, 0, 0, $4)
          ON CONFLICT (tenant_id, location_id, tenant_catalogue_product_id)
          DO NOTHING
        `,
        [tenantId, locationId, productId, safetyStock ?? 0]
      );

      const levelResult = await tx.query(
        `
          SELECT id, on_hand, reserved, safety_stock
          FROM commerce_inventory_levels
          WHERE tenant_id = $1
            AND location_id = $2
            AND tenant_catalogue_product_id = $3
          FOR UPDATE
        `,
        [tenantId, locationId, productId]
      );

      const level = levelResult.rows[0];
      const nextOnHand = Number(level.on_hand) + delta;
      const nextSafetyStock =
        safetyStock === undefined ? Number(level.safety_stock) : safetyStock;

      if (nextOnHand < 0) {
        const error = new Error("Inventory adjustment would make on-hand stock negative.");
        error.statusCode = 409;
        throw error;
      }

      if (Number(level.reserved) > nextOnHand) {
        const error = new Error("Inventory adjustment cannot reduce stock below reserved quantity.");
        error.statusCode = 409;
        throw error;
      }

      await tx.query(
        `
          UPDATE commerce_inventory_levels
          SET
            on_hand = $1,
            safety_stock = $2,
            updated_at = now()
          WHERE tenant_id = $3
            AND id = $4
        `,
        [nextOnHand, nextSafetyStock, tenantId, level.id]
      );

      if (delta !== 0) {
        await tx.query(
          `
            INSERT INTO commerce_inventory_movements (
              tenant_id,
              inventory_level_id,
              movement_type,
              quantity_delta,
              note,
              actor
            )
            VALUES ($1, $2, $3, $4, $5, 'admin')
          `,
          [
            tenantId,
            level.id,
            Number(level.on_hand) === 0 && delta > 0 ? "opening_balance" : "adjustment",
            delta,
            note || null
          ]
        );
      }

      return {
        inventoryLevelId: level.id,
        marketCode,
        onHand: nextOnHand,
        reserved: Number(level.reserved),
        safetyStock: nextSafetyStock,
        availableToSell: Math.max(
          0,
          nextOnHand - Number(level.reserved) - nextSafetyStock
        )
      };
    });
  } finally {
    client.release();
  }
}


async function listReturnsOverview() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            o.id,
            o.order_number,
            o.customer_name,
            o.customer_email,
            o.market_code,
            o.currency_code,
            o.total,
            o.payment_status,
            o.fulfilment_status,
            o.source,
            o.created_at,
            pa.id AS payment_attempt_id,
            pa.provider,
            pa.provider_reference,
            pa.status AS payment_attempt_status,
            pa.provider_payload,
            pa.updated_at AS payment_updated_at
          FROM commerce_orders o
          LEFT JOIN LATERAL (
            SELECT
              p.id,
              p.provider,
              p.provider_reference,
              p.status,
              p.provider_payload,
              p.updated_at
            FROM commerce_payment_attempts p
            WHERE p.tenant_id = o.tenant_id
              AND p.order_id = o.id
            ORDER BY p.created_at DESC
            LIMIT 1
          ) pa ON true
          WHERE o.tenant_id = $1
            AND o.payment_status IN (
              'paid',
              'partially_refunded',
              'refunded'
            )
          ORDER BY o.updated_at DESC, o.created_at DESC
          LIMIT 250
        `,
        [tenantId]
      );

      return result.rows.map((row) => {
        const providerPayload = row.provider_payload || {};
        const refundedMinor = Number(providerPayload.refunded_minor || 0);
        const totalMinor = Math.round(Number(row.total) * 100);
        const refundableMinor = Math.max(0, totalMinor - refundedMinor);
        const hasProviderAttempt = Boolean(row.payment_attempt_id);
        const isRefunded =
          row.payment_status === "refunded" ||
          row.payment_attempt_status === "refunded";
        const partiallyRefunded =
          row.payment_status === "partially_refunded" ||
          row.payment_attempt_status === "partially_refunded";

        return {
          orderId: row.id,
          orderNumber: row.order_number,
          customerName: row.customer_name,
          customerEmail: row.customer_email,
          marketCode: row.market_code,
          currency: row.currency_code,
          total: Number(row.total),
          paymentStatus: row.payment_status,
          fulfilmentStatus: row.fulfilment_status,
          source: row.source,
          provider: row.provider || null,
          providerReference: row.provider_reference || null,
          paymentAttemptStatus: row.payment_attempt_status || null,
          refundedMinor,
          refundableMinor,
          refundState: isRefunded
            ? "refunded"
            : partiallyRefunded
              ? "partially_refunded"
              : "not_refunded",
          refundEligible:
            hasProviderAttempt &&
            !isRefunded &&
            refundableMinor > 0 &&
            ["paid", "partially_refunded"].includes(row.payment_status),
          paymentUpdatedAt: row.payment_updated_at,
          createdAt: row.created_at
        };
      });
    });
  } finally {
    client.release();
  }
}


async function getCommerceAnalytics() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const summaryResult = await tx.query(
        `
          SELECT
            COUNT(*)::int AS order_count,
            COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid_orders,
            COUNT(*) FILTER (WHERE payment_status = 'pending')::int AS pending_orders,
            COUNT(*) FILTER (WHERE payment_status = 'failed')::int AS failed_orders,
            COUNT(*) FILTER (WHERE payment_status = 'partially_refunded')::int AS partial_refunds,
            COUNT(*) FILTER (WHERE payment_status = 'refunded')::int AS refunded_orders
          FROM commerce_orders
          WHERE tenant_id = $1
        `,
        [tenantId]
      );

      const marketResult = await tx.query(
        `
          SELECT
            market_code,
            currency_code,
            COUNT(*)::int AS order_count,
            COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid_orders,
            COALESCE(
              SUM(total) FILTER (WHERE payment_status = 'paid'),
              0
            )::numeric AS paid_value,
            COALESCE(
              SUM(total) FILTER (
                WHERE payment_status IN ('partially_refunded','refunded')
              ),
              0
            )::numeric AS refunded_order_value
          FROM commerce_orders
          WHERE tenant_id = $1
          GROUP BY market_code, currency_code
          ORDER BY market_code ASC
        `,
        [tenantId]
      );

      const recentResult = await tx.query(
        `
          SELECT
            o.id,
            o.order_number,
            o.market_code,
            o.currency_code,
            o.total,
            o.payment_status,
            o.fulfilment_status,
            o.created_at
          FROM commerce_orders o
          WHERE o.tenant_id = $1
          ORDER BY o.created_at DESC
          LIMIT 12
        `,
        [tenantId]
      );

      const summary = summaryResult.rows[0];

      return {
        orders: {
          total: Number(summary.order_count || 0),
          paid: Number(summary.paid_orders || 0),
          pending: Number(summary.pending_orders || 0),
          failed: Number(summary.failed_orders || 0),
          partiallyRefunded: Number(summary.partial_refunds || 0),
          refunded: Number(summary.refunded_orders || 0)
        },
        markets: marketResult.rows.map((row) => ({
          marketCode: row.market_code,
          currency: row.currency_code,
          orderCount: Number(row.order_count || 0),
          paidOrders: Number(row.paid_orders || 0),
          paidValue: Number(row.paid_value || 0),
          refundedOrderValue: Number(row.refunded_order_value || 0)
        })),
        recentOrders: recentResult.rows.map((row) => ({
          id: row.id,
          orderNumber: row.order_number,
          marketCode: row.market_code,
          currency: row.currency_code,
          total: Number(row.total),
          paymentStatus: row.payment_status,
          fulfilmentStatus: row.fulfilment_status,
          createdAt: row.created_at
        }))
      };
    });
  } finally {
    client.release();
  }
}


async function listSuppliers() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            s.id,
            s.supplier_code,
            s.name,
            s.supplier_type,
            s.market_code,
            s.fulfilment_model,
            s.status,
            s.verification_status,
            s.contact_name,
            s.contact_email,
            s.contact_phone,
            s.website,
            s.created_at,
            s.updated_at,
            COUNT(o.id)::int AS active_offers
          FROM commerce_suppliers s
          LEFT JOIN commerce_supplier_offers o
            ON o.tenant_id = s.tenant_id
           AND o.supplier_id = s.id
           AND o.status = 'active'
          WHERE s.tenant_id = $1
            AND s.status <> 'archived'
          GROUP BY s.id
          ORDER BY s.updated_at DESC, s.name ASC
        `,
        [tenantId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        supplierCode: row.supplier_code,
        name: row.name,
        supplierType: row.supplier_type,
        marketCode: row.market_code,
        fulfilmentModel: row.fulfilment_model,
        status: row.status,
        verificationStatus: row.verification_status,
        contactName: row.contact_name,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone,
        website: row.website,
        activeOffers: Number(row.active_offers || 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    });
  } finally {
    client.release();
  }
}

async function createSupplier(input) {
  const name = String(input?.name || "").trim();
  const supplierType = String(input?.supplierType || "").trim();
  const marketCode = String(input?.marketCode || "").trim().toUpperCase();
  const fulfilmentModel = String(
    input?.fulfilmentModel || "supplier_fulfilled"
  ).trim();
  const contactName = String(input?.contactName || "").trim() || null;
  const contactEmail = String(input?.contactEmail || "").trim().toLowerCase() || null;
  const contactPhone = String(input?.contactPhone || "").trim() || null;
  const website = String(input?.website || "").trim() || null;

  if (!name || name.length > 160) {
    const error = new Error("Supplier name is required and must be 160 characters or fewer.");
    error.statusCode = 400;
    throw error;
  }

  if (!["dropship","wholesale","manufacturer","3pl"].includes(supplierType)) {
    const error = new Error("Unsupported supplier type.");
    error.statusCode = 400;
    throw error;
  }

  if (!["GB","NG"].includes(marketCode)) {
    const error = new Error("Supplier market must be GB or NG.");
    error.statusCode = 400;
    throw error;
  }

  if (!["supplier_fulfilled","zayvi_fulfilled","3pl_fulfilled"].includes(fulfilmentModel)) {
    const error = new Error("Unsupported fulfilment model.");
    error.statusCode = 400;
    throw error;
  }

  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    const error = new Error("Supplier contact email is invalid.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const storeResult = await tx.query(
        "SELECT id FROM stores WHERE tenant_id = $1 AND slug = 'main' AND status = 'active' LIMIT 1",
        [tenantId]
      );

      if (storeResult.rowCount === 0) {
        throw new Error("Active main store not found.");
      }

      const supplierCode =
        "SUP-" +
        crypto
          .createHash("sha256")
          .update(name + ":" + Date.now().toString())
          .digest("hex")
          .slice(0, 10)
          .toUpperCase();

      const result = await tx.query(
        `
          INSERT INTO commerce_suppliers (
            tenant_id,
            store_id,
            supplier_code,
            name,
            supplier_type,
            market_code,
            fulfilment_model,
            verification_status,
            contact_name,
            contact_email,
            contact_phone,
            website
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            'pending_review', $8, $9, $10, $11
          )
          RETURNING *
        `,
        [
          tenantId,
          storeResult.rows[0].id,
          supplierCode,
          name,
          supplierType,
          marketCode,
          fulfilmentModel,
          contactName,
          contactEmail,
          contactPhone,
          website
        ]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        supplierCode: row.supplier_code,
        name: row.name,
        supplierType: row.supplier_type,
        marketCode: row.market_code,
        fulfilmentModel: row.fulfilment_model,
        status: row.status,
        verificationStatus: row.verification_status,
        contactName: row.contact_name,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone,
        website: row.website,
        activeOffers: 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  } finally {
    client.release();
  }
}


async function listSupplierOffers(supplierId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(supplierId || ""))) {
    const error = new Error("A valid supplier id is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            o.id,
            o.supplier_id,
            o.supplier_sku,
            o.currency_code,
            o.unit_cost,
            o.minimum_order_quantity,
            o.lead_time_days,
            o.stock_status,
            o.external_stock_quantity,
            o.source_updated_at,
            o.status,
            o.created_at,
            o.updated_at,
            tcp.id AS tenant_product_id,
            cp.id AS product_id,
            cp.name AS product_name,
            cp.canonical_code
          FROM commerce_supplier_offers o
          JOIN tenant_catalogue_products tcp
            ON tcp.tenant_id = o.tenant_id
           AND tcp.id = o.tenant_catalogue_product_id
          JOIN catalogue_products cp
            ON cp.id = tcp.product_id
          WHERE o.tenant_id = $1
            AND o.supplier_id = $2
            AND o.status <> 'archived'
          ORDER BY o.updated_at DESC, cp.name ASC
        `,
        [tenantId, supplierId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        supplierId: row.supplier_id,
        supplierSku: row.supplier_sku,
        productId: row.product_id,
        tenantProductId: row.tenant_product_id,
        productName: row.product_name,
        canonicalCode: row.canonical_code,
        currency: row.currency_code,
        unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
        minimumOrderQuantity: Number(row.minimum_order_quantity),
        leadTimeDays: row.lead_time_days === null ? null : Number(row.lead_time_days),
        stockStatus: row.stock_status,
        externalStockQuantity:
          row.external_stock_quantity === null
            ? null
            : Number(row.external_stock_quantity),
        sourceUpdatedAt: row.source_updated_at,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    });
  } finally {
    client.release();
  }
}

async function createSupplierOffer(input) {
  const supplierId = String(input?.supplierId || "").trim();
  const productId = String(input?.productId || "").trim();
  const supplierSku = String(input?.supplierSku || "").trim() || null;
  const currency = String(input?.currency || "").trim().toUpperCase();
  const unitCost =
    input?.unitCost === null || input?.unitCost === undefined
      ? null
      : Number(input.unitCost);
  const minimumOrderQuantity = Number(input?.minimumOrderQuantity ?? 1);
  const leadTimeDays =
    input?.leadTimeDays === null || input?.leadTimeDays === undefined
      ? null
      : Number(input.leadTimeDays);
  const stockStatus = String(input?.stockStatus || "unknown").trim();
  const externalStockQuantity =
    input?.externalStockQuantity === null ||
    input?.externalStockQuantity === undefined ||
    input?.externalStockQuantity === ""
      ? null
      : Number(input.externalStockQuantity);

  if (!/^[0-9a-f-]{36}$/i.test(supplierId)) {
    const error = new Error("A valid supplier id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^[0-9a-f-]{36}$/i.test(productId)) {
    const error = new Error("A valid product id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!["GBP", "NGN"].includes(currency)) {
    const error = new Error("Supplier offer currency must be GBP or NGN.");
    error.statusCode = 400;
    throw error;
  }

  if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
    const error = new Error("Unit cost must be a non-negative number.");
    error.statusCode = 400;
    throw error;
  }

  if (
    !Number.isSafeInteger(minimumOrderQuantity) ||
    minimumOrderQuantity < 1 ||
    minimumOrderQuantity > 100000
  ) {
    const error = new Error("Minimum order quantity must be a positive whole number.");
    error.statusCode = 400;
    throw error;
  }

  if (
    leadTimeDays !== null &&
    (!Number.isSafeInteger(leadTimeDays) || leadTimeDays < 0 || leadTimeDays > 3650)
  ) {
    const error = new Error("Lead time must be a non-negative whole number of days.");
    error.statusCode = 400;
    throw error;
  }

  if (!["unknown","in_stock","limited","out_of_stock","preorder"].includes(stockStatus)) {
    const error = new Error("Invalid supplier stock status.");
    error.statusCode = 400;
    throw error;
  }

  if (
    externalStockQuantity !== null &&
    (!Number.isSafeInteger(externalStockQuantity) || externalStockQuantity < 0)
  ) {
    const error = new Error("External stock quantity must be a non-negative whole number.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const supplier = await tx.query(
        `
          SELECT id, market_code
          FROM commerce_suppliers
          WHERE tenant_id = $1
            AND id = $2
            AND status = 'active'
          LIMIT 1
        `,
        [tenantId, supplierId]
      );

      if (supplier.rowCount === 0) {
        const error = new Error("Active supplier not found.");
        error.statusCode = 404;
        throw error;
      }

      const product = await tx.query(
        `
          SELECT tcp.id
          FROM tenant_catalogue_products tcp
          WHERE tcp.tenant_id = $1
            AND tcp.product_id = $2
            AND tcp.status <> 'archived'
          LIMIT 1
        `,
        [tenantId, productId]
      );

      if (product.rowCount === 0) {
        const error = new Error("Catalogue product not found.");
        error.statusCode = 404;
        throw error;
      }

      const expectedCurrency =
        supplier.rows[0].market_code === "NG" ? "NGN" : "GBP";

      if (currency !== expectedCurrency) {
        const error = new Error(
          "Supplier offer currency must match the supplier market."
        );
        error.statusCode = 409;
        throw error;
      }

      const result = await tx.query(
        `
          INSERT INTO commerce_supplier_offers (
            tenant_id,
            supplier_id,
            tenant_catalogue_product_id,
            supplier_sku,
            currency_code,
            unit_cost,
            minimum_order_quantity,
            lead_time_days,
            stock_status,
            external_stock_quantity,
            source_updated_at,
            status
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), 'active'
          )
          ON CONFLICT (tenant_id, supplier_id, tenant_catalogue_product_id)
          DO UPDATE SET
            supplier_sku = EXCLUDED.supplier_sku,
            currency_code = EXCLUDED.currency_code,
            unit_cost = EXCLUDED.unit_cost,
            minimum_order_quantity = EXCLUDED.minimum_order_quantity,
            lead_time_days = EXCLUDED.lead_time_days,
            stock_status = EXCLUDED.stock_status,
            external_stock_quantity = EXCLUDED.external_stock_quantity,
            source_updated_at = now(),
            status = 'active',
            updated_at = now()
          RETURNING id
        `,
        [
          tenantId,
          supplierId,
          product.rows[0].id,
          supplierSku,
          currency,
          unitCost,
          minimumOrderQuantity,
          leadTimeDays,
          stockStatus,
          externalStockQuantity
        ]
      );

      const offers = await tx.query(
        `
          SELECT
            o.id,
            o.supplier_id,
            o.supplier_sku,
            o.currency_code,
            o.unit_cost,
            o.minimum_order_quantity,
            o.lead_time_days,
            o.stock_status,
            o.external_stock_quantity,
            o.source_updated_at,
            o.status,
            o.created_at,
            o.updated_at,
            cp.id AS product_id,
            cp.name AS product_name,
            cp.canonical_code
          FROM commerce_supplier_offers o
          JOIN tenant_catalogue_products tcp
            ON tcp.tenant_id = o.tenant_id
           AND tcp.id = o.tenant_catalogue_product_id
          JOIN catalogue_products cp
            ON cp.id = tcp.product_id
          WHERE o.tenant_id = $1
            AND o.id = $2
          LIMIT 1
        `,
        [tenantId, result.rows[0].id]
      );

      const row = offers.rows[0];

      return {
        id: row.id,
        supplierId: row.supplier_id,
        supplierSku: row.supplier_sku,
        productId: row.product_id,
        productName: row.product_name,
        canonicalCode: row.canonical_code,
        currency: row.currency_code,
        unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
        minimumOrderQuantity: Number(row.minimum_order_quantity),
        leadTimeDays: row.lead_time_days === null ? null : Number(row.lead_time_days),
        stockStatus: row.stock_status,
        externalStockQuantity:
          row.external_stock_quantity === null
            ? null
            : Number(row.external_stock_quantity),
        sourceUpdatedAt: row.source_updated_at,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  } finally {
    client.release();
  }
}


async function getSourcingRecommendations(marketCode = "GB") {
  const normalizedMarket = String(marketCode || "GB").trim().toUpperCase();

  if (!["GB", "NG"].includes(normalizedMarket)) {
    const error = new Error("Sourcing market must be GB or NG.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            tcp.id AS tenant_product_id,
            cp.id AS product_id,
            cp.name AS product_name,
            cp.canonical_code,
            tpm.customer_price,
            tpm.currency_code,
            tpm.publication_status,
            tpm.availability_status,
            own.on_hand,
            own.reserved,
            own.safety_stock,
            own.location_name,
            so.id AS offer_id,
            so.supplier_sku,
            so.unit_cost,
            so.minimum_order_quantity,
            so.lead_time_days,
            so.stock_status,
            so.external_stock_quantity,
            so.source_updated_at,
            s.id AS supplier_id,
            s.name AS supplier_name,
            s.supplier_type,
            s.fulfilment_model,
            s.verification_status
          FROM tenant_catalogue_products tcp
          JOIN catalogue_products cp
            ON cp.id = tcp.product_id
          LEFT JOIN tenant_product_markets tpm
            ON tpm.tenant_id = tcp.tenant_id
           AND tpm.tenant_catalogue_product_id = tcp.id
           AND tpm.market_code = $2
          LEFT JOIN LATERAL (
            SELECT
              il.on_hand,
              il.reserved,
              il.safety_stock,
              loc.name AS location_name
            FROM commerce_inventory_locations loc
            JOIN commerce_inventory_levels il
              ON il.tenant_id = loc.tenant_id
             AND il.location_id = loc.id
            WHERE loc.tenant_id = tcp.tenant_id
              AND loc.store_id = tcp.store_id
              AND loc.market_code = $2
              AND loc.location_type = 'own_stock'
              AND loc.status = 'active'
              AND il.tenant_catalogue_product_id = tcp.id
            ORDER BY il.updated_at DESC
            LIMIT 1
          ) own ON true
          LEFT JOIN commerce_supplier_offers so
            ON so.tenant_id = tcp.tenant_id
           AND so.tenant_catalogue_product_id = tcp.id
           AND so.status = 'active'
          LEFT JOIN commerce_suppliers s
            ON s.tenant_id = so.tenant_id
           AND s.id = so.supplier_id
           AND s.market_code = $2
           AND s.status = 'active'
          WHERE tcp.tenant_id = $1
            AND tcp.status <> 'archived'
          ORDER BY cp.name ASC, s.name ASC NULLS LAST
        `,
        [tenantId, normalizedMarket]
      );

      const products = new Map();

      for (const row of result.rows) {
        if (!products.has(row.tenant_product_id)) {
          const onHand = row.on_hand === null ? 0 : Number(row.on_hand);
          const reserved = row.reserved === null ? 0 : Number(row.reserved);
          const safetyStock =
            row.safety_stock === null ? 0 : Number(row.safety_stock);
          const availableToSell = Math.max(
            0,
            onHand - reserved - safetyStock
          );

          const sources = [];

          if (row.on_hand !== null) {
            sources.push({
              sourceType: "own_stock",
              sourceId: "own-stock",
              sourceName: row.location_name || "Own stock",
              eligible: availableToSell > 0,
              score: availableToSell > 0 ? 100 : null,
              reasons:
                availableToSell > 0
                  ? [
                      "Stock is already held by Zayvi.",
                      `${availableToSell} unit(s) are available to sell after reservations and safety stock.`
                    ]
                  : [
                      "No own-stock units are currently available to sell."
                    ],
              availableQuantity: availableToSell,
              unitCost: null,
              marginAmount: null,
              marginPercent: null,
              leadTimeDays: 0,
              verificationStatus: "internal",
              stockStatus: availableToSell > 0 ? "in_stock" : "out_of_stock"
            });
          }

          products.set(row.tenant_product_id, {
            tenantProductId: row.tenant_product_id,
            productId: row.product_id,
            productName: row.product_name,
            canonicalCode: row.canonical_code,
            marketCode: normalizedMarket,
            currency:
              row.currency_code ||
              (normalizedMarket === "NG" ? "NGN" : "GBP"),
            sellingPrice:
              row.customer_price === null
                ? null
                : Number(row.customer_price),
            publicationStatus:
              row.publication_status || "not_listed",
            availabilityStatus:
              row.availability_status || "unknown",
            sources
          });
        }

        if (!row.offer_id || !row.supplier_id) continue;

        const product = products.get(row.tenant_product_id);
        const sellingPrice = product.sellingPrice;
        const unitCost =
          row.unit_cost === null ? null : Number(row.unit_cost);
        const marginAmount =
          sellingPrice === null || unitCost === null
            ? null
            : sellingPrice - unitCost;
        const marginPercent =
          sellingPrice && marginAmount !== null
            ? (marginAmount / sellingPrice) * 100
            : null;
        const verified = row.verification_status === "verified";
        const supplierStock =
          row.external_stock_quantity === null
            ? null
            : Number(row.external_stock_quantity);
        const stockAvailable =
          ["in_stock", "limited", "preorder"].includes(row.stock_status) &&
          (supplierStock === null || supplierStock > 0);
        const positiveMargin =
          marginAmount !== null && marginAmount > 0;
        const hasCommercialEvidence =
          sellingPrice !== null && unitCost !== null;
        const eligible =
          verified &&
          stockAvailable &&
          positiveMargin &&
          hasCommercialEvidence;

        let score = null;
        const reasons = [];

        if (!verified) {
          reasons.push("Supplier is not verified.");
        }
        if (!stockAvailable) {
          reasons.push("Supplier stock is not currently available.");
        }
        if (!hasCommercialEvidence) {
          reasons.push("Selling price or supplier unit cost is missing.");
        } else if (!positiveMargin) {
          reasons.push("Supplier cost does not leave a positive gross margin.");
        }

        if (eligible) {
          const marginScore = Math.max(
            0,
            Math.min(30, Number(marginPercent || 0))
          );
          const stockScore =
            row.stock_status === "in_stock"
              ? 10
              : row.stock_status === "limited"
                ? 6
                : 3;
          const lead = row.lead_time_days === null
            ? null
            : Number(row.lead_time_days);
          const leadScore =
            lead === null
              ? 0
              : lead <= 2
                ? 10
                : lead <= 5
                  ? 7
                  : lead <= 10
                    ? 3
                    : 0;

          score = Math.round(50 + marginScore + stockScore + leadScore);

          reasons.push(
            `Estimated gross margin is ${Number(marginPercent).toFixed(1)}% before shipping, tax and other variable costs.`
          );
          reasons.push(
            lead === null
              ? "Supplier lead time has not been recorded."
              : `Recorded lead time is ${lead} day(s).`
          );
        }

        product.sources.push({
          sourceType: "supplier",
          sourceId: row.offer_id,
          supplierId: row.supplier_id,
          sourceName: row.supplier_name,
          supplierType: row.supplier_type,
          fulfilmentModel: row.fulfilment_model,
          supplierSku: row.supplier_sku,
          eligible,
          score,
          reasons,
          availableQuantity: supplierStock,
          unitCost,
          marginAmount,
          marginPercent,
          minimumOrderQuantity: Number(row.minimum_order_quantity),
          leadTimeDays:
            row.lead_time_days === null
              ? null
              : Number(row.lead_time_days),
          verificationStatus: row.verification_status,
          stockStatus: row.stock_status,
          sourceUpdatedAt: row.source_updated_at
        });
      }

      return [...products.values()].map((product) => {
        const ranked = [...product.sources].sort((a, b) => {
          const aScore = a.score === null ? -1 : a.score;
          const bScore = b.score === null ? -1 : b.score;
          return bScore - aScore;
        });

        const recommended = ranked.find((source) => source.eligible) || null;

        return {
          ...product,
          recommendedSourceId: recommended?.sourceId || null,
          recommendedSourceType: recommended?.sourceType || null,
          recommendedSourceName: recommended?.sourceName || null,
          sources: ranked
        };
      });
    });
  } finally {
    client.release();
  }
}


async function getFulfilmentPlan(orderId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(orderId || ""))) {
    const error = new Error("A valid order id is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();
  try {
    return await withTenant(client, async (tx, tenantId) => {
      const planResult = await tx.query(
        `
          SELECT
            p.id,
            p.order_id,
            p.status,
            p.recommendation_version,
            p.rationale,
            p.approved_by,
            p.approved_at,
            p.cancelled_at,
            p.created_at,
            p.updated_at
          FROM commerce_fulfilment_plans p
          WHERE p.tenant_id = $1
            AND p.order_id = $2
          LIMIT 1
        `,
        [tenantId, orderId]
      );

      if (planResult.rowCount === 0) return null;

      const plan = planResult.rows[0];
      const allocationResult = await tx.query(
        `
          SELECT
            a.id,
            a.order_item_id,
            a.source_type,
            a.quantity,
            a.unit_cost_snapshot,
            a.currency_code,
            a.expected_lead_time_days,
            a.score_snapshot,
            a.rationale,
            a.reservation_status,
            oi.product_name,
            oi.merchant_sku,
            il.on_hand,
            il.reserved,
            il.safety_stock,
            loc.name AS inventory_location_name,
            s.name AS supplier_name,
            so.supplier_sku
          FROM commerce_fulfilment_allocations a
          JOIN commerce_order_items oi
            ON oi.tenant_id = a.tenant_id
           AND oi.id = a.order_item_id
          LEFT JOIN commerce_inventory_levels il
            ON il.tenant_id = a.tenant_id
           AND il.id = a.inventory_level_id
          LEFT JOIN commerce_inventory_locations loc
            ON loc.tenant_id = il.tenant_id
           AND loc.id = il.location_id
          LEFT JOIN commerce_supplier_offers so
            ON so.tenant_id = a.tenant_id
           AND so.id = a.supplier_offer_id
          LEFT JOIN commerce_suppliers s
            ON s.tenant_id = so.tenant_id
           AND s.id = so.supplier_id
          WHERE a.tenant_id = $1
            AND a.fulfilment_plan_id = $2
          ORDER BY oi.created_at ASC
        `,
        [tenantId, plan.id]
      );

      return {
        id: plan.id,
        orderId: plan.order_id,
        status: plan.status,
        recommendationVersion: plan.recommendation_version,
        rationale: plan.rationale || {},
        approvedBy: plan.approved_by,
        approvedAt: plan.approved_at,
        cancelledAt: plan.cancelled_at,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
        allocations: allocationResult.rows.map((row) => ({
          id: row.id,
          orderItemId: row.order_item_id,
          productName: row.product_name,
          sku: row.merchant_sku,
          sourceType: row.source_type,
          sourceName:
            row.source_type === "own_stock"
              ? row.inventory_location_name || "Own stock"
              : row.supplier_name || "Supplier",
          supplierSku: row.supplier_sku,
          quantity: Number(row.quantity),
          unitCost:
            row.unit_cost_snapshot === null
              ? null
              : Number(row.unit_cost_snapshot),
          currency: row.currency_code,
          expectedLeadTimeDays:
            row.expected_lead_time_days === null
              ? null
              : Number(row.expected_lead_time_days),
          score:
            row.score_snapshot === null ? null : Number(row.score_snapshot),
          rationale: row.rationale || {},
          reservationStatus: row.reservation_status,
          onHand: row.on_hand === null ? null : Number(row.on_hand),
          reserved: row.reserved === null ? null : Number(row.reserved),
          safetyStock:
            row.safety_stock === null ? null : Number(row.safety_stock)
        }))
      };
    });
  } finally {
    client.release();
  }
}

async function generateFulfilmentPlan(orderId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(orderId || ""))) {
    const error = new Error("A valid order id is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();
  try {
    return await withTenant(client, async (tx, tenantId) => {
      const orderResult = await tx.query(
        `
          SELECT
            id, store_id, market_code, currency_code, payment_status,
            fulfilment_status, source
          FROM commerce_orders
          WHERE tenant_id = $1 AND id = $2
          LIMIT 1
        `,
        [tenantId, orderId]
      );

      if (orderResult.rowCount === 0) {
        const error = new Error("Order not found.");
        error.statusCode = 404;
        throw error;
      }

      const order = orderResult.rows[0];

      const existing = await tx.query(
        "SELECT id, status FROM commerce_fulfilment_plans WHERE tenant_id = $1 AND order_id = $2 LIMIT 1",
        [tenantId, orderId]
      );

      if (existing.rowCount > 0 && existing.rows[0].status === "approved") {
        const error = new Error("Approved fulfilment plans cannot be regenerated.");
        error.statusCode = 409;
        throw error;
      }

      if (existing.rowCount > 0) {
        await tx.query(
          "DELETE FROM commerce_fulfilment_allocations WHERE tenant_id = $1 AND fulfilment_plan_id = $2",
          [tenantId, existing.rows[0].id]
        );
        await tx.query(
          "DELETE FROM commerce_fulfilment_plans WHERE tenant_id = $1 AND id = $2",
          [tenantId, existing.rows[0].id]
        );
      }

      const items = await tx.query(
        `
          SELECT
            oi.id,
            oi.tenant_catalogue_product_id,
            oi.product_name,
            oi.quantity,
            oi.unit_price,
            oi.currency_code
          FROM commerce_order_items oi
          WHERE oi.tenant_id = $1
            AND oi.order_id = $2
          ORDER BY oi.created_at ASC
        `,
        [tenantId, orderId]
      );

      if (items.rowCount === 0) {
        const error = new Error("Order contains no items.");
        error.statusCode = 409;
        throw error;
      }

      const planResult = await tx.query(
        `
          INSERT INTO commerce_fulfilment_plans (
            tenant_id,
            order_id,
            status,
            recommendation_version,
            rationale
          )
          VALUES ($1, $2, 'draft', 'v1', $3::jsonb)
          RETURNING id
        `,
        [
          tenantId,
          orderId,
          JSON.stringify({
            generatedAutomatically: true,
            approvalRequired: true,
            paymentStatus: order.payment_status,
            source: order.source,
            marketCode: order.market_code
          })
        ]
      );

      const planId = planResult.rows[0].id;
      const blockedItems = [];

      for (const item of items.rows) {
        const own = await tx.query(
          `
            SELECT
              il.id,
              il.on_hand,
              il.reserved,
              il.safety_stock,
              loc.name
            FROM commerce_inventory_locations loc
            JOIN commerce_inventory_levels il
              ON il.tenant_id = loc.tenant_id
             AND il.location_id = loc.id
            WHERE loc.tenant_id = $1
              AND loc.store_id = $2
              AND loc.market_code = $3
              AND loc.location_type = 'own_stock'
              AND loc.status = 'active'
              AND il.tenant_catalogue_product_id = $4
            ORDER BY il.updated_at DESC
            LIMIT 1
          `,
          [
            tenantId,
            order.store_id,
            order.market_code,
            item.tenant_catalogue_product_id
          ]
        );

        let selected = null;

        if (own.rowCount > 0) {
          const row = own.rows[0];
          const available =
            Number(row.on_hand) -
            Number(row.reserved) -
            Number(row.safety_stock);

          if (available >= Number(item.quantity)) {
            selected = {
              sourceType: "own_stock",
              inventoryLevelId: row.id,
              supplierOfferId: null,
              unitCost: null,
              leadTimeDays: 0,
              score: 100,
              rationale: {
                reason: "Owned stock is available after reservations and safety stock.",
                availableBeforeReservation: available
              }
            };
          }
        }

        if (!selected) {
          const supplier = await tx.query(
            `
              SELECT
                so.id,
                so.unit_cost,
                so.lead_time_days,
                so.minimum_order_quantity,
                so.stock_status,
                so.external_stock_quantity,
                s.name,
                s.verification_status
              FROM commerce_supplier_offers so
              JOIN commerce_suppliers s
                ON s.tenant_id = so.tenant_id
               AND s.id = so.supplier_id
              WHERE so.tenant_id = $1
                AND so.tenant_catalogue_product_id = $2
                AND so.status = 'active'
                AND s.status = 'active'
                AND s.market_code = $3
                AND s.verification_status = 'verified'
                AND so.currency_code = $4
                AND so.unit_cost IS NOT NULL
                AND so.unit_cost < $5
                AND so.minimum_order_quantity <= $6
                AND so.stock_status IN ('in_stock','limited')
                AND (
                  so.external_stock_quantity IS NULL
                  OR so.external_stock_quantity >= $6
                )
              ORDER BY
                so.unit_cost ASC,
                so.lead_time_days ASC NULLS LAST,
                so.updated_at DESC
              LIMIT 1
            `,
            [
              tenantId,
              item.tenant_catalogue_product_id,
              order.market_code,
              item.currency_code,
              Number(item.unit_price),
              Number(item.quantity)
            ]
          );

          if (supplier.rowCount > 0) {
            const row = supplier.rows[0];
            const marginAmount =
              Number(item.unit_price) - Number(row.unit_cost);
            const marginPercent =
              Number(item.unit_price) > 0
                ? (marginAmount / Number(item.unit_price)) * 100
                : 0;
            const lead =
              row.lead_time_days === null
                ? null
                : Number(row.lead_time_days);
            const score = Math.round(
              50 +
              Math.max(0, Math.min(30, marginPercent)) +
              (row.stock_status === "in_stock" ? 10 : 6) +
              (lead === null ? 0 : lead <= 2 ? 10 : lead <= 5 ? 7 : lead <= 10 ? 3 : 0)
            );

            selected = {
              sourceType: "supplier",
              inventoryLevelId: null,
              supplierOfferId: row.id,
              unitCost: Number(row.unit_cost),
              leadTimeDays: lead,
              score,
              rationale: {
                reason: "Verified supplier offer with stock and positive recorded gross margin.",
                supplierName: row.name,
                grossMarginPercent: Number(marginPercent.toFixed(2))
              }
            };
          }
        }

        if (!selected) {
          blockedItems.push({
            orderItemId: item.id,
            productName: item.product_name,
            reason:
              "No owned stock or verified supplier offer currently satisfies quantity, stock and positive-margin requirements."
          });
          continue;
        }

        await tx.query(
          `
            INSERT INTO commerce_fulfilment_allocations (
              tenant_id,
              fulfilment_plan_id,
              order_item_id,
              source_type,
              inventory_level_id,
              supplier_offer_id,
              quantity,
              unit_cost_snapshot,
              currency_code,
              expected_lead_time_days,
              score_snapshot,
              rationale
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb
            )
          `,
          [
            tenantId,
            planId,
            item.id,
            selected.sourceType,
            selected.inventoryLevelId,
            selected.supplierOfferId,
            Number(item.quantity),
            selected.unitCost,
            item.currency_code,
            selected.leadTimeDays,
            selected.score,
            JSON.stringify(selected.rationale)
          ]
        );
      }

      await tx.query(
        `
          UPDATE commerce_fulfilment_plans
          SET rationale = rationale || $1::jsonb, updated_at = now()
          WHERE tenant_id = $2 AND id = $3
        `,
        [
          JSON.stringify({
            blockedItems,
            complete: blockedItems.length === 0
          }),
          tenantId,
          planId
        ]
      );

      return { planId, complete: blockedItems.length === 0, blockedItems };
    });
  } finally {
    client.release();
  }
}

async function approveFulfilmentPlan(orderId) {
  const client = await getPool().connect();
  try {
    return await withTenant(client, async (tx, tenantId) => {
      const orderResult = await tx.query(
        `
          SELECT id, payment_status, source, fulfilment_status
          FROM commerce_orders
          WHERE tenant_id = $1 AND id = $2
          FOR UPDATE
        `,
        [tenantId, orderId]
      );

      if (orderResult.rowCount === 0) {
        const error = new Error("Order not found.");
        error.statusCode = 404;
        throw error;
      }

      const order = orderResult.rows[0];

      if (order.payment_status !== "paid") {
        const error = new Error("Payment must be confirmed before fulfilment-plan approval.");
        error.statusCode = 409;
        throw error;
      }

      if (order.source === "preview") {
        const error = new Error("Preview/test orders cannot approve real fulfilment plans.");
        error.statusCode = 409;
        throw error;
      }

      const planResult = await tx.query(
        `
          SELECT id, status, rationale
          FROM commerce_fulfilment_plans
          WHERE tenant_id = $1 AND order_id = $2
          FOR UPDATE
        `,
        [tenantId, orderId]
      );

      if (planResult.rowCount === 0) {
        const error = new Error("Generate a fulfilment plan before approval.");
        error.statusCode = 409;
        throw error;
      }

      const plan = planResult.rows[0];

      if (plan.status !== "draft") {
        const error = new Error("Only draft fulfilment plans can be approved.");
        error.statusCode = 409;
        throw error;
      }

      if (plan.rationale?.complete !== true) {
        const error = new Error("Fulfilment plan has unresolved items.");
        error.statusCode = 409;
        throw error;
      }

      const allocations = await tx.query(
        `
          SELECT id, source_type, inventory_level_id, quantity
          FROM commerce_fulfilment_allocations
          WHERE tenant_id = $1
            AND fulfilment_plan_id = $2
          ORDER BY created_at ASC
          FOR UPDATE
        `,
        [tenantId, plan.id]
      );

      for (const allocation of allocations.rows) {
        if (allocation.source_type !== "own_stock") continue;

        const levelResult = await tx.query(
          `
            SELECT id, on_hand, reserved, safety_stock
            FROM commerce_inventory_levels
            WHERE tenant_id = $1 AND id = $2
            FOR UPDATE
          `,
          [tenantId, allocation.inventory_level_id]
        );

        if (levelResult.rowCount === 0) {
          const error = new Error("Inventory level disappeared before reservation.");
          error.statusCode = 409;
          throw error;
        }

        const level = levelResult.rows[0];
        const available =
          Number(level.on_hand) -
          Number(level.reserved) -
          Number(level.safety_stock);

        if (available < Number(allocation.quantity)) {
          const error = new Error("Owned stock changed and is no longer sufficient for this plan.");
          error.statusCode = 409;
          throw error;
        }

        await tx.query(
          `
            UPDATE commerce_inventory_levels
            SET reserved = reserved + $1, updated_at = now()
            WHERE tenant_id = $2 AND id = $3
          `,
          [Number(allocation.quantity), tenantId, level.id]
        );

        await tx.query(
          `
            INSERT INTO commerce_inventory_movements (
              tenant_id,
              inventory_level_id,
              movement_type,
              quantity_delta,
              reserved_delta,
              reference_type,
              reference_id,
              note,
              actor
            )
            VALUES ($1,$2,'reservation',0,$3,'fulfilment_plan',$4,$5,'admin')
          `,
          [
            tenantId,
            level.id,
            Number(allocation.quantity),
            plan.id,
            "Reserved during fulfilment-plan approval"
          ]
        );

        await tx.query(
          `
            UPDATE commerce_fulfilment_allocations
            SET reservation_status = 'reserved', updated_at = now()
            WHERE tenant_id = $1 AND id = $2
          `,
          [tenantId, allocation.id]
        );
      }

      await tx.query(
        `
          UPDATE commerce_fulfilment_plans
          SET
            status = 'approved',
            approved_by = 'admin',
            approved_at = now(),
            updated_at = now()
          WHERE tenant_id = $1 AND id = $2
        `,
        [tenantId, plan.id]
      );

      return { planId: plan.id, status: "approved" };
    });
  } finally {
    client.release();
  }
}

async function cancelFulfilmentPlan(orderId) {
  const client = await getPool().connect();
  try {
    return await withTenant(client, async (tx, tenantId) => {
      const planResult = await tx.query(
        `
          SELECT id, status
          FROM commerce_fulfilment_plans
          WHERE tenant_id = $1 AND order_id = $2
          FOR UPDATE
        `,
        [tenantId, orderId]
      );

      if (planResult.rowCount === 0) {
        const error = new Error("Fulfilment plan not found.");
        error.statusCode = 404;
        throw error;
      }

      const plan = planResult.rows[0];

      if (!["draft","approved"].includes(plan.status)) {
        const error = new Error("This fulfilment plan cannot be cancelled.");
        error.statusCode = 409;
        throw error;
      }

      if (plan.status === "approved") {
        const allocations = await tx.query(
          `
            SELECT id, inventory_level_id, quantity
            FROM commerce_fulfilment_allocations
            WHERE tenant_id = $1
              AND fulfilment_plan_id = $2
              AND source_type = 'own_stock'
              AND reservation_status = 'reserved'
            FOR UPDATE
          `,
          [tenantId, plan.id]
        );

        for (const allocation of allocations.rows) {
          await tx.query(
            `
              UPDATE commerce_inventory_levels
              SET reserved = reserved - $1, updated_at = now()
              WHERE tenant_id = $2
                AND id = $3
                AND reserved >= $1
            `,
            [Number(allocation.quantity), tenantId, allocation.inventory_level_id]
          );

          await tx.query(
            `
              INSERT INTO commerce_inventory_movements (
                tenant_id,
                inventory_level_id,
                movement_type,
                quantity_delta,
                reserved_delta,
                reference_type,
                reference_id,
                note,
                actor
              )
              VALUES ($1,$2,'release',0,$3,'fulfilment_plan',$4,$5,'admin')
            `,
            [
              tenantId,
              allocation.inventory_level_id,
              -Number(allocation.quantity),
              plan.id,
              "Released because fulfilment plan was cancelled"
            ]
          );

          await tx.query(
            `
              UPDATE commerce_fulfilment_allocations
              SET reservation_status = 'released', updated_at = now()
              WHERE tenant_id = $1 AND id = $2
            `,
            [tenantId, allocation.id]
          );
        }
      }

      await tx.query(
        `
          UPDATE commerce_fulfilment_plans
          SET status = 'cancelled', cancelled_at = now(), updated_at = now()
          WHERE tenant_id = $1 AND id = $2
        `,
        [tenantId, plan.id]
      );

      return { planId: plan.id, status: "cancelled" };
    });
  } finally {
    client.release();
  }
}


async function getKredalConnection() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            s.id AS store_id,
            s.name AS store_name,
            c.id,
            c.external_connection_id,
            c.status,
            c.approved_at,
            c.revoked_at,
            c.metadata,
            c.created_at,
            c.updated_at
          FROM stores s
          LEFT JOIN commerce_payment_connections c
            ON c.tenant_id = s.tenant_id
           AND c.store_id = s.id
           AND c.platform = 'kredal'
          WHERE s.tenant_id = $1
            AND s.slug = 'main'
            AND s.status = 'active'
          LIMIT 1
        `,
        [tenantId]
      );

      if (result.rowCount === 0) {
        const error = new Error("Active main store not found.");
        error.statusCode = 404;
        throw error;
      }

      const row = result.rows[0];

      return {
        storeId: row.store_id,
        storeName: row.store_name,
        connection: row.id
          ? {
              id: row.id,
              externalConnectionId: row.external_connection_id,
              status: row.status,
              approvedAt: row.approved_at,
              revokedAt: row.revoked_at,
              metadata: row.metadata || {},
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }
          : null
      };
    });
  } finally {
    client.release();
  }
}

async function saveKredalConnection(input) {
  const externalConnectionId = String(
    input?.externalConnectionId || ""
  ).trim();
  const status = String(input?.status || "pending").trim();
  const metadata =
    input?.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : {};

  if (!/^kc_[A-Za-z0-9._:-]{1,180}$/.test(externalConnectionId)) {
    const error = new Error("A valid Kredal connection id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!["pending", "active", "revoked"].includes(status)) {
    const error = new Error("Invalid Kredal connection status.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const store = await tx.query(
        `
          SELECT id
          FROM stores
          WHERE tenant_id = $1
            AND slug = 'main'
            AND status = 'active'
          LIMIT 1
        `,
        [tenantId]
      );

      if (store.rowCount === 0) {
        const error = new Error("Active main store not found.");
        error.statusCode = 404;
        throw error;
      }

      const saved = await tx.query(
        `
          INSERT INTO commerce_payment_connections (
            tenant_id,
            store_id,
            platform,
            external_connection_id,
            status,
            approved_at,
            revoked_at,
            metadata
          )
          VALUES (
            $1,
            $2,
            'kredal',
            $3,
            $4,
            CASE WHEN $4 = 'active' THEN now() ELSE NULL END,
            CASE WHEN $4 = 'revoked' THEN now() ELSE NULL END,
            $5::jsonb
          )
          ON CONFLICT (tenant_id, store_id, platform)
          DO UPDATE SET
            external_connection_id = EXCLUDED.external_connection_id,
            status = EXCLUDED.status,
            approved_at =
              CASE
                WHEN EXCLUDED.status = 'active'
                  THEN COALESCE(commerce_payment_connections.approved_at, now())
                ELSE commerce_payment_connections.approved_at
              END,
            revoked_at =
              CASE
                WHEN EXCLUDED.status = 'revoked' THEN now()
                WHEN EXCLUDED.status IN ('pending','active') THEN NULL
                ELSE commerce_payment_connections.revoked_at
              END,
            metadata = EXCLUDED.metadata,
            updated_at = now()
          RETURNING
            id,
            external_connection_id,
            status,
            approved_at,
            revoked_at,
            metadata,
            created_at,
            updated_at
        `,
        [
          tenantId,
          store.rows[0].id,
          externalConnectionId,
          status,
          JSON.stringify(metadata)
        ]
      );

      const row = saved.rows[0];

      return {
        storeId: store.rows[0].id,
        connection: {
          id: row.id,
          externalConnectionId: row.external_connection_id,
          status: row.status,
          approvedAt: row.approved_at,
          revokedAt: row.revoked_at,
          metadata: row.metadata || {},
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      };
    });
  } finally {
    client.release();
  }
}

async function createKredalPaymentAttempt(input) {
  const orderId = String(input?.orderId || "").trim();
  const idempotencyKey = String(input?.idempotencyKey || "").trim();
  const providerReference = String(input?.providerReference || "").trim();
  const providerPayload =
    input?.providerPayload &&
    typeof input.providerPayload === "object" &&
    !Array.isArray(input.providerPayload)
      ? input.providerPayload
      : {};

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    const error = new Error("A valid Zayvi order id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
    const error = new Error("A valid payment idempotency key is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^[A-Za-z0-9._:-]{1,180}$/.test(providerReference)) {
    const error = new Error("A valid Kredal payment reference is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const order = await tx.query(
        `
          SELECT
            id,
            order_number,
            market_code,
            currency_code,
            total,
            order_status,
            payment_status
          FROM commerce_orders
          WHERE tenant_id = $1
            AND id = $2
          LIMIT 1
        `,
        [tenantId, orderId]
      );

      if (order.rowCount === 0) {
        const error = new Error("Order not found.");
        error.statusCode = 404;
        throw error;
      }

      const row = order.rows[0];

      if (
        row.market_code !== "NG" ||
        row.currency_code !== "NGN" ||
        !["draft", "pending_payment"].includes(row.order_status) ||
        !["unpaid", "pending"].includes(row.payment_status)
      ) {
        const error = new Error(
          "Kredal test payments require an unpaid Nigeria NGN order."
        );
        error.statusCode = 409;
        throw error;
      }

      const connection = await tx.query(
        `
          SELECT id, external_connection_id, status
          FROM commerce_payment_connections
          WHERE tenant_id = $1
            AND store_id = (
              SELECT store_id
              FROM commerce_orders
              WHERE tenant_id = $1 AND id = $2
            )
            AND platform = 'kredal'
          LIMIT 1
        `,
        [tenantId, orderId]
      );

      if (
        connection.rowCount === 0 ||
        connection.rows[0].status !== "active"
      ) {
        const error = new Error(
          "The Zayvi store does not have an active Kredal connection."
        );
        error.statusCode = 409;
        throw error;
      }

      const attempt = await tx.query(
        `
          INSERT INTO commerce_payment_attempts (
            tenant_id,
            order_id,
            provider,
            idempotency_key,
            provider_reference,
            status,
            amount,
            currency_code,
            provider_payload
          )
          VALUES (
            $1, $2, 'kredal', $3, $4, 'pending', $5, 'NGN', $6::jsonb
          )
          ON CONFLICT (tenant_id, provider, idempotency_key)
          DO UPDATE SET
            provider_payload = EXCLUDED.provider_payload,
            updated_at = now()
          RETURNING
            id,
            order_id,
            idempotency_key,
            provider_reference,
            status,
            amount,
            currency_code,
            created_at,
            updated_at
        `,
        [
          tenantId,
          orderId,
          idempotencyKey,
          providerReference,
          row.total,
          JSON.stringify(providerPayload)
        ]
      );

      await tx.query(
        `
          UPDATE commerce_orders
          SET
            order_status =
              CASE
                WHEN order_status = 'draft' THEN 'pending_payment'
                ELSE order_status
              END,
            payment_status = 'pending',
            updated_at = now()
          WHERE tenant_id = $1
            AND id = $2
        `,
        [tenantId, orderId]
      );

      const saved = attempt.rows[0];

      return {
        id: saved.id,
        orderId: saved.order_id,
        orderNumber: row.order_number,
        idempotencyKey: saved.idempotency_key,
        providerReference: saved.provider_reference,
        status: saved.status,
        amount: Number(saved.amount),
        currency: saved.currency_code,
        connectionId: connection.rows[0].external_connection_id,
        createdAt: saved.created_at,
        updatedAt: saved.updated_at
      };
    });
  } finally {
    client.release();
  }
}

async function getKredalPaymentAttempt(orderId) {
  const normalizedOrderId = String(orderId || "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(normalizedOrderId)) {
    const error = new Error("A valid Zayvi order id is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            pa.id,
            pa.order_id,
            pa.idempotency_key,
            pa.provider_reference,
            pa.status,
            pa.amount,
            pa.currency_code,
            pa.provider_payload,
            pa.created_at,
            pa.updated_at,
            o.order_number,
            o.payment_status,
            o.order_status,
            c.external_connection_id
          FROM commerce_payment_attempts pa
          JOIN commerce_orders o
            ON o.tenant_id = pa.tenant_id
           AND o.id = pa.order_id
          LEFT JOIN commerce_payment_connections c
            ON c.tenant_id = o.tenant_id
           AND c.store_id = o.store_id
           AND c.platform = 'kredal'
          WHERE pa.tenant_id = $1
            AND pa.order_id = $2
            AND pa.provider = 'kredal'
          ORDER BY pa.created_at DESC
          LIMIT 1
        `,
        [tenantId, normalizedOrderId]
      );

      if (result.rowCount === 0) {
        return null;
      }

      const row = result.rows[0];

      return {
        id: row.id,
        orderId: row.order_id,
        orderNumber: row.order_number,
        idempotencyKey: row.idempotency_key,
        providerReference: row.provider_reference,
        status: row.status,
        amount: Number(row.amount),
        currency: row.currency_code,
        providerPayload: row.provider_payload || {},
        orderPaymentStatus: row.payment_status,
        orderStatus: row.order_status,
        connectionId: row.external_connection_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  } finally {
    client.release();
  }
}

async function applyVerifiedKredalPayment(input) {
  const orderId = String(input?.orderId || "").trim();
  const providerPaymentState = String(
    input?.providerPaymentState || ""
  ).trim();
  const providerHoldState =
    input?.providerHoldState === null ||
    input?.providerHoldState === undefined ||
    input?.providerHoldState === ""
      ? null
      : String(input.providerHoldState).trim();
  const providerPayload =
    input?.providerPayload &&
    typeof input.providerPayload === "object" &&
    !Array.isArray(input.providerPayload)
      ? input.providerPayload
      : {};

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    const error = new Error("A valid Zayvi order id is required.");
    error.statusCode = 400;
    throw error;
  }

  const mapped = mapKredalPaymentState({
    payment_state: providerPaymentState,
    hold_state: providerHoldState
  });

  if (!mapped) {
    const error = new Error("Unsupported verified Kredal payment state.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const current = await tx.query(
        `
          SELECT
            pa.id,
            pa.status AS attempt_status,
            o.payment_status,
            o.order_status
          FROM commerce_payment_attempts pa
          JOIN commerce_orders o
            ON o.tenant_id = pa.tenant_id
           AND o.id = pa.order_id
          WHERE pa.tenant_id = $1
            AND pa.order_id = $2
            AND pa.provider = 'kredal'
          ORDER BY pa.created_at DESC
          LIMIT 1
        `,
        [tenantId, orderId]
      );

      if (current.rowCount === 0) {
        const error = new Error("Kredal payment attempt not found.");
        error.statusCode = 404;
        throw error;
      }

      const state = current.rows[0];
      const refundTerminal =
        ["refunded", "partially_refunded"].includes(state.payment_status) ||
        ["refunded", "partially_refunded"].includes(state.attempt_status);

      if (
        refundTerminal &&
        ["created", "pending", "succeeded"].includes(providerPaymentState)
      ) {
        return {
          ignored: true,
          reason: "Refunded payment cannot be moved back to a paid state."
        };
      }

      await tx.query(
        `
          UPDATE commerce_payment_attempts
          SET
            status = $1,
            provider_payload = $2::jsonb,
            updated_at = now()
          WHERE tenant_id = $3
            AND id = $4
        `,
        [
          mapped.attemptStatus,
          JSON.stringify(providerPayload),
          tenantId,
          state.id
        ]
      );

      let nextOrderStatus = state.order_status;

      if (mapped.orderStatusMode === "confirm") {
        if (
          state.order_status === "draft" ||
          state.order_status === "pending_payment"
        ) {
          nextOrderStatus = "confirmed";
        }
      } else if (mapped.orderStatusMode === "cancel") {
        if (state.order_status !== "completed") {
          nextOrderStatus = "cancelled";
        }
      } else if (
        mapped.orderStatusMode === "keep_pending" &&
        state.order_status === "draft"
      ) {
        nextOrderStatus = "pending_payment";
      }

      await tx.query(
        `
          UPDATE commerce_orders
          SET
            payment_status = $1,
            order_status = $2,
            updated_at = now()
          WHERE tenant_id = $3
            AND id = $4
        `,
        [
          mapped.orderPaymentStatus,
          nextOrderStatus,
          tenantId,
          orderId
        ]
      );

      return {
        ignored: false,
        attemptStatus: mapped.attemptStatus,
        orderPaymentStatus: mapped.orderPaymentStatus,
        orderStatus: nextOrderStatus,
        providerPaymentState,
        providerHoldState
      };
    });
  } finally {
    client.release();
  }
}

async function storeKredalEvent(input) {
  const payload =
    input?.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? input.payload
      : null;

  const externalEventId = String(payload?.id || input?.eventId || "").trim();
  const eventType = String(payload?.type || input?.eventType || "").trim();
  const schemaVersion = String(payload?.schema_version || "").trim() || null;
  const businessId = String(payload?.business_id || "").trim() || null;
  const sequence = Number(payload?.sequence);
  const livemode =
    typeof payload?.livemode === "boolean" ? payload.livemode : null;
  const data =
    payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? payload.data
      : null;

  const allowedEvents = new Set([
    "payment.paid",
    "payment.held",
    "payment.released",
    "payment.refunded",
    "payment.cancelled",
    "payment.failed",
    "payment.arrival_chosen",
    "transfer.received",
    "connection.approved",
    "connection.revoked"
  ]);

  if (!/^evt_[A-Za-z0-9._:-]{1,180}$/.test(externalEventId)) {
    const error = new Error("A valid Kredal event id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (
    !allowedEvents.has(eventType) ||
    !payload ||
    !data ||
    !Number.isSafeInteger(sequence) ||
    sequence < 0
  ) {
    const error = new Error("Unsupported or malformed Kredal event.");
    error.statusCode = 400;
    throw error;
  }

  if (livemode !== false) {
    const error = new Error("Only Kredal test-mode events are accepted here.");
    error.statusCode = 409;
    throw error;
  }

  const isConnectionEvent =
    eventType === "connection.approved" ||
    eventType === "connection.revoked";

  const providerObjectId = String(data.id || "").trim() || null;
  const providerReference = isConnectionEvent
    ? null
    : String(data.reference || "").trim() || null;
  const providerConnectionId = isConnectionEvent
    ? providerObjectId
    : String(data.connection_id || "").trim() || null;

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const inserted = await tx.query(
        `
          INSERT INTO commerce_payment_events (
            tenant_id,
            platform,
            external_event_id,
            event_type,
            provider_sequence,
            schema_version,
            livemode,
            business_id,
            provider_object_id,
            provider_reference,
            provider_connection_id,
            payload,
            processing_status,
            processing_note
          )
          VALUES (
            $1,
            'kredal',
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11::jsonb,
            'stored',
            'Signed Kredal event stored.'
          )
          ON CONFLICT (tenant_id, platform, external_event_id)
          DO NOTHING
          RETURNING id, received_at
        `,
        [
          tenantId,
          externalEventId,
          eventType,
          sequence,
          schemaVersion,
          livemode,
          businessId,
          providerObjectId,
          providerReference,
          providerConnectionId,
          JSON.stringify(payload)
        ]
      );

      if (inserted.rowCount === 0) {
        const existing = await tx.query(
          `
            SELECT
              event_type,
              received_at,
              processing_status,
              processing_note,
              provider_sequence
            FROM commerce_payment_events
            WHERE tenant_id = $1
              AND platform = 'kredal'
              AND external_event_id = $2
            LIMIT 1
          `,
          [tenantId, externalEventId]
        );

        return {
          eventId: externalEventId,
          eventType: existing.rows[0]?.event_type || eventType,
          duplicate: true,
          storedAt: existing.rows[0]?.received_at || null,
          processingStatus: existing.rows[0]?.processing_status || "stored",
          processingNote: existing.rows[0]?.processing_note || null,
          sequence: existing.rows[0]?.provider_sequence ?? sequence
        };
      }

      const eventRowId = inserted.rows[0].id;

      const prior = await tx.query(
        `
          SELECT max(provider_sequence) AS last_sequence
          FROM commerce_payment_events
          WHERE tenant_id = $1
            AND platform = 'kredal'
            AND id <> $2
            AND provider_sequence IS NOT NULL
            AND (
              ($3::text IS NOT NULL AND provider_reference = $3)
              OR
              ($4::text IS NOT NULL AND provider_connection_id = $4)
            )
            AND processing_status IN ('verified','applied','ignored')
        `,
        [tenantId, eventRowId, providerReference, providerConnectionId]
      );

      const lastSequence =
        prior.rows[0]?.last_sequence === null ||
        prior.rows[0]?.last_sequence === undefined
          ? null
          : Number(prior.rows[0].last_sequence);

      if (lastSequence !== null && sequence < lastSequence) {
        await tx.query(
          `
            UPDATE commerce_payment_events
            SET
              processing_status = 'ignored',
              processing_note = $1,
              processed_at = now()
            WHERE tenant_id = $2
              AND id = $3
          `,
          [
            "Ignored stale Kredal event sequence " +
              sequence +
              "; latest applied sequence is " +
              lastSequence +
              ".",
            tenantId,
            eventRowId
          ]
        );

        return {
          eventId: externalEventId,
          eventType,
          duplicate: false,
          ignored: true,
          sequence,
          lastSequence,
          storedAt: inserted.rows[0].received_at
        };
      }

      if (isConnectionEvent) {
        if (!/^kc_[A-Za-z0-9._:-]{1,180}$/.test(providerConnectionId || "")) {
          const error = new Error("Kredal connection event has an invalid connection id.");
          error.statusCode = 400;
          throw error;
        }

        const nextStatus =
          eventType === "connection.approved" ? "active" : "revoked";

        const updated = await tx.query(
          `
            UPDATE commerce_payment_connections
            SET
              status = $1,
              approved_at =
                CASE
                  WHEN $1 = 'active' THEN COALESCE(approved_at, now())
                  ELSE approved_at
                END,
              revoked_at =
                CASE
                  WHEN $1 = 'revoked' THEN now()
                  ELSE NULL
                END,
              metadata =
                COALESCE(metadata, '{}'::jsonb) ||
                jsonb_build_object(
                  'lastKredalSequence', $2::bigint,
                  'lastKredalEventId', $3::text,
                  'businessName', $4::text
                ),
              updated_at = now()
            WHERE tenant_id = $5
              AND platform = 'kredal'
              AND external_connection_id = $6
            RETURNING id
          `,
          [
            nextStatus,
            sequence,
            externalEventId,
            String(data.business_name || ""),
            tenantId,
            providerConnectionId
          ]
        );

        if (updated.rowCount === 0) {
          await tx.query(
            `
              UPDATE commerce_payment_events
              SET
                processing_status = 'failed',
                processing_note =
                  'Connection event did not match a stored Zayvi Kredal connection.',
                processed_at = now()
              WHERE tenant_id = $1
                AND id = $2
            `,
            [tenantId, eventRowId]
          );

          return {
            eventId: externalEventId,
            eventType,
            duplicate: false,
            applied: false,
            sequence,
            reason: "connection_not_found",
            storedAt: inserted.rows[0].received_at
          };
        }

        await tx.query(
          `
            UPDATE commerce_payment_events
            SET
              connection_id = $1,
              processing_status = 'applied',
              processing_note = $2,
              processed_at = now()
            WHERE tenant_id = $3
              AND id = $4
          `,
          [
            updated.rows[0].id,
            "Applied Kredal connection state: " + nextStatus + ".",
            tenantId,
            eventRowId
          ]
        );

        return {
          eventId: externalEventId,
          eventType,
          duplicate: false,
          applied: true,
          connectionStatus: nextStatus,
          sequence,
          storedAt: inserted.rows[0].received_at
        };
      }

      if (
        !providerReference ||
        !/^rq_[A-Za-z0-9._:-]{1,180}$/.test(providerObjectId || "") ||
        !/^kc_[A-Za-z0-9._:-]{1,180}$/.test(providerConnectionId || "")
      ) {
        const error = new Error("Kredal payment event identifiers are invalid.");
        error.statusCode = 400;
        throw error;
      }

      const paymentState = String(data.payment_state || "").trim();
      const mapped = mapKredalPaymentState(data);

      if (!mapped) {
        await tx.query(
          `
            UPDATE commerce_payment_events
            SET
              processing_status = 'ignored',
              processing_note = $1,
              processed_at = now()
            WHERE tenant_id = $2
              AND id = $3
          `,
          [
            "No Zayvi state mapping for Kredal payment_state: " +
              (paymentState || "missing") +
              ".",
            tenantId,
            eventRowId
          ]
        );

        return {
          eventId: externalEventId,
          eventType,
          duplicate: false,
          ignored: true,
          sequence,
          providerState: paymentState || null,
          storedAt: inserted.rows[0].received_at
        };
      }

      const payment = await tx.query(
        `
          SELECT
            pa.id AS payment_attempt_id,
            pa.status AS attempt_status,
            pa.amount,
            pa.currency_code,
            o.id AS order_id,
            o.order_number,
            o.payment_status,
            o.order_status,
            o.total,
            o.store_id,
            c.id AS connection_row_id,
            c.external_connection_id
          FROM commerce_orders o
          JOIN commerce_payment_attempts pa
            ON pa.tenant_id = o.tenant_id
           AND pa.order_id = o.id
           AND pa.provider = 'kredal'
          JOIN commerce_payment_connections c
            ON c.tenant_id = o.tenant_id
           AND c.store_id = o.store_id
           AND c.platform = 'kredal'
          WHERE o.tenant_id = $1
            AND o.order_number = $2
          ORDER BY pa.created_at DESC
          LIMIT 1
        `,
        [tenantId, providerReference]
      );

      if (payment.rowCount === 0) {
        await tx.query(
          `
            UPDATE commerce_payment_events
            SET
              processing_status = 'failed',
              processing_note =
                'Payment event did not match a stored Zayvi Kredal order/attempt.',
              processed_at = now()
            WHERE tenant_id = $1
              AND id = $2
          `,
          [tenantId, eventRowId]
        );

        return {
          eventId: externalEventId,
          eventType,
          duplicate: false,
          applied: false,
          sequence,
          reason: "payment_attempt_not_found",
          storedAt: inserted.rows[0].received_at
        };
      }

      const row = payment.rows[0];
      const amountMinor = Number(data.amount_minor);
      const expectedMinor = Math.round(Number(row.amount) * 100);

      if (
        row.external_connection_id !== providerConnectionId ||
        String(data.currency || "") !== row.currency_code ||
        !Number.isSafeInteger(amountMinor) ||
        amountMinor !== expectedMinor ||
        Number(row.total) !== Number(row.amount)
      ) {
        await tx.query(
          `
            UPDATE commerce_payment_events
            SET
              payment_attempt_id = $1,
              connection_id = $2,
              processing_status = 'failed',
              processing_note =
                'Kredal event amount, currency or connection did not match Zayvi records.',
              processed_at = now()
            WHERE tenant_id = $3
              AND id = $4
          `,
          [
            row.payment_attempt_id,
            row.connection_row_id,
            tenantId,
            eventRowId
          ]
        );

        return {
          eventId: externalEventId,
          eventType,
          duplicate: false,
          applied: false,
          sequence,
          reason: "payment_mismatch",
          storedAt: inserted.rows[0].received_at
        };
      }

      const refundTerminal =
        ["partially_refunded", "refunded"].includes(row.payment_status) ||
        ["partially_refunded", "refunded"].includes(row.attempt_status);

      if (
        refundTerminal &&
        ["created", "pending", "succeeded"].includes(paymentState)
      ) {
        await tx.query(
          `
            UPDATE commerce_payment_events
            SET
              payment_attempt_id = $1,
              connection_id = $2,
              processing_status = 'ignored',
              processing_note =
                'Ignored state regression after refund.',
              processed_at = now()
            WHERE tenant_id = $3
              AND id = $4
          `,
          [
            row.payment_attempt_id,
            row.connection_row_id,
            tenantId,
            eventRowId
          ]
        );

        return {
          eventId: externalEventId,
          eventType,
          duplicate: false,
          ignored: true,
          sequence,
          reason: "refund_state_regression",
          storedAt: inserted.rows[0].received_at
        };
      }

      await tx.query(
        `
          UPDATE commerce_payment_attempts
          SET
            provider_reference = $1,
            status = $2,
            provider_payload = $3::jsonb,
            updated_at = now()
          WHERE tenant_id = $4
            AND id = $5
        `,
        [
          providerObjectId,
          mapped.attemptStatus,
          JSON.stringify(data),
          tenantId,
          row.payment_attempt_id
        ]
      );

      let nextOrderStatus = row.order_status;

      if (mapped.orderStatusMode === "confirm") {
        if (row.order_status === "draft" || row.order_status === "pending_payment") {
          nextOrderStatus = "confirmed";
        }
      } else if (mapped.orderStatusMode === "cancel") {
        if (row.order_status !== "completed") {
          nextOrderStatus = "cancelled";
        }
      } else if (mapped.orderStatusMode === "keep_pending") {
        if (row.order_status === "draft") {
          nextOrderStatus = "pending_payment";
        }
      }

      await tx.query(
        `
          UPDATE commerce_orders
          SET
            payment_status = $1,
            order_status = $2,
            updated_at = now()
          WHERE tenant_id = $3
            AND id = $4
        `,
        [
          mapped.orderPaymentStatus,
          nextOrderStatus,
          tenantId,
          row.order_id
        ]
      );

      await tx.query(
        `
          UPDATE commerce_payment_events
          SET
            payment_attempt_id = $1,
            connection_id = $2,
            processing_status = 'applied',
            processing_note = $3,
            processed_at = now()
          WHERE tenant_id = $4
            AND id = $5
        `,
        [
          row.payment_attempt_id,
          row.connection_row_id,
          "Applied Kredal payment_state=" +
            paymentState +
            (data.hold_state ? ", hold_state=" + data.hold_state : "") +
            ".",
          tenantId,
          eventRowId
        ]
      );

      return {
        eventId: externalEventId,
        eventType,
        duplicate: false,
        applied: true,
        sequence,
        paymentState,
        holdState: data.hold_state ?? null,
        attemptStatus: mapped.attemptStatus,
        orderPaymentStatus: mapped.orderPaymentStatus,
        orderStatus: nextOrderStatus,
        storedAt: inserted.rows[0].received_at
      };
    });
  } finally {
    client.release();
  }
}

async function listKredalEvents() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            external_event_id,
            event_type,
            provider_sequence,
            processing_status,
            processing_note,
            received_at,
            processed_at
          FROM commerce_payment_events
          WHERE tenant_id = $1
            AND platform = 'kredal'
          ORDER BY received_at DESC
          LIMIT 100
        `,
        [tenantId]
      );

      return result.rows.map((row) => ({
        eventId: row.external_event_id,
        eventType: row.event_type,
        sequence:
          row.provider_sequence === null || row.provider_sequence === undefined
            ? null
            : Number(row.provider_sequence),
        processingStatus: row.processing_status,
        processingNote: row.processing_note,
        receivedAt: row.received_at,
        processedAt: row.processed_at
      }));
    });
  } finally {
    client.release();
  }
}

async function listMarkets() {
  const result = await getPool().query(
    `
      SELECT
        code,
        name,
        currency_code,
        default_locale,
        timezone_name,
        enabled,
        configuration_version,
        updated_at
      FROM commerce_markets
      ORDER BY code ASC
    `
  );

  return result.rows.map((row) => ({
    code: row.code,
    name: row.name,
    currency: row.currency_code,
    locale: row.default_locale,
    timezone: row.timezone_name,
    enabled: row.enabled,
    configurationVersion: row.configuration_version,
    updatedAt: row.updated_at
  }));
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



  if (method === "GET" && routePath.endsWith("/inventory")) {
    try {
      const marketCode = event?.queryStringParameters?.market || "GB";
      const items = await listInventory(marketCode);
      return response(200, {
        source: "postgresql",
        marketCode: String(marketCode).toUpperCase(),
        total: items.length,
        inventoryTrackingEnabled: true,
        items
      });
    } catch (error) {
      console.error("Inventory list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(500, {
        error: "inventory_unavailable"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/inventory/adjust")) {
    try {
      const adjustment = await adjustInventory(parseBody(event));
      return response(200, {
        source: "postgresql",
        adjustment
      });
    } catch (error) {
      console.error("Inventory adjustment failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "inventory_adjustment_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/customers")) {
    try {
      const customers = await listCustomers();
      return response(200, {
        source: "postgresql",
        total: customers.length,
        customers
      });
    } catch (error) {
      console.error("Customer list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(500, {
        error: "customers_unavailable"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/suppliers")) {
    try {
      const suppliers = await listSuppliers();
      return response(200, {
        source: "postgresql",
        total: suppliers.length,
        suppliers
      });
    } catch (error) {
      console.error("Supplier list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(500, {
        error: "suppliers_unavailable"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/suppliers")) {
    try {
      const supplier = await createSupplier(parseBody(event));
      return response(201, {
        source: "postgresql",
        supplier
      });
    } catch (error) {
      console.error("Supplier create failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_create_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/supplier-offers")) {
    try {
      const supplierId = event?.queryStringParameters?.supplierId || "";
      const offers = await listSupplierOffers(supplierId);
      return response(200, {
        source: "postgresql",
        total: offers.length,
        offers
      });
    } catch (error) {
      console.error("Supplier offers list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_offers_unavailable"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/supplier-offers")) {
    try {
      const offer = await createSupplierOffer(parseBody(event));
      return response(200, {
        source: "postgresql",
        offer
      });
    } catch (error) {
      console.error("Supplier offer upsert failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_offer_upsert_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/sourcing")) {
    try {
      const marketCode = event?.queryStringParameters?.market || "GB";
      const recommendations = await getSourcingRecommendations(marketCode);
      return response(200, {
        source: "postgresql",
        marketCode: String(marketCode).toUpperCase(),
        generatedAt: new Date().toISOString(),
        routingEnabled: false,
        methodology:
          "Deterministic sourcing score using owned stock, supplier verification, recorded stock state, gross margin and lead time. Shipping, tax, returns and other variable costs are not yet included.",
        recommendations
      });
    } catch (error) {
      console.error("Sourcing recommendations failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "sourcing_unavailable"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/analytics")) {
    try {
      const analytics = await getCommerceAnalytics();
      return response(200, {
        source: "postgresql",
        generatedAt: new Date().toISOString(),
        ...analytics
      });
    } catch (error) {
      console.error("Commerce analytics failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(500, {
        error: "analytics_unavailable"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/returns")) {
    try {
      const returns = await listReturnsOverview();
      return response(200, {
        source: "postgresql",
        total: returns.length,
        returns,
        actionsEnabled: false,
        message:
          "Returns and refunds are read-only in this phase. Provider refund actions remain separately controlled."
      });
    } catch (error) {
      console.error("Returns overview failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(500, {
        error: "returns_unavailable"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/payment-connections/kredal")) {
    try {
      const connection = await getKredalConnection();
      return response(200, {
        source: "postgresql",
        ...connection
      });
    } catch (error) {
      console.error("Kredal connection read failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "kredal_connection_unavailable"
      });
    }
  }

  if (method === "PUT" && routePath.endsWith("/payment-connections/kredal")) {
    try {
      const connection = await saveKredalConnection(parseBody(event));
      return response(200, {
        source: "postgresql",
        ...connection
      });
    } catch (error) {
      console.error("Kredal connection write failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "kredal_connection_update_failed"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/payment-attempts/kredal")) {
    try {
      const attempt = await createKredalPaymentAttempt(parseBody(event));
      return response(201, {
        source: "postgresql",
        attempt
      });
    } catch (error) {
      console.error("Kredal payment attempt create failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "kredal_payment_attempt_create_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/payment-attempts/kredal")) {
    try {
      const orderId = event?.queryStringParameters?.orderId || "";
      const attempt = await getKredalPaymentAttempt(orderId);
      return response(200, {
        source: "postgresql",
        attempt
      });
    } catch (error) {
      console.error("Kredal payment attempt read failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "kredal_payment_attempt_unavailable"
      });
    }
  }

  if (method === "PUT" && routePath.endsWith("/payment-attempts/kredal")) {
    try {
      const state = await applyVerifiedKredalPayment(parseBody(event));
      return response(200, {
        source: "postgresql",
        state
      });
    } catch (error) {
      console.error("Kredal verified payment apply failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "kredal_payment_state_apply_failed"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/payment-events/kredal")) {
    try {
      const eventResult = await storeKredalEvent(parseBody(event));
      return response(200, {
        source: "postgresql",
        ...eventResult
      });
    } catch (error) {
      console.error("Kredal event storage failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "kredal_event_storage_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/payment-events/kredal")) {
    try {
      const events = await listKredalEvents();
      return response(200, {
        source: "postgresql",
        total: events.length,
        events
      });
    } catch (error) {
      console.error("Kredal event list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(500, {
        error: "kredal_events_unavailable"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/markets")) {
    try {
      const markets = await listMarkets();
      return response(200, {
        source: "postgresql",
        total: markets.length,
        markets
      });
    } catch (error) {
      console.error("Market list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(500, {
        error: "markets_unavailable"
      });
    }
  }

  if (
    method === "GET" &&
    /\/orders\/[0-9a-f-]{36}\/fulfilment-plan$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const orderId = parts[parts.length - 2];
      const plan = await getFulfilmentPlan(orderId);
      return response(200, {
        source: "postgresql",
        plan,
        automaticRoutingEnabled: false
      });
    } catch (error) {
      console.error("Fulfilment plan read failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "fulfilment_plan_unavailable"
      });
    }
  }

  if (
    method === "POST" &&
    /\/orders\/[0-9a-f-]{36}\/fulfilment-plan$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const orderId = parts[parts.length - 2];
      const result = await generateFulfilmentPlan(orderId);
      return response(201, {
        source: "postgresql",
        ...result,
        automaticRoutingEnabled: false
      });
    } catch (error) {
      console.error("Fulfilment plan generation failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "fulfilment_plan_generation_failed"
      });
    }
  }

  if (
    method === "POST" &&
    /\/orders\/[0-9a-f-]{36}\/fulfilment-plan\/approve$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const orderId = parts[parts.length - 3];
      const result = await approveFulfilmentPlan(orderId);
      return response(200, {
        source: "postgresql",
        ...result,
        automaticRoutingEnabled: false
      });
    } catch (error) {
      console.error("Fulfilment plan approval failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "fulfilment_plan_approval_failed"
      });
    }
  }

  if (
    method === "POST" &&
    /\/orders\/[0-9a-f-]{36}\/fulfilment-plan\/cancel$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const orderId = parts[parts.length - 3];
      const result = await cancelFulfilmentPlan(orderId);
      return response(200, {
        source: "postgresql",
        ...result
      });
    } catch (error) {
      console.error("Fulfilment plan cancellation failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "fulfilment_plan_cancellation_failed"
      });
    }
  }

  if (method === "GET" && /\/orders\/[0-9a-f-]{36}$/i.test(routePath)) {
    try {
      const orderId = routePath.split("/").filter(Boolean).pop();
      const order = await getOrder(orderId);
      return response(200, {
        source: "postgresql",
        order,
        purchasingEnabled: false
      });
    } catch (error) {
      console.error("Order detail failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "order_detail_unavailable"
      });
    }
  }

  if (method === "PATCH" && /\/orders\/[0-9a-f-]{36}$/i.test(routePath)) {
    try {
      const orderId = routePath.split("/").filter(Boolean).pop();
      const order = await updateOrderStatus(orderId, parseBody(event));
      return response(200, {
        source: "postgresql",
        order,
        purchasingEnabled: false
      });
    } catch (error) {
      console.error("Order status update failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "order_update_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/orders")) {
    try {
      const orders = await listOrders();
      return response(200, {
        source: "postgresql",
        total: orders.length,
        orders,
        purchasingEnabled: false
      });
    } catch (error) {
      console.error("Order list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(500, {
        error: "orders_unavailable"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/orders")) {
    try {
      const order = await createOrder(parseBody(event));
      return response(201, {
        order,
        purchasingEnabled: false
      });
    } catch (error) {
      console.error("Order create failed:", {
        name: error?.name,
        message: error?.message
      });

      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "order_create_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/products")) {
    try {
      const marketCode =
        event?.queryStringParameters?.market || "GB";
      const products = await listProducts(marketCode);
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


  if (
    method === "PATCH" &&
    /\/products\/[0-9a-f-]{36}\/markets\/[A-Za-z]{2}$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const productId = parts[parts.length - 3];
      const marketCode = parts[parts.length - 1];
      const market = await updateProductMarket(
        productId,
        marketCode,
        parseBody(event)
      );
      return response(200, { market });
    } catch (error) {
      console.error("Product market update failed:", {
        name: error?.name,
        message: error?.message
      });

      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "product_market_update_failed"
      });
    }
  }


  if (method === "PATCH" && /\/products\/[0-9a-f-]{36}$/i.test(routePath)) {
    try {
      const productId = routePath.split("/").filter(Boolean).pop();
      const product = await updateProduct(productId, parseBody(event));
      return response(200, {
        product
      });
    } catch (error) {
      console.error("Catalogue update failed:", {
        name: error?.name,
        message: error?.message
      });

      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "catalogue_update_failed"
      });
    }
  }

  return response(404, {
    error: "not_found"
  });
};

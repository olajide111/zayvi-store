const { queryThemeDrafts } = require("./theme-drafts");
const { queryStoreSetup } = require("./store-setup");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Pool } = require("pg");
const { Signer } = require("@aws-sdk/rds-signer");
const { checkoutError, deliveryMigration, normalizeDeliveryAddress, previewDeliveryQuote } = require("./checkout-delivery");

const { contentMigration, queryStorefrontContent } = require("./storefront-content");
const { marketsMigration, queryStorefrontMarkets, storeMarketSettings } = require("./storefront-markets");
const { socialLinksMigration, querySocialLinks } = require("./storefront-social-links");
const { reviewSupplierImage, storefrontImage } = require("./supplier-image-rights");
const { mapKredalPaymentState } = require("./kredal-payment-state");

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
    image: storefrontImage(attributes, row.market_code),
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

async function recordOperationsAudit(
  tx,
  tenantId,
  {
    actorType,
    actorReference = null,
    action,
    entityType,
    entityId = null,
    marketCode = null,
    summary,
    metadata = {}
  }
) {
  await tx.query(
    `
      INSERT INTO commerce_operations_audit_events (
        tenant_id,
        actor_type,
        actor_reference,
        action,
        entity_type,
        entity_id,
        market_code,
        summary,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
    `,
    [
      tenantId,
      actorType,
      actorReference,
      action,
      entityType,
      entityId,
      marketCode,
      summary,
      JSON.stringify(metadata || {})
    ]
  );
}

async function listOperationsAudit() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            id,
            actor_type,
            actor_reference,
            action,
            entity_type,
            entity_id,
            market_code,
            summary,
            metadata,
            created_at
          FROM commerce_operations_audit_events
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT 500
        `,
        [tenantId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        actorType: row.actor_type,
        actorReference: row.actor_reference,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        marketCode: row.market_code,
        summary: row.summary,
        metadata: row.metadata || {},
        createdAt: row.created_at
      }));
    });
  } finally {
    client.release();
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

  const deliveryAddress = input?.deliveryAddress === undefined
    ? null
    : normalizeDeliveryAddress(input.deliveryAddress, marketCode);
  const shippingQuote = deliveryAddress ? previewDeliveryQuote(marketCode) : null;

  const requestFingerprint = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        customerName,
        customerEmail,
        phone,
        marketCode,
        items: normalizedItems,
        ...(deliveryAddress ? { deliveryAddress } : {})
      })
    )
    .digest("hex");

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const marketDefinition = schemaMigrationDefinitions.find(({ name }) => name === marketsMigration);
      const marketsReady = await probeSchemaMigration(tx, marketDefinition);
      const storeResult = await tx.query(
        marketsReady
          ? `SELECT id, default_market_code, storefront_market_codes, storefront_market_switcher
             FROM stores WHERE tenant_id = $1 AND slug = 'main' AND status = 'active' FOR SHARE`
          : "SELECT id FROM stores WHERE tenant_id = $1 AND slug = 'main' AND status = 'active'",
        [tenantId]
      );

      if (storeResult.rowCount === 0) {
        throw new Error("Active main store not found.");
      }

      const storeId = storeResult.rows[0].id;

      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        `order:${tenantId}:${idempotencyKey}`
      ]);

      const replay = await tx.query(
        `
          SELECT
            id,
            order_number,
            customer_name,
            customer_email,
            subtotal,
            shipping_total,
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
          subtotal: Number(existing.subtotal),
          shippingTotal: Number(existing.shipping_total),
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

      if (marketsReady && !storeMarketSettings(storeResult.rows[0]).enabledMarkets.includes(marketCode)) {
        throw checkoutError("This store does not sell in the selected market.", 409);
      }

      if (shippingQuote) {
        const definition = schemaMigrationDefinitions.find(({ name }) => name === deliveryMigration);
        if (!(await probeSchemaMigration(tx, definition))) {
          throw checkoutError("Preview delivery setup is unavailable.", 503);
        }
        if (input.shippingMinor !== shippingQuote.shippingMinor) {
          throw checkoutError("The delivery fee changed. Review the current fee and try again.", 409);
        }
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

      if (shippingQuote && shippingQuote.currency !== marketCurrency) {
        throw checkoutError("The delivery fee does not match this market.", 409);
      }

      const shippingTotal = (shippingQuote?.shippingMinor ?? 0) / 100;
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
            ${deliveryAddress ? ", delivery_address" : ""}
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            'draft', 'unpaid', 'unfulfilled',
            $7, $8, $9::numeric, $10::numeric, 0, $9::numeric + $10::numeric, 'preview',
            $11, $12
            ${deliveryAddress ? ', $13::jsonb' : ''}
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
          shippingTotal,
          idempotencyKey,
          requestFingerprint,
          ...(deliveryAddress ? [JSON.stringify(deliveryAddress)] : [])
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
        subtotal: Number(order.subtotal),
        shippingTotal: Number(order.shipping_total),
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
            to_jsonb(o) -> 'delivery_address' AS delivery_address,
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
        deliveryAddress: row.delivery_address ?? null,
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


function createReturnNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `RT-${stamp}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

async function listReturns() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            r.id,
            r.return_number,
            r.order_id,
            o.order_number,
            o.customer_name,
            o.customer_email,
            o.market_code,
            r.status,
            r.reason,
            r.review_note,
            r.inspection_note,
            r.refund_status,
            r.requested_refund_amount,
            r.currency_code,
            r.requested_at,
            r.approved_at,
            r.rejected_at,
            r.received_at,
            r.completed_at,
            r.updated_at,
            COALESCE(SUM(ri.quantity_requested), 0)::int AS quantity_requested,
            COALESCE(SUM(ri.quantity_received), 0)::int AS quantity_received,
            COALESCE(SUM(ri.quantity_restocked), 0)::int AS quantity_restocked
          FROM commerce_returns r
          JOIN commerce_orders o
            ON o.tenant_id = r.tenant_id
           AND o.id = r.order_id
          LEFT JOIN commerce_return_items ri
            ON ri.tenant_id = r.tenant_id
           AND ri.return_id = r.id
          WHERE r.tenant_id = $1
          GROUP BY r.id, o.id
          ORDER BY r.created_at DESC
          LIMIT 250
        `,
        [tenantId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        returnNumber: row.return_number,
        orderId: row.order_id,
        orderNumber: row.order_number,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        marketCode: row.market_code,
        status: row.status,
        reason: row.reason,
        reviewNote: row.review_note,
        inspectionNote: row.inspection_note,
        refundStatus: row.refund_status,
        requestedRefundAmount: Number(row.requested_refund_amount || 0),
        currency: row.currency_code,
        quantityRequested: Number(row.quantity_requested || 0),
        quantityReceived: Number(row.quantity_received || 0),
        quantityRestocked: Number(row.quantity_restocked || 0),
        requestedAt: row.requested_at,
        approvedAt: row.approved_at,
        rejectedAt: row.rejected_at,
        receivedAt: row.received_at,
        completedAt: row.completed_at,
        updatedAt: row.updated_at
      }));
    });
  } finally {
    client.release();
  }
}

async function getReturn(returnId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(returnId || ""))) {
    const error = new Error("A valid return id is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const returnResult = await tx.query(
        `
          SELECT
            r.*,
            o.order_number,
            o.customer_name,
            o.customer_email,
            o.market_code,
            o.payment_status,
            o.fulfilment_status,
            o.source
          FROM commerce_returns r
          JOIN commerce_orders o
            ON o.tenant_id = r.tenant_id
           AND o.id = r.order_id
          WHERE r.tenant_id = $1
            AND r.id = $2
          LIMIT 1
        `,
        [tenantId, returnId]
      );

      if (returnResult.rowCount === 0) {
        const error = new Error("Return not found.");
        error.statusCode = 404;
        throw error;
      }

      const itemResult = await tx.query(
        `
          SELECT
            ri.id,
            ri.order_item_id,
            ri.tenant_catalogue_product_id,
            oi.product_name,
            oi.merchant_sku,
            oi.quantity AS ordered_quantity,
            oi.unit_price,
            ri.quantity_requested,
            ri.quantity_received,
            ri.quantity_restocked,
            ri.condition,
            ri.restock_decision,
            ri.refund_amount
          FROM commerce_return_items ri
          JOIN commerce_order_items oi
            ON oi.tenant_id = ri.tenant_id
           AND oi.id = ri.order_item_id
          WHERE ri.tenant_id = $1
            AND ri.return_id = $2
          ORDER BY ri.created_at ASC
        `,
        [tenantId, returnId]
      );

      const row = returnResult.rows[0];

      return {
        id: row.id,
        returnNumber: row.return_number,
        orderId: row.order_id,
        orderNumber: row.order_number,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        marketCode: row.market_code,
        orderPaymentStatus: row.payment_status,
        orderFulfilmentStatus: row.fulfilment_status,
        orderSource: row.source,
        status: row.status,
        reason: row.reason,
        reviewNote: row.review_note,
        inspectionNote: row.inspection_note,
        refundStatus: row.refund_status,
        requestedRefundAmount: Number(row.requested_refund_amount || 0),
        currency: row.currency_code,
        requestedAt: row.requested_at,
        approvedAt: row.approved_at,
        rejectedAt: row.rejected_at,
        receivedAt: row.received_at,
        completedAt: row.completed_at,
        updatedAt: row.updated_at,
        items: itemResult.rows.map((item) => ({
          id: item.id,
          orderItemId: item.order_item_id,
          tenantProductId: item.tenant_catalogue_product_id,
          productName: item.product_name,
          sku: item.merchant_sku,
          orderedQuantity: Number(item.ordered_quantity),
          unitPrice: Number(item.unit_price),
          quantityRequested: Number(item.quantity_requested),
          quantityReceived: Number(item.quantity_received),
          quantityRestocked: Number(item.quantity_restocked),
          condition: item.condition,
          restockDecision: item.restock_decision,
          refundAmount: Number(item.refund_amount)
        }))
      };
    });
  } finally {
    client.release();
  }
}

async function createReturn(input) {
  const orderId = String(input?.orderId || "").trim();
  const reason = String(input?.reason || "").trim().slice(0, 1000);
  const items = Array.isArray(input?.items) ? input.items : [];

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    const error = new Error("A valid order id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!reason) {
    const error = new Error("A return reason is required.");
    error.statusCode = 400;
    throw error;
  }

  if (items.length < 1 || items.length > 50) {
    const error = new Error("A return must contain between 1 and 50 items.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedItems = items.map((item) => {
    const orderItemId = String(item?.orderItemId || "").trim();
    const quantity = Number(item?.quantity);

    if (!/^[0-9a-f-]{36}$/i.test(orderItemId)) {
      const error = new Error("Return item has an invalid order item id.");
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
      const error = new Error("Return quantities must be positive whole numbers.");
      error.statusCode = 400;
      throw error;
    }

    return { orderItemId, quantity };
  });

  const ids = normalizedItems.map((item) => item.orderItemId);
  if (new Set(ids).size !== ids.length) {
    const error = new Error("Each order item can only appear once in a return.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    const returnId = await withTenant(client, async (tx, tenantId) => {
      const orderResult = await tx.query(
        `
          SELECT id, currency_code, payment_status
          FROM commerce_orders
          WHERE tenant_id = $1
            AND id = $2
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

      if (!["paid", "partially_refunded"].includes(order.payment_status)) {
        const error = new Error(
          "Returns requiring a refund can only be opened for paid or partially refunded orders."
        );
        error.statusCode = 409;
        throw error;
      }

      const orderItems = await tx.query(
        `
          SELECT
            oi.id,
            oi.tenant_catalogue_product_id,
            oi.quantity,
            oi.unit_price,
            COALESCE((
              SELECT SUM(ri.quantity_requested)
              FROM commerce_return_items ri
              JOIN commerce_returns r
                ON r.tenant_id = ri.tenant_id
               AND r.id = ri.return_id
              WHERE ri.tenant_id = oi.tenant_id
                AND ri.order_item_id = oi.id
                AND r.status NOT IN ('rejected','cancelled')
            ), 0)::int AS already_requested
          FROM commerce_order_items oi
          WHERE oi.tenant_id = $1
            AND oi.order_id = $2
            AND oi.id = ANY($3::uuid[])
          FOR UPDATE
        `,
        [tenantId, orderId, ids]
      );

      if (orderItems.rowCount !== normalizedItems.length) {
        const error = new Error("One or more return items do not belong to this order.");
        error.statusCode = 400;
        throw error;
      }

      const byId = new Map(orderItems.rows.map((row) => [row.id, row]));
      let requestedRefundAmount = 0;

      for (const item of normalizedItems) {
        const row = byId.get(item.orderItemId);
        const remaining =
          Number(row.quantity) - Number(row.already_requested || 0);

        if (item.quantity > remaining) {
          const error = new Error(
            "Return quantity exceeds the remaining returnable quantity for an item."
          );
          error.statusCode = 409;
          throw error;
        }

        requestedRefundAmount += Number(row.unit_price) * item.quantity;
      }

      const returnNumber = createReturnNumber();

      const returnResult = await tx.query(
        `
          INSERT INTO commerce_returns (
            tenant_id,
            order_id,
            return_number,
            status,
            reason,
            refund_status,
            requested_refund_amount,
            currency_code
          )
          VALUES ($1,$2,$3,'requested',$4,'not_requested',$5,$6)
          RETURNING id
        `,
        [
          tenantId,
          orderId,
          returnNumber,
          reason,
          requestedRefundAmount,
          order.currency_code
        ]
      );

      const createdReturnId = returnResult.rows[0].id;

      for (const item of normalizedItems) {
        const row = byId.get(item.orderItemId);
        await tx.query(
          `
            INSERT INTO commerce_return_items (
              tenant_id,
              return_id,
              order_item_id,
              tenant_catalogue_product_id,
              quantity_requested,
              refund_amount
            )
            VALUES ($1,$2,$3,$4,$5,$6)
          `,
          [
            tenantId,
            createdReturnId,
            item.orderItemId,
            row.tenant_catalogue_product_id,
            item.quantity,
            Number(row.unit_price) * item.quantity
          ]
        );
      }

      await recordOperationsAudit(tx, tenantId, {
        actorType: "admin",
        actorReference: "admin",
        action: "return.created",
        entityType: "return",
        entityId: createdReturnId,
        summary: `Return created: ${returnNumber}.`,
        metadata: {
          orderId,
          returnNumber,
          requestedRefundAmount,
          currency: order.currency_code,
          lineCount: normalizedItems.length,
          quantityRequested: normalizedItems.reduce(
            (sum, item) => sum + item.quantity,
            0
          ),
          reason
        }
      });

      return createdReturnId;
    });

    return await getReturn(returnId);
  } finally {
    client.release();
  }
}

async function updateReturn(returnId, input) {
  const action = String(input?.action || "").trim();
  const reviewNote = String(input?.reviewNote || "").trim().slice(0, 1000) || null;
  const inspectionNote =
    String(input?.inspectionNote || "").trim().slice(0, 1000) || null;

  const allowedActions = new Set([
    "approve",
    "reject",
    "receive",
    "reconcile_refund",
    "complete",
    "cancel"
  ]);

  if (!allowedActions.has(action)) {
    const error = new Error("Unsupported return action.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    await withTenant(client, async (tx, tenantId) => {
      const returnResult = await tx.query(
        `
          SELECT
            r.*,
            o.market_code,
            o.payment_status,
            o.store_id
          FROM commerce_returns r
          JOIN commerce_orders o
            ON o.tenant_id = r.tenant_id
           AND o.id = r.order_id
          WHERE r.tenant_id = $1
            AND r.id = $2
          FOR UPDATE
        `,
        [tenantId, returnId]
      );

      if (returnResult.rowCount === 0) {
        const error = new Error("Return not found.");
        error.statusCode = 404;
        throw error;
      }

      const current = returnResult.rows[0];

      const auditReturn = (actionName, summary, metadata = {}) =>
        recordOperationsAudit(tx, tenantId, {
          actorType: "admin",
          actorReference: "admin",
          action: `return.${actionName}`,
          entityType: "return",
          entityId: returnId,
          marketCode: current.market_code,
          summary,
          metadata: {
            orderId: current.order_id,
            returnNumber: current.return_number,
            ...metadata
          }
        });

      if (action === "approve") {
        if (current.status !== "requested") {
          const error = new Error("Only requested returns can be approved.");
          error.statusCode = 409;
          throw error;
        }

        await tx.query(
          `
            UPDATE commerce_returns
            SET
              status = 'approved',
              refund_status = CASE
                WHEN requested_refund_amount > 0 THEN 'pending_provider'
                ELSE 'not_requested'
              END,
              review_note = $1,
              approved_at = now(),
              updated_at = now()
            WHERE tenant_id = $2 AND id = $3
          `,
          [reviewNote, tenantId, returnId]
        );

        await auditReturn(
          "approved",
          "Return approved for receipt and refund follow-up.",
          {
            previousStatus: current.status,
            nextStatus: "approved",
            requestedRefundAmount: Number(current.requested_refund_amount || 0),
            reviewNote
          }
        );
        return;
      }

      if (action === "reject") {
        if (current.status !== "requested") {
          const error = new Error("Only requested returns can be rejected.");
          error.statusCode = 409;
          throw error;
        }
        if (!reviewNote) {
          const error = new Error("A rejection note is required.");
          error.statusCode = 400;
          throw error;
        }

        await tx.query(
          `
            UPDATE commerce_returns
            SET
              status = 'rejected',
              review_note = $1,
              rejected_at = now(),
              updated_at = now()
            WHERE tenant_id = $2 AND id = $3
          `,
          [reviewNote, tenantId, returnId]
        );

        await auditReturn(
          "rejected",
          "Return request rejected.",
          {
            previousStatus: current.status,
            nextStatus: "rejected",
            reviewNote
          }
        );
        return;
      }

      if (action === "cancel") {
        if (!["requested", "approved"].includes(current.status)) {
          const error = new Error("Only requested or approved returns can be cancelled.");
          error.statusCode = 409;
          throw error;
        }

        await tx.query(
          `
            UPDATE commerce_returns
            SET status = 'cancelled', updated_at = now()
            WHERE tenant_id = $1 AND id = $2
          `,
          [tenantId, returnId]
        );

        await auditReturn(
          "cancelled",
          "Return request cancelled.",
          {
            previousStatus: current.status,
            nextStatus: "cancelled"
          }
        );
        return;
      }

      if (action === "receive") {
        if (current.status !== "approved") {
          const error = new Error("Only approved returns can be received.");
          error.statusCode = 409;
          throw error;
        }

        const receivedItems = Array.isArray(input?.items) ? input.items : [];
        const itemResult = await tx.query(
          `
            SELECT
              ri.id,
              ri.order_item_id,
              ri.tenant_catalogue_product_id,
              ri.quantity_requested
            FROM commerce_return_items ri
            WHERE ri.tenant_id = $1
              AND ri.return_id = $2
            ORDER BY ri.created_at ASC
            FOR UPDATE
          `,
          [tenantId, returnId]
        );

        const submitted = new Map(
          receivedItems.map((item) => [
            String(item?.orderItemId || ""),
            item
          ])
        );

        if (submitted.size !== itemResult.rows.length) {
          const error = new Error("Receipt must inspect every return item.");
          error.statusCode = 400;
          throw error;
        }

        const locationResult = await tx.query(
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
          [tenantId, current.store_id, current.market_code]
        );

        if (locationResult.rowCount === 0) {
          const error = new Error("Active own-stock return location not found.");
          error.statusCode = 409;
          throw error;
        }

        const locationId = locationResult.rows[0].id;

        for (const row of itemResult.rows) {
          const item = submitted.get(row.order_item_id);
          if (!item) {
            const error = new Error("Receipt contains an unknown return item.");
            error.statusCode = 400;
            throw error;
          }

          const quantityReceived = Number(item.quantityReceived);
          const condition = String(item.condition || "").trim();
          const restockDecision = String(item.restockDecision || "").trim();

          if (
            !Number.isSafeInteger(quantityReceived) ||
            quantityReceived < 0 ||
            quantityReceived > Number(row.quantity_requested)
          ) {
            const error = new Error("Received quantity is invalid.");
            error.statusCode = 400;
            throw error;
          }

          if (!["new","opened","damaged","faulty"].includes(condition)) {
            const error = new Error("A valid inspected condition is required.");
            error.statusCode = 400;
            throw error;
          }

          if (!["restock","do_not_restock"].includes(restockDecision)) {
            const error = new Error("A restock decision is required.");
            error.statusCode = 400;
            throw error;
          }

          if (restockDecision === "restock" && ["damaged","faulty"].includes(condition)) {
            const error = new Error("Damaged or faulty goods cannot be restocked.");
            error.statusCode = 409;
            throw error;
          }

          const quantityRestocked =
            restockDecision === "restock" ? quantityReceived : 0;

          await tx.query(
            `
              UPDATE commerce_return_items
              SET
                quantity_received = $1,
                quantity_restocked = $2,
                condition = $3,
                restock_decision = $4,
                updated_at = now()
              WHERE tenant_id = $5 AND id = $6
            `,
            [
              quantityReceived,
              quantityRestocked,
              condition,
              restockDecision,
              tenantId,
              row.id
            ]
          );

          if (quantityRestocked > 0) {
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
                VALUES ($1,$2,$3,0,0,0)
                ON CONFLICT (tenant_id, location_id, tenant_catalogue_product_id)
                DO NOTHING
              `,
              [
                tenantId,
                locationId,
                row.tenant_catalogue_product_id
              ]
            );

            const levelResult = await tx.query(
              `
                SELECT id, on_hand
                FROM commerce_inventory_levels
                WHERE tenant_id = $1
                  AND location_id = $2
                  AND tenant_catalogue_product_id = $3
                FOR UPDATE
              `,
              [
                tenantId,
                locationId,
                row.tenant_catalogue_product_id
              ]
            );

            const level = levelResult.rows[0];

            await tx.query(
              `
                UPDATE commerce_inventory_levels
                SET on_hand = on_hand + $1, updated_at = now()
                WHERE tenant_id = $2 AND id = $3
              `,
              [quantityRestocked, tenantId, level.id]
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
                VALUES ($1,$2,'return',$3,0,'return',$4,$5,'admin')
              `,
              [
                tenantId,
                level.id,
                quantityRestocked,
                returnId,
                inspectionNote || "Return received and approved for restock."
              ]
            );
          }
        }

        await tx.query(
          `
            UPDATE commerce_returns
            SET
              status = 'received',
              inspection_note = $1,
              received_at = now(),
              updated_at = now()
            WHERE tenant_id = $2 AND id = $3
          `,
          [inspectionNote, tenantId, returnId]
        );

        const receivedSummary = receivedItems.reduce(
          (summary, item) => {
            const quantity = Number(item?.quantityReceived || 0);
            summary.received += Number.isFinite(quantity) ? quantity : 0;
            if (String(item?.restockDecision || "") === "restock") {
              summary.restocked += Number.isFinite(quantity) ? quantity : 0;
            }
            return summary;
          },
          { received: 0, restocked: 0 }
        );

        await auditReturn(
          "received",
          "Return received and inspected.",
          {
            previousStatus: current.status,
            nextStatus: "received",
            quantityReceived: receivedSummary.received,
            quantityRestocked: receivedSummary.restocked,
            inspectionNote
          }
        );
        return;
      }

      if (action === "reconcile_refund") {
        if (!["approved", "received"].includes(current.status)) {
          const error = new Error(
            "Refund reconciliation requires an approved or received return."
          );
          error.statusCode = 409;
          throw error;
        }

        let nextRefundStatus = null;
        if (current.payment_status === "refunded") {
          nextRefundStatus = "refunded";
        } else if (current.payment_status === "partially_refunded") {
          nextRefundStatus = "partially_refunded";
        } else {
          const error = new Error(
            "Provider payment status does not yet show a refund."
          );
          error.statusCode = 409;
          throw error;
        }

        await tx.query(
          `
            UPDATE commerce_returns
            SET refund_status = $1, updated_at = now()
            WHERE tenant_id = $2 AND id = $3
          `,
          [nextRefundStatus, tenantId, returnId]
        );

        await auditReturn(
          "refund_reconciled",
          "Return refund reconciled from provider-controlled payment state.",
          {
            providerPaymentStatus: current.payment_status,
            previousRefundStatus: current.refund_status,
            nextRefundStatus
          }
        );
        return;
      }

      if (action === "complete") {
        if (current.status !== "received") {
          const error = new Error("Only received returns can be completed.");
          error.statusCode = 409;
          throw error;
        }

        if (
          Number(current.requested_refund_amount) > 0 &&
          !["partially_refunded","refunded"].includes(current.refund_status)
        ) {
          const error = new Error(
            "Refund must be reconciled from provider-controlled payment state before completion."
          );
          error.statusCode = 409;
          throw error;
        }

        await tx.query(
          `
            UPDATE commerce_returns
            SET status = 'completed', completed_at = now(), updated_at = now()
            WHERE tenant_id = $1 AND id = $2
          `,
          [tenantId, returnId]
        );

        await auditReturn(
          "completed",
          "Return workflow completed.",
          {
            previousStatus: current.status,
            nextStatus: "completed",
            refundStatus: current.refund_status
          }
        );
      }
    });

    return await getReturn(returnId);
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


async function getOperationsInbox() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const [
        supplierReviewResult,
        discoveryResult,
        purchaseOrderResult,
        returnResult
      ] = await Promise.all([
        tx.query(
          `
            SELECT
              s.id,
              s.name,
              s.supplier_code,
              s.market_code,
              s.verification_status,
              s.updated_at
            FROM commerce_suppliers s
            WHERE s.tenant_id = $1
              AND s.status = 'active'
              AND s.verification_status IN ('unverified','pending_review')
            ORDER BY s.updated_at ASC
            LIMIT 100
          `,
          [tenantId]
        ),
        tx.query(
          `
            SELECT
              c.id,
              c.name,
              c.category,
              c.status,
              c.updated_at,
              s.id AS supplier_id,
              s.name AS supplier_name,
              s.market_code
            FROM commerce_product_discovery_candidates c
            JOIN commerce_suppliers s
              ON s.tenant_id = c.tenant_id
             AND s.id = c.supplier_id
            WHERE c.tenant_id = $1
              AND c.status = 'pending_review'
            ORDER BY c.updated_at ASC
            LIMIT 100
          `,
          [tenantId]
        ),
        tx.query(
          `
            SELECT
              po.id,
              po.po_number,
              po.status,
              po.supplier_ack_status,
              po.supplier_update_note,
              po.submitted_at,
              po.updated_at,
              s.name AS supplier_name,
              s.market_code
            FROM commerce_purchase_orders po
            JOIN commerce_suppliers s
              ON s.tenant_id = po.tenant_id
             AND s.id = po.supplier_id
            WHERE po.tenant_id = $1
              AND (
                po.status IN ('draft','approved')
                OR (
                  po.status IN ('submitted','partially_received')
                  AND po.supplier_ack_status IN ('pending','unable_to_fulfil')
                )
              )
            ORDER BY po.updated_at ASC
            LIMIT 100
          `,
          [tenantId]
        ),
        tx.query(
          `
            SELECT
              r.id,
              r.return_number,
              r.status,
              r.refund_status,
              r.requested_refund_amount,
              r.currency_code,
              r.updated_at,
              o.id AS order_id,
              o.order_number,
              o.customer_name,
              o.payment_status
            FROM commerce_returns r
            JOIN commerce_orders o
              ON o.tenant_id = r.tenant_id
             AND o.id = r.order_id
            WHERE r.tenant_id = $1
              AND (
                r.status IN ('requested','approved','received')
                OR r.refund_status = 'pending_provider'
              )
            ORDER BY r.updated_at ASC
            LIMIT 100
          `,
          [tenantId]
        )
      ]);

      const items = [];

      for (const row of supplierReviewResult.rows) {
        items.push({
          id: `supplier:${row.id}`,
          type: "supplier_review",
          severity: "review",
          title: `Review supplier: ${row.name}`,
          detail:
            row.verification_status === "unverified"
              ? "Supplier has not entered verification review."
              : "Supplier is waiting for verification review.",
          marketCode: row.market_code,
          entityId: row.id,
          href: `/admin/suppliers/${row.id}`,
          createdAt: row.updated_at,
          metadata: {
            supplierCode: row.supplier_code,
            verificationStatus: row.verification_status
          }
        });
      }

      for (const row of discoveryResult.rows) {
        items.push({
          id: `discovery:${row.id}`,
          type: "product_discovery",
          severity: "review",
          title: `Review product candidate: ${row.name}`,
          detail: `${row.supplier_name} · ${row.category}`,
          marketCode: row.market_code,
          entityId: row.id,
          href: "/admin/discovery",
          createdAt: row.updated_at,
          metadata: {
            supplierId: row.supplier_id,
            supplierName: row.supplier_name
          }
        });
      }

      for (const row of purchaseOrderResult.rows) {
        let severity = "action";
        let title = `Purchase order ${row.po_number} needs action`;
        let detail = `${row.supplier_name} · ${row.status.replaceAll("_", " ")}`;

        if (row.status === "draft") {
          title = `Approve or review draft PO ${row.po_number}`;
        } else if (row.status === "approved") {
          title = `Send approved PO ${row.po_number}`;
        } else if (row.supplier_ack_status === "pending") {
          title = `Supplier has not acknowledged ${row.po_number}`;
          severity = "action";
        } else if (row.supplier_ack_status === "unable_to_fulfil") {
          title = `Supplier cannot fulfil ${row.po_number}`;
          detail = row.supplier_update_note || detail;
          severity = "urgent";
        }

        items.push({
          id: `po:${row.id}`,
          type: "purchase_order",
          severity,
          title,
          detail,
          marketCode: row.market_code,
          entityId: row.id,
          href: `/admin/purchase-orders/${row.id}`,
          createdAt: row.submitted_at || row.updated_at,
          metadata: {
            status: row.status,
            supplierAckStatus: row.supplier_ack_status,
            supplierName: row.supplier_name
          }
        });
      }

      for (const row of returnResult.rows) {
        let severity = "action";
        let title = `Return ${row.return_number} needs action`;
        let detail = `${row.order_number} · ${row.customer_name}`;

        if (row.status === "requested") {
          title = `Approve or reject return ${row.return_number}`;
        } else if (row.status === "approved") {
          title = `Receive and inspect return ${row.return_number}`;
        } else if (row.refund_status === "pending_provider") {
          title = `Refund pending for ${row.return_number}`;
          detail = `${detail} · provider state: ${row.payment_status}`;
          severity = "action";
        } else if (row.status === "received") {
          title = `Complete return ${row.return_number}`;
        }

        items.push({
          id: `return:${row.id}`,
          type: "return",
          severity,
          title,
          detail,
          marketCode: null,
          entityId: row.id,
          href: `/admin/returns/${row.id}`,
          createdAt: row.updated_at,
          metadata: {
            orderId: row.order_id,
            orderNumber: row.order_number,
            status: row.status,
            refundStatus: row.refund_status,
            refundAmount: Number(row.requested_refund_amount || 0),
            currency: row.currency_code
          }
        });
      }

      const escalationPolicy = {
        supplier_review: {
          targetHours: 72,
          urgentAfterHours: 168,
          label: "Supplier verification review"
        },
        product_discovery: {
          targetHours: 48,
          urgentAfterHours: 168,
          label: "Product discovery review"
        },
        purchase_order_draft: {
          targetHours: 48,
          urgentAfterHours: 120,
          label: "Draft purchase-order review"
        },
        purchase_order_approved: {
          targetHours: 24,
          urgentAfterHours: 72,
          label: "Approved purchase-order submission"
        },
        purchase_order_ack: {
          targetHours: 24,
          urgentAfterHours: 48,
          label: "Supplier purchase-order acknowledgement"
        },
        purchase_order_unable: {
          targetHours: 0,
          urgentAfterHours: 0,
          label: "Supplier unable to fulfil"
        },
        return_requested: {
          targetHours: 24,
          urgentAfterHours: 72,
          label: "Return request review"
        },
        return_approved: {
          targetHours: 48,
          urgentAfterHours: 120,
          label: "Approved return receipt"
        },
        return_refund: {
          targetHours: 24,
          urgentAfterHours: 72,
          label: "Provider refund follow-up"
        },
        return_received: {
          targetHours: 24,
          urgentAfterHours: 72,
          label: "Received return completion"
        }
      };

      const nowMs = Date.now();

      for (const item of items) {
        let policyKey = item.type;

        if (item.type === "purchase_order") {
          if (item.metadata.supplierAckStatus === "unable_to_fulfil") {
            policyKey = "purchase_order_unable";
          } else if (
            ["submitted", "partially_received"].includes(item.metadata.status) &&
            item.metadata.supplierAckStatus === "pending"
          ) {
            policyKey = "purchase_order_ack";
          } else if (item.metadata.status === "approved") {
            policyKey = "purchase_order_approved";
          } else {
            policyKey = "purchase_order_draft";
          }
        }

        if (item.type === "return") {
          if (item.metadata.refundStatus === "pending_provider") {
            policyKey = "return_refund";
          } else if (item.metadata.status === "requested") {
            policyKey = "return_requested";
          } else if (item.metadata.status === "approved") {
            policyKey = "return_approved";
          } else {
            policyKey = "return_received";
          }
        }

        const policy = escalationPolicy[policyKey];
        const createdAtMs = new Date(item.createdAt || 0).getTime();
        const ageHours =
          Number.isFinite(createdAtMs) && createdAtMs > 0
            ? Math.max(0, (nowMs - createdAtMs) / 3600000)
            : 0;

        item.baseSeverity = item.severity;
        item.ageHours = ageHours;
        item.targetHours = policy?.targetHours ?? null;
        item.urgentAfterHours = policy?.urgentAfterHours ?? null;
        item.escalationLabel = policy?.label || null;
        item.overdue =
          policy?.targetHours !== undefined &&
          ageHours >= policy.targetHours;
        item.overdueHours =
          item.overdue && policy?.targetHours !== undefined
            ? Math.max(0, ageHours - policy.targetHours)
            : 0;

        if (
          policy?.urgentAfterHours !== undefined &&
          ageHours >= policy.urgentAfterHours
        ) {
          item.severity = "urgent";
        } else if (
          policy?.targetHours !== undefined &&
          ageHours >= policy.targetHours &&
          item.severity !== "urgent"
        ) {
          item.severity = "attention";
        }
      }

      const severityRank = {
        urgent: 0,
        attention: 1,
        action: 2,
        review: 3
      };

      items.sort((left, right) => {
        const rank =
          (severityRank[left.severity] ?? 9) -
          (severityRank[right.severity] ?? 9);
        if (rank !== 0) return rank;

        return (
          new Date(left.createdAt || 0).getTime() -
          new Date(right.createdAt || 0).getTime()
        );
      });

      return {
        total: items.length,
        counts: {
          urgent: items.filter((item) => item.severity === "urgent").length,
          attention: items.filter((item) => item.severity === "attention").length,
          action: items.filter((item) => item.severity === "action").length,
          review: items.filter((item) => item.severity === "review").length,
          overdue: items.filter((item) => item.overdue).length
        },
        escalationPolicy,
        items
      };
    });
  } finally {
    client.release();
  }
}


async function getSupplierPerformance() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            s.id,
            s.supplier_code,
            s.name,
            s.market_code,
            s.supplier_type,
            s.fulfilment_model,
            s.status,
            s.verification_status,

            COALESCE(offers.active_offers, 0)::int AS active_offers,

            COALESCE(feed.batch_count, 0)::int AS feed_batch_count,
            COALESCE(feed.accepted_items, 0)::int AS feed_accepted_items,
            COALESCE(feed.rejected_items, 0)::int AS feed_rejected_items,
            feed.last_feed_at,

            COALESCE(sync.sync_runs, 0)::int AS sync_runs,
            COALESCE(sync.matched_items, 0)::int AS sync_matched_items,
            COALESCE(sync.unmatched_items, 0)::int AS sync_unmatched_items,
            COALESCE(sync.stale_items, 0)::int AS sync_stale_items,
            sync.last_sync_at,

            COALESCE(po.po_count, 0)::int AS po_count,
            COALESCE(po.submitted_po_count, 0)::int AS submitted_po_count,
            COALESCE(po.acknowledged_po_count, 0)::int AS acknowledged_po_count,
            COALESCE(po.unable_po_count, 0)::int AS unable_po_count,
            COALESCE(po.pending_ack_count, 0)::int AS pending_ack_count,
            po.avg_ack_hours,
            po.last_shipped_at,

            COALESCE(po.ordered_units, 0)::int AS ordered_units,
            COALESCE(po.received_units, 0)::int AS received_units

          FROM commerce_suppliers s

          LEFT JOIN LATERAL (
            SELECT
              COUNT(*) FILTER (WHERE so.status = 'active')::int AS active_offers
            FROM commerce_supplier_offers so
            WHERE so.tenant_id = s.tenant_id
              AND so.supplier_id = s.id
          ) offers ON true

          LEFT JOIN LATERAL (
            SELECT
              COUNT(*)::int AS batch_count,
              COALESCE(SUM(b.accepted_count), 0)::int AS accepted_items,
              COALESCE(SUM(b.rejected_count), 0)::int AS rejected_items,
              MAX(b.created_at) AS last_feed_at
            FROM commerce_supplier_feed_batches b
            WHERE b.tenant_id = s.tenant_id
              AND b.supplier_id = s.id
          ) feed ON true

          LEFT JOIN LATERAL (
            SELECT
              COUNT(*)::int AS sync_runs,
              COALESCE(SUM(r.matched_count), 0)::int AS matched_items,
              COALESCE(SUM(r.unmatched_count), 0)::int AS unmatched_items,
              COALESCE(SUM(r.stale_count), 0)::int AS stale_items,
              MAX(r.created_at) AS last_sync_at
            FROM commerce_supplier_inventory_sync_runs r
            WHERE r.tenant_id = s.tenant_id
              AND r.supplier_id = s.id
          ) sync ON true

          LEFT JOIN LATERAL (
            SELECT
              COUNT(*)::int AS po_count,
              COUNT(*) FILTER (
                WHERE p.submitted_at IS NOT NULL
              )::int AS submitted_po_count,
              COUNT(*) FILTER (
                WHERE p.supplier_ack_status = 'acknowledged'
              )::int AS acknowledged_po_count,
              COUNT(*) FILTER (
                WHERE p.supplier_ack_status = 'unable_to_fulfil'
              )::int AS unable_po_count,
              COUNT(*) FILTER (
                WHERE p.status IN ('submitted','partially_received')
                  AND p.supplier_ack_status = 'pending'
              )::int AS pending_ack_count,
              AVG(
                EXTRACT(EPOCH FROM (
                  p.supplier_acknowledged_at - p.submitted_at
                )) / 3600.0
              ) FILTER (
                WHERE p.submitted_at IS NOT NULL
                  AND p.supplier_acknowledged_at IS NOT NULL
              ) AS avg_ack_hours,
              MAX(p.latest_shipped_at) AS last_shipped_at,
              COALESCE(SUM(items.ordered_units), 0)::int AS ordered_units,
              COALESCE(SUM(items.received_units), 0)::int AS received_units
            FROM commerce_purchase_orders p
            LEFT JOIN LATERAL (
              SELECT
                COALESCE(SUM(i.quantity), 0)::int AS ordered_units,
                COALESCE(SUM(i.received_quantity), 0)::int AS received_units
              FROM commerce_purchase_order_items i
              WHERE i.tenant_id = p.tenant_id
                AND i.purchase_order_id = p.id
            ) items ON true
            WHERE p.tenant_id = s.tenant_id
              AND p.supplier_id = s.id
              AND p.status <> 'cancelled'
          ) po ON true

          WHERE s.tenant_id = $1
            AND s.status <> 'archived'
          ORDER BY s.name ASC
        `,
        [tenantId]
      );

      return result.rows.map((row) => {
        const accepted = Number(row.feed_accepted_items || 0);
        const rejected = Number(row.feed_rejected_items || 0);
        const feedTotal = accepted + rejected;
        const matched = Number(row.sync_matched_items || 0);
        const unmatched = Number(row.sync_unmatched_items || 0);
        const stale = Number(row.sync_stale_items || 0);
        const syncTotal = matched + unmatched + stale;
        const orderedUnits = Number(row.ordered_units || 0);
        const receivedUnits = Number(row.received_units || 0);

        const feedAcceptanceRate =
          feedTotal > 0 ? accepted / feedTotal : null;
        const syncMatchRate =
          syncTotal > 0 ? matched / syncTotal : null;
        const receiptRate =
          orderedUnits > 0 ? receivedUnits / orderedUnits : null;

        const attentionFlags = [
          ...(row.verification_status !== "verified"
            ? ["supplier_not_verified"]
            : []),
          ...(Number(row.active_offers || 0) === 0
            ? ["no_active_offers"]
            : []),
          ...(feedAcceptanceRate !== null && feedAcceptanceRate < 0.8
            ? ["high_feed_rejection"]
            : []),
          ...(unmatched > 0 ? ["inventory_unmatched_skus"] : []),
          ...(Number(row.pending_ack_count || 0) > 0
            ? ["purchase_orders_waiting_ack"]
            : []),
          ...(Number(row.unable_po_count || 0) > 0
            ? ["supplier_reported_unable_to_fulfil"]
            : [])
        ];

        return {
          supplierId: row.id,
          supplierCode: row.supplier_code,
          supplierName: row.name,
          marketCode: row.market_code,
          supplierType: row.supplier_type,
          fulfilmentModel: row.fulfilment_model,
          status: row.status,
          verificationStatus: row.verification_status,
          activeOffers: Number(row.active_offers || 0),
          feed: {
            batchCount: Number(row.feed_batch_count || 0),
            acceptedItems: accepted,
            rejectedItems: rejected,
            acceptanceRate: feedAcceptanceRate,
            lastFeedAt: row.last_feed_at
          },
          inventorySync: {
            runCount: Number(row.sync_runs || 0),
            matchedItems: matched,
            unmatchedItems: unmatched,
            staleItems: stale,
            matchRate: syncMatchRate,
            lastSyncAt: row.last_sync_at
          },
          purchaseOrders: {
            count: Number(row.po_count || 0),
            submittedCount: Number(row.submitted_po_count || 0),
            acknowledgedCount: Number(row.acknowledged_po_count || 0),
            unableToFulfilCount: Number(row.unable_po_count || 0),
            pendingAcknowledgementCount: Number(row.pending_ack_count || 0),
            averageAcknowledgementHours:
              row.avg_ack_hours === null
                ? null
                : Number(row.avg_ack_hours),
            orderedUnits,
            receivedUnits,
            receiptRate,
            lastShippedAt: row.last_shipped_at
          },
          attentionFlags
        };
      });
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
        updatedAt: row.updated_at,
        qualityFlags: [
          ...(row.image_url ? [] : ["missing_image"]),
          ...(row.unit_cost === null ? ["missing_unit_cost"] : []),
          ...(row.stock_status === "unknown" ? ["unknown_stock"] : []),
          ...(row.stock_status === "out_of_stock" ? ["out_of_stock"] : []),
          ...(row.potential_duplicate_product_id ? ["potential_duplicate"] : [])
        ],
        potentialDuplicate: row.potential_duplicate_product_id
          ? {
              productId: row.potential_duplicate_product_id,
              productName: row.potential_duplicate_product_name,
              matchType: row.potential_duplicate_match_type
            }
          : null
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
            a.execution_status,
            a.carrier,
            a.tracking_number,
            a.dispatched_at,
            a.delivered_at,
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
          executionStatus: row.execution_status,
          carrier: row.carrier,
          trackingNumber: row.tracking_number,
          dispatchedAt: row.dispatched_at,
          deliveredAt: row.delivered_at,
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


async function updateFulfilmentExecution(orderId, allocationId, input) {
  if (!/^[0-9a-f-]{36}$/i.test(String(orderId || ""))) {
    const error = new Error("A valid order id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^[0-9a-f-]{36}$/i.test(String(allocationId || ""))) {
    const error = new Error("A valid allocation id is required.");
    error.statusCode = 400;
    throw error;
  }

  const action = String(input?.action || "").trim();
  const carrier = String(input?.carrier || "").trim().slice(0, 120) || null;
  const trackingNumber =
    String(input?.trackingNumber || "").trim().slice(0, 180) || null;

  if (!["dispatch", "deliver"].includes(action)) {
    const error = new Error("Fulfilment action must be dispatch or deliver.");
    error.statusCode = 400;
    throw error;
  }

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
        const error = new Error("Payment must be confirmed before fulfilment execution.");
        error.statusCode = 409;
        throw error;
      }

      if (order.source === "preview") {
        const error = new Error("Preview/test orders cannot execute real fulfilment.");
        error.statusCode = 409;
        throw error;
      }

      const allocationResult = await tx.query(
        `
          SELECT
            a.id,
            a.fulfilment_plan_id,
            a.source_type,
            a.inventory_level_id,
            a.quantity,
            a.reservation_status,
            a.execution_status,
            p.status AS plan_status
          FROM commerce_fulfilment_allocations a
          JOIN commerce_fulfilment_plans p
            ON p.tenant_id = a.tenant_id
           AND p.id = a.fulfilment_plan_id
          WHERE a.tenant_id = $1
            AND a.id = $2
            AND p.order_id = $3
          FOR UPDATE
        `,
        [tenantId, allocationId, orderId]
      );

      if (allocationResult.rowCount === 0) {
        const error = new Error("Fulfilment allocation not found.");
        error.statusCode = 404;
        throw error;
      }

      const allocation = allocationResult.rows[0];

      if (allocation.plan_status !== "approved") {
        const error = new Error("The fulfilment plan must be approved before execution.");
        error.statusCode = 409;
        throw error;
      }

      if (action === "dispatch") {
        if (allocation.execution_status !== "pending") {
          const error = new Error("Only pending allocations can be marked dispatched.");
          error.statusCode = 409;
          throw error;
        }

        if (
          allocation.source_type === "own_stock" &&
          allocation.reservation_status !== "reserved"
        ) {
          const error = new Error("Owned stock must be reserved before dispatch.");
          error.statusCode = 409;
          throw error;
        }

        if (allocation.source_type === "own_stock") {
          const levelResult = await tx.query(
            `
              SELECT id, on_hand, reserved
              FROM commerce_inventory_levels
              WHERE tenant_id = $1 AND id = $2
              FOR UPDATE
            `,
            [tenantId, allocation.inventory_level_id]
          );

          if (levelResult.rowCount === 0) {
            const error = new Error("Reserved inventory level not found.");
            error.statusCode = 409;
            throw error;
          }

          const level = levelResult.rows[0];
          const quantity = Number(allocation.quantity);

          if (
            Number(level.on_hand) < quantity ||
            Number(level.reserved) < quantity
          ) {
            const error = new Error("Reserved owned stock is no longer consistent.");
            error.statusCode = 409;
            throw error;
          }

          await tx.query(
            `
              UPDATE commerce_inventory_levels
              SET
                on_hand = on_hand - $1,
                reserved = reserved - $1,
                updated_at = now()
              WHERE tenant_id = $2 AND id = $3
            `,
            [quantity, tenantId, level.id]
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
              VALUES ($1,$2,'sale',$3,$3,'fulfilment_allocation',$4,$5,'admin')
            `,
            [
              tenantId,
              level.id,
              -quantity,
              allocation.id,
              "Consumed reserved stock on manual dispatch confirmation"
            ]
          );
        }

        const updated = await tx.query(
          `
            UPDATE commerce_fulfilment_allocations
            SET
              execution_status = 'dispatched',
              reservation_status = CASE
                WHEN source_type = 'own_stock' THEN 'consumed'
                ELSE reservation_status
              END,
              carrier = COALESCE($1, carrier),
              tracking_number = COALESCE($2, tracking_number),
              dispatched_at = now(),
              updated_at = now()
            WHERE tenant_id = $3 AND id = $4
            RETURNING id, execution_status, carrier, tracking_number, dispatched_at
          `,
          [carrier, trackingNumber, tenantId, allocation.id]
        );

        await tx.query(
          `
            UPDATE commerce_orders
            SET fulfilment_status = 'processing', updated_at = now()
            WHERE tenant_id = $1
              AND id = $2
              AND fulfilment_status = 'unfulfilled'
          `,
          [tenantId, orderId]
        );

        return updated.rows[0];
      }

      if (allocation.execution_status !== "dispatched") {
        const error = new Error("Only dispatched allocations can be marked delivered.");
        error.statusCode = 409;
        throw error;
      }

      const delivered = await tx.query(
        `
          UPDATE commerce_fulfilment_allocations
          SET
            execution_status = 'delivered',
            carrier = COALESCE($1, carrier),
            tracking_number = COALESCE($2, tracking_number),
            delivered_at = now(),
            updated_at = now()
          WHERE tenant_id = $3 AND id = $4
          RETURNING id, execution_status, carrier, tracking_number, delivered_at
        `,
        [carrier, trackingNumber, tenantId, allocation.id]
      );

      const remaining = await tx.query(
        `
          SELECT COUNT(*)::int AS remaining
          FROM commerce_fulfilment_allocations
          WHERE tenant_id = $1
            AND fulfilment_plan_id = $2
            AND execution_status <> 'delivered'
        `,
        [tenantId, allocation.fulfilment_plan_id]
      );

      if (Number(remaining.rows[0]?.remaining || 0) === 0) {
        await tx.query(
          `
            UPDATE commerce_fulfilment_plans
            SET status = 'completed', updated_at = now()
            WHERE tenant_id = $1 AND id = $2
          `,
          [tenantId, allocation.fulfilment_plan_id]
        );

        await tx.query(
          `
            UPDATE commerce_orders
            SET
              fulfilment_status = 'fulfilled',
              order_status = 'completed',
              updated_at = now()
            WHERE tenant_id = $1 AND id = $2
          `,
          [tenantId, orderId]
        );
      }

      return delivered.rows[0];
    });
  } finally {
    client.release();
  }
}


async function updateSupplierVerification(supplierId, input) {
  if (!/^[0-9a-f-]{36}$/i.test(String(supplierId || ""))) {
    const error = new Error("A valid supplier id is required.");
    error.statusCode = 400;
    throw error;
  }

  const toStatus = String(input?.verificationStatus || "").trim();
  const reviewNote = String(input?.reviewNote || "").trim().slice(0, 1000) || null;

  if (!["pending_review", "verified", "rejected"].includes(toStatus)) {
    const error = new Error("Unsupported supplier verification status.");
    error.statusCode = 400;
    throw error;
  }

  if (toStatus === "rejected" && !reviewNote) {
    const error = new Error("A review note is required when rejecting a supplier.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const supplierResult = await tx.query(
        `
          SELECT
            id,
            verification_status,
            status
          FROM commerce_suppliers
          WHERE tenant_id = $1
            AND id = $2
          FOR UPDATE
        `,
        [tenantId, supplierId]
      );

      if (supplierResult.rowCount === 0) {
        const error = new Error("Supplier not found.");
        error.statusCode = 404;
        throw error;
      }

      const supplier = supplierResult.rows[0];

      if (supplier.status === "archived") {
        const error = new Error("Archived suppliers cannot be verified.");
        error.statusCode = 409;
        throw error;
      }

      if (supplier.verification_status === toStatus) {
        const error = new Error("Supplier is already in that verification state.");
        error.statusCode = 409;
        throw error;
      }

      await tx.query(
        `
          UPDATE commerce_suppliers
          SET verification_status = $1, updated_at = now()
          WHERE tenant_id = $2 AND id = $3
        `,
        [toStatus, tenantId, supplierId]
      );

      await tx.query(
        `
          INSERT INTO commerce_supplier_verification_events (
            tenant_id,
            supplier_id,
            from_status,
            to_status,
            review_note,
            actor
          )
          VALUES ($1,$2,$3,$4,$5,'admin')
        `,
        [
          tenantId,
          supplierId,
          supplier.verification_status,
          toStatus,
          reviewNote
        ]
      );

      await recordOperationsAudit(tx, tenantId, {
        actorType: "admin",
        actorReference: "admin",
        action: "supplier.verification_updated",
        entityType: "supplier",
        entityId: supplierId,
        summary: `Supplier verification changed from ${supplier.verification_status} to ${toStatus}.`,
        metadata: {
          fromStatus: supplier.verification_status,
          toStatus,
          reviewNote
        }
      });

      return {
        supplierId,
        verificationStatus: toStatus,
        previousVerificationStatus: supplier.verification_status,
        reviewNote
      };
    });
  } finally {
    client.release();
  }
}

async function listSupplierVerificationEvents(supplierId) {
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
            id,
            from_status,
            to_status,
            review_note,
            actor,
            created_at
          FROM commerce_supplier_verification_events
          WHERE tenant_id = $1
            AND supplier_id = $2
          ORDER BY created_at DESC
          LIMIT 100
        `,
        [tenantId, supplierId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        reviewNote: row.review_note,
        actor: row.actor,
        createdAt: row.created_at
      }));
    });
  } finally {
    client.release();
  }
}


async function getReplenishmentWatchlist(marketCode = "GB") {
  const normalizedMarket = String(marketCode || "GB").trim().toUpperCase();

  if (!["GB", "NG"].includes(normalizedMarket)) {
    const error = new Error("Replenishment market must be GB or NG.");
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
            cp.attributes,
            tpm.customer_price,
            tpm.currency_code,
            tpm.publication_status,
            tpm.availability_status,
            il.id AS inventory_level_id,
            il.on_hand,
            il.reserved,
            il.safety_stock,
            il.updated_at AS inventory_updated_at,
            loc.name AS location_name,
            fallback.supplier_id,
            fallback.supplier_name,
            fallback.supplier_offer_id,
            fallback.supplier_sku,
            fallback.unit_cost,
            fallback.lead_time_days,
            fallback.stock_status,
            fallback.external_stock_quantity,
            fallback.source_updated_at
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
          LEFT JOIN LATERAL (
            SELECT
              s.id AS supplier_id,
              s.name AS supplier_name,
              so.id AS supplier_offer_id,
              so.supplier_sku,
              so.unit_cost,
              so.lead_time_days,
              so.stock_status,
              so.external_stock_quantity,
              so.source_updated_at
            FROM commerce_supplier_offers so
            JOIN commerce_suppliers s
              ON s.tenant_id = so.tenant_id
             AND s.id = so.supplier_id
            WHERE so.tenant_id = tcp.tenant_id
              AND so.tenant_catalogue_product_id = tcp.id
              AND so.status = 'active'
              AND s.status = 'active'
              AND s.market_code = $2
              AND s.verification_status = 'verified'
              AND so.currency_code = COALESCE(
                tpm.currency_code,
                CASE WHEN $2 = 'NG' THEN 'NGN' ELSE 'GBP' END
              )
              AND so.stock_status IN ('in_stock','limited')
              AND (
                so.external_stock_quantity IS NULL
                OR so.external_stock_quantity > 0
              )
            ORDER BY
              so.unit_cost ASC NULLS LAST,
              so.lead_time_days ASC NULLS LAST,
              so.updated_at DESC
            LIMIT 1
          ) fallback ON true
          WHERE tcp.tenant_id = $1
            AND tcp.status <> 'archived'
          ORDER BY cp.name ASC
        `,
        [tenantId, normalizedMarket]
      );

      return result.rows
        .map((row) => {
          const onHand = row.on_hand === null ? null : Number(row.on_hand);
          const reserved = row.reserved === null ? 0 : Number(row.reserved);
          const safetyStock =
            row.safety_stock === null ? 0 : Number(row.safety_stock);
          const availableToSell =
            onHand === null
              ? null
              : Math.max(0, onHand - reserved - safetyStock);

          let attentionReason = null;
          let severity = null;

          if (row.inventory_level_id === null) {
            attentionReason = "inventory_not_tracked";
            severity = "setup";
          } else if (availableToSell <= 0) {
            attentionReason = "no_sellable_stock";
            severity = "critical";
          } else if (onHand - reserved <= safetyStock) {
            attentionReason = "at_safety_threshold";
            severity = "warning";
          }

          if (!attentionReason) return null;

          return {
            tenantProductId: row.tenant_product_id,
            productId: row.product_id,
            productName: row.product_name,
            canonicalCode: row.canonical_code,
            image: row.attributes?.image || "",
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
            inventoryTracked: row.inventory_level_id !== null,
            inventoryLevelId: row.inventory_level_id || null,
            locationName: row.location_name || null,
            onHand,
            reserved,
            safetyStock,
            availableToSell,
            attentionReason,
            severity,
            inventoryUpdatedAt: row.inventory_updated_at,
            fallbackSupplier: row.supplier_id
              ? {
                  supplierId: row.supplier_id,
                  supplierName: row.supplier_name,
                  supplierOfferId: row.supplier_offer_id,
                  supplierSku: row.supplier_sku,
                  unitCost:
                    row.unit_cost === null
                      ? null
                      : Number(row.unit_cost),
                  leadTimeDays:
                    row.lead_time_days === null
                      ? null
                      : Number(row.lead_time_days),
                  stockStatus: row.stock_status,
                  externalStockQuantity:
                    row.external_stock_quantity === null
                      ? null
                      : Number(row.external_stock_quantity),
                  sourceUpdatedAt: row.source_updated_at
                }
              : null
          };
        })
        .filter(Boolean);
    });
  } finally {
    client.release();
  }
}


function createPurchaseOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `PO-${stamp}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function listPurchaseOrders() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            po.id,
            po.po_number,
            po.market_code,
            po.currency_code,
            po.status,
            po.notes,
            po.approved_by,
            po.approved_at,
            po.submitted_at,
            po.cancelled_at,
            po.supplier_ack_status,
            po.supplier_acknowledged_at,
            po.supplier_reference,
            po.latest_carrier,
            po.latest_tracking_number,
            po.latest_shipped_at,
            po.expected_delivery_at,
            po.created_at,
            po.updated_at,
            s.id AS supplier_id,
            s.name AS supplier_name,
            COUNT(i.id)::int AS line_count,
            COALESCE(SUM(i.quantity * i.unit_cost), 0)::numeric AS total_value,
            COALESCE(SUM(i.received_quantity), 0)::int AS received_units,
            COALESCE(SUM(i.quantity), 0)::int AS ordered_units
          FROM commerce_purchase_orders po
          JOIN commerce_suppliers s
            ON s.tenant_id = po.tenant_id
           AND s.id = po.supplier_id
          LEFT JOIN commerce_purchase_order_items i
            ON i.tenant_id = po.tenant_id
           AND i.purchase_order_id = po.id
          WHERE po.tenant_id = $1
          GROUP BY po.id, s.id, s.name
          ORDER BY po.created_at DESC
          LIMIT 250
        `,
        [tenantId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        poNumber: row.po_number,
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        marketCode: row.market_code,
        currency: row.currency_code,
        status: row.status,
        notes: row.notes,
        lineCount: Number(row.line_count || 0),
        totalValue: Number(row.total_value || 0),
        receivedUnits: Number(row.received_units || 0),
        orderedUnits: Number(row.ordered_units || 0),
        approvedBy: row.approved_by,
        approvedAt: row.approved_at,
        submittedAt: row.submitted_at,
        cancelledAt: row.cancelled_at,
        supplierAckStatus: row.supplier_ack_status || "pending",
        supplierAcknowledgedAt: row.supplier_acknowledged_at,
        supplierReference: row.supplier_reference,
        latestCarrier: row.latest_carrier,
        latestTrackingNumber: row.latest_tracking_number,
        latestShippedAt: row.latest_shipped_at,
        expectedDeliveryAt: row.expected_delivery_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    });
  } finally {
    client.release();
  }
}

async function getPurchaseOrder(poId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(poId || ""))) {
    const error = new Error("A valid purchase-order id is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const poResult = await tx.query(
        `
          SELECT
            po.*,
            s.name AS supplier_name,
            s.verification_status
          FROM commerce_purchase_orders po
          JOIN commerce_suppliers s
            ON s.tenant_id = po.tenant_id
           AND s.id = po.supplier_id
          WHERE po.tenant_id = $1
            AND po.id = $2
          LIMIT 1
        `,
        [tenantId, poId]
      );

      if (poResult.rowCount === 0) {
        const error = new Error("Purchase order not found.");
        error.statusCode = 404;
        throw error;
      }

      const itemResult = await tx.query(
        `
          SELECT
            i.id,
            i.supplier_offer_id,
            i.tenant_catalogue_product_id,
            i.supplier_sku,
            i.quantity,
            i.unit_cost,
            i.currency_code,
            i.received_quantity,
            cp.name AS product_name,
            cp.canonical_code,
            so.stock_status,
            so.external_stock_quantity,
            so.lead_time_days
          FROM commerce_purchase_order_items i
          JOIN tenant_catalogue_products tcp
            ON tcp.tenant_id = i.tenant_id
           AND tcp.id = i.tenant_catalogue_product_id
          JOIN catalogue_products cp
            ON cp.id = tcp.product_id
          JOIN commerce_supplier_offers so
            ON so.tenant_id = i.tenant_id
           AND so.id = i.supplier_offer_id
          WHERE i.tenant_id = $1
            AND i.purchase_order_id = $2
          ORDER BY i.created_at ASC
        `,
        [tenantId, poId]
      );

      const supplierEventResult = await tx.query(
        `
          SELECT
            e.id,
            e.event_type,
            e.supplier_reference,
            e.note,
            e.carrier,
            e.tracking_number,
            e.shipped_at,
            e.expected_delivery_at,
            e.created_at,
            u.email AS supplier_user_email,
            u.display_name AS supplier_user_name
          FROM commerce_purchase_order_supplier_events e
          LEFT JOIN commerce_supplier_users u
            ON u.tenant_id = e.tenant_id
           AND u.id = e.supplier_user_id
          WHERE e.tenant_id = $1
            AND e.purchase_order_id = $2
          ORDER BY e.created_at DESC
          LIMIT 100
        `,
        [tenantId, poId]
      );

      const po = poResult.rows[0];

      return {
        id: po.id,
        poNumber: po.po_number,
        supplierId: po.supplier_id,
        supplierName: po.supplier_name,
        verificationStatus: po.verification_status,
        marketCode: po.market_code,
        currency: po.currency_code,
        status: po.status,
        notes: po.notes,
        approvedBy: po.approved_by,
        approvedAt: po.approved_at,
        submittedAt: po.submitted_at,
        cancelledAt: po.cancelled_at,
        supplierAckStatus: po.supplier_ack_status || "pending",
        supplierAcknowledgedAt: po.supplier_acknowledged_at,
        supplierReference: po.supplier_reference,
        supplierUpdateNote: po.supplier_update_note,
        latestCarrier: po.latest_carrier,
        latestTrackingNumber: po.latest_tracking_number,
        latestShippedAt: po.latest_shipped_at,
        expectedDeliveryAt: po.expected_delivery_at,
        supplierEvents: supplierEventResult.rows.map((event) => ({
          id: event.id,
          eventType: event.event_type,
          supplierReference: event.supplier_reference,
          note: event.note,
          carrier: event.carrier,
          trackingNumber: event.tracking_number,
          shippedAt: event.shipped_at,
          expectedDeliveryAt: event.expected_delivery_at,
          supplierUserEmail: event.supplier_user_email,
          supplierUserName: event.supplier_user_name,
          createdAt: event.created_at
        })),
        createdAt: po.created_at,
        updatedAt: po.updated_at,
        items: itemResult.rows.map((row) => ({
          id: row.id,
          supplierOfferId: row.supplier_offer_id,
          tenantProductId: row.tenant_catalogue_product_id,
          supplierSku: row.supplier_sku,
          productName: row.product_name,
          canonicalCode: row.canonical_code,
          quantity: Number(row.quantity),
          unitCost: Number(row.unit_cost),
          currency: row.currency_code,
          receivedQuantity: Number(row.received_quantity),
          stockStatus: row.stock_status,
          externalStockQuantity:
            row.external_stock_quantity === null ? null : Number(row.external_stock_quantity),
          leadTimeDays:
            row.lead_time_days === null ? null : Number(row.lead_time_days)
        }))
      };
    });
  } finally {
    client.release();
  }
}

async function createPurchaseOrder(input) {
  const supplierOfferId = String(input?.supplierOfferId || "").trim();
  const quantity = Number(input?.quantity);
  const notes = String(input?.notes || "").trim().slice(0, 1000) || null;

  if (!/^[0-9a-f-]{36}$/i.test(supplierOfferId)) {
    const error = new Error("A valid supplier offer id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) {
    const error = new Error("Purchase quantity must be a positive whole number.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const offerResult = await tx.query(
        `
          SELECT
            so.id,
            so.supplier_id,
            so.tenant_catalogue_product_id,
            so.supplier_sku,
            so.currency_code,
            so.unit_cost,
            so.minimum_order_quantity,
            so.stock_status,
            so.external_stock_quantity,
            s.store_id,
            s.market_code,
            s.name AS supplier_name,
            s.status AS supplier_status,
            s.verification_status
          FROM commerce_supplier_offers so
          JOIN commerce_suppliers s
            ON s.tenant_id = so.tenant_id
           AND s.id = so.supplier_id
          WHERE so.tenant_id = $1
            AND so.id = $2
            AND so.status = 'active'
          FOR UPDATE
        `,
        [tenantId, supplierOfferId]
      );

      if (offerResult.rowCount === 0) {
        const error = new Error("Active supplier offer not found.");
        error.statusCode = 404;
        throw error;
      }

      const offer = offerResult.rows[0];

      if (
        offer.supplier_status !== "active" ||
        offer.verification_status !== "verified"
      ) {
        const error = new Error("Only verified active suppliers can receive purchase orders.");
        error.statusCode = 409;
        throw error;
      }

      if (offer.unit_cost === null) {
        const error = new Error("Supplier offer must have a unit cost before creating a purchase order.");
        error.statusCode = 409;
        throw error;
      }

      if (quantity < Number(offer.minimum_order_quantity)) {
        const error = new Error(
          `Quantity must meet the supplier MOQ of ${offer.minimum_order_quantity}.`
        );
        error.statusCode = 409;
        throw error;
      }

      if (
        offer.external_stock_quantity !== null &&
        quantity > Number(offer.external_stock_quantity)
      ) {
        const error = new Error("Requested quantity exceeds the supplier-reported stock quantity.");
        error.statusCode = 409;
        throw error;
      }

      if (!["in_stock", "limited", "preorder"].includes(offer.stock_status)) {
        const error = new Error("Supplier offer is not currently available for ordering.");
        error.statusCode = 409;
        throw error;
      }

      const poNumber = createPurchaseOrderNumber();

      const poResult = await tx.query(
        `
          INSERT INTO commerce_purchase_orders (
            tenant_id,
            store_id,
            supplier_id,
            market_code,
            currency_code,
            po_number,
            status,
            notes
          )
          VALUES ($1,$2,$3,$4,$5,$6,'draft',$7)
          RETURNING id
        `,
        [
          tenantId,
          offer.store_id,
          offer.supplier_id,
          offer.market_code,
          offer.currency_code,
          poNumber,
          notes
        ]
      );

      await tx.query(
        `
          INSERT INTO commerce_purchase_order_items (
            tenant_id,
            purchase_order_id,
            supplier_offer_id,
            tenant_catalogue_product_id,
            supplier_sku,
            quantity,
            unit_cost,
            currency_code
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [
          tenantId,
          poResult.rows[0].id,
          offer.id,
          offer.tenant_catalogue_product_id,
          offer.supplier_sku,
          quantity,
          Number(offer.unit_cost),
          offer.currency_code
        ]
      );

      return {
        id: poResult.rows[0].id,
        poNumber,
        supplierName: offer.supplier_name,
        quantity,
        currency: offer.currency_code,
        unitCost: Number(offer.unit_cost),
        status: "draft"
      };
    });
  } finally {
    client.release();
  }
}

async function approvePurchaseOrder(poId) {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            po.id,
            po.status,
            s.status AS supplier_status,
            s.verification_status
          FROM commerce_purchase_orders po
          JOIN commerce_suppliers s
            ON s.tenant_id = po.tenant_id
           AND s.id = po.supplier_id
          WHERE po.tenant_id = $1
            AND po.id = $2
          FOR UPDATE
        `,
        [tenantId, poId]
      );

      if (result.rowCount === 0) {
        const error = new Error("Purchase order not found.");
        error.statusCode = 404;
        throw error;
      }

      const po = result.rows[0];

      if (po.status !== "draft") {
        const error = new Error("Only draft purchase orders can be approved.");
        error.statusCode = 409;
        throw error;
      }

      if (
        po.supplier_status !== "active" ||
        po.verification_status !== "verified"
      ) {
        const error = new Error("Supplier must remain verified and active before approval.");
        error.statusCode = 409;
        throw error;
      }

      await tx.query(
        `
          UPDATE commerce_purchase_orders
          SET
            status = 'approved',
            approved_by = 'admin',
            approved_at = now(),
            updated_at = now()
          WHERE tenant_id = $1 AND id = $2
        `,
        [tenantId, poId]
      );

      await recordOperationsAudit(tx, tenantId, {
        actorType: "admin",
        actorReference: "admin",
        action: "purchase_order.approved",
        entityType: "purchase_order",
        entityId: poId,
        summary: "Purchase order approved.",
        metadata: { previousStatus: po.status, nextStatus: "approved" }
      });

      return { id: poId, status: "approved" };
    });
  } finally {
    client.release();
  }
}

async function markPurchaseOrderSubmitted(poId) {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          UPDATE commerce_purchase_orders
          SET status = 'submitted', submitted_at = now(), updated_at = now()
          WHERE tenant_id = $1
            AND id = $2
            AND status = 'approved'
          RETURNING id
        `,
        [tenantId, poId]
      );

      if (result.rowCount === 0) {
        const error = new Error("Only approved purchase orders can be marked submitted.");
        error.statusCode = 409;
        throw error;
      }

      await recordOperationsAudit(tx, tenantId, {
        actorType: "admin",
        actorReference: "admin",
        action: "purchase_order.submitted",
        entityType: "purchase_order",
        entityId: poId,
        summary: "Purchase order marked submitted after external supplier submission.",
        metadata: { nextStatus: "submitted" }
      });

      return { id: poId, status: "submitted" };
    });
  } finally {
    client.release();
  }
}

async function receivePurchaseOrderItem(poId, itemId, input) {
  const receiveQuantity = Number(input?.quantity);

  if (!Number.isSafeInteger(receiveQuantity) || receiveQuantity < 1) {
    const error = new Error("Received quantity must be a positive whole number.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const itemResult = await tx.query(
        `
          SELECT
            i.id,
            i.purchase_order_id,
            i.tenant_catalogue_product_id,
            i.quantity,
            i.received_quantity,
            po.store_id,
            po.market_code,
            po.status
          FROM commerce_purchase_order_items i
          JOIN commerce_purchase_orders po
            ON po.tenant_id = i.tenant_id
           AND po.id = i.purchase_order_id
          WHERE i.tenant_id = $1
            AND i.id = $2
            AND i.purchase_order_id = $3
          FOR UPDATE
        `,
        [tenantId, itemId, poId]
      );

      if (itemResult.rowCount === 0) {
        const error = new Error("Purchase-order item not found.");
        error.statusCode = 404;
        throw error;
      }

      const item = itemResult.rows[0];

      if (!["approved", "submitted", "partially_received"].includes(item.status)) {
        const error = new Error("Purchase order is not in a receivable state.");
        error.statusCode = 409;
        throw error;
      }

      const remaining =
        Number(item.quantity) - Number(item.received_quantity);

      if (receiveQuantity > remaining) {
        const error = new Error("Received quantity exceeds the outstanding purchase-order quantity.");
        error.statusCode = 409;
        throw error;
      }

      const locationResult = await tx.query(
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
        [tenantId, item.store_id, item.market_code]
      );

      if (locationResult.rowCount === 0) {
        const error = new Error("Own-stock inventory location is not configured for this market.");
        error.statusCode = 409;
        throw error;
      }

      const locationId = locationResult.rows[0].id;

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
          VALUES ($1,$2,$3,0,0,0)
          ON CONFLICT (tenant_id, location_id, tenant_catalogue_product_id)
          DO NOTHING
        `,
        [tenantId, locationId, item.tenant_catalogue_product_id]
      );

      const levelResult = await tx.query(
        `
          SELECT id
          FROM commerce_inventory_levels
          WHERE tenant_id = $1
            AND location_id = $2
            AND tenant_catalogue_product_id = $3
          FOR UPDATE
        `,
        [tenantId, locationId, item.tenant_catalogue_product_id]
      );

      const levelId = levelResult.rows[0].id;

      await tx.query(
        `
          UPDATE commerce_inventory_levels
          SET on_hand = on_hand + $1, updated_at = now()
          WHERE tenant_id = $2 AND id = $3
        `,
        [receiveQuantity, tenantId, levelId]
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
          VALUES ($1,$2,'receipt',$3,0,'purchase_order',$4,$5,'admin')
        `,
        [
          tenantId,
          levelId,
          receiveQuantity,
          poId,
          "Received against approved supplier purchase order"
        ]
      );

      await tx.query(
        `
          UPDATE commerce_purchase_order_items
          SET received_quantity = received_quantity + $1, updated_at = now()
          WHERE tenant_id = $2 AND id = $3
        `,
        [receiveQuantity, tenantId, itemId]
      );

      const outstandingResult = await tx.query(
        `
          SELECT
            COALESCE(SUM(quantity - received_quantity), 0)::int AS outstanding
          FROM commerce_purchase_order_items
          WHERE tenant_id = $1
            AND purchase_order_id = $2
        `,
        [tenantId, poId]
      );

      const outstanding = Number(outstandingResult.rows[0]?.outstanding || 0);

      const nextPurchaseOrderStatus =
        outstanding === 0 ? "received" : "partially_received";

      await tx.query(
        `
          UPDATE commerce_purchase_orders
          SET
            status = $1,
            updated_at = now()
          WHERE tenant_id = $2 AND id = $3
        `,
        [nextPurchaseOrderStatus, tenantId, poId]
      );

      await recordOperationsAudit(tx, tenantId, {
        actorType: "admin",
        actorReference: "admin",
        action: "purchase_order.stock_received",
        entityType: "purchase_order",
        entityId: poId,
        marketCode: item.market_code,
        summary: `Received ${receiveQuantity} unit(s) against purchase order.`,
        metadata: {
          itemId,
          receivedQuantity: receiveQuantity,
          outstanding,
          nextStatus: nextPurchaseOrderStatus
        }
      });

      return {
        itemId,
        receivedNow: receiveQuantity,
        outstanding,
        purchaseOrderStatus: nextPurchaseOrderStatus
      };
    });
  } finally {
    client.release();
  }
}


async function ingestSupplierFeed(input) {
  const supplierId = String(input?.supplierId || "").trim();
  const sourceType = String(input?.sourceType || "manual").trim();
  const sourceReference = String(input?.sourceReference || "").trim().slice(0, 500) || null;
  const items = Array.isArray(input?.items) ? input.items : [];

  if (!/^[0-9a-f-]{36}$/i.test(supplierId)) {
    const error = new Error("A valid supplier id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!["manual","api","file","connector"].includes(sourceType)) {
    const error = new Error("Unsupported supplier feed source type.");
    error.statusCode = 400;
    throw error;
  }

  if (items.length < 1 || items.length > 100) {
    const error = new Error("Supplier feed must contain between 1 and 100 items.");
    error.statusCode = 400;
    throw error;
  }

  const payloadChecksum = crypto
    .createHash("sha256")
    .update(JSON.stringify(items))
    .digest("hex");

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const supplierResult = await tx.query(
        `
          SELECT id, market_code, verification_status, status
          FROM commerce_suppliers
          WHERE tenant_id = $1
            AND id = $2
          LIMIT 1
        `,
        [tenantId, supplierId]
      );

      if (supplierResult.rowCount === 0) {
        const error = new Error("Supplier not found.");
        error.statusCode = 404;
        throw error;
      }

      const supplier = supplierResult.rows[0];

      if (
        supplier.status !== "active" ||
        supplier.verification_status !== "verified"
      ) {
        const error = new Error("Only verified active suppliers can ingest product feeds.");
        error.statusCode = 409;
        throw error;
      }

      const expectedCurrency =
        supplier.market_code === "NG" ? "NGN" : "GBP";

      const existingBatch = await tx.query(
        `
          SELECT
            id,
            item_count,
            accepted_count,
            rejected_count,
            status,
            accepted_details,
            rejection_details,
            created_at
          FROM commerce_supplier_feed_batches
          WHERE tenant_id = $1
            AND supplier_id = $2
            AND payload_checksum = $3
          LIMIT 1
        `,
        [tenantId, supplierId, payloadChecksum]
      );

      if (existingBatch.rowCount > 0) {
        const row = existingBatch.rows[0];
        return {
          batchId: row.id,
          supplierId,
          duplicatePayload: true,
          itemCount: Number(row.item_count || 0),
          acceptedCount: Number(row.accepted_count || 0),
          rejectedCount: Number(row.rejected_count || 0),
          accepted: row.accepted_details || [],
          rejected: row.rejection_details || [],
          status: row.status,
          createdAt: row.created_at
        };
      }

      const batchResult = await tx.query(
        `
          INSERT INTO commerce_supplier_feed_batches (
            tenant_id,
            supplier_id,
            source_type,
            source_reference,
            item_count,
            accepted_count,
            rejected_count,
            status,
            payload_checksum
          )
          VALUES ($1,$2,$3,$4,$5,0,0,'processed',$6)
          RETURNING id
        `,
        [
          tenantId,
          supplierId,
          sourceType,
          sourceReference,
          items.length,
          payloadChecksum
        ]
      );

      const batchId = batchResult.rows[0].id;
      const accepted = [];
      const rejected = [];

      for (let index = 0; index < items.length; index += 1) {
        const raw = items[index] || {};
        const externalProductId = String(
          raw.externalProductId || raw.external_id || raw.id || ""
        ).trim();
        const supplierSku = String(raw.supplierSku || raw.sku || "").trim() || null;
        const name = String(raw.name || "").trim();
        const category = String(raw.category || "").trim();
        const description = String(raw.description || raw.desc || "").trim() || null;
        const imageUrl = String(raw.imageUrl || raw.image || "").trim() || null;
        const currency = String(raw.currency || expectedCurrency).trim().toUpperCase();
        const unitCost =
          raw.unitCost === null || raw.unitCost === undefined || raw.unitCost === ""
            ? null
            : Number(raw.unitCost);
        const minimumOrderQuantity = Number(raw.minimumOrderQuantity ?? raw.moq ?? 1);
        const leadTimeDays =
          raw.leadTimeDays === null ||
          raw.leadTimeDays === undefined ||
          raw.leadTimeDays === ""
            ? null
            : Number(raw.leadTimeDays);
        const stockStatus = String(raw.stockStatus || "unknown").trim();
        const externalStockQuantity =
          raw.externalStockQuantity === null ||
          raw.externalStockQuantity === undefined ||
          raw.externalStockQuantity === ""
            ? null
            : Number(raw.externalStockQuantity);

        const problems = [];

        if (!externalProductId) problems.push("externalProductId is required");
        if (!name) problems.push("name is required");
        if (!category) problems.push("category is required");
        if (currency !== expectedCurrency) {
          problems.push(`currency must be ${expectedCurrency}`);
        }
        if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
          problems.push("unitCost must be non-negative");
        }
        if (
          !Number.isSafeInteger(minimumOrderQuantity) ||
          minimumOrderQuantity < 1
        ) {
          problems.push("minimumOrderQuantity must be a positive whole number");
        }
        if (
          leadTimeDays !== null &&
          (!Number.isSafeInteger(leadTimeDays) || leadTimeDays < 0)
        ) {
          problems.push("leadTimeDays must be a non-negative whole number");
        }
        if (!["unknown","in_stock","limited","out_of_stock","preorder"].includes(stockStatus)) {
          problems.push("stockStatus is invalid");
        }
        if (
          externalStockQuantity !== null &&
          (!Number.isSafeInteger(externalStockQuantity) || externalStockQuantity < 0)
        ) {
          problems.push("externalStockQuantity must be a non-negative whole number");
        }

        if (problems.length > 0) {
          rejected.push({
            index,
            externalProductId: externalProductId || null,
            errors: problems
          });
          continue;
        }

        const candidateResult = await tx.query(
          `
            INSERT INTO commerce_product_discovery_candidates (
              tenant_id,
              supplier_id,
              feed_batch_id,
              external_product_id,
              supplier_sku,
              name,
              category,
              description,
              image_url,
              currency_code,
              unit_cost,
              minimum_order_quantity,
              lead_time_days,
              stock_status,
              external_stock_quantity,
              status,
              raw_payload
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
              'pending_review',$16::jsonb
            )
            ON CONFLICT (tenant_id, supplier_id, external_product_id)
            DO UPDATE SET
              feed_batch_id = EXCLUDED.feed_batch_id,
              supplier_sku = EXCLUDED.supplier_sku,
              name = EXCLUDED.name,
              category = EXCLUDED.category,
              description = EXCLUDED.description,
              image_url = EXCLUDED.image_url,
              currency_code = EXCLUDED.currency_code,
              unit_cost = EXCLUDED.unit_cost,
              minimum_order_quantity = EXCLUDED.minimum_order_quantity,
              lead_time_days = EXCLUDED.lead_time_days,
              stock_status = EXCLUDED.stock_status,
              external_stock_quantity = EXCLUDED.external_stock_quantity,
              raw_payload = EXCLUDED.raw_payload,
              status = CASE
                WHEN commerce_product_discovery_candidates.status = 'approved'
                  THEN 'approved'
                ELSE 'pending_review'
              END,
              updated_at = now()
            RETURNING id, status
          `,
          [
            tenantId,
            supplierId,
            batchId,
            externalProductId,
            supplierSku,
            name,
            category,
            description,
            imageUrl,
            currency,
            unitCost,
            minimumOrderQuantity,
            leadTimeDays,
            stockStatus,
            externalStockQuantity,
            JSON.stringify(raw)
          ]
        );

        accepted.push({
          id: candidateResult.rows[0].id,
          externalProductId,
          status: candidateResult.rows[0].status
        });
      }

      await tx.query(
        `
          UPDATE commerce_supplier_feed_batches
          SET
            accepted_count = $1,
            rejected_count = $2,
            status = $3,
            accepted_details = $4::jsonb,
            rejection_details = $5::jsonb
          WHERE tenant_id = $6
            AND id = $7
        `,
        [
          accepted.length,
          rejected.length,
          rejected.length === 0
            ? "processed"
            : accepted.length === 0
              ? "failed"
              : "partial",
          JSON.stringify(accepted),
          JSON.stringify(rejected),
          tenantId,
          batchId
        ]
      );

      return {
        batchId,
        supplierId,
        itemCount: items.length,
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        accepted,
        rejected,
        duplicatePayload: false
      };
    });
  } finally {
    client.release();
  }
}

async function listSupplierFeedBatches() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            b.id,
            b.supplier_id,
            b.source_type,
            b.source_reference,
            b.item_count,
            b.accepted_count,
            b.rejected_count,
            b.status,
            b.payload_checksum,
            b.accepted_details,
            b.rejection_details,
            b.created_at,
            s.name AS supplier_name,
            s.market_code
          FROM commerce_supplier_feed_batches b
          JOIN commerce_suppliers s
            ON s.tenant_id = b.tenant_id
           AND s.id = b.supplier_id
          WHERE b.tenant_id = $1
          ORDER BY b.created_at DESC
          LIMIT 100
        `,
        [tenantId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        marketCode: row.market_code,
        sourceType: row.source_type,
        sourceReference: row.source_reference,
        itemCount: Number(row.item_count || 0),
        acceptedCount: Number(row.accepted_count || 0),
        rejectedCount: Number(row.rejected_count || 0),
        status: row.status,
        payloadChecksum: row.payload_checksum,
        acceptedDetails: row.accepted_details || [],
        rejectionDetails: row.rejection_details || [],
        createdAt: row.created_at
      }));
    });
  } finally {
    client.release();
  }
}


async function listDiscoveryCandidates(status = "pending_review") {
  const allowedStatuses = new Set(["pending_review","approved","rejected","all"]);
  const normalizedStatus = String(status || "pending_review").trim();

  if (!allowedStatuses.has(normalizedStatus)) {
    const error = new Error("Unsupported discovery status.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const params = [tenantId];
      let filter = "";

      if (normalizedStatus !== "all") {
        params.push(normalizedStatus);
        filter = "AND c.status = $2";
      }

      const result = await tx.query(
        `
          SELECT
            c.id,
            c.external_product_id,
            c.supplier_sku,
            c.name,
            c.category,
            c.description,
            c.image_url,
            c.currency_code,
            c.unit_cost,
            c.minimum_order_quantity,
            c.lead_time_days,
            c.stock_status,
            c.external_stock_quantity,
            c.status,
            c.review_note,
            c.approved_product_id,
            c.approved_at,
            c.rejected_at,
            c.created_at,
            c.updated_at,
            s.id AS supplier_id,
            s.name AS supplier_name,
            s.market_code,
            dup.product_id AS potential_duplicate_product_id,
            dup.product_name AS potential_duplicate_product_name,
            dup.match_type AS potential_duplicate_match_type
          FROM commerce_product_discovery_candidates c
          JOIN commerce_suppliers s
            ON s.tenant_id = c.tenant_id
           AND s.id = c.supplier_id
          LEFT JOIN LATERAL (
            SELECT
              cp.id AS product_id,
              cp.name AS product_name,
              CASE
                WHEN c.supplier_sku IS NOT NULL
                 AND so.supplier_sku = c.supplier_sku
                 AND so.supplier_id = c.supplier_id
                  THEN 'supplier_sku'
                ELSE 'name'
              END AS match_type
            FROM tenant_catalogue_products tcp
            JOIN catalogue_products cp
              ON cp.id = tcp.product_id
            LEFT JOIN commerce_supplier_offers so
              ON so.tenant_id = tcp.tenant_id
             AND so.tenant_catalogue_product_id = tcp.id
            WHERE tcp.tenant_id = c.tenant_id
              AND tcp.status <> 'archived'
              AND (
                lower(cp.name) = lower(c.name)
                OR (
                  c.supplier_sku IS NOT NULL
                  AND so.supplier_id = c.supplier_id
                  AND so.supplier_sku = c.supplier_sku
                )
              )
            ORDER BY
              CASE
                WHEN c.supplier_sku IS NOT NULL
                 AND so.supplier_sku = c.supplier_sku
                 AND so.supplier_id = c.supplier_id
                  THEN 0
                ELSE 1
              END,
              tcp.updated_at DESC
            LIMIT 1
          ) dup ON true
          WHERE c.tenant_id = $1
            ${filter}
          ORDER BY c.updated_at DESC
          LIMIT 500
        `,
        params
      );

      return result.rows.map((row) => ({
        id: row.id,
        externalProductId: row.external_product_id,
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        supplierSku: row.supplier_sku,
        marketCode: row.market_code,
        name: row.name,
        category: row.category,
        description: row.description,
        imageUrl: row.image_url,
        currency: row.currency_code,
        unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
        minimumOrderQuantity: Number(row.minimum_order_quantity),
        leadTimeDays:
          row.lead_time_days === null ? null : Number(row.lead_time_days),
        stockStatus: row.stock_status,
        externalStockQuantity:
          row.external_stock_quantity === null
            ? null
            : Number(row.external_stock_quantity),
        status: row.status,
        reviewNote: row.review_note,
        approvedProductId: row.approved_product_id,
        approvedAt: row.approved_at,
        rejectedAt: row.rejected_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        qualityFlags: [
          ...(row.image_url ? [] : ["missing_image"]),
          ...(row.unit_cost === null ? ["missing_unit_cost"] : []),
          ...(row.stock_status === "unknown" ? ["unknown_stock"] : []),
          ...(row.stock_status === "out_of_stock" ? ["out_of_stock"] : []),
          ...(row.potential_duplicate_product_id ? ["potential_duplicate"] : [])
        ],
        potentialDuplicate: row.potential_duplicate_product_id
          ? {
              productId: row.potential_duplicate_product_id,
              productName: row.potential_duplicate_product_name,
              matchType: row.potential_duplicate_match_type
            }
          : null
      }));
    });
  } finally {
    client.release();
  }
}

async function approveDiscoveryCandidate(candidateId, input) {
  if (!/^[0-9a-f-]{36}$/i.test(String(candidateId || ""))) {
    const error = new Error("A valid discovery candidate id is required.");
    error.statusCode = 400;
    throw error;
  }

  const customerPrice = Number(input?.customerPrice);
  const reviewNote = String(input?.reviewNote || "").trim().slice(0, 1000) || null;
  const confirmDuplicateReview = input?.confirmDuplicateReview === true;

  if (!Number.isFinite(customerPrice) || customerPrice < 0) {
    const error = new Error("An explicit non-negative customer price is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const candidateResult = await tx.query(
        `
          SELECT
            c.*,
            s.store_id,
            s.market_code,
            s.status AS supplier_status,
            s.verification_status
          FROM commerce_product_discovery_candidates c
          JOIN commerce_suppliers s
            ON s.tenant_id = c.tenant_id
           AND s.id = c.supplier_id
          WHERE c.tenant_id = $1
            AND c.id = $2
          FOR UPDATE
        `,
        [tenantId, candidateId]
      );

      if (candidateResult.rowCount === 0) {
        const error = new Error("Discovery candidate not found.");
        error.statusCode = 404;
        throw error;
      }

      const candidate = candidateResult.rows[0];

      if (candidate.status !== "pending_review") {
        const error = new Error("Only pending discovery candidates can be approved.");
        error.statusCode = 409;
        throw error;
      }

      if (
        candidate.supplier_status !== "active" ||
        candidate.verification_status !== "verified"
      ) {
        const error = new Error("Supplier must remain verified and active before approval.");
        error.statusCode = 409;
        throw error;
      }

      const duplicateResult = await tx.query(
        `
          SELECT
            cp.id AS product_id,
            cp.name AS product_name,
            CASE
              WHEN $4::text IS NOT NULL
               AND so.supplier_sku = $4
               AND so.supplier_id = $3
                THEN 'supplier_sku'
              ELSE 'name'
            END AS match_type
          FROM tenant_catalogue_products tcp
          JOIN catalogue_products cp
            ON cp.id = tcp.product_id
          LEFT JOIN commerce_supplier_offers so
            ON so.tenant_id = tcp.tenant_id
           AND so.tenant_catalogue_product_id = tcp.id
          WHERE tcp.tenant_id = $1
            AND tcp.status <> 'archived'
            AND (
              lower(cp.name) = lower($2)
              OR (
                $4::text IS NOT NULL
                AND so.supplier_id = $3
                AND so.supplier_sku = $4
              )
            )
          ORDER BY
            CASE
              WHEN $4::text IS NOT NULL
               AND so.supplier_sku = $4
               AND so.supplier_id = $3
                THEN 0
              ELSE 1
            END,
            tcp.updated_at DESC
          LIMIT 1
        `,
        [
          tenantId,
          candidate.name,
          candidate.supplier_id,
          candidate.supplier_sku
        ]
      );

      if (duplicateResult.rowCount > 0) {
        if (!confirmDuplicateReview) {
          const duplicate = duplicateResult.rows[0];
          const error = new Error(
            `Potential duplicate detected: ${duplicate.product_name} (${duplicate.match_type}). Confirm duplicate review before approval.`
          );
          error.statusCode = 409;
          throw error;
        }

        if (!reviewNote) {
          const error = new Error(
            "A review note is required when approving a potential duplicate."
          );
          error.statusCode = 400;
          throw error;
        }
      }

      const canonicalCode =
        `DISC-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
      const slugBase = slugify(candidate.name) || "product";
      const slug =
        `${slugBase}-${crypto.randomBytes(3).toString("hex")}`;

      const { image, imageRights } = reviewSupplierImage(candidate, input);
      const attributes = {
        category: candidate.category,
        image,
        ...(imageRights ? { imageRights } : {}),
        desc: candidate.description || "",
        longDesc: candidate.description || "",
        discoverySource: "supplier_feed",
        discoveryCandidateId: candidate.id,
        supplierExternalProductId: candidate.external_product_id
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
          VALUES ($1,$2,$3,'ZAYVI',$4,'active',$5::jsonb)
          RETURNING id
        `,
        [
          canonicalCode,
          slug,
          candidate.name,
          candidate.category,
          JSON.stringify(attributes)
        ]
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
          VALUES ($1,$2,$3,$4,'active','{}'::jsonb)
          RETURNING id
        `,
        [
          tenantId,
          candidate.store_id,
          canonical.rows[0].id,
          canonicalCode
        ]
      );

      const targetCurrency =
        candidate.market_code === "NG" ? "NGN" : "GBP";

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
            $1,$2,$3,
            CASE WHEN $4 IN ('in_stock','limited') THEN 'available' ELSE 'unknown' END,
            'pending',
            'pending_review',
            true,
            $5,
            $6,
            now()
          )
        `,
        [
          tenantId,
          tenantProduct.rows[0].id,
          candidate.market_code,
          candidate.stock_status,
          customerPrice,
          targetCurrency
        ]
      );

      const otherMarket = candidate.market_code === "NG" ? "GB" : "NG";
      const otherCurrency = otherMarket === "NG" ? "NGN" : "GBP";

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
            currency_code
          )
          VALUES (
            $1,$2,$3,'unknown','not_assessed','not_listed',true,NULL,$4
          )
          ON CONFLICT (tenant_id, tenant_catalogue_product_id, market_code)
          DO NOTHING
        `,
        [
          tenantId,
          tenantProduct.rows[0].id,
          otherMarket,
          otherCurrency
        ]
      );

      await tx.query(
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
            status,
            metadata
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),'active',$11::jsonb
          )
          ON CONFLICT (tenant_id, supplier_id, tenant_catalogue_product_id)
          DO NOTHING
        `,
        [
          tenantId,
          candidate.supplier_id,
          tenantProduct.rows[0].id,
          candidate.supplier_sku,
          candidate.currency_code,
          candidate.unit_cost,
          candidate.minimum_order_quantity,
          candidate.lead_time_days,
          candidate.stock_status,
          candidate.external_stock_quantity,
          JSON.stringify({
            discoveryCandidateId: candidate.id,
            externalProductId: candidate.external_product_id
          })
        ]
      );

      await tx.query(
        `
          UPDATE commerce_product_discovery_candidates
          SET
            status = 'approved',
            review_note = $1,
            approved_product_id = $2,
            approved_at = now(),
            updated_at = now()
          WHERE tenant_id = $3 AND id = $4
        `,
        [reviewNote, canonical.rows[0].id, tenantId, candidateId]
      );

      await recordOperationsAudit(tx, tenantId, {
        actorType: "admin",
        actorReference: "admin",
        action: "discovery.approved",
        entityType: "discovery_candidate",
        entityId: candidateId,
        marketCode: candidate.market_code,
        summary: `Discovery candidate approved: ${candidate.name}.`,
        metadata: {
          productId: canonical.rows[0].id,
          tenantProductId: tenantProduct.rows[0].id,
          customerPrice,
          currency: targetCurrency,
          reviewNote,
          duplicateReviewConfirmed: confirmDuplicateReview,
          ...(imageRights ? { imageRights } : {})
        }
      });

      return {
        candidateId,
        productId: canonical.rows[0].id,
        tenantProductId: tenantProduct.rows[0].id,
        canonicalCode,
        customerPrice,
        currency: targetCurrency,
        publicationStatus: "pending_review"
      };
    });
  } finally {
    client.release();
  }
}

async function rejectDiscoveryCandidate(candidateId, input) {
  const reviewNote = String(input?.reviewNote || "").trim().slice(0, 1000);

  if (!reviewNote) {
    const error = new Error("A review note is required when rejecting a discovery candidate.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          UPDATE commerce_product_discovery_candidates
          SET
            status = 'rejected',
            review_note = $1,
            rejected_at = now(),
            updated_at = now()
          WHERE tenant_id = $2
            AND id = $3
            AND status = 'pending_review'
          RETURNING id
        `,
        [reviewNote, tenantId, candidateId]
      );

      if (result.rowCount === 0) {
        const error = new Error("Only pending discovery candidates can be rejected.");
        error.statusCode = 409;
        throw error;
      }

      await recordOperationsAudit(tx, tenantId, {
        actorType: "admin",
        actorReference: "admin",
        action: "discovery.rejected",
        entityType: "discovery_candidate",
        entityId: candidateId,
        summary: "Discovery candidate rejected.",
        metadata: { reviewNote }
      });

      return { candidateId, status: "rejected", reviewNote };
    });
  } finally {
    client.release();
  }
}


const schemaMigrationDefinitions = [
  { name: "0002_storefront_theme_versions.sql", feature: "Theme version storage", description: "Immutable store theme versions.", probe: {type:"table",table:"store_theme_versions"} },
  {
    name: "0011_inventory_ledger.sql",
    feature: "Inventory",
    description: "Owned-stock locations, balances and movement ledger.",
    probe: { type: "table", table: "commerce_inventory_levels" }
  },
  {
    name: "0012_supplier_registry.sql",
    feature: "Suppliers",
    description: "Supplier registry and supplier product offers.",
    probe: { type: "table", table: "commerce_suppliers" }
  },
  {
    name: "0013_fulfilment_planning.sql",
    feature: "Fulfilment planning",
    description: "Human-approved fulfilment plans and stock reservations.",
    probe: { type: "table", table: "commerce_fulfilment_plans" }
  },
  {
    name: "0014_fulfilment_execution.sql",
    feature: "Fulfilment execution",
    description: "Dispatch, delivery and owned-stock consumption.",
    probe: {
      type: "column",
      table: "commerce_fulfilment_allocations",
      column: "execution_status"
    }
  },
  {
    name: "0015_supplier_verification_audit.sql",
    feature: "Supplier verification",
    description: "Auditable supplier review and verification history.",
    probe: { type: "table", table: "commerce_supplier_verification_events" }
  },
  {
    name: "0016_purchase_orders.sql",
    feature: "Purchase orders",
    description: "Supplier purchase orders and inventory receiving.",
    probe: { type: "table", table: "commerce_purchase_orders" }
  },
  {
    name: "0017_supplier_feed_discovery.sql",
    feature: "Product discovery",
    description: "Supplier-feed batches and discovery review candidates.",
    probe: { type: "table", table: "commerce_product_discovery_candidates" }
  },
  {
    name: "0018_supplier_feed_observability.sql",
    feature: "Feed observability",
    description: "Supplier-feed replay protection and durable batch history.",
    probe: {
      type: "column",
      table: "commerce_supplier_feed_batches",
      column: "payload_checksum"
    }
  },
  {
    name: "0019_vendor_portal_access.sql",
    feature: "Vendor portal",
    description: "Invite-only supplier users and supplier-scoped portal access.",
    probe: { type: "table", table: "commerce_supplier_users" }
  },
  {
    name: "0020_supplier_api_credentials.sql",
    feature: "Supplier API",
    description: "Revocable machine credentials for supplier feed automation.",
    probe: { type: "table", table: "commerce_supplier_api_credentials" }
  },
  {
    name: "0021_supplier_inventory_sync.sql",
    feature: "Supplier inventory sync",
    description: "Auditable supplier stock snapshots with stale-update protection.",
    probe: { type: "table", table: "commerce_supplier_inventory_sync_runs" }
  },
  {
    name: "0022_returns_reverse_inventory.sql",
    feature: "Returns",
    description: "Admin-reviewed returns, provider refund reconciliation and reverse inventory.",
    probe: { type: "table", table: "commerce_returns" }
  },
  {
    name: "0023_vendor_purchase_order_updates.sql",
    feature: "Vendor PO updates",
    description: "Supplier acknowledgements and shipment evidence for submitted purchase orders.",
    probe: { type: "table", table: "commerce_purchase_order_supplier_events" }
  },
  {
    name: "0024_operations_audit.sql",
    feature: "Operations audit",
    description: "Append-only cross-workflow audit evidence for critical commerce actions.",
    probe: { type: "table", table: "commerce_operations_audit_events" }
  },
  {
    name: deliveryMigration,
    feature: "Checkout delivery",
    description: "Delivery address snapshots and market shipping fees for Preview draft orders.",
    probe: { type: "column", table: "commerce_orders", column: "delivery_address" }
  },
  {
    name: contentMigration,
    feature: "Storefront publishing",
    description: "Market-specific page and article drafts with explicit publication.",
    probe: { type: "table", table: "commerce_storefront_content" }
  },
  {
    name: marketsMigration,
    feature: "Storefront markets",
    description: "Store-specific enabled countries, default market and country switcher.",
    probe: { type: "column", table: "stores", column: "storefront_market_codes" }
  },
  {
    name: socialLinksMigration,
    feature: "Storefront social links",
    description: "Seller-managed social profile links in the storefront footer.",
    probe: { type: "column", table: "stores", column: "storefront_social_links" }
  },
  {
    name: "0029_store_setup.sql", feature: "Store setup",
    description: "Account-backed business details and theme appearance preferences.",
    probe: { type: "column", table: "stores", column: "setup_profile" }
  },
  {
    name: "0030_theme_draft_access.sql", feature: "Store design versions",
    description: "Read and insert access to immutable tenant-scoped theme drafts.",
    probe: { type: "theme_draft_access" }
  }

];

async function probeSchemaMigration(client, definition) {
  if (definition.probe.type === "theme_draft_access") {
    const result = await client.query("SELECT CASE WHEN to_regclass('public.store_theme_versions') IS NULL THEN false ELSE has_table_privilege(current_user, 'public.store_theme_versions', 'SELECT') AND has_table_privilege(current_user, 'public.store_theme_versions', 'INSERT') END AS present");
    return Boolean(result.rows[0]?.present);
  }

  if (definition.probe.type === "table") {
    const result = await client.query(
      "SELECT to_regclass($1) AS relation",
      [`public.${definition.probe.table}`]
    );
    return Boolean(result.rows[0]?.relation);
  }

  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS present
    `,
    [definition.probe.table, definition.probe.column]
  );

  return Boolean(result.rows[0]?.present);
}

async function checkSchemaMigrations(requiredNames) {
  const client = await getPool().connect();

  try {
    const definitions = schemaMigrationDefinitions.filter((definition) =>
      requiredNames.includes(definition.name)
    );

    const pending = requiredNames.filter(name => !definitions.some(definition => definition.name === name));

    for (const definition of definitions) {
      const applied = await probeSchemaMigration(client, definition);
      if (!applied) pending.push(definition.name);
    }

    return {
      ready: pending.length === 0,
      pending
    };
  } finally {
    client.release();
  }
}

function requiredSchemaMigrationsForRoute(routePath) {
  if (routePath.endsWith("/theme-drafts")) return ["0002_storefront_theme_versions.sql", "0030_theme_draft_access.sql"];
  if (routePath.endsWith("/store-setup")) return ["0029_store_setup.sql"];

  if (routePath.endsWith("/storefront-social-links")) {
    return [socialLinksMigration];
  }

  if (routePath.endsWith("/storefront-market-settings")) {
    return [marketsMigration];
  }

  if (/\/(store-content|published-content)$/.test(routePath)) {
    return [contentMigration];
  }

  if (routePath.endsWith("/delivery-settings")) {
    return [deliveryMigration];
  }

  if (routePath.endsWith("/inventory") || routePath.endsWith("/inventory/adjust")) {
    return ["0011_inventory_ledger.sql"];
  }

  if (/\/suppliers\/[0-9a-f-]{36}\/verification-events$/i.test(routePath)) {
    return [
      "0012_supplier_registry.sql",
      "0015_supplier_verification_audit.sql"
    ];
  }

  if (/\/suppliers\/[0-9a-f-]{36}\/verification$/i.test(routePath)) {
    return [
      "0012_supplier_registry.sql",
      "0015_supplier_verification_audit.sql",
      "0024_operations_audit.sql"
    ];
  }

  if (
    routePath.endsWith("/suppliers") ||
    routePath.endsWith("/supplier-offers")
  ) {
    return ["0012_supplier_registry.sql"];
  }

  if (routePath.endsWith("/operations-audit")) {
    return ["0024_operations_audit.sql"];
  }

  if (routePath.endsWith("/operations-inbox")) {
    return [
      "0012_supplier_registry.sql",
      "0015_supplier_verification_audit.sql",
      "0016_purchase_orders.sql",
      "0017_supplier_feed_discovery.sql",
      "0022_returns_reverse_inventory.sql",
      "0023_vendor_purchase_order_updates.sql"
    ];
  }

  if (routePath.endsWith("/supplier-performance")) {
    return [
      "0012_supplier_registry.sql",
      "0016_purchase_orders.sql",
      "0017_supplier_feed_discovery.sql",
      "0018_supplier_feed_observability.sql",
      "0019_vendor_portal_access.sql",
      "0021_supplier_inventory_sync.sql",
      "0023_vendor_purchase_order_updates.sql"
    ];
  }

  if (routePath.endsWith("/sourcing") || routePath.endsWith("/replenishment")) {
    return [
      "0011_inventory_ledger.sql",
      "0012_supplier_registry.sql"
    ];
  }

  if (/\/vendor-portal\/purchase-orders\/[0-9a-f-]{36}$/i.test(routePath)) {
    return [
      "0012_supplier_registry.sql",
      "0016_purchase_orders.sql",
      "0019_vendor_portal_access.sql",
      "0023_vendor_purchase_order_updates.sql",
      "0024_operations_audit.sql"
    ];
  }

  if (routePath.endsWith("/vendor-portal/purchase-orders")) {
    return [
      "0012_supplier_registry.sql",
      "0016_purchase_orders.sql",
      "0019_vendor_portal_access.sql",
      "0023_vendor_purchase_order_updates.sql"
    ];
  }

  if (
    /\/purchase-orders\/[0-9a-f-]{36}\/(approve|submitted)$/i.test(routePath) ||
    /\/purchase-orders\/[0-9a-f-]{36}\/items\/[0-9a-f-]{36}\/receive$/i.test(routePath)
  ) {
    return [
      "0011_inventory_ledger.sql",
      "0012_supplier_registry.sql",
      "0016_purchase_orders.sql",
      "0024_operations_audit.sql"
    ];
  }

  if (routePath.includes("/purchase-orders")) {
    return [
      "0011_inventory_ledger.sql",
      "0012_supplier_registry.sql",
      "0016_purchase_orders.sql"
    ];
  }

  if (routePath.endsWith("/supplier-feed/batches")) {
    return [
      "0012_supplier_registry.sql",
      "0017_supplier_feed_discovery.sql",
      "0018_supplier_feed_observability.sql"
    ];
  }

  if (/\/discovery-candidates\/[0-9a-f-]{36}\/(approve|approve-with-image-review|reject)$/i.test(routePath)) {
    return [
      "0012_supplier_registry.sql",
      "0017_supplier_feed_discovery.sql",
      "0024_operations_audit.sql"
    ];
  }

  if (
    routePath.endsWith("/supplier-feed/ingest") ||
    routePath.endsWith("/discovery-candidates")
  ) {
    return [
      "0012_supplier_registry.sql",
      "0017_supplier_feed_discovery.sql"
    ];
  }

  if (/\/orders\/[0-9a-f-]{36}\/fulfilment-plan\/allocations\/[0-9a-f-]{36}\/execution$/i.test(routePath)) {
    return [
      "0011_inventory_ledger.sql",
      "0012_supplier_registry.sql",
      "0013_fulfilment_planning.sql",
      "0014_fulfilment_execution.sql"
    ];
  }

  if (/\/orders\/[0-9a-f-]{36}\/fulfilment-plan/i.test(routePath)) {
    return [
      "0011_inventory_ledger.sql",
      "0012_supplier_registry.sql",
      "0013_fulfilment_planning.sql"
    ];
  }

  if (routePath.includes("/returns")) {
    return [
      "0011_inventory_ledger.sql",
      "0022_returns_reverse_inventory.sql",
      "0024_operations_audit.sql"
    ];
  }

  if (
    routePath.endsWith("/vendor-portal/feed") ||
    routePath.endsWith("/vendor-portal/feed-history")
  ) {
    return [
      "0012_supplier_registry.sql",
      "0017_supplier_feed_discovery.sql",
      "0018_supplier_feed_observability.sql",
      "0019_vendor_portal_access.sql"
    ];
  }

  if (
    routePath.endsWith("/supplier-api/inventory-sync") ||
    routePath.endsWith("/supplier-inventory-sync-runs")
  ) {
    return [
      "0012_supplier_registry.sql",
      "0020_supplier_api_credentials.sql",
      "0021_supplier_inventory_sync.sql"
    ];
  }

  if (
    routePath.includes("/supplier-api-credentials") ||
    routePath.endsWith("/supplier-api/ingest")
  ) {
    return [
      "0012_supplier_registry.sql",
      "0017_supplier_feed_discovery.sql",
      "0018_supplier_feed_observability.sql",
      "0020_supplier_api_credentials.sql"
    ];
  }

  if (
    routePath.includes("/supplier-users") ||
    routePath.includes("/vendor-portal")
  ) {
    return [
      "0012_supplier_registry.sql",
      "0019_vendor_portal_access.sql"
    ];
  }

  return [];
}

async function getSystemReadiness() {
  const client = await getPool().connect();

  try {
    const mapped = [];

    for (const definition of schemaMigrationDefinitions) {
      const applied = await probeSchemaMigration(client, definition);
      mapped.push({
        name: definition.name,
        feature: definition.feature,
        description: definition.description,
        applied,
        appliedAt: null
      });
    }

    const appliedCount = mapped.filter((migration) => migration.applied).length;
    const readyNames = mapped
      .filter((migration) => migration.applied)
      .map((migration) => migration.name);

    return {
      readinessSource: "schema_markers",
      allReady: appliedCount === mapped.length,
      appliedCount,
      pendingCount: mapped.length - appliedCount,
      requiredMigrations: mapped,
      latestAppliedMigration:
        readyNames.length > 0 ? readyNames[readyNames.length - 1] : null
    };
  } finally {
    client.release();
  }
}


async function listSupplierUsers(supplierId) {
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
            u.id,
            u.supplier_id,
            u.email,
            u.display_name,
            u.role,
            u.status,
            u.invite_expires_at,
            u.activated_at,
            u.last_login_at,
            u.revoked_at,
            u.created_at,
            u.updated_at
          FROM commerce_supplier_users u
          WHERE u.tenant_id = $1
            AND u.supplier_id = $2
          ORDER BY u.created_at ASC
        `,
        [tenantId, supplierId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        supplierId: row.supplier_id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        status: row.status,
        inviteExpiresAt: row.invite_expires_at,
        activatedAt: row.activated_at,
        lastLoginAt: row.last_login_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    });
  } finally {
    client.release();
  }
}

async function createSupplierUserInvite(input) {
  const supplierId = String(input?.supplierId || "").trim();
  const email = String(input?.email || "").trim().toLowerCase();
  const displayName = String(input?.displayName || "").trim().slice(0, 160) || null;
  const role = String(input?.role || "editor").trim();
  const inviteTokenHash = String(input?.inviteTokenHash || "").trim();
  const inviteExpiresAt = input?.inviteExpiresAt
    ? new Date(input.inviteExpiresAt)
    : null;

  if (!/^[0-9a-f-]{36}$/i.test(supplierId)) {
    const error = new Error("A valid supplier id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("A valid vendor email is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!["owner", "editor", "viewer"].includes(role)) {
    const error = new Error("Unsupported vendor role.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^[a-f0-9]{64}$/i.test(inviteTokenHash)) {
    const error = new Error("A valid invite token hash is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!inviteExpiresAt || Number.isNaN(inviteExpiresAt.getTime())) {
    const error = new Error("A valid invite expiry is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const supplierResult = await tx.query(
        `
          SELECT id, name, status
          FROM commerce_suppliers
          WHERE tenant_id = $1
            AND id = $2
          LIMIT 1
        `,
        [tenantId, supplierId]
      );

      if (supplierResult.rowCount === 0) {
        const error = new Error("Supplier not found.");
        error.statusCode = 404;
        throw error;
      }

      if (supplierResult.rows[0].status === "archived") {
        const error = new Error("Archived suppliers cannot receive portal invitations.");
        error.statusCode = 409;
        throw error;
      }

      const result = await tx.query(
        `
          INSERT INTO commerce_supplier_users (
            tenant_id,
            supplier_id,
            email,
            display_name,
            role,
            status,
            invite_token_hash,
            invite_expires_at
          )
          VALUES ($1,$2,$3,$4,$5,'invited',$6,$7)
          ON CONFLICT (tenant_id, supplier_id, email)
          DO UPDATE SET
            display_name = EXCLUDED.display_name,
            role = EXCLUDED.role,
            status = 'invited',
            invite_token_hash = EXCLUDED.invite_token_hash,
            invite_expires_at = EXCLUDED.invite_expires_at,
            activated_at = NULL,
            revoked_at = NULL,
            updated_at = now()
          RETURNING id, email, display_name, role, status, invite_expires_at
        `,
        [
          tenantId,
          supplierId,
          email,
          displayName,
          role,
          inviteTokenHash,
          inviteExpiresAt.toISOString()
        ]
      );

      return {
        ...result.rows[0],
        supplierId,
        supplierName: supplierResult.rows[0].name
      };
    });
  } finally {
    client.release();
  }
}

async function activateSupplierUserInvite(inviteTokenHash) {
  if (!/^[a-f0-9]{64}$/i.test(String(inviteTokenHash || ""))) {
    const error = new Error("A valid vendor invite token is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            u.id,
            u.supplier_id,
            u.email,
            u.display_name,
            u.role,
            u.status,
            u.invite_expires_at,
            s.name AS supplier_name,
            s.market_code,
            s.status AS supplier_status,
            s.verification_status
          FROM commerce_supplier_users u
          JOIN commerce_suppliers s
            ON s.tenant_id = u.tenant_id
           AND s.id = u.supplier_id
          WHERE u.tenant_id = $1
            AND u.invite_token_hash = $2
          FOR UPDATE
        `,
        [tenantId, inviteTokenHash]
      );

      if (result.rowCount === 0) {
        const error = new Error("Vendor invitation is invalid or has already been used.");
        error.statusCode = 404;
        throw error;
      }

      const user = result.rows[0];

      if (user.status !== "invited") {
        const error = new Error("Vendor invitation is no longer active.");
        error.statusCode = 409;
        throw error;
      }

      if (
        !user.invite_expires_at ||
        new Date(user.invite_expires_at).getTime() < Date.now()
      ) {
        const error = new Error("Vendor invitation has expired.");
        error.statusCode = 410;
        throw error;
      }

      if (user.supplier_status !== "active") {
        const error = new Error("Supplier account is not active.");
        error.statusCode = 409;
        throw error;
      }

      await tx.query(
        `
          UPDATE commerce_supplier_users
          SET
            status = 'active',
            invite_token_hash = NULL,
            invite_expires_at = NULL,
            activated_at = COALESCE(activated_at, now()),
            last_login_at = now(),
            updated_at = now()
          WHERE tenant_id = $1 AND id = $2
        `,
        [tenantId, user.id]
      );

      return {
        accountId: user.id,
        supplierId: user.supplier_id,
        supplierName: user.supplier_name,
        marketCode: user.market_code,
        verificationStatus: user.verification_status,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      };
    });
  } finally {
    client.release();
  }
}

async function revokeSupplierUser(accountId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(accountId || ""))) {
    const error = new Error("A valid supplier-user id is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          UPDATE commerce_supplier_users
          SET
            status = 'revoked',
            invite_token_hash = NULL,
            invite_expires_at = NULL,
            revoked_at = now(),
            updated_at = now()
          WHERE tenant_id = $1
            AND id = $2
            AND status <> 'revoked'
          RETURNING id, supplier_id, email
        `,
        [tenantId, accountId]
      );

      if (result.rowCount === 0) {
        const error = new Error("Active or invited supplier user not found.");
        error.statusCode = 404;
        throw error;
      }

      return {
        accountId: result.rows[0].id,
        supplierId: result.rows[0].supplier_id,
        email: result.rows[0].email,
        status: "revoked"
      };
    });
  } finally {
    client.release();
  }
}

async function getVendorPortalContext(accountId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(accountId || ""))) {
    const error = new Error("A valid vendor account id is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const accountResult = await tx.query(
        `
          SELECT
            u.id,
            u.supplier_id,
            u.email,
            u.display_name,
            u.role,
            u.status,
            s.name AS supplier_name,
            s.supplier_code,
            s.market_code,
            s.verification_status,
            s.status AS supplier_status
          FROM commerce_supplier_users u
          JOIN commerce_suppliers s
            ON s.tenant_id = u.tenant_id
           AND s.id = u.supplier_id
          WHERE u.tenant_id = $1
            AND u.id = $2
          LIMIT 1
        `,
        [tenantId, accountId]
      );

      if (accountResult.rowCount === 0 || accountResult.rows[0].status !== "active") {
        const error = new Error("Vendor session is no longer active.");
        error.statusCode = 401;
        throw error;
      }

      const account = accountResult.rows[0];

      if (account.supplier_status !== "active") {
        const error = new Error("Supplier account is paused or archived.");
        error.statusCode = 409;
        throw error;
      }

      const offersResult = await tx.query(
        `
          SELECT
            so.id,
            so.supplier_sku,
            so.currency_code,
            so.unit_cost,
            so.minimum_order_quantity,
            so.lead_time_days,
            so.stock_status,
            so.external_stock_quantity,
            so.source_updated_at,
            so.status,
            cp.name AS product_name,
            cp.canonical_code
          FROM commerce_supplier_offers so
          JOIN tenant_catalogue_products tcp
            ON tcp.tenant_id = so.tenant_id
           AND tcp.id = so.tenant_catalogue_product_id
          JOIN catalogue_products cp
            ON cp.id = tcp.product_id
          WHERE so.tenant_id = $1
            AND so.supplier_id = $2
            AND so.status <> 'archived'
          ORDER BY cp.name ASC
        `,
        [tenantId, account.supplier_id]
      );

      await tx.query(
        `
          UPDATE commerce_supplier_users
          SET last_login_at = now(), updated_at = now()
          WHERE tenant_id = $1 AND id = $2
        `,
        [tenantId, account.id]
      );

      return {
        account: {
          id: account.id,
          supplierId: account.supplier_id,
          supplierName: account.supplier_name,
          supplierCode: account.supplier_code,
          marketCode: account.market_code,
          verificationStatus: account.verification_status,
          email: account.email,
          displayName: account.display_name,
          role: account.role
        },
        offers: offersResult.rows.map((row) => ({
          id: row.id,
          supplierSku: row.supplier_sku,
          productName: row.product_name,
          canonicalCode: row.canonical_code,
          currency: row.currency_code,
          unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
          minimumOrderQuantity: Number(row.minimum_order_quantity),
          leadTimeDays:
            row.lead_time_days === null ? null : Number(row.lead_time_days),
          stockStatus: row.stock_status,
          externalStockQuantity:
            row.external_stock_quantity === null
              ? null
              : Number(row.external_stock_quantity),
          sourceUpdatedAt: row.source_updated_at,
          status: row.status
        }))
      };
    });
  } finally {
    client.release();
  }
}

async function updateVendorPortalOffer(accountId, offerId, input) {
  if (!/^[0-9a-f-]{36}$/i.test(String(accountId || ""))) {
    const error = new Error("A valid vendor account id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^[0-9a-f-]{36}$/i.test(String(offerId || ""))) {
    const error = new Error("A valid supplier offer id is required.");
    error.statusCode = 400;
    throw error;
  }

  const unitCost =
    input?.unitCost === null || input?.unitCost === undefined || input?.unitCost === ""
      ? null
      : Number(input.unitCost);
  const minimumOrderQuantity = Number(input?.minimumOrderQuantity ?? 1);
  const leadTimeDays =
    input?.leadTimeDays === null ||
    input?.leadTimeDays === undefined ||
    input?.leadTimeDays === ""
      ? null
      : Number(input.leadTimeDays);
  const stockStatus = String(input?.stockStatus || "unknown").trim();
  const externalStockQuantity =
    input?.externalStockQuantity === null ||
    input?.externalStockQuantity === undefined ||
    input?.externalStockQuantity === ""
      ? null
      : Number(input.externalStockQuantity);

  if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
    const error = new Error("Unit cost must be non-negative.");
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isSafeInteger(minimumOrderQuantity) || minimumOrderQuantity < 1) {
    const error = new Error("MOQ must be a positive whole number.");
    error.statusCode = 400;
    throw error;
  }

  if (
    leadTimeDays !== null &&
    (!Number.isSafeInteger(leadTimeDays) || leadTimeDays < 0)
  ) {
    const error = new Error("Lead time must be a non-negative whole number.");
    error.statusCode = 400;
    throw error;
  }

  if (!["unknown","in_stock","limited","out_of_stock","preorder"].includes(stockStatus)) {
    const error = new Error("Unsupported stock status.");
    error.statusCode = 400;
    throw error;
  }

  if (
    externalStockQuantity !== null &&
    (!Number.isSafeInteger(externalStockQuantity) || externalStockQuantity < 0)
  ) {
    const error = new Error("Stock quantity must be a non-negative whole number.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const accountResult = await tx.query(
        `
          SELECT id, supplier_id, role, status
          FROM commerce_supplier_users
          WHERE tenant_id = $1
            AND id = $2
          LIMIT 1
        `,
        [tenantId, accountId]
      );

      if (accountResult.rowCount === 0 || accountResult.rows[0].status !== "active") {
        const error = new Error("Vendor session is no longer active.");
        error.statusCode = 401;
        throw error;
      }

      const account = accountResult.rows[0];

      if (account.role === "viewer") {
        const error = new Error("Viewer accounts cannot change supplier offers.");
        error.statusCode = 403;
        throw error;
      }

      const result = await tx.query(
        `
          UPDATE commerce_supplier_offers
          SET
            unit_cost = $1,
            minimum_order_quantity = $2,
            lead_time_days = $3,
            stock_status = $4,
            external_stock_quantity = $5,
            source_updated_at = now(),
            updated_at = now()
          WHERE tenant_id = $6
            AND id = $7
            AND supplier_id = $8
            AND status = 'active'
          RETURNING
            id,
            unit_cost,
            minimum_order_quantity,
            lead_time_days,
            stock_status,
            external_stock_quantity,
            source_updated_at
        `,
        [
          unitCost,
          minimumOrderQuantity,
          leadTimeDays,
          stockStatus,
          externalStockQuantity,
          tenantId,
          offerId,
          account.supplier_id
        ]
      );

      if (result.rowCount === 0) {
        const error = new Error("Active supplier offer not found for this vendor.");
        error.statusCode = 404;
        throw error;
      }

      const row = result.rows[0];

      return {
        id: row.id,
        unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
        minimumOrderQuantity: Number(row.minimum_order_quantity),
        leadTimeDays:
          row.lead_time_days === null ? null : Number(row.lead_time_days),
        stockStatus: row.stock_status,
        externalStockQuantity:
          row.external_stock_quantity === null
            ? null
            : Number(row.external_stock_quantity),
        sourceUpdatedAt: row.source_updated_at
      };
    });
  } finally {
    client.release();
  }
}


async function resolveActiveVendorAccount(accountId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(accountId || ""))) {
    const error = new Error("A valid vendor account id is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            u.id,
            u.supplier_id,
            u.email,
            u.role,
            u.status,
            s.name AS supplier_name,
            s.market_code,
            s.status AS supplier_status,
            s.verification_status
          FROM commerce_supplier_users u
          JOIN commerce_suppliers s
            ON s.tenant_id = u.tenant_id
           AND s.id = u.supplier_id
          WHERE u.tenant_id = $1
            AND u.id = $2
          LIMIT 1
        `,
        [tenantId, accountId]
      );

      if (result.rowCount === 0 || result.rows[0].status !== "active") {
        const error = new Error("Vendor session is no longer active.");
        error.statusCode = 401;
        throw error;
      }

      const account = result.rows[0];

      if (account.supplier_status !== "active") {
        const error = new Error("Supplier account is paused or archived.");
        error.statusCode = 409;
        throw error;
      }

      return {
        accountId: account.id,
        supplierId: account.supplier_id,
        supplierName: account.supplier_name,
        marketCode: account.market_code,
        verificationStatus: account.verification_status,
        email: account.email,
        role: account.role
      };
    });
  } finally {
    client.release();
  }
}

async function submitVendorFeed(accountId, input) {
  const account = await resolveActiveVendorAccount(accountId);

  if (account.role === "viewer") {
    const error = new Error("Viewer accounts cannot submit supplier feeds.");
    error.statusCode = 403;
    throw error;
  }

  return ingestSupplierFeed({
    supplierId: account.supplierId,
    sourceType: input?.sourceType === "file" ? "file" : "manual",
    sourceReference:
      String(input?.sourceReference || "Vendor portal submission")
        .trim()
        .slice(0, 500) || "Vendor portal submission",
    items: Array.isArray(input?.items) ? input.items : []
  });
}

async function listVendorFeedHistory(accountId) {
  const account = await resolveActiveVendorAccount(accountId);
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            id,
            source_type,
            source_reference,
            item_count,
            accepted_count,
            rejected_count,
            status,
            accepted_details,
            rejection_details,
            created_at
          FROM commerce_supplier_feed_batches
          WHERE tenant_id = $1
            AND supplier_id = $2
          ORDER BY created_at DESC
          LIMIT 25
        `,
        [tenantId, account.supplierId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        sourceType: row.source_type,
        sourceReference: row.source_reference,
        itemCount: Number(row.item_count || 0),
        acceptedCount: Number(row.accepted_count || 0),
        rejectedCount: Number(row.rejected_count || 0),
        status: row.status,
        acceptedDetails: row.accepted_details || [],
        rejectionDetails: row.rejection_details || [],
        createdAt: row.created_at
      }));
    });
  } finally {
    client.release();
  }
}


async function listVendorPurchaseOrders(accountId) {
  const account = await resolveActiveVendorAccount(accountId);
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            po.id,
            po.po_number,
            po.market_code,
            po.currency_code,
            po.status,
            po.notes,
            po.submitted_at,
            po.supplier_ack_status,
            po.supplier_acknowledged_at,
            po.supplier_reference,
            po.supplier_update_note,
            po.latest_carrier,
            po.latest_tracking_number,
            po.latest_shipped_at,
            po.expected_delivery_at,
            po.created_at,
            po.updated_at,
            COUNT(i.id)::int AS line_count,
            COALESCE(SUM(i.quantity), 0)::int AS ordered_units,
            COALESCE(SUM(i.received_quantity), 0)::int AS received_units,
            COALESCE(SUM(i.quantity * i.unit_cost), 0)::numeric AS total_value
          FROM commerce_purchase_orders po
          LEFT JOIN commerce_purchase_order_items i
            ON i.tenant_id = po.tenant_id
           AND i.purchase_order_id = po.id
          WHERE po.tenant_id = $1
            AND po.supplier_id = $2
            AND po.status IN ('submitted','partially_received','received')
          GROUP BY po.id
          ORDER BY po.submitted_at DESC NULLS LAST, po.created_at DESC
          LIMIT 100
        `,
        [tenantId, account.supplierId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        poNumber: row.po_number,
        marketCode: row.market_code,
        currency: row.currency_code,
        status: row.status,
        notes: row.notes,
        lineCount: Number(row.line_count || 0),
        orderedUnits: Number(row.ordered_units || 0),
        receivedUnits: Number(row.received_units || 0),
        totalValue: Number(row.total_value || 0),
        submittedAt: row.submitted_at,
        supplierAckStatus: row.supplier_ack_status || "pending",
        supplierAcknowledgedAt: row.supplier_acknowledged_at,
        supplierReference: row.supplier_reference,
        supplierUpdateNote: row.supplier_update_note,
        latestCarrier: row.latest_carrier,
        latestTrackingNumber: row.latest_tracking_number,
        latestShippedAt: row.latest_shipped_at,
        expectedDeliveryAt: row.expected_delivery_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    });
  } finally {
    client.release();
  }
}

async function updateVendorPurchaseOrder(accountId, poId, input) {
  const account = await resolveActiveVendorAccount(accountId);

  if (account.role === "viewer") {
    const error = new Error("Viewer accounts cannot update purchase orders.");
    error.statusCode = 403;
    throw error;
  }

  if (!/^[0-9a-f-]{36}$/i.test(String(poId || ""))) {
    const error = new Error("A valid purchase-order id is required.");
    error.statusCode = 400;
    throw error;
  }

  const action = String(input?.action || "").trim();
  if (!["acknowledge","unable_to_fulfil","shipment"].includes(action)) {
    const error = new Error("Unsupported supplier purchase-order action.");
    error.statusCode = 400;
    throw error;
  }

  const supplierReference =
    String(input?.supplierReference || "").trim().slice(0, 200) || null;
  const note =
    String(input?.note || "").trim().slice(0, 1000) || null;
  const carrier =
    String(input?.carrier || "").trim().slice(0, 160) || null;
  const trackingNumber =
    String(input?.trackingNumber || "").trim().slice(0, 200) || null;

  let shippedAt = null;
  let expectedDeliveryAt = null;

  if (action === "shipment") {
    if (!carrier && !trackingNumber) {
      const error = new Error(
        "Shipment update requires a carrier or tracking number."
      );
      error.statusCode = 400;
      throw error;
    }

    shippedAt = input?.shippedAt ? new Date(input.shippedAt) : new Date();
    if (Number.isNaN(shippedAt.getTime())) {
      const error = new Error("Shipment date is invalid.");
      error.statusCode = 400;
      throw error;
    }

    if (shippedAt.getTime() > Date.now() + 10 * 60 * 1000) {
      const error = new Error("Shipment date cannot be in the future.");
      error.statusCode = 400;
      throw error;
    }

    if (input?.expectedDeliveryAt) {
      expectedDeliveryAt = new Date(input.expectedDeliveryAt);
      if (Number.isNaN(expectedDeliveryAt.getTime())) {
        const error = new Error("Expected delivery date is invalid.");
        error.statusCode = 400;
        throw error;
      }

      if (expectedDeliveryAt.getTime() < shippedAt.getTime()) {
        const error = new Error(
          "Expected delivery cannot be earlier than shipment."
        );
        error.statusCode = 400;
        throw error;
      }
    }
  }

  if (action === "unable_to_fulfil" && !note) {
    const error = new Error(
      "A note is required when a supplier cannot fulfil a purchase order."
    );
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const poResult = await tx.query(
        `
          SELECT
            id,
            supplier_id,
            status,
            supplier_ack_status
          FROM commerce_purchase_orders
          WHERE tenant_id = $1
            AND id = $2
            AND supplier_id = $3
          FOR UPDATE
        `,
        [tenantId, poId, account.supplierId]
      );

      if (poResult.rowCount === 0) {
        const error = new Error(
          "Purchase order not found for this supplier."
        );
        error.statusCode = 404;
        throw error;
      }

      const po = poResult.rows[0];

      if (!["submitted","partially_received"].includes(po.status)) {
        const error = new Error(
          "Only submitted or partially received purchase orders accept supplier updates."
        );
        error.statusCode = 409;
        throw error;
      }

      let eventType = null;

      if (action === "acknowledge") {
        eventType = "acknowledged";
        await tx.query(
          `
            UPDATE commerce_purchase_orders
            SET
              supplier_ack_status = 'acknowledged',
              supplier_acknowledged_at = now(),
              supplier_reference = COALESCE($1, supplier_reference),
              supplier_update_note = $2,
              updated_at = now()
            WHERE tenant_id = $3 AND id = $4
          `,
          [supplierReference, note, tenantId, poId]
        );
      }

      if (action === "unable_to_fulfil") {
        eventType = "unable_to_fulfil";
        await tx.query(
          `
            UPDATE commerce_purchase_orders
            SET
              supplier_ack_status = 'unable_to_fulfil',
              supplier_acknowledged_at = now(),
              supplier_reference = COALESCE($1, supplier_reference),
              supplier_update_note = $2,
              updated_at = now()
            WHERE tenant_id = $3 AND id = $4
          `,
          [supplierReference, note, tenantId, poId]
        );
      }

      if (action === "shipment") {
        if (po.supplier_ack_status !== "acknowledged") {
          const error = new Error(
            "Purchase order must be acknowledged before shipment can be reported."
          );
          error.statusCode = 409;
          throw error;
        }

        eventType = "shipment_update";
        await tx.query(
          `
            UPDATE commerce_purchase_orders
            SET
              supplier_reference = COALESCE($1, supplier_reference),
              supplier_update_note = COALESCE($2, supplier_update_note),
              latest_carrier = $3,
              latest_tracking_number = $4,
              latest_shipped_at = $5,
              expected_delivery_at = $6,
              updated_at = now()
            WHERE tenant_id = $7 AND id = $8
          `,
          [
            supplierReference,
            note,
            carrier,
            trackingNumber,
            shippedAt.toISOString(),
            expectedDeliveryAt ? expectedDeliveryAt.toISOString() : null,
            tenantId,
            poId
          ]
        );
      }

      await tx.query(
        `
          INSERT INTO commerce_purchase_order_supplier_events (
            tenant_id,
            purchase_order_id,
            supplier_id,
            supplier_user_id,
            event_type,
            supplier_reference,
            note,
            carrier,
            tracking_number,
            shipped_at,
            expected_delivery_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        `,
        [
          tenantId,
          poId,
          account.supplierId,
          account.accountId,
          eventType,
          supplierReference,
          note,
          carrier,
          trackingNumber,
          shippedAt ? shippedAt.toISOString() : null,
          expectedDeliveryAt ? expectedDeliveryAt.toISOString() : null
        ]
      );

      await recordOperationsAudit(tx, tenantId, {
        actorType: "vendor",
        actorReference: account.email,
        action: `purchase_order.vendor_${eventType}`,
        entityType: "purchase_order",
        entityId: poId,
        summary:
          eventType === "shipment_update"
            ? "Supplier reported a purchase-order shipment update."
            : eventType === "unable_to_fulfil"
              ? "Supplier reported inability to fulfil purchase order."
              : "Supplier acknowledged purchase order.",
        metadata: {
          supplierId: account.supplierId,
          supplierReference,
          note,
          carrier,
          trackingNumber,
          shippedAt: shippedAt ? shippedAt.toISOString() : null,
          expectedDeliveryAt: expectedDeliveryAt
            ? expectedDeliveryAt.toISOString()
            : null
        }
      });

      const updated = await tx.query(
        `
          SELECT
            id,
            po_number,
            status,
            supplier_ack_status,
            supplier_acknowledged_at,
            supplier_reference,
            supplier_update_note,
            latest_carrier,
            latest_tracking_number,
            latest_shipped_at,
            expected_delivery_at,
            updated_at
          FROM commerce_purchase_orders
          WHERE tenant_id = $1 AND id = $2
        `,
        [tenantId, poId]
      );

      const row = updated.rows[0];

      return {
        id: row.id,
        poNumber: row.po_number,
        status: row.status,
        supplierAckStatus: row.supplier_ack_status,
        supplierAcknowledgedAt: row.supplier_acknowledged_at,
        supplierReference: row.supplier_reference,
        supplierUpdateNote: row.supplier_update_note,
        latestCarrier: row.latest_carrier,
        latestTrackingNumber: row.latest_tracking_number,
        latestShippedAt: row.latest_shipped_at,
        expectedDeliveryAt: row.expected_delivery_at,
        updatedAt: row.updated_at,
        inventoryChanged: false,
        purchaseOrderStatusChanged: false
      };
    });
  } finally {
    client.release();
  }
}


async function listSupplierApiCredentials(supplierId) {
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
            id,
            supplier_id,
            label,
            key_prefix,
            scopes,
            status,
            expires_at,
            last_used_at,
            revoked_at,
            created_at,
            updated_at
          FROM commerce_supplier_api_credentials
          WHERE tenant_id = $1
            AND supplier_id = $2
          ORDER BY created_at DESC
        `,
        [tenantId, supplierId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        supplierId: row.supplier_id,
        label: row.label,
        keyPrefix: row.key_prefix,
        scopes: row.scopes || [],
        status: row.status,
        expiresAt: row.expires_at,
        lastUsedAt: row.last_used_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    });
  } finally {
    client.release();
  }
}

async function createSupplierApiCredential(input) {
  const supplierId = String(input?.supplierId || "").trim();
  const label = String(input?.label || "").trim().slice(0, 120);
  const keyPrefix = String(input?.keyPrefix || "").trim().slice(0, 32);
  const secretHash = String(input?.secretHash || "").trim();
  const expiresAt =
    input?.expiresAt === null || input?.expiresAt === undefined || input?.expiresAt === ""
      ? null
      : new Date(input.expiresAt);
  const requestedScopes = Array.isArray(input?.scopes)
    ? input.scopes.map((scope) => String(scope))
    : ["feed:write"];
  const allowedScopes = new Set(["feed:write", "inventory:write"]);
  const scopes = [...new Set(requestedScopes)].filter((scope) =>
    allowedScopes.has(scope)
  );

  if (!/^[0-9a-f-]{36}$/i.test(supplierId)) {
    const error = new Error("A valid supplier id is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!label) {
    const error = new Error("API credential label is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^zv_vendor_[A-Za-z0-9_-]{4,24}$/.test(keyPrefix)) {
    const error = new Error("A valid supplier API key prefix is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^[a-f0-9]{64}$/i.test(secretHash)) {
    const error = new Error("A valid supplier API secret hash is required.");
    error.statusCode = 400;
    throw error;
  }

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    const error = new Error("Supplier API credential expiry is invalid.");
    error.statusCode = 400;
    throw error;
  }

  if (scopes.length < 1 || scopes.length !== requestedScopes.length) {
    const error = new Error("Supplier API credential contains an unsupported scope.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const supplierResult = await tx.query(
        `
          SELECT id, name, status, verification_status
          FROM commerce_suppliers
          WHERE tenant_id = $1
            AND id = $2
          LIMIT 1
        `,
        [tenantId, supplierId]
      );

      if (supplierResult.rowCount === 0) {
        const error = new Error("Supplier not found.");
        error.statusCode = 404;
        throw error;
      }

      const supplier = supplierResult.rows[0];

      if (
        supplier.status !== "active" ||
        supplier.verification_status !== "verified"
      ) {
        const error = new Error(
          "Supplier API credentials can only be created for verified active suppliers."
        );
        error.statusCode = 409;
        throw error;
      }

      const result = await tx.query(
        `
          INSERT INTO commerce_supplier_api_credentials (
            tenant_id,
            supplier_id,
            label,
            key_prefix,
            secret_hash,
            scopes,
            status,
            expires_at
          )
          VALUES (
            $1,$2,$3,$4,$5,$6::text[],'active',$7
          )
          RETURNING
            id,
            supplier_id,
            label,
            key_prefix,
            scopes,
            status,
            expires_at,
            created_at
        `,
        [
          tenantId,
          supplierId,
          label,
          keyPrefix,
          secretHash,
          scopes,
          expiresAt ? expiresAt.toISOString() : null
        ]
      );

      const row = result.rows[0];

      return {
        id: row.id,
        supplierId: row.supplier_id,
        supplierName: supplier.name,
        label: row.label,
        keyPrefix: row.key_prefix,
        scopes: row.scopes || [],
        status: row.status,
        expiresAt: row.expires_at,
        createdAt: row.created_at
      };
    });
  } finally {
    client.release();
  }
}

async function revokeSupplierApiCredential(credentialId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(credentialId || ""))) {
    const error = new Error("A valid supplier API credential id is required.");
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          UPDATE commerce_supplier_api_credentials
          SET
            status = 'revoked',
            revoked_at = now(),
            updated_at = now()
          WHERE tenant_id = $1
            AND id = $2
            AND status = 'active'
          RETURNING id, supplier_id, label, key_prefix
        `,
        [tenantId, credentialId]
      );

      if (result.rowCount === 0) {
        const error = new Error("Active supplier API credential not found.");
        error.statusCode = 404;
        throw error;
      }

      return {
        id: result.rows[0].id,
        supplierId: result.rows[0].supplier_id,
        label: result.rows[0].label,
        keyPrefix: result.rows[0].key_prefix,
        status: "revoked"
      };
    });
  } finally {
    client.release();
  }
}

async function resolveSupplierApiCredential(secretHash, requiredScope) {
  if (!/^[a-f0-9]{64}$/i.test(String(secretHash || ""))) {
    const error = new Error("Supplier API credential is invalid.");
    error.statusCode = 401;
    throw error;
  }

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            c.id,
            c.supplier_id,
            c.scopes,
            c.status,
            c.expires_at,
            s.status AS supplier_status,
            s.verification_status
          FROM commerce_supplier_api_credentials c
          JOIN commerce_suppliers s
            ON s.tenant_id = c.tenant_id
           AND s.id = c.supplier_id
          WHERE c.tenant_id = $1
            AND c.secret_hash = $2
          FOR UPDATE
        `,
        [tenantId, secretHash]
      );

      if (result.rowCount === 0) {
        const error = new Error("Supplier API credential is invalid.");
        error.statusCode = 401;
        throw error;
      }

      const credential = result.rows[0];

      if (credential.status !== "active") {
        const error = new Error("Supplier API credential has been revoked.");
        error.statusCode = 401;
        throw error;
      }

      if (
        credential.expires_at &&
        new Date(credential.expires_at).getTime() < Date.now()
      ) {
        const error = new Error("Supplier API credential has expired.");
        error.statusCode = 401;
        throw error;
      }

      if (
        credential.supplier_status !== "active" ||
        credential.verification_status !== "verified"
      ) {
        const error = new Error("Supplier is not eligible for automated feed submission.");
        error.statusCode = 403;
        throw error;
      }

      if (!(credential.scopes || []).includes(requiredScope)) {
        const error = new Error(
          `Supplier API credential lacks ${requiredScope} scope.`
        );
        error.statusCode = 403;
        throw error;
      }

      await tx.query(
        `
          UPDATE commerce_supplier_api_credentials
          SET last_used_at = now(), updated_at = now()
          WHERE tenant_id = $1 AND id = $2
        `,
        [tenantId, credential.id]
      );

      return {
        credentialId: credential.id,
        supplierId: credential.supplier_id
      };
    });
  } finally {
    client.release();
  }
}

async function ingestSupplierApiFeed(secretHash, input) {
  const credential = await resolveSupplierApiCredential(secretHash, "feed:write");

  return ingestSupplierFeed({
    supplierId: credential.supplierId,
    sourceType: "api",
    sourceReference:
      String(input?.sourceReference || "Supplier API submission")
        .trim()
        .slice(0, 500) || "Supplier API submission",
    items: Array.isArray(input?.items) ? input.items : []
  });
}


async function synchronizeSupplierInventory(secretHash, input) {
  const credential = await resolveSupplierApiCredential(
    secretHash,
    "inventory:write"
  );

  const items = Array.isArray(input?.items) ? input.items : [];
  const sourceReference =
    String(input?.sourceReference || "Supplier inventory API sync")
      .trim()
      .slice(0, 500) || "Supplier inventory API sync";

  if (items.length < 1 || items.length > 500) {
    const error = new Error("Inventory sync must contain between 1 and 500 items.");
    error.statusCode = 400;
    throw error;
  }

  const normalized = items.map((raw, index) => {
    const supplierSku = String(raw?.supplierSku || raw?.sku || "").trim();
    const stockStatus = String(raw?.stockStatus || "unknown").trim();
    const externalStockQuantity =
      raw?.externalStockQuantity === null ||
      raw?.externalStockQuantity === undefined ||
      raw?.externalStockQuantity === ""
        ? null
        : Number(raw.externalStockQuantity);
    const observedAt = raw?.observedAt
      ? new Date(raw.observedAt)
      : new Date();

    if (!supplierSku) {
      const error = new Error(`Inventory item ${index + 1} requires supplierSku.`);
      error.statusCode = 400;
      throw error;
    }

    if (!["unknown","in_stock","limited","out_of_stock","preorder"].includes(stockStatus)) {
      const error = new Error(`Inventory item ${index + 1} has invalid stockStatus.`);
      error.statusCode = 400;
      throw error;
    }

    if (
      externalStockQuantity !== null &&
      (!Number.isSafeInteger(externalStockQuantity) || externalStockQuantity < 0)
    ) {
      const error = new Error(
        `Inventory item ${index + 1} has invalid externalStockQuantity.`
      );
      error.statusCode = 400;
      throw error;
    }

    if (Number.isNaN(observedAt.getTime())) {
      const error = new Error(`Inventory item ${index + 1} has invalid observedAt.`);
      error.statusCode = 400;
      throw error;
    }

    return {
      supplierSku,
      stockStatus,
      externalStockQuantity,
      observedAt,
      raw
    };
  });

  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const runResult = await tx.query(
        `
          INSERT INTO commerce_supplier_inventory_sync_runs (
            tenant_id,
            supplier_id,
            source_type,
            source_reference,
            item_count
          )
          VALUES ($1,$2,'api',$3,$4)
          RETURNING id
        `,
        [tenantId, credential.supplierId, sourceReference, normalized.length]
      );

      const syncRunId = runResult.rows[0].id;
      let matchedCount = 0;
      let unmatchedCount = 0;
      let staleCount = 0;
      const outcomes = [];

      for (const item of normalized) {
        const offerResult = await tx.query(
          `
            SELECT
              id,
              source_updated_at
            FROM commerce_supplier_offers
            WHERE tenant_id = $1
              AND supplier_id = $2
              AND supplier_sku = $3
              AND status = 'active'
            ORDER BY updated_at DESC
            LIMIT 1
            FOR UPDATE
          `,
          [tenantId, credential.supplierId, item.supplierSku]
        );

        if (offerResult.rowCount === 0) {
          unmatchedCount += 1;

          await tx.query(
            `
              INSERT INTO commerce_supplier_inventory_snapshots (
                tenant_id,
                supplier_id,
                sync_run_id,
                supplier_offer_id,
                supplier_sku,
                stock_status,
                external_stock_quantity,
                observed_at,
                outcome,
                raw_payload
              )
              VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,'unmatched',$8::jsonb)
            `,
            [
              tenantId,
              credential.supplierId,
              syncRunId,
              item.supplierSku,
              item.stockStatus,
              item.externalStockQuantity,
              item.observedAt.toISOString(),
              JSON.stringify(item.raw)
            ]
          );

          outcomes.push({
            supplierSku: item.supplierSku,
            outcome: "unmatched"
          });
          continue;
        }

        const offer = offerResult.rows[0];
        const sourceUpdatedAt = offer.source_updated_at
          ? new Date(offer.source_updated_at)
          : null;

        if (
          sourceUpdatedAt &&
          item.observedAt.getTime() <= sourceUpdatedAt.getTime()
        ) {
          staleCount += 1;

          await tx.query(
            `
              INSERT INTO commerce_supplier_inventory_snapshots (
                tenant_id,
                supplier_id,
                sync_run_id,
                supplier_offer_id,
                supplier_sku,
                stock_status,
                external_stock_quantity,
                observed_at,
                outcome,
                raw_payload
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'stale_ignored',$9::jsonb)
            `,
            [
              tenantId,
              credential.supplierId,
              syncRunId,
              offer.id,
              item.supplierSku,
              item.stockStatus,
              item.externalStockQuantity,
              item.observedAt.toISOString(),
              JSON.stringify(item.raw)
            ]
          );

          outcomes.push({
            supplierSku: item.supplierSku,
            outcome: "stale_ignored"
          });
          continue;
        }

        matchedCount += 1;

        await tx.query(
          `
            UPDATE commerce_supplier_offers
            SET
              stock_status = $1,
              external_stock_quantity = $2,
              source_updated_at = $3,
              updated_at = now()
            WHERE tenant_id = $4
              AND id = $5
          `,
          [
            item.stockStatus,
            item.externalStockQuantity,
            item.observedAt.toISOString(),
            tenantId,
            offer.id
          ]
        );

        await tx.query(
          `
            INSERT INTO commerce_supplier_inventory_snapshots (
              tenant_id,
              supplier_id,
              sync_run_id,
              supplier_offer_id,
              supplier_sku,
              stock_status,
              external_stock_quantity,
              observed_at,
              outcome,
              raw_payload
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'applied',$9::jsonb)
          `,
          [
            tenantId,
            credential.supplierId,
            syncRunId,
            offer.id,
            item.supplierSku,
            item.stockStatus,
            item.externalStockQuantity,
            item.observedAt.toISOString(),
            JSON.stringify(item.raw)
          ]
        );

        outcomes.push({
          supplierSku: item.supplierSku,
          outcome: "applied"
        });
      }

      const status =
        unmatchedCount === normalized.length
          ? "failed"
          : unmatchedCount > 0 || staleCount > 0
            ? "partial"
            : "processed";

      await tx.query(
        `
          UPDATE commerce_supplier_inventory_sync_runs
          SET
            matched_count = $1,
            unmatched_count = $2,
            stale_count = $3,
            status = $4
          WHERE tenant_id = $5
            AND id = $6
        `,
        [
          matchedCount,
          unmatchedCount,
          staleCount,
          status,
          tenantId,
          syncRunId
        ]
      );

      return {
        syncRunId,
        status,
        itemCount: normalized.length,
        matchedCount,
        unmatchedCount,
        staleCount,
        outcomes,
        ownedInventoryChanged: false,
        publicationChanged: false
      };
    });
  } finally {
    client.release();
  }
}


async function listSupplierInventorySyncRuns(supplierId) {
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
            id,
            source_type,
            source_reference,
            item_count,
            matched_count,
            unmatched_count,
            stale_count,
            status,
            created_at
          FROM commerce_supplier_inventory_sync_runs
          WHERE tenant_id = $1
            AND supplier_id = $2
          ORDER BY created_at DESC
          LIMIT 100
        `,
        [tenantId, supplierId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        sourceType: row.source_type,
        sourceReference: row.source_reference,
        itemCount: Number(row.item_count || 0),
        matchedCount: Number(row.matched_count || 0),
        unmatchedCount: Number(row.unmatched_count || 0),
        staleCount: Number(row.stale_count || 0),
        status: row.status,
        createdAt: row.created_at
      }));
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

  if (
    !routePath.endsWith("/health") &&
    !routePath.endsWith("/ready") &&
    !routePath.endsWith("/system-readiness")
  ) {
    const requiredMigrations = requiredSchemaMigrationsForRoute(routePath);

    if (requiredMigrations.length > 0) {
      try {
        const schema = await checkSchemaMigrations(requiredMigrations);

        if (!schema.ready) {
          return response(409, {
            error:
              "Database migration required before this Preview feature can be used.",
            code: "schema_not_ready",
            requiredMigrations: schema.pending,
            systemReadinessPath: "/admin/system-readiness"
          });
        }
      } catch (error) {
        console.error("Schema readiness gate failed:", {
          name: error?.name,
          message: error?.message
        });

        return response(503, {
          error: "Unable to verify database schema readiness.",
          code: "schema_readiness_unavailable"
        });
      }
    }
  }

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

  if (method === "GET" && routePath.endsWith("/operations-audit")) {
    try {
      const events = await listOperationsAudit();
      return response(200, {
        source: "postgresql",
        generatedAt: new Date().toISOString(),
        total: events.length,
        events
      });
    } catch (error) {
      console.error("Operations audit list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "operations_audit_unavailable"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/operations-inbox")) {
    try {
      const inbox = await getOperationsInbox();
      return response(200, {
        source: "postgresql",
        generatedAt: new Date().toISOString(),
        ...inbox
      });
    } catch (error) {
      console.error("Operations inbox failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "operations_inbox_unavailable"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/supplier-performance")) {
    try {
      const suppliers = await getSupplierPerformance();
      return response(200, {
        source: "postgresql",
        generatedAt: new Date().toISOString(),
        total: suppliers.length,
        suppliers
      });
    } catch (error) {
      console.error("Supplier performance failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_performance_unavailable"
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

  if (
    method === "GET" &&
    /\/suppliers\/[0-9a-f-]{36}\/verification-events$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const supplierId = parts[parts.length - 2];
      const events = await listSupplierVerificationEvents(supplierId);
      return response(200, {
        source: "postgresql",
        total: events.length,
        events
      });
    } catch (error) {
      console.error("Supplier verification history failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_verification_history_unavailable"
      });
    }
  }

  if (
    method === "PATCH" &&
    /\/suppliers\/[0-9a-f-]{36}\/verification$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const supplierId = parts[parts.length - 2];
      const verification = await updateSupplierVerification(
        supplierId,
        parseBody(event)
      );
      return response(200, {
        source: "postgresql",
        verification
      });
    } catch (error) {
      console.error("Supplier verification update failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_verification_update_failed"
      });
    }
  }

  if (
    method === "GET" &&
    routePath.endsWith("/supplier-inventory-sync-runs")
  ) {
    try {
      const supplierId = event?.queryStringParameters?.supplierId || "";
      const runs = await listSupplierInventorySyncRuns(supplierId);
      return response(200, {
        source: "postgresql",
        total: runs.length,
        runs
      });
    } catch (error) {
      console.error("Supplier inventory sync history failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_inventory_sync_history_unavailable"
      });
    }
  }

  if (
    method === "GET" &&
    routePath.endsWith("/supplier-api-credentials")
  ) {
    try {
      const supplierId = event?.queryStringParameters?.supplierId || "";
      const credentials = await listSupplierApiCredentials(supplierId);
      return response(200, {
        source: "postgresql",
        total: credentials.length,
        credentials
      });
    } catch (error) {
      console.error("Supplier API credential list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_api_credentials_unavailable"
      });
    }
  }

  if (
    method === "POST" &&
    routePath.endsWith("/supplier-api-credentials")
  ) {
    try {
      const credential = await createSupplierApiCredential(parseBody(event));
      return response(201, {
        source: "postgresql",
        credential
      });
    } catch (error) {
      console.error("Supplier API credential create failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_api_credential_create_failed"
      });
    }
  }

  if (
    method === "POST" &&
    /\/supplier-api-credentials\/[0-9a-f-]{36}\/revoke$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const credentialId = parts[parts.length - 2];
      const revoked = await revokeSupplierApiCredential(credentialId);
      return response(200, {
        source: "postgresql",
        revoked
      });
    } catch (error) {
      console.error("Supplier API credential revoke failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_api_credential_revoke_failed"
      });
    }
  }

  if (
    method === "POST" &&
    routePath.endsWith("/supplier-api/inventory-sync")
  ) {
    try {
      const body = parseBody(event);
      const result = await synchronizeSupplierInventory(
        String(body?.secretHash || ""),
        body
      );
      return response(200, {
        source: "postgresql",
        ...result
      });
    } catch (error) {
      console.error("Supplier inventory sync failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_inventory_sync_failed"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/supplier-api/ingest")) {
    try {
      const body = parseBody(event);
      const result = await ingestSupplierApiFeed(
        String(body?.secretHash || ""),
        body
      );
      return response(201, {
        source: "postgresql",
        ...result,
        autoPublishEnabled: false
      });
    } catch (error) {
      console.error("Supplier API ingest failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_api_ingest_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/supplier-users")) {
    try {
      const supplierId = event?.queryStringParameters?.supplierId || "";
      const users = await listSupplierUsers(supplierId);
      return response(200, {
        source: "postgresql",
        total: users.length,
        users
      });
    } catch (error) {
      console.error("Supplier-user list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_users_unavailable"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/supplier-users/invite")) {
    try {
      const invite = await createSupplierUserInvite(parseBody(event));
      return response(201, {
        source: "postgresql",
        invite
      });
    } catch (error) {
      console.error("Supplier-user invite failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_user_invite_failed"
      });
    }
  }

  if (
    method === "POST" &&
    /\/supplier-users\/[0-9a-f-]{36}\/revoke$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const accountId = parts[parts.length - 2];
      const revoked = await revokeSupplierUser(accountId);
      return response(200, {
        source: "postgresql",
        revoked
      });
    } catch (error) {
      console.error("Supplier-user revoke failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_user_revoke_failed"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/vendor-portal/activate")) {
    try {
      const body = parseBody(event);
      const account = await activateSupplierUserInvite(
        String(body?.inviteTokenHash || "")
      );
      return response(200, {
        source: "postgresql",
        account
      });
    } catch (error) {
      console.error("Vendor invite activation failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "vendor_invite_activation_failed"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/vendor-portal/feed")) {
    try {
      const body = parseBody(event);
      const result = await submitVendorFeed(
        String(body?.accountId || ""),
        body
      );
      return response(201, {
        source: "postgresql",
        ...result,
        autoPublishEnabled: false
      });
    } catch (error) {
      console.error("Vendor feed submission failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "vendor_feed_submission_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/vendor-portal/feed-history")) {
    try {
      const accountId = event?.queryStringParameters?.accountId || "";
      const batches = await listVendorFeedHistory(accountId);
      return response(200, {
        source: "postgresql",
        total: batches.length,
        batches
      });
    } catch (error) {
      console.error("Vendor feed history failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "vendor_feed_history_unavailable"
      });
    }
  }

  if (
    method === "GET" &&
    routePath.endsWith("/vendor-portal/purchase-orders")
  ) {
    try {
      const accountId = event?.queryStringParameters?.accountId || "";
      const purchaseOrders = await listVendorPurchaseOrders(accountId);
      return response(200, {
        source: "postgresql",
        total: purchaseOrders.length,
        purchaseOrders
      });
    } catch (error) {
      console.error("Vendor purchase-order list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "vendor_purchase_orders_unavailable"
      });
    }
  }

  if (
    method === "PATCH" &&
    /\/vendor-portal\/purchase-orders\/[0-9a-f-]{36}$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const poId = parts[parts.length - 1];
      const body = parseBody(event);
      const purchaseOrder = await updateVendorPurchaseOrder(
        String(body?.accountId || ""),
        poId,
        body
      );
      return response(200, {
        source: "postgresql",
        purchaseOrder
      });
    } catch (error) {
      console.error("Vendor purchase-order update failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "vendor_purchase_order_update_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/vendor-portal/context")) {
    try {
      const accountId = event?.queryStringParameters?.accountId || "";
      const portal = await getVendorPortalContext(accountId);
      return response(200, {
        source: "postgresql",
        portal
      });
    } catch (error) {
      console.error("Vendor portal context failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "vendor_portal_unavailable"
      });
    }
  }

  if (
    method === "PATCH" &&
    /\/vendor-portal\/offers\/[0-9a-f-]{36}$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const offerId = parts[parts.length - 1];
      const body = parseBody(event);
      const offer = await updateVendorPortalOffer(
        String(body?.accountId || ""),
        offerId,
        body
      );
      return response(200, {
        source: "postgresql",
        offer
      });
    } catch (error) {
      console.error("Vendor portal offer update failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "vendor_offer_update_failed"
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

  if (method === "GET" && routePath.endsWith("/supplier-feed/batches")) {
    try {
      const batches = await listSupplierFeedBatches();
      return response(200, {
        source: "postgresql",
        total: batches.length,
        batches
      });
    } catch (error) {
      console.error("Supplier feed batch list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(500, {
        error: "supplier_feed_batches_unavailable"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/supplier-feed/ingest")) {
    try {
      const result = await ingestSupplierFeed(parseBody(event));
      return response(201, {
        source: "postgresql",
        ...result,
        autoPublishEnabled: false
      });
    } catch (error) {
      console.error("Supplier feed ingest failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "supplier_feed_ingest_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/discovery-candidates")) {
    try {
      const status = event?.queryStringParameters?.status || "pending_review";
      const candidates = await listDiscoveryCandidates(status);
      return response(200, {
        source: "postgresql",
        total: candidates.length,
        candidates,
        autoPublishEnabled: false
      });
    } catch (error) {
      console.error("Discovery candidate list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "discovery_candidates_unavailable"
      });
    }
  }

  if (
    method === "POST" &&
    /\/discovery-candidates\/[0-9a-f-]{36}\/(approve|approve-with-image-review)$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const candidateId = parts[parts.length - 2];
      const result = await approveDiscoveryCandidate(
        candidateId,
        parseBody(event)
      );
      return response(200, {
        source: "postgresql",
        ...result,
        autoPublishEnabled: false
      });
    } catch (error) {
      console.error("Discovery candidate approval failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "discovery_candidate_approval_failed"
      });
    }
  }

  if (
    method === "POST" &&
    /\/discovery-candidates\/[0-9a-f-]{36}\/reject$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const candidateId = parts[parts.length - 2];
      const result = await rejectDiscoveryCandidate(
        candidateId,
        parseBody(event)
      );
      return response(200, {
        source: "postgresql",
        ...result
      });
    } catch (error) {
      console.error("Discovery candidate rejection failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "discovery_candidate_rejection_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/purchase-orders")) {
    try {
      const purchaseOrders = await listPurchaseOrders();
      return response(200, {
        source: "postgresql",
        total: purchaseOrders.length,
        purchaseOrders,
        automaticSubmissionEnabled: false
      });
    } catch (error) {
      console.error("Purchase-order list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(500, {
        error: "purchase_orders_unavailable"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/purchase-orders")) {
    try {
      const purchaseOrder = await createPurchaseOrder(parseBody(event));
      return response(201, {
        source: "postgresql",
        purchaseOrder,
        automaticSubmissionEnabled: false
      });
    } catch (error) {
      console.error("Purchase-order create failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "purchase_order_create_failed"
      });
    }
  }

  if (
    method === "GET" &&
    /\/purchase-orders\/[0-9a-f-]{36}$/i.test(routePath)
  ) {
    try {
      const poId = routePath.split("/").filter(Boolean).pop();
      const purchaseOrder = await getPurchaseOrder(poId);
      return response(200, {
        source: "postgresql",
        purchaseOrder,
        automaticSubmissionEnabled: false
      });
    } catch (error) {
      console.error("Purchase-order detail failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "purchase_order_detail_unavailable"
      });
    }
  }

  if (
    method === "POST" &&
    /\/purchase-orders\/[0-9a-f-]{36}\/approve$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const poId = parts[parts.length - 2];
      const approval = await approvePurchaseOrder(poId);
      return response(200, {
        source: "postgresql",
        approval,
        automaticSubmissionEnabled: false
      });
    } catch (error) {
      console.error("Purchase-order approval failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "purchase_order_approval_failed"
      });
    }
  }

  if (
    method === "POST" &&
    /\/purchase-orders\/[0-9a-f-]{36}\/submitted$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const poId = parts[parts.length - 2];
      const submission = await markPurchaseOrderSubmitted(poId);
      return response(200, {
        source: "postgresql",
        submission,
        automaticSubmissionEnabled: false
      });
    } catch (error) {
      console.error("Purchase-order submission status failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "purchase_order_submission_update_failed"
      });
    }
  }

  if (
    method === "POST" &&
    /\/purchase-orders\/[0-9a-f-]{36}\/items\/[0-9a-f-]{36}\/receive$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const poId = parts[parts.length - 4];
      const itemId = parts[parts.length - 2];
      const receipt = await receivePurchaseOrderItem(
        poId,
        itemId,
        parseBody(event)
      );
      return response(200, {
        source: "postgresql",
        receipt
      });
    } catch (error) {
      console.error("Purchase-order receipt failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "purchase_order_receipt_failed"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/replenishment")) {
    try {
      const marketCode = event?.queryStringParameters?.market || "GB";
      const items = await getReplenishmentWatchlist(marketCode);
      return response(200, {
        source: "postgresql",
        marketCode: String(marketCode).toUpperCase(),
        generatedAt: new Date().toISOString(),
        autoReorderEnabled: false,
        total: items.length,
        items
      });
    } catch (error) {
      console.error("Replenishment watchlist failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "replenishment_unavailable"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/system-readiness")) {
    try {
      const readiness = await getSystemReadiness();
      return response(200, {
        source: "postgresql",
        generatedAt: new Date().toISOString(),
        ...readiness
      });
    } catch (error) {
      console.error("System readiness check failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(500, {
        error: "system_readiness_unavailable"
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/returns")) {
    try {
      const returns = await listReturns();
      return response(200, {
        source: "postgresql",
        total: returns.length,
        returns
      });
    } catch (error) {
      console.error("Return list failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "returns_unavailable"
      });
    }
  }

  if (method === "POST" && routePath.endsWith("/returns")) {
    try {
      const result = await createReturn(parseBody(event));
      return response(201, {
        source: "postgresql",
        return: result
      });
    } catch (error) {
      console.error("Return create failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "return_create_failed"
      });
    }
  }

  if (
    method === "GET" &&
    /\/returns\/[0-9a-f-]{36}$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const returnId = parts[parts.length - 1];
      const result = await getReturn(returnId);
      return response(200, {
        source: "postgresql",
        return: result
      });
    } catch (error) {
      console.error("Return detail failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "return_unavailable"
      });
    }
  }

  if (
    method === "PATCH" &&
    /\/returns\/[0-9a-f-]{36}$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const returnId = parts[parts.length - 1];
      const result = await updateReturn(returnId, parseBody(event));
      return response(200, {
        source: "postgresql",
        return: result
      });
    } catch (error) {
      console.error("Return update failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "return_update_failed"
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

  if (routePath.endsWith("/theme-drafts") && ["GET", "POST"].includes(method)) {
    try { return response(200, await queryThemeDrafts({getPool,withTenant},method === "POST" ? parseBody(event) : null,method === "POST")); }
    catch(error) { return response(error.statusCode || 503,{error:error.statusCode ? error.message : "Theme drafts unavailable. Check migration 0030 and the matching API."}); }
  }

  if (routePath.endsWith("/store-setup") && ["GET", "PUT"].includes(method)) {
    try {
      return response(200, await queryStoreSetup({ getPool, withTenant }, method === "PUT" ? parseBody(event) : null, method === "PUT"));
    } catch (error) {
      return response(error.statusCode || 503, { error: error.statusCode ? error.message : "Store setup unavailable. Check Preview API and migration 0029." });
    }
  }

  if (routePath.endsWith("/storefront-social-links") && ["GET", "PUT"].includes(method)) {
    try {
      const save = method === "PUT";
      let input;
      if (save) {
        try {
          input = parseBody(event);
        } catch {
          throw checkoutError("Invalid social profile links.");
        }
      }
      return response(200, await querySocialLinks({ getPool, withTenant }, input, save));
    } catch (error) {
      return response(error.statusCode || 500, {
        error: error.statusCode ? error.message : "Social links are unavailable."
      });
    }
  }

  if (routePath.endsWith("/storefront-market-settings") && ["GET", "PATCH"].includes(method)) {
    try {
      const save = method === "PATCH";
      let input;
      if (save) {
        try {
          input = parseBody(event);
        } catch {
          throw checkoutError("Invalid market settings.");
        }
      }
      return response(200, await queryStorefrontMarkets({ getPool, withTenant }, input, save));
    } catch (error) {
      return response(error.statusCode || 500, {
        error: error.statusCode ? error.message : "Storefront market settings are unavailable."
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
    method === "POST" &&
    /\/orders\/[0-9a-f-]{36}\/fulfilment-plan\/allocations\/[0-9a-f-]{36}\/execution$/i.test(routePath)
  ) {
    try {
      const parts = routePath.split("/").filter(Boolean);
      const orderId = parts[parts.length - 5];
      const allocationId = parts[parts.length - 2];
      const execution = await updateFulfilmentExecution(
        orderId,
        allocationId,
        parseBody(event)
      );
      return response(200, {
        source: "postgresql",
        execution,
        automaticDispatchEnabled: false
      });
    } catch (error) {
      console.error("Fulfilment execution update failed:", {
        name: error?.name,
        message: error?.message
      });
      return response(error?.statusCode || 500, {
        error:
          error?.statusCode && error.statusCode < 500
            ? error.message
            : "fulfilment_execution_update_failed"
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

  const adminContentRoute = routePath.endsWith("/store-content");
  const publicContentRoute = routePath.endsWith("/published-content");
  if ((adminContentRoute && ["GET", "POST"].includes(method)) || (publicContentRoute && method === "GET")) {
    try {
      const input = method === "POST" ? parseBody(event) : event?.queryStringParameters;
      const operation = method === "POST" ? "write" : publicContentRoute ? "public" : "admin";
      return response(200, await queryStorefrontContent({ getPool, withTenant }, input, operation));
    } catch (error) {
      return response(error.statusCode || 500, {
        error: error.statusCode ? error.message : "Storefront content is unavailable."
      });
    }
  }

  if (method === "GET" && routePath.endsWith("/delivery-settings")) {
    try {
      const marketCode = event?.queryStringParameters?.market || "GB";
      return response(200, previewDeliveryQuote(marketCode));
    } catch (error) {
      return response(error.statusCode || 500, { error: error.statusCode ? error.message : "Delivery settings unavailable." });
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

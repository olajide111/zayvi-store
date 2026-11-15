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
            COUNT(o.id)::int AS order_count,
            COALESCE(SUM(o.total), 0)::numeric AS lifetime_value
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
  const items = Array.isArray(input?.items) ? input.items : [];

  if (!customerName || !customerEmail || !customerEmail.includes("@")) {
    const error = new Error("Customer name and a valid email are required.");
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

    return { id, quantity, selectedColor };
  });

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
            tpm.customer_price,
            tpm.currency_code,
            tpm.availability_status
          FROM tenant_catalogue_products tcp
          JOIN catalogue_products cp
            ON cp.id = tcp.product_id
          JOIN tenant_product_markets tpm
            ON tpm.tenant_id = tcp.tenant_id
           AND tpm.tenant_catalogue_product_id = tcp.id
           AND tpm.market_code = 'GB'
          WHERE tcp.tenant_id = $1
            AND cp.id = ANY($2::uuid[])
        `,
        [tenantId, productIds]
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
        pricedLines.map((line) => line.product.currency_code || "GBP")
      );

      if (currencySet.size !== 1 || !currencySet.has("GBP")) {
        const error = new Error("Preview orders currently support GBP only.");
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

      let order;
      let attempts = 0;

      while (!order && attempts < 3) {
        attempts += 1;
        try {
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
                source
              )
              VALUES (
                $1, $2, $3, $4, 'GB', 'GBP',
                'draft', 'unpaid', 'unfulfilled',
                $5, $6, $7, 0, 0, $7, 'preview'
              )
              RETURNING *
            `,
            [
              tenantId,
              storeId,
              customer.rows[0].id,
              createOrderNumber(),
              customerName,
              customerEmail,
              subtotal
            ]
          );
          order = orderResult.rows[0];
        } catch (error) {
          if (error?.code !== "23505" || attempts >= 3) throw error;
        }
      }

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
              $7, $8, $9, 'GBP', $10::jsonb
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
            JSON.stringify(
              line.selectedColor
                ? { color: line.selectedColor }
                : {}
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
        purchasingEnabled: false
      };
    });
  } finally {
    client.release();
  }
}


async function listInventory() {
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = await tx.query(
        `
          SELECT
            cp.id,
            cp.canonical_code,
            cp.name,
            cp.attributes,
            tcp.status AS product_status,
            tpm.availability_status,
            tpm.customer_price,
            tpm.currency_code,
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
          ORDER BY cp.name ASC
        `,
        [tenantId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        sku: row.canonical_code,
        name: row.name,
        image: row.attributes?.image || "",
        status: row.product_status,
        availabilityStatus: row.availability_status || "unknown",
        quantity: null,
        inventoryManaged: false,
        price: row.customer_price === null ? null : Number(row.customer_price),
        currency: row.currency_code || "GBP",
        updatedAt: row.updated_at
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
      const items = await listInventory();
      return response(200, {
        source: "postgresql",
        total: items.length,
        inventoryTrackingEnabled: false,
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
    return response(200, {
      source: "preview_supplier_setup_pending",
      total: 0,
      suppliers: [],
      message:
        "Supplier management is ready for configuration; no supplier records are currently active."
    });
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

function contentError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

const contentMigration = "0026_storefront_content.sql";
const reservedPages = new Set(["about", "contact", "privacy", "returns", "shipping", "faqs", "tracking", "affiliate", "terms"]);

function contentKey(input, requireSlug) {
  const { market, slug } = input || {};
  if (market !== "GB" && market !== "NG") throw contentError("Select the UK or Nigeria market.");
  if ((requireSlug || slug !== undefined) && (
    typeof slug !== "string" || slug.length > 80 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
  )) {
    throw contentError("Use a lowercase URL slug with letters, numbers and hyphens.");
  }
  return { market, slug };
}

function draftContent(input, slug) {
  const { kind } = input;
  if (!["page", "article"].includes(kind) || (kind === "article" && reservedPages.has(slug))) {
    throw contentError("Choose a page or an article with an available slug.");
  }

  function field(name, max, required) {
    const value = typeof input[name] === "string" ? input[name].trim() : "";
    if ((required && !value) || value.length > max || value.includes("\u0000")) {
      throw contentError(`Check the ${name}. Use at most ${max} characters.`);
    }
    return value;
  }

  return { kind, draft: { title: field("title", 120, true), summary: field("summary", 300), body: field("body", 16000, true) } };
}

async function queryStorefrontContent({ getPool, withTenant }, input, operation) {
  const write = operation === "write";
  const isPublic = operation === "public";
  const { market, slug } = contentKey(input, write);
  const client = await getPool().connect();

  try {
    return await withTenant(client, async (tx, tenantId) => {
      const store = await tx.query(
        "SELECT id FROM stores WHERE tenant_id = $1 AND slug = 'main' AND status = 'active' LIMIT 1",
        [tenantId]
      );
      if (!store.rowCount) throw contentError("Storefront unavailable.", 404);
      const scope = [tenantId, store.rows[0].id, market];

      if (!write) {
        const publicFields = "slug, kind, published ->> 'title' AS title, published ->> 'summary' AS summary, published_at";
        const adminFields = "slug, kind, draft ->> 'title' AS title, draft_changed, revision, published_at, updated_at";
        const fields = isPublic ? publicFields : adminFields;
        const visibility = isPublic ? "AND published IS NOT NULL" : "";
        const { rows } = await tx.query(
          slug
            ? `SELECT ${fields}, ${isPublic ? "published ->> 'body' AS body" : "draft"}
                 FROM commerce_storefront_content
                WHERE tenant_id = $1 AND store_id = $2 AND market_code = $3 AND slug = $4 ${visibility}`
            : `SELECT ${fields}
                 FROM commerce_storefront_content
                WHERE tenant_id = $1 AND store_id = $2 AND market_code = $3 ${visibility}
             ORDER BY ${isPublic ? "published_at" : "updated_at"} DESC, slug`,
          slug ? [...scope, slug] : scope
        );
        if (!slug) return { content: rows };
        if (!rows[0]) throw contentError("Page not found.", 404);
        return { entry: rows[0] };
      }

      const { action, revision } = input;
      const key = [...scope, slug];
      if (!Number.isSafeInteger(revision) || revision < 0 || revision > 2147483646) {
        throw contentError("Reload the draft before editing.");
      }
      let result;

      if (action === "save") {
        const { kind, draft } = draftContent(input, slug);
        result = revision === 0
          ? await tx.query(
              `INSERT INTO commerce_storefront_content (tenant_id, store_id, market_code, slug, kind, draft)
               VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING
               RETURNING revision`,
              [...key, kind, JSON.stringify(draft)]
            )
          : await tx.query(
              `UPDATE commerce_storefront_content
                  SET draft = $6::jsonb, draft_changed = ($6::jsonb IS DISTINCT FROM published),
                      revision = revision + 1, updated_at = now()
                WHERE tenant_id = $1 AND store_id = $2 AND market_code = $3 AND slug = $4
                  AND revision = $5 AND kind = $7
              RETURNING revision`,
              [...key, revision, JSON.stringify(draft), kind]
            );
      } else if (action === "publish" || action === "unpublish") {
        result = await tx.query(
          `UPDATE commerce_storefront_content
              SET published = CASE WHEN $6::boolean THEN draft ELSE NULL END,
                  published_at = CASE WHEN $6::boolean THEN now() ELSE NULL END,
                  draft_changed = NOT $6::boolean, revision = revision + 1, updated_at = now()
            WHERE tenant_id = $1 AND store_id = $2 AND market_code = $3 AND slug = $4
              AND revision = $5
          RETURNING revision`,
          [...key, revision, action === "publish"]
        );
      } else {
        throw contentError("Unsupported content action.");
      }

      if (!result.rowCount) throw contentError("This entry already exists or has changed. Reload before saving.", 409);
      return result.rows[0];
    });
  } finally {
    client.release();
  }
}

module.exports = { contentMigration, queryStorefrontContent };

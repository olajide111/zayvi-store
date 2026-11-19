const { parseSocialLinks } = require("../../lib/social-links");
const { checkoutError } = require("./checkout-delivery");

const socialLinksMigration = "0028_storefront_social_links.sql";

async function querySocialLinks({ getPool, withTenant }, input, save) {
  let links;
  if (save) {
    try {
      links = parseSocialLinks(input?.links);
    } catch (error) {
      throw checkoutError(error.message);
    }
  }

  const client = await getPool().connect();
  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = save
        ? await tx.query(
            `UPDATE stores SET storefront_social_links = $2::jsonb
             WHERE tenant_id = $1 AND slug = 'main' AND status = 'active'
             RETURNING storefront_social_links`,
            [tenantId, JSON.stringify(links)]
          )
        : await tx.query(
            `SELECT storefront_social_links
             FROM stores WHERE tenant_id = $1 AND slug = 'main' AND status = 'active'`,
            [tenantId]
          );
      if (!result.rowCount) throw checkoutError("Active storefront unavailable.", 404);
      return { links: parseSocialLinks(result.rows[0].storefront_social_links) };
    });
  } finally {
    client.release();
  }
}

module.exports = { socialLinksMigration, querySocialLinks };

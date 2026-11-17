const { checkoutError } = require("./checkout-delivery");

const marketsMigration = "0027_storefront_markets.sql";
const marketCodes = ["GB", "NG"];

function storeMarketSettings(row) {
  const defaultMarket = marketCodes.includes(row.default_market_code) ? row.default_market_code : "GB";
  return {
    defaultMarket,
    enabledMarkets: row.storefront_market_codes ?? [defaultMarket],
    showSwitcher: row.storefront_market_switcher
  };
}

async function queryStorefrontMarkets({ getPool, withTenant }, input, save) {
  let enabledMarkets;

  if (save) {
    const requested = input?.enabledMarkets;
    if (!Array.isArray(requested) || requested.length === 0 ||
        new Set(requested).size !== requested.length ||
        requested.some((code) => !marketCodes.includes(code)) ||
        !requested.includes(input.defaultMarket) ||
        typeof input.showSwitcher !== "boolean") {
      throw checkoutError("Choose at least one market and a default from your enabled markets.");
    }
    enabledMarkets = marketCodes.filter((code) => requested.includes(code));
  }

  const client = await getPool().connect();
  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = save
        ? await tx.query(
            `UPDATE stores
             SET storefront_market_codes = $2, default_market_code = $3, storefront_market_switcher = $4
             WHERE tenant_id = $1 AND slug = 'main' AND status = 'active'
             RETURNING storefront_market_codes, default_market_code, storefront_market_switcher`,
            [tenantId, enabledMarkets, input.defaultMarket, input.showSwitcher]
          )
        : await tx.query(
            `SELECT storefront_market_codes, default_market_code, storefront_market_switcher
             FROM stores WHERE tenant_id = $1 AND slug = 'main' AND status = 'active'`,
            [tenantId]
          );
      if (!result.rowCount) throw checkoutError("Active storefront unavailable.", 404);
      return storeMarketSettings(result.rows[0]);
    });
  } finally {
    client.release();
  }
}

module.exports = { marketsMigration, queryStorefrontMarkets, storeMarketSettings };

const { validateStoreSetup } = require('../../lib/store-setup');
const { checkoutError } = require('./checkout-delivery');
async function queryStoreSetup({getPool, withTenant}, input, save) {
  let profile;
  if (save) { try { profile = validateStoreSetup(input); } catch (error) { throw checkoutError(error.message); } }
  const client = await getPool().connect();
  try {
    return await withTenant(client, async (tx, tenantId) => {
      const result = save ? await tx.query(`UPDATE stores SET setup_profile=$2::jsonb WHERE tenant_id=$1 AND slug='main' AND status='active' RETURNING setup_profile`, [tenantId, JSON.stringify(profile)]) : await tx.query(`SELECT setup_profile FROM stores WHERE tenant_id=$1 AND slug='main' AND status='active'`, [tenantId]);
      if (!result.rowCount) throw checkoutError('Active store unavailable.',404);
      return { profile: result.rows[0].setup_profile, publishingEnabled: false };
    });
  } finally { client.release(); }
}
module.exports = {queryStoreSetup};

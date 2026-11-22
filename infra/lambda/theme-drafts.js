const {validateThemeDraft}=require('../../lib/theme-draft');
const {checkoutError}=require('./checkout-delivery');
async function queryThemeDrafts({getPool,withTenant},input,save){
 let validated;
 if(save){try{validated=validateThemeDraft(input);}catch(error){throw checkoutError(error.message);}}
 const client=await getPool().connect();
 try{return await withTenant(client,async(tx,tenantId)=>{
  // Serialize version allocation on the existing store row, not MAX alone.
  const store=await tx.query(`SELECT id FROM stores WHERE tenant_id=$1 AND slug='main' AND status='active' FOR UPDATE`,[tenantId]);
  if(!store.rowCount)throw checkoutError('Active store unavailable.',404);
  const storeId=store.rows[0].id;
  const latest=await tx.query(`SELECT COALESCE(MAX(version_number),0) AS version FROM store_theme_versions WHERE tenant_id=$1 AND store_id=$2`,[tenantId,storeId]);
  const version=Number(latest.rows[0].version);
  if(save){
   if(validated.baseVersion!==version)throw checkoutError('Another design was saved. Refresh version history before saving again.',409);
   await tx.query(`INSERT INTO store_theme_versions (tenant_id,store_id,version_number,schema_version,template_family,config) VALUES ($1,$2,$3,1,$4,$5::jsonb)`,[tenantId,storeId,version+1,validated.theme.family,JSON.stringify(validated.config)]);
  }
  const history=await tx.query(`SELECT id,version_number,created_at,config FROM store_theme_versions WHERE tenant_id=$1 AND store_id=$2 AND config->>'kind'='studio-draft' ORDER BY version_number DESC LIMIT 50`,[tenantId,storeId]);
  const latestByTheme=await tx.query(`SELECT DISTINCT ON (config->>'themeId') id,version_number,created_at,config FROM store_theme_versions WHERE tenant_id=$1 AND store_id=$2 AND config->>'kind'='studio-draft' ORDER BY config->>'themeId',version_number DESC`,[tenantId,storeId]);
  return {baseVersion:save?version+1:version,latestVersions:latestByTheme.rows.map(row=>({id:row.id,version:Number(row.version_number),createdAt:row.created_at,themeId:row.config.themeId,draft:row.config.draft})),versions:history.rows.map(row=>({id:row.id,version:Number(row.version_number),createdAt:row.created_at,themeId:row.config.themeId,draft:row.config.draft})),publishingEnabled:false};
 });}finally{client.release();}
}
module.exports={queryThemeDrafts};

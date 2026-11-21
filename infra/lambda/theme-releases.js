const {validateThemeRelease,previewReleasesEnabled}=require('../../lib/theme-release');
const {validateThemeDraft}=require('../../lib/theme-draft');
const {checkoutError}=require('./checkout-delivery');
async function queryThemeRelease({getPool,withTenant},input,save,env=process.env){
 const enabled=previewReleasesEnabled(env);
 if(!enabled&&save)throw checkoutError('Preview theme releases are disabled.',423);
 if(!enabled)return {enabled:false,current:null,events:[],message:'Preview theme releases are disabled.'};
 let request;
 if(save){try{request=validateThemeRelease(input);}catch(error){throw checkoutError(error.message);}}
 const client=await getPool().connect();
 try{return await withTenant(client,async(tx,tenantId)=>{
  const store=await tx.query(`SELECT id FROM stores WHERE tenant_id=$1 AND slug='main' AND status='active' FOR UPDATE`,[tenantId]);
  if(!store.rowCount)throw checkoutError('Active store unavailable.',404);
  const scope=[tenantId,store.rows[0].id];
  let release=await tx.query(`SELECT theme_version_id FROM store_theme_releases WHERE tenant_id=$1 AND store_id=$2`,scope);
  let current=release.rows[0]?.theme_version_id||null;
  if(save){
   if(request.expectedReleaseId!==current)throw checkoutError('The release changed. Refresh before trying again.',409);
   const target=await tx.query(`SELECT config FROM store_theme_versions WHERE tenant_id=$1 AND store_id=$2 AND id=$3`,[...scope,request.versionId]);
   if(!target.rowCount||target.rows[0].config?.kind!=='studio-draft')throw checkoutError('Saved studio version unavailable.',404);
   const config=target.rows[0].config;
   try{validateThemeDraft({themeId:config.themeId,draft:config.draft,baseVersion:0});}catch{throw checkoutError('Saved design is incompatible. Save a new design version first.');}
   if(request.action==='rollback'){
    const previous=await tx.query(`SELECT id FROM store_theme_release_events WHERE tenant_id=$1 AND store_id=$2 AND theme_version_id=$3 LIMIT 1`,[...scope,request.versionId]);
    if(!previous.rowCount)throw checkoutError('Rollback requires a previously released version.');
   }
   if(current!==request.versionId){
    await tx.query(`INSERT INTO store_theme_releases (tenant_id,store_id,theme_version_id) VALUES ($1,$2,$3) ON CONFLICT (tenant_id,store_id) DO UPDATE SET theme_version_id=EXCLUDED.theme_version_id,published_at=now()`,[...scope,request.versionId]);
    await tx.query(`INSERT INTO store_theme_release_events (tenant_id,store_id,theme_version_id,action,reason) VALUES ($1,$2,$3,$4,$5)`,[...scope,request.versionId,request.action,request.reason]);
    current=request.versionId;
   }
  }
  const events=await tx.query(`SELECT id,theme_version_id,action,reason,created_at FROM store_theme_release_events WHERE tenant_id=$1 AND store_id=$2 ORDER BY created_at DESC,id DESC LIMIT 50`,scope);
  let design=null;
  if(current){
    const selected=await tx.query(`SELECT config FROM store_theme_versions WHERE tenant_id=$1 AND store_id=$2 AND id=$3`,[...scope,current]);
    if(selected.rowCount&&selected.rows[0].config?.kind==='studio-draft'){
      try{const config=selected.rows[0].config;const valid=validateThemeDraft({themeId:config.themeId,draft:config.draft,baseVersion:0});design={themeId:valid.theme.id,draft:valid.config.draft};}catch{}
    }
  }
  return {enabled:true,current,design,events:events.rows};
 });}finally{client.release();}
}
module.exports={queryThemeRelease};

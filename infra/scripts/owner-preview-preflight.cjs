#!/usr/bin/env node
// Read-only metadata inspection. Never provisions, changes configuration or prints secret values.
const {execFileSync}=require('node:child_process');
const ACCOUNT='001961766018',REGION='eu-west-2';
const READS=new Set(['sts get-caller-identity','cognito-idp list-user-pools','cognito-idp list-user-pool-clients','cognito-idp describe-user-pool','cognito-idp describe-user-pool-client','cognito-idp get-user-pool-mfa-config','lambda get-function-configuration']);
function aws(service,operation,args=[]){
 if(!READS.has(`${service} ${operation}`))throw new Error('Only approved metadata reads are supported.');
 try{return JSON.parse(execFileSync('aws',[service,operation,...args,'--region',REGION,'--output','json','--no-cli-pager'],{encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe'],env:{...process.env,AWS_REGION:REGION,AWS_DEFAULT_REGION:REGION,AWS_PAGER:'',AWS_CLI_AUTO_PROMPT:'off'}}));}
 catch{throw new Error(`Cannot read ${service} ${operation}. Check AWS authentication and read permissions; provider details were not printed.`);}
}
function options(argv){
 const result={};
 for(let i=0;i<argv.length;i++){
  const flag=argv[i];if(flag==='--help'){result.help=true;continue;}
  const key={'--pool-id':'poolId','--client-id':'clientId','--origin':'origin','--scope':'scope'}[flag];
  if(!key||result[key]!==undefined||!argv[i+1]||argv[i+1].startsWith('--'))throw new Error('Invalid options. Run with --help.');
  result[key]=argv[++i];
 }
 if(result.poolId&&!/^eu-west-2_[A-Za-z0-9]+$/.test(result.poolId))throw new Error('Use an eu-west-2 user pool ID.');
 if(result.clientId&&(!result.poolId||!/^[a-z0-9]{1,128}$/.test(result.clientId)))throw new Error('A valid pool and client ID are required.');
 if(result.clientId&&!result.origin)throw new Error('Supply the exact Preview HTTPS origin with --origin.');
 if(result.origin){let url;try{url=new URL(result.origin);}catch{throw new Error('Invalid Preview origin.');}
  if(url.protocol!=='https:'||url.origin!==result.origin||url.port||['zayvi.store','www.zayvi.store','localhost'].includes(url.hostname))throw new Error('Use a dedicated Preview HTTPS origin, not the production store origin.');}
 if(result.scope&&(!/^\S+\/\S+$/.test(result.scope)||result.scope.length>256))throw new Error('Use the exact configured resource-server scope.');
 if((result.origin||result.scope)&&!result.clientId)throw new Error('Origin and scope checks require a selected pool and client.');
 return result;
}
function lifetime(client,name){
 const units=client.TokenValidityUnits?.[`${name}Token`]??'hours';
 const factor={seconds:1,minutes:60,hours:3600,days:86400}[units];
 const value=client[`${name}TokenValidity`];
 // Cognito defaults omitted access/ID validity to one hour, independent of the optional unit fields.
 if(value===undefined)return 3600;
 return typeof value==='number'&&Number.isInteger(value)&&value>0&&factor?value*factor:NaN;
}
function inspect(input,pool,client,mfa,discovery,lambda){
 const checks=[];const check=(id,pass,message)=>checks.push({id,passed:pass===true,message});
 const poolArn=`arn:aws:cognito-idp:${REGION}:${ACCOUNT}:userpool/${input.poolId}`;
 check('pool_identity',pool.Id===input.poolId&&pool.Arn===poolArn,'Pool must belong to the selected Preview account and London region.');
 check('preview_tag',Object.entries(pool.UserPoolTags??{}).some(([k,v])=>k.toLowerCase()==='environment'&&typeof v==='string'&&v.toLowerCase()==='preview'),'Pool must be explicitly tagged environment=preview before pilot activation.');
 check('client_identity',client.UserPoolId===input.poolId&&client.ClientId===input.clientId,'Client must belong to the selected pool.');
 check('public_pkce_client',client.HasClientSecret===false&&!client.ClientSecret,'Current code uses a client without a client secret and PKCE.');
 check('code_flow',client.AllowedOAuthFlowsUserPoolClient===true&&client.AllowedOAuthFlows?.length===1&&client.AllowedOAuthFlows[0]==='code','Allow only the authorization-code OAuth flow for this dedicated client.');
 const callback=`${input.origin}/api/owner/auth/callback`;
 check('preview_callback',client.CallbackURLs?.length===1&&client.CallbackURLs[0]===callback,'Dedicated client callback must match the exact Preview owner callback.');
 const requiredScope=input.scope??'zayvi/store.access';
 check('scopes',client.AllowedOAuthScopes?.includes('openid')&&client.AllowedOAuthScopes?.includes(requiredScope),'Client must allow openid and the required Zayvi resource-server scope.');
 check('token_revocation',client.EnableTokenRevocation===true,'Token revocation must be enabled; a current-session assurance adapter is still required.');
 check('user_existence',client.PreventUserExistenceErrors==='ENABLED','Enable generic user-existence errors.');
 check('token_lifetime',['Access','Id'].every(name=>lifetime(client,name)<=3600),'Access and ID token lifetimes must each be at most one hour.');
 check('mfa',mfa.MfaConfiguration==='ON'&&mfa.SoftwareTokenMfaConfiguration?.Enabled===true,'Initial pilot requires mandatory MFA with software-token MFA enabled.');
 check('local_provider',client.SupportedIdentityProviders?.length===1&&client.SupportedIdentityProviders[0]==='COGNITO','Initial assurance path supports Cognito users; federated MFA needs separate review.');
 check('controlled_signup',pool.AdminCreateUserConfig?.AllowAdminCreateUserOnly===true,'Initial owner access must use controlled provisioning, not open self-signup.');
 const domain=typeof pool.Domain==='string'&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(pool.Domain)?`https://${pool.Domain}.auth.${REGION}.amazoncognito.com`:null;
 const issuer=`https://cognito-idp.${REGION}.amazonaws.com/${input.poolId}`;
 check('hosted_domain',!!domain,'Current login implementation requires a Cognito London prefix domain.');
 check('discovery',!!domain&&discovery?.issuer===issuer&&discovery.authorization_endpoint===`${domain}/oauth2/authorize`&&discovery.token_endpoint===`${domain}/oauth2/token`&&discovery.jwks_uri===`${issuer}/.well-known/jwks.json`,'Observed OIDC metadata must match the issuer, JWKS and domain used by the current verifier.');
 return {account:ACCOUNT,region:REGION,poolId:input.poolId,clientId:input.clientId,origin:input.origin,
  configurationMatched:checks.every(item=>item.passed),activationReady:false,checks,
  databaseLambdaInVpc:Array.isArray(lambda?.VpcConfig?.SubnetIds)?lambda.VpcConfig.SubnetIds.length>0:null,
  pending:['Review public token/JWKS connectivity and the typed private-database boundary. Cognito PrivateLink does not support hosted OAuth domain endpoints.','Implement and verify current provider revocation/MFA assurance and a durable limiter. Pool MFA settings alone are not evidence of a completed MFA challenge.','Review/apply the new database migrations, provision the exact owner membership and mount/guard the owner routes.','Complete live browser, provider-outage and RDS role/locking checks.'],
  note:'Metadata inspection only. No secrets, configuration changes, Terraform apply or sign-in activation.'};
}
async function publicDiscovery(url){
 try{const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();const text=await response.text();if(text.length>65536)throw new Error();return JSON.parse(text);}catch{return null;}
}
async function run(argv,{read=aws,discover=publicDiscovery}={}){
 const input=options(argv);if(input.help)return {help:true};
 const identity=await read('sts','get-caller-identity');if(identity.Account!==ACCOUNT)throw new Error('Expected Preview AWS account 001961766018. Stopped before reading Cognito.');
 if(!input.poolId){const result=await read('cognito-idp','list-user-pools',['--max-results','60','--query','{UserPools:UserPools[].{Id:Id,Name:Name}}']);return {inventory:'pools',pools:(result.UserPools??[]).map(({Id,Name})=>({id:Id,name:Name})),note:'No pool selected or created. Select only an explicitly reviewed Preview pool.'};}
 if(!input.clientId){const result=await read('cognito-idp','list-user-pool-clients',['--user-pool-id',input.poolId,'--query','{UserPoolClients:UserPoolClients[].{ClientId:ClientId,ClientName:ClientName}}']);return {inventory:'clients',poolId:input.poolId,clients:(result.UserPoolClients??[]).map(({ClientId,ClientName})=>({id:ClientId,name:ClientName})),note:'No client selected or changed.'};}
 const pool=(await read('cognito-idp','describe-user-pool',['--user-pool-id',input.poolId])).UserPool??{};
 // Project in the CLI: only the presence of a client secret reaches this process, never its value.
 const clientFields=['UserPoolId','ClientId','AllowedOAuthFlowsUserPoolClient','AllowedOAuthFlows','CallbackURLs','AllowedOAuthScopes','EnableTokenRevocation','PreventUserExistenceErrors','AccessTokenValidity','IdTokenValidity','TokenValidityUnits','SupportedIdentityProviders'];
 const clientQuery='{UserPoolClient:{'+clientFields.map(key=>`${key}:UserPoolClient.${key}`).join(',')+',HasClientSecret:UserPoolClient.ClientSecret != `null`}}';
 const client=(await read('cognito-idp','describe-user-pool-client',['--user-pool-id',input.poolId,'--client-id',input.clientId,'--query',clientQuery])).UserPoolClient??{};
 const mfa=await read('cognito-idp','get-user-pool-mfa-config',['--user-pool-id',input.poolId]);
 let lambda=null;try{lambda=await read('lambda','get-function-configuration',['--function-name','zayvi-preview-api','--query','{VpcConfig:{SubnetIds:VpcConfig.SubnetIds}}']);}catch{/* unavailable metadata remains unknown */}
 const discovery=await discover(`https://cognito-idp.${REGION}.amazonaws.com/${input.poolId}/.well-known/openid-configuration`);
 return inspect(input,pool,client,mfa,discovery,lambda);
}
module.exports={run,inspect,options};
if(require.main===module)run(process.argv.slice(2)).then(report=>{
 if(report.help){console.log('Read-only Zayvi Preview owner-auth inspection (requires AWS CLI and Node.js 22).\n\nList existing pools:\n  node infra/scripts/owner-preview-preflight.cjs\nList clients in a reviewed Preview pool:\n  node infra/scripts/owner-preview-preflight.cjs --pool-id eu-west-2_POOL\nInspect a selected client:\n  node infra/scripts/owner-preview-preflight.cjs --pool-id eu-west-2_POOL --client-id CLIENT --origin https://YOUR-PREVIEW-HOST [--scope zayvi/store.access]\n\nNo resources are created or changed. This is not an activation approval.');return;}
 console.log(JSON.stringify(report,null,2));if(report.configurationMatched===false)process.exitCode=2;
}).catch(error=>{console.error(error.message);process.exitCode=1;});

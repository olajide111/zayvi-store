const fs = require('node:fs');

const identityResources=new Map(['aws_cognito_user_pool','aws_cognito_user_pool_client','aws_cognito_user_pool_domain','aws_cognito_resource_server'].map(type=>[`${type}.preview_owners[0]`,type]));
const merchantResources = new Map([
  ['aws_security_group.merchant_registration', 'aws_security_group'],
  ['aws_security_group.merchant_proof_endpoint', 'aws_security_group'],
  ['aws_vpc_security_group_egress_rule.merchant_to_database', 'aws_vpc_security_group_egress_rule'],
  ['aws_vpc_security_group_ingress_rule.database_from_merchant', 'aws_vpc_security_group_ingress_rule'],
  ['aws_vpc_security_group_egress_rule.merchant_to_proof_endpoint', 'aws_vpc_security_group_egress_rule'],
  ['aws_vpc_security_group_ingress_rule.proof_endpoint_from_merchant', 'aws_vpc_security_group_ingress_rule'],
  ['aws_iam_role.merchant_registration', 'aws_iam_role'],
  ['aws_vpc_endpoint.merchant_proof', 'aws_vpc_endpoint'],
  ['aws_cloudwatch_log_group.merchant_registration', 'aws_cloudwatch_log_group'],
  ['aws_iam_role_policy.merchant_registration_vpc', 'aws_iam_role_policy'],
  ['aws_iam_role_policy.merchant_registration_access', 'aws_iam_role_policy'],
  ['aws_lambda_function.merchant_registration', 'aws_lambda_function'],
  ['aws_lambda_alias.merchant_registration', 'aws_lambda_alias'],
  ['aws_iam_role.merchant_vercel', 'aws_iam_role'],
  ['aws_iam_role_policy.merchant_invoke', 'aws_iam_role_policy'],
].map(([address, type]) => [address + '["preview"]', type]));

const bootstrapResources = new Set([
  'aws_security_group.db_bootstrap[0]', 'aws_security_group.secrets_endpoint[0]',
  'aws_vpc_security_group_egress_rule.bootstrap_to_database[0]',
  'aws_vpc_security_group_ingress_rule.database_from_bootstrap[0]',
  'aws_vpc_security_group_egress_rule.bootstrap_to_secrets_endpoint[0]',
  'aws_vpc_security_group_ingress_rule.secrets_endpoint_from_bootstrap[0]',
  'aws_vpc_endpoint.secretsmanager[0]', 'aws_iam_role.db_bootstrap[0]',
  'aws_cloudwatch_log_group.db_bootstrap[0]', 'aws_iam_role_policy.db_bootstrap_logs[0]',
  'aws_iam_role_policy.db_bootstrap_vpc[0]', 'aws_iam_role_policy.db_bootstrap_secret[0]',
  'aws_lambda_function.db_bootstrap[0]', 'aws_lambda_invocation.db_bootstrap[0]',
]);
const bootstrapInvocation = 'aws_lambda_invocation.db_bootstrap[0]';

function merchantBootstrap(item) {
  if (item.address !== bootstrapInvocation) return false;
  try { return JSON.parse(item.change.after?.input).action === 'merchant-registration-bootstrap'; }
  catch { return false; }
}

function review(plan,scope='general') {
  if(!['general','owner-identity','merchant-registration','merchant-db-bootstrap'].includes(scope))throw new Error('Unknown plan scope');
  if (!plan || (!Array.isArray(plan.resource_changes) && !(plan.format_version && plan.planned_values))) throw new Error('Expected Terraform plan JSON with resource_changes');
  const resources = plan.resource_changes || [];
  const changes = resources.filter(item => item.mode !== 'data' && item.change.actions.some(action => !['no-op', 'read'].includes(action)));
  const blocked = [], notes = [];
  if (plan.errored || plan.complete === false) blocked.push('Incomplete or errored plan; do not use a targeted or deferred plan for this deployment.');
  for (const item of changes) {
    const actions = item.change.actions;
    if (scope === 'merchant-db-bootstrap') {
      const permitted = item.address === bootstrapInvocation
        ? merchantBootstrap(item) && (actions.join('/') === 'create' || actions.join('/') === 'delete/create')
        : actions.join('/') === 'create' || (item.address === 'aws_lambda_function.db_bootstrap[0]' && actions.join('/') === 'update');
      if (!bootstrapResources.has(item.address) || !permitted) {
        blocked.push(`${item.address}: changes outside the temporary merchant database runner are not permitted`);
      }
      continue;
    }
    if (merchantBootstrap(item)) blocked.push(`${item.address}: use the separate merchant-db-bootstrap scope review`);
    if (scope === 'merchant-registration') {
      if (merchantResources.get(item.address) !== item.type || actions.length !== 1 || actions[0] !== 'create') {
        blocked.push(`${item.address}: initial merchant registration permits only dedicated Preview resource creation`);
      }
      continue;
    }
    if (merchantResources.has(item.address)) blocked.push(`${item.address}: use the separate merchant-registration scope review`);
    if(scope==='owner-identity'){
      if(identityResources.get(item.address)!==item.type||actions.length!==1||actions[0]!=='create')blocked.push(`${item.address}: identity activation permits only the four new Preview Cognito resources`);
    }else if(item.type.startsWith('aws_cognito_'))blocked.push(`${item.address}: use the separate owner-identity scope review`);
    const migration = item.address === 'aws_lambda_invocation.db_bootstrap[0]' && actions.includes('create');
    if (actions.includes('delete') && !migration) blocked.push(`${item.address}: deletion or replacement`);
    if (/^aws_(db_instance|db_subnet_group|vpc|subnet|route_table|security_group|vpc_security_group_|vpc_endpoint|s3_|cloudfront_)/.test(item.type)) blocked.push(`${item.address}: protected database, network or media resource changed`);
    if (/^aws_iam_/.test(item.type)) blocked.push(`${item.address}: IAM change requires separate scope review`);
    if (item.type === 'aws_cloudwatch_metric_alarm') {
      const before = item.change.before || {}, after = item.change.after || {};
      for (const key of ['alarm_actions', 'ok_actions']) {
        if (Array.isArray(before[key]) && before[key].length && (!Array.isArray(after[key]) || !after[key].length)) blocked.push(`${item.address}: existing ${key} notifications would be removed or are unknown`);
      }
      if (before.actions_enabled !== false && after.actions_enabled === false) blocked.push(`${item.address}: alarm actions would be disabled`);
    }
    if (migration) notes.push('The checksum-protected database bootstrap will run; review its package and migration ledger before apply.');
  }
  if(scope==='owner-identity'&&(changes.length!==4||[...identityResources.keys()].some(address=>!changes.some(item=>item.address===address))))blocked.push('Expected exactly four Preview owner identity resources; inspect any missing or extra changes.');
  if (scope === 'merchant-registration' && [...merchantResources.keys()].some(address => !changes.some(item => item.address === address))) {
    blocked.push('The initial merchant registration plan must include every dedicated Preview resource.');
  }
  if (scope === 'merchant-db-bootstrap' && !changes.some(merchantBootstrap)) {
    blocked.push('Expected the explicit merchant database bootstrap invocation.');
  }
  return { changes: changes.map(item => ({ address: item.address, actions: item.change.actions })), blocked: [...new Set(blocked)], notes: [...new Set(notes)] };
}
module.exports = { review };
if (require.main === module) {
  try {
    const option = process.argv[2];
    const scope = ['--owner-identity', '--merchant-registration', '--merchant-db-bootstrap'].includes(option) ? option.slice(2) : 'general';
    const result = review(JSON.parse(fs.readFileSync(process.argv[scope === 'general' ? 2 : 3] || 0, 'utf8')), scope);
    for (const change of result.changes) console.log(`${change.actions.join('/')} ${change.address}`);
    for (const note of result.notes) console.log('NOTE: ' + note);
    for (const reason of result.blocked) console.log('BLOCKED: ' + reason);
    console.log(result.blocked.length ? 'Do not apply this plan. Resolve the blocked changes first.' : 'Scope check passed. Review the full saved plan before applying; this is not an approval.');
    process.exitCode = result.blocked.length ? 2 : 0;
  } catch {
    console.error('Cannot review plan JSON. No plan values were printed.');
    process.exitCode = 1;
  }
}

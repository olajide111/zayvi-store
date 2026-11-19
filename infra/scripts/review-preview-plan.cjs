const fs = require('node:fs');

function review(plan) {
  if (!plan || (!Array.isArray(plan.resource_changes) && !(plan.format_version && plan.planned_values))) throw new Error('Expected Terraform plan JSON with resource_changes');
  const resources = plan.resource_changes || [];
  const changes = resources.filter(item => item.mode !== 'data' && item.change.actions.some(action => !['no-op', 'read'].includes(action)));
  const blocked = [], notes = [];
  if (plan.errored || plan.complete === false) blocked.push('Incomplete or errored plan; do not use a targeted or deferred plan for this deployment.');
  for (const item of changes) {
    const actions = item.change.actions;
    const migration = item.address === 'aws_lambda_invocation.db_bootstrap[0]' && actions.includes('create');
    if (actions.includes('delete') && !migration) blocked.push(`${item.address}: deletion or replacement`);
    if (/^aws_(db_instance|db_subnet_group|vpc|subnet|route_table|security_group|vpc_security_group_|vpc_endpoint|s3_|cloudfront_)/.test(item.type)) blocked.push(`${item.address}: protected database, network or media resource changed`);
    if (/^aws_iam_/.test(item.type)) blocked.push(`${item.address}: IAM change requires separate scope review`);
    if (migration) notes.push('The checksum-protected database bootstrap will run; review its package and migration ledger before apply.');
  }
  return { changes: changes.map(item => ({ address: item.address, actions: item.change.actions })), blocked: [...new Set(blocked)], notes: [...new Set(notes)] };
}
module.exports = { review };
if (require.main === module) {
  try {
    const result = review(JSON.parse(fs.readFileSync(process.argv[2] || 0, 'utf8')));
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

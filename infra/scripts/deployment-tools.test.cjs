const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { archive } = require('./package-lambda.cjs');
const { review } = require('./review-preview-plan.cjs');

const change = (type, actions, address = type + '.test') => ({ mode: 'managed', address, type, change: { actions, before: { secret: 'must-not-appear' }, after: {} } });
const plan = (...resource_changes) => ({ resource_changes });

test('archive has stable ordering/metadata and passes an independent ZIP reader', () => {
  const files = [{name:'index.js',bytes:Buffer.from('exports.handler = async () => {};')},{name:'migrations/0028_example.sql',bytes:Buffer.from('SELECT 1;\n')}];
  const bytes = archive(files);
  assert.deepEqual(bytes, archive([...files].reverse()));
  const root = mkdtempSync(path.join(tmpdir(), 'zayvi-archive-test-'));
  try {
    const file=path.join(root,'test.zip');writeFileSync(file,bytes);
    execFileSync('unzip',['-t',file]);
    assert.equal(execFileSync('unzip',['-p',file,'migrations/0028_example.sql']).toString(),'SELECT 1;\n');
  } finally {rmSync(root,{recursive:true,force:true});}
  assert.throws(()=>archive([{name:'../escape',bytes:Buffer.from('x')}]),/Unsafe/);
});

test('scope review accepts alarms and code updates, excludes read-only/no-op items', () => {
  const report=review(plan(change('aws_cloudwatch_metric_alarm',['create']),change('aws_lambda_function',['update']),change('aws_db_instance',['no-op'])));
  assert.equal(report.blocked.length,0);assert.equal(report.changes.length,2);
  assert.ok(!JSON.stringify(report).includes('must-not-appear'));
});

test('scope review blocks protected resource updates, deletion and unrelated IAM', () => {
  for (const type of ['aws_db_instance','aws_s3_bucket','aws_cloudfront_distribution','aws_vpc','aws_subnet','aws_security_group','aws_iam_role_policy']) {
    assert.ok(review(plan(change(type,['update']))).blocked.length,type);
  }
  assert.ok(review(plan(change('aws_lambda_function',['delete','create']))).blocked.length);
});

test('only migration invocation replacement is exempted, and it requires review', () => {
  const report=review(plan(change('aws_lambda_invocation',['delete','create'],'aws_lambda_invocation.db_bootstrap[0]')));
  assert.equal(report.blocked.length,0);assert.equal(report.notes.length,1);
  assert.ok(review(plan(change('aws_lambda_invocation',['delete'],'aws_lambda_invocation.db_bootstrap[0]'))).blocked.length);
  assert.ok(review(plan(change('aws_lambda_invocation',['delete','create'],'aws_lambda_invocation.other'))).blocked.length);
  assert.throws(()=>review({}),/Expected/);
});

test('no-change plans are readable and incomplete plans cannot pass', () => {
  assert.equal(review({format_version:'1.2',planned_values:{}}).changes.length,0);
  assert.ok(review({...plan(),complete:false}).blocked.length);
  assert.ok(review({...plan(),errored:true}).blocked.length);
});

// Exercise the deployment shell flow with fake local CLIs, never AWS.
const { chmodSync, mkdirSync, copyFileSync, readFileSync, symlinkSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
function planFixture(account,options={}) {
  const root=mkdtempSync(path.join(tmpdir(),'zayvi-plan-flow-'));
  mkdirSync(path.join(root,'bin'));mkdirSync(path.join(root,'infra/terraform'),{recursive:true});mkdirSync(path.join(root,'infra/scripts'));
  copyFileSync(path.join(__dirname,'review-preview-plan.cjs'),path.join(root,'infra/scripts/review-preview-plan.cjs'));
  const commands={
    git: `#!/bin/sh\ncase "$*" in\n'rev-parse --show-toplevel') echo "$FIXTURE_ROOT";;\n'rev-parse HEAD') echo reviewed-commit;;\nstatus*) ;;\nesac\n`,
    aws: `#!/bin/sh\necho "aws $*" >> "$FIXTURE_TRACE"\ncase "$1 $2" in\n'sts get-caller-identity') echo "$FIXTURE_ACCOUNT";;\n'lambda get-function-configuration') echo arn:aws:secretsmanager:eu-west-2:001961766018:secret:zayvi/preview/webhook-abc123;;\n'cloudwatch describe-alarms') echo arn:aws:sns:eu-west-2:001961766018:zayvi-preview-alerts;;\n'secretsmanager describe-secret') echo existing-arn;;\nesac\n`,
    npm: `#!/bin/sh\necho "npm $*" >> "$FIXTURE_TRACE"\n`,
    terraform: `#!/bin/sh\necho "terraform $* alarm-topic=$TF_VAR_operational_alarm_topic_arn" >> "$FIXTURE_TRACE"\ncase "$1" in\nworkspace) echo default;;\nstate) printf '%s\\n' aws_lambda_function.api aws_db_instance.postgres aws_apigatewayv2_stage.default 'aws_lambda_function.db_bootstrap[0]';;\nplan) exit 2;;\nshow) printf '%s\\n' \"$FIXTURE_PLAN\";;\nesac\n`,
  };
  for(const [name,body] of Object.entries(commands)){const file=path.join(root,'bin',name);writeFileSync(file,body);chmodSync(file,0o700);}
  symlinkSync(process.execPath,path.join(root,'bin/node'));
  const trace=path.join(root,'trace');
  const result=spawnSync(process.env.ZAYVI_TEST_BASH||'bash',[path.join(__dirname,'preview-plan.sh'),...(options.args||[])],{encoding:'utf8',env:{...process.env,PATH:path.join(root,'bin')+':'+process.env.PATH,FIXTURE_ROOT:root,FIXTURE_TRACE:trace,FIXTURE_ACCOUNT:account,FIXTURE_PLAN:JSON.stringify(options.plan||{resource_changes:[{mode:'managed',type:'aws_cloudwatch_metric_alarm',address:'aws_cloudwatch_metric_alarm.test',change:{actions:['create'],after:{secret:'hidden-test-value'}}}]}),TF_VAR_kredal_preview_webhook_secret_arn:'',TF_VAR_operational_alarm_topic_arn:''}});
  return {root,result,trace:require('node:fs').existsSync(trace)?readFileSync(trace,'utf8'):''};
}

test('wrong AWS account stops before any Terraform invocation',()=>{
  const fixture=planFixture('999999999999');
  try{assert.notEqual(fixture.result.status,0);assert.ok(!fixture.trace.includes('terraform'));}
  finally{rmSync(fixture.root,{recursive:true,force:true});}
});

test('plan helper preserves active inputs, handles plan exit 2, never applies or fetches secret values',()=>{
  const fixture=planFixture('001961766018');
  try{
    assert.equal(fixture.result.status,0,fixture.result.stderr);
    assert.ok(fixture.trace.includes('-var=enable_db_bootstrap=true'));
    assert.ok(fixture.trace.includes('-var=kredal_preview_webhook_secret_arn=arn:aws:secretsmanager:eu-west-2:001961766018:secret:'));
    assert.ok(fixture.trace.includes('cloudwatch describe-alarms'));
    assert.ok(fixture.trace.includes('alarm-topic=arn:aws:sns:eu-west-2:001961766018:zayvi-preview-alerts'));
    assert.ok(!fixture.trace.includes('-target'));assert.ok(!fixture.trace.includes('terraform apply'));
    assert.ok(!fixture.trace.includes('get-secret-value'));
    assert.ok(!fixture.result.stdout.includes('hidden-test-value'));
    assert.ok(fixture.result.stdout.includes(`terraform -chdir="${fixture.root}/infra/terraform" show`));
    assert.ok(fixture.result.stdout.includes(`terraform -chdir="${fixture.root}/infra/terraform" apply`));
  }finally{rmSync(fixture.root,{recursive:true,force:true});}
});

test('commerce entry preserves responses/exceptions and marks only handled 5xx without payloads',async()=>{
  const vm=require('node:vm');let response={statusCode:503,body:'private-test-payload'};const logs=[];
  const exports={};
  vm.runInNewContext(readFileSync(path.join(__dirname,'../lambda/handler.js'),'utf8'),{
    exports,require:()=>({handler:async()=>{if(response instanceof Error)throw response;return response;}}),console:{error:message=>logs.push(message)},
  });
  assert.equal(await exports.handler({}),response);
  assert.equal(logs.length,1);assert.ok(logs[0].includes('commerce_server_error'));assert.ok(!logs[0].includes('private-test-payload'));
  for(const statusCode of [200,400,401,404]){response={statusCode};assert.equal(await exports.handler({}),response);}
  assert.equal(logs.length,1);
  response=new Error('runtime failure');await assert.rejects(()=>exports.handler({}),/runtime failure/);
});


test('owner identity activation is isolated from ordinary Preview plans',()=>{
 const types=['aws_cognito_user_pool','aws_cognito_user_pool_client','aws_cognito_user_pool_domain','aws_cognito_resource_server'];
 const resources=types.map(type=>change(type,['create'],type+'.preview_owners[0]'));
 assert.equal(review(plan(...resources),'owner-identity').blocked.length,0);
 assert(review(plan(...resources)).blocked.length);
 for(const bad of [plan(...resources.slice(1)),plan(...resources,change('aws_lambda_function',['update'])),plan(...resources.map((r,i)=>i? r:change(types[0],['delete','create'],types[0]+'.preview_owners[0]'))),plan(...resources,change('aws_db_instance',['update']))])assert(review(bad,'owner-identity').blocked.length);
 assert(review({...plan(...resources),complete:false},'owner-identity').blocked.length);
});


test('owner plan shell selects its strict scope and generic scope rejects identity resources',()=>{
 const resources=['aws_cognito_user_pool','aws_cognito_user_pool_client','aws_cognito_user_pool_domain','aws_cognito_resource_server'].map(type=>change(type,['create'],type+'.preview_owners[0]'));
 for(const [args,status] of [[['--owner-identity'],0],[[],2]]){
  const fixture=planFixture('001961766018',{args,plan:plan(...resources)});
  try{assert.equal(fixture.result.status,status,fixture.result.stderr);assert(!fixture.trace.includes('terraform apply'));assert(!fixture.result.stderr.includes('unbound variable'));}
  finally{rmSync(fixture.root,{recursive:true,force:true});}
 }
});

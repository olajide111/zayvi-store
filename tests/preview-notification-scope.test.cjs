const test=require('node:test');
const assert=require('node:assert/strict');
const {review}=require('../infra/scripts/review-preview-plan.cjs');
const topic='arn:aws:sns:eu-west-2:001961766018:zayvi-preview-alerts';
function plan(after){return {resource_changes:[{address:'aws_cloudwatch_metric_alarm.application_failures["commerce"]',type:'aws_cloudwatch_metric_alarm',mode:'managed',change:{actions:['update'],before:{alarm_actions:[topic],ok_actions:[topic],actions_enabled:true},after}}]};}
test('Preview scope review blocks removal of established alarm or recovery notifications',()=>{
 for(const after of [{alarm_actions:[],ok_actions:[topic]},{alarm_actions:[topic],ok_actions:[]},{alarm_actions:null,ok_actions:[topic]},{alarm_actions:[topic],ok_actions:[topic],actions_enabled:false}])assert.ok(review(plan(after)).blocked.length);
});
test('preserved notification actions allow unrelated alarm threshold updates',()=>{
 assert.equal(review(plan({alarm_actions:[topic],ok_actions:[topic],actions_enabled:true,threshold:2})).blocked.length,0);
});

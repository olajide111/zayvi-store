export function validateThemeRelease(input:unknown){
 if(!input||typeof input!=='object')throw new Error('A release request is required.');
 const v=input as Record<string,unknown>,uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!['publish','rollback'].includes(String(v.action)))throw new Error('Choose publish or rollback.');
 if(typeof v.versionId!=='string'||!uuid.test(v.versionId))throw new Error('Choose a saved version.');
 if(v.expectedReleaseId!==null&&(typeof v.expectedReleaseId!=='string'||!uuid.test(v.expectedReleaseId)))throw new Error('Refresh the current release before continuing.');
 if(typeof v.reason!=='string'||!v.reason.trim()||v.reason.length>500)throw new Error('Enter a release note of up to 500 characters.');
 return {action:v.action as 'publish'|'rollback',versionId:v.versionId,expectedReleaseId:v.expectedReleaseId as string|null,reason:v.reason.trim()};
}
export function previewReleasesEnabled(env:Record<string,string|undefined>){return env.THEME_RELEASE_MODE==='preview'&&env.AWS_LAMBDA_FUNCTION_NAME==='zayvi-preview-api';}

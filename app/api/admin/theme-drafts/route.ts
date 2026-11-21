import {NextRequest,NextResponse} from 'next/server';
import {hasAdminSession} from '@/lib/admin-auth';
import {callZayviAwsApi} from '@/lib/aws-api';
import {validateThemeDraft} from '@/lib/theme-draft';
async function handle(request:NextRequest,save:boolean){
 if(!hasAdminSession(request))return NextResponse.json({error:'Unauthorised'},{status:401});
 let body;
 if(save){try{const v=validateThemeDraft(await request.json());body={themeId:v.theme.id,draft:v.config.draft,baseVersion:v.baseVersion};}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid draft.'},{status:400});}}
 const result=await callZayviAwsApi('/theme-drafts',save?{method:'POST',body}:undefined);
 const error=result.data as {error?:string}|null;
 return NextResponse.json(result.ok?result.data:{error:result.status===409?error?.error:'Theme drafts unavailable. Check Preview API and migration 0030.'},{status:result.ok?200:result.status||503,headers:{'Cache-Control':'no-store'}});
}
export const GET=(r:NextRequest)=>handle(r,false);
export const POST=(r:NextRequest)=>handle(r,true);

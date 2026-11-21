import {NextRequest,NextResponse} from 'next/server';
import {hasAdminSession} from '@/lib/admin-auth';
import {callZayviAwsApi} from '@/lib/aws-api';
import {validateThemeRelease} from '@/lib/theme-release';
async function handle(request:NextRequest,save:boolean){
 if(!hasAdminSession(request))return NextResponse.json({error:'Unauthorised'},{status:401});
 let body;
 if(save){try{body=validateThemeRelease(await request.json());}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid release.'},{status:400});}}
 const result=await callZayviAwsApi('/theme-release',save?{method:'POST',body}:undefined);
 const data=result.data as {error?:string}|null;
 return NextResponse.json(result.ok?result.data:{error:[400,404,409].includes(result.status)?data?.error:'Preview releases unavailable. Check API and migration 0031.'},{status:result.ok?200:result.status||503,headers:{'Cache-Control':'no-store'}});
}
export const GET=(r:NextRequest)=>handle(r,false);
export const POST=(r:NextRequest)=>handle(r,true);

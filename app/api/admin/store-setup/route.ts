import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin-auth';
import { callZayviAwsApi } from '@/lib/aws-api';
import { validateStoreSetup } from '@/lib/store-setup';
async function handle(request: NextRequest, save: boolean) {
  if (!hasAdminSession(request)) return NextResponse.json({error:'Unauthorised'},{status:401});
  let body;
  if (save) { try { body = validateStoreSetup(await request.json()); } catch(error) { return NextResponse.json({error: error instanceof Error ? error.message : 'Invalid details.'},{status:400}); } }
  const result = await callZayviAwsApi('/store-setup', save ? {method:'PUT',body} : undefined);
  return NextResponse.json(result.ok ? result.data : {error:result.status===400?'The Preview API rejected these setup choices. Update the matching commerce API before saving newly added themes.':'Store setup unavailable. Check the Preview API and migration 0029.'},{status:result.ok ? 200 : result.status || 503,headers:{'Cache-Control':'no-store'}});
}
export const GET = (request: NextRequest) => handle(request,false);
export const PUT = (request: NextRequest) => handle(request,true);

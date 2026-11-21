import {callZayviAwsApi} from '@/lib/aws-api';
import {resolveStudioInitial} from '@/lib/theme-studio-initial';
import {cookies} from 'next/headers';
import {ADMIN_COOKIE,isAdminSessionCookieValid} from '@/lib/admin-auth';
import {notFound} from 'next/navigation';
import ThemeStudio from '@/components/themes/ThemeStudio';
import {ALL_STUDIO_THEMES as THEME_DESIGNS} from '@/lib/theme-registry';
export default async function Page({params}:{params:Promise<{themeId:string}>}){const {themeId}=await params;const theme=THEME_DESIGNS.find(t=>t.id===themeId);if(!theme)notFound();const session=(await cookies()).get(ADMIN_COOKIE)?.value;
 let platformAdmin=false;
 try{platformAdmin=isAdminSessionCookieValid(session);}catch{platformAdmin=false;}
 let initialBaseVersion:number|undefined;
 let initial:ReturnType<typeof resolveStudioInitial>={source:'Theme defaults or browser draft'};
 if(platformAdmin){
   const results=await Promise.allSettled([callZayviAwsApi('/theme-drafts'),callZayviAwsApi('/store-setup')]);
   const data=results.map(r=>r.status==='fulfilled'&&r.value.ok?r.value.data:null);
   initial=resolveStudioInitial(theme,data[0],data[1]);
   const history=data[0] as {baseVersion?:unknown}|null;
   if(Number.isSafeInteger(history?.baseVersion))initialBaseVersion=history?.baseVersion as number;
 }
 return <ThemeStudio key={theme.id} theme={theme} platformAdmin={platformAdmin} initialBaseVersion={initialBaseVersion} initialDraft={initial.draft} initialSource={initial.source}/>;}

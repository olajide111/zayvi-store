import {cookies} from 'next/headers';
import {ADMIN_COOKIE,isAdminSessionCookieValid} from '@/lib/admin-auth';
import {notFound} from 'next/navigation';
import ThemeStudio from '@/components/themes/ThemeStudio';
import {THEME_DESIGNS} from '@/lib/theme-designs';
export default async function Page({params}:{params:Promise<{themeId:string}>}){const {themeId}=await params;const theme=THEME_DESIGNS.find(t=>t.id===themeId);if(!theme)notFound();const session=(await cookies()).get(ADMIN_COOKIE)?.value;
 let platformAdmin=false;
 try{platformAdmin=isAdminSessionCookieValid(session);}catch{platformAdmin=false;}
 return <ThemeStudio theme={theme} platformAdmin={platformAdmin}/>;}

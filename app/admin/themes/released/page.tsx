import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {ADMIN_COOKIE,isAdminSessionCookieValid} from '@/lib/admin-auth';
import {callZayviAwsApi} from '@/lib/aws-api';
import {resolveReleasedTheme} from '@/lib/released-theme';
import ThemedShop from '@/components/themes/ThemedShop';
export const dynamic='force-dynamic';
export default async function ReleasedTheme(){
 let authorised=false;try{authorised=isAdminSessionCookieValid((await cookies()).get(ADMIN_COOKIE)?.value);}catch{}
 if(!authorised)notFound();
 const response=await callZayviAwsApi('/theme-release');
 const release=response.ok?resolveReleasedTheme(response.data):null;
 if(!release)return <main className="p-8"><h1>No Preview release available</h1><p>Enable the Preview release service and record a saved design first.</p><Link href="/admin/themes/releases">Back to release review</Link></main>;
 const d=release.config.draft;
 return <><div className="flex flex-wrap gap-4 border-b p-3"><Link href="/admin/themes/releases">Back to release history</Link><span>Released design · {release.releaseId} · No real checkout</span></div><ThemedShop theme={release.theme} brand={d.brand} headline={d.headline} font={d.font} motion={d.motion} palette={d.palette} colourInput={d.colours} source="store" view="home"/></>;
}

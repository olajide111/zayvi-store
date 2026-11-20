import {notFound} from 'next/navigation';
import {ALL_STUDIO_THEMES as THEME_DESIGNS} from '@/lib/theme-registry';
import ThemeDemo from '@/components/themes/ThemeDemo';
export default async function Page({params,searchParams}:{params:Promise<{themeId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [{themeId},q]=await Promise.all([params,searchParams]);const theme=THEME_DESIGNS.find(t=>t.id===themeId);if(!theme)notFound();
 const safe=new URLSearchParams();for(const k of ['brand','headline','font','palette','motion','source','view','showroom','canvas','ink','accent'])if(typeof q[k]==='string')safe.set(k,q[k].slice(0,200));
 return <ThemeDemo theme={theme} query={safe.toString()}/>;
}

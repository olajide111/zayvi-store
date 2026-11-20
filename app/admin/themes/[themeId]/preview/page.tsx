import {notFound} from 'next/navigation';
import ThemedShop from '@/components/themes/ThemedShop';
import {THEME_DESIGNS} from '@/lib/theme-designs';
export default async function Page({params,searchParams}:{params:Promise<{themeId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [{themeId},q]=await Promise.all([params,searchParams]);const theme=THEME_DESIGNS.find(t=>t.id===themeId);if(!theme)notFound();
 const value=(k:string)=>typeof q[k]==='string'?q[k] as string:'';
 return <ThemedShop theme={theme} brand={value('brand').slice(0,80)} headline={value('headline').slice(0,160)} motion={value('motion')} font={value('font')} view={value('view')} source={value('source')} palette={value('palette')}/>;
}

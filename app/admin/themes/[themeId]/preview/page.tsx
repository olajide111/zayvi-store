import {notFound} from 'next/navigation';
import ZdxStudioPreview from '@/components/storefront-directions/ZdxStudioPreview';
import LondonSignaturePreview from '@/components/storefront-directions/LondonSignaturePreview';
import ThemedShop from '@/components/themes/ThemedShop';
import {ALL_STUDIO_THEMES as THEME_DESIGNS} from '@/lib/theme-registry';
export default async function Page({params,searchParams}:{params:Promise<{themeId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [{themeId},q]=await Promise.all([params,searchParams]);const theme=THEME_DESIGNS.find(t=>t.id===themeId);if(!theme)notFound();
 const value=(k:string)=>typeof q[k]==='string'?q[k] as string:'';
 if(theme.signatureFamily)return <LondonSignaturePreview theme={theme} brand={value('brand')} palette={value('palette')} font={value('font')} motion={value('motion')} view={value('view')} colours={{canvas:value('canvas'),ink:value('ink'),accent:value('accent')}}/>;
 if(theme.directionFamily)return <ZdxStudioPreview theme={theme} brand={value('brand')} palette={value('palette')} font={value('font')} motion={value('motion')} view={['home','collection','product','bag'].includes(value('view'))?value('view'):'home'} colours={{canvas:value('canvas'),ink:value('ink'),accent:value('accent')}}/>;
 return <ThemedShop colourInput={{canvas:value('canvas'),ink:value('ink'),accent:value('accent')}} showroom={value('showroom')==='3d'?'3d':'photo'} theme={theme} brand={value('brand').slice(0,80)} headline={value('headline').slice(0,160)} motion={value('motion')} font={value('font')} view={value('view')} source={value('source')} palette={value('palette')}/>;
}

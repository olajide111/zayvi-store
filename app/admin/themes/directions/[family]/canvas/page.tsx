import {notFound} from 'next/navigation';
import {getDirection} from '@/lib/storefront-theme-directions';
import ZdxCanvas from '@/components/storefront-directions/ZdxCanvas';
export default async function Page({params,searchParams}:{params:Promise<{family:string}>;searchParams:Promise<{device?:string;screen?:string}>}){const [{family},q]=await Promise.all([params,searchParams]);const d=getDirection(family);if(!d)notFound();return <ZdxCanvas family={d.family} device={q.device==='mobile'?'mobile':'desktop'} screen={['home','collection','product','bag'].includes(q.screen||'')?q.screen!:'home'}/>;}

import {notFound} from 'next/navigation';
import {getDirection,DIRECTION_FAMILIES} from '@/lib/storefront-theme-directions';
import ZdxDevicePreview from '@/components/storefront-directions/ZdxDevicePreview';
export function generateStaticParams(){return DIRECTION_FAMILIES.map(family=>({family}));}
export default async function Page({params}:{params:Promise<{family:string}>}){const {family}=await params;const d=getDirection(family);if(!d)notFound();return <ZdxDevicePreview family={d.family} name={d.name}/>;}

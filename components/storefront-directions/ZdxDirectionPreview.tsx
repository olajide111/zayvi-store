"use client";
import type {DirectionFamily} from '@/lib/storefront-theme-directions';
import ShowroomDesktop from './generated/showroom-desktop';
import ShowroomMobile from './generated/showroom-mobile';
import EditorialDesktop from './generated/editorial-desktop';
import EditorialMobile from './generated/editorial-mobile';
import MarketDesktop from './generated/market-desktop';
import MarketMobile from './generated/market-mobile';
import AtelierDesktop from './generated/atelier-desktop';
import AtelierMobile from './generated/atelier-mobile';
import FreshDesktop from './generated/fresh-desktop';
import FreshMobile from './generated/fresh-mobile';
import SpecDesktop from './generated/spec-desktop';
import SpecMobile from './generated/spec-mobile';
const renderers={
 'fashion-showroom':[ShowroomDesktop,ShowroomMobile],
 'african-editorial':[EditorialDesktop,EditorialMobile],
 'modern-marketplace':[MarketDesktop,MarketMobile],
 'atelier-minimal':[AtelierDesktop,AtelierMobile],
 'fresh-market':[FreshDesktop,FreshMobile],
 'spec-sheet':[SpecDesktop,SpecMobile],
} as const;
export default function ZdxDirectionPreview({family,device='desktop',screen='home'}:{family:DirectionFamily;device?:string;screen?:string}){
 const Renderer=renderers[family][device==='mobile'?1:0];
 return <Renderer screen={screen}/>;
}

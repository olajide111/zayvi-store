"use client";
import type {DirectionFamily} from '@/lib/storefront-theme-directions';
import ShowroomDesktop from './generated/showroom-desktop';
import ShowroomMobile from './generated/showroom-mobile';
import {AfricanEditorial,FreshMarket,SpecSheet,Forma} from './ZdxRefinedStorefronts';
import Marketplace from './ZdxMarketplacePreview';


const renderers={
 'fashion-showroom':[ShowroomDesktop,ShowroomMobile],
 'african-editorial':[AfricanEditorial,AfricanEditorial],
 'modern-marketplace':[Marketplace,Marketplace],
 'atelier-minimal':[Forma,Forma],
 'fresh-market':[FreshMarket,FreshMarket],
 'spec-sheet':[SpecSheet,SpecSheet],
} as const;
export default function ZdxDirectionPreview({family,device='desktop',screen='home'}:{family:DirectionFamily;device?:string;screen?:string}){
 if(family==='modern-marketplace')return <Marketplace initialScreen={screen}/>;
 if(family==='african-editorial')return <AfricanEditorial initialScreen={screen}/>;
 if(family==='fresh-market')return <FreshMarket initialScreen={screen}/>;
 if(family==='atelier-minimal')return <Forma initialScreen={screen}/>;
 if(family==='spec-sheet')return <SpecSheet initialScreen={screen}/>;
 const Renderer=renderers[family][device==='mobile'?1:0];
 return <Renderer screen={screen}/>;
}

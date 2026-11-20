'use client';
import type {StudioTheme} from '@/lib/theme-registry';
import {customColours} from '@/lib/theme-colours';
import {ZdxAppearanceContext} from './zdx-runtime';
import {Mayfair,Camden} from './ZdxRefinedStorefronts';
import './zdx-fonts.css';
export default function LondonSignaturePreview({theme,brand,palette,font,motion,view,colours}:{theme:StudioTheme;brand:string;palette:string;font:string;motion:string;view:string;colours:Record<string,string>}){
 const presets:Record<string,Record<string,string>>={light:{canvas:'#f9fafb',ink:'#1d2936',accent:'#263d57'},dark:{canvas:'#171c22',ink:'#f5f7fa',accent:'#e1e8ed'},forest:{canvas:'#eef4ed',ink:'#203e2d',accent:'#28523a'}};
 const custom=palette==='custom'||Boolean(presets[palette]),chosen=customColours(palette==='custom'?colours:presets[palette],theme);
 const appearance={brand:brand.slice(0,80),replacements:{},colours:custom?chosen:null,font:font==='serif'?'Georgia,serif':font==='sans'?'Arial,sans-serif':null};
 return <ZdxAppearanceContext.Provider value={appearance}><div className={motion==='off'?'zdx-motion-off':''}><style>{'.zdx-motion-off *{animation:none!important;transition:none!important;scroll-behavior:auto!important}'}</style><div style={{background:'#eee9df',color:'#473c37',font:'11px/1.7 Arial,sans-serif',padding:'8px 16px'}}>LONDON SIGNATURE · SAMPLE PRODUCTS, ILLUSTRATIONS & PRICES · NO REAL ORDERS OR PAYMENTS</div>{theme.signatureFamily==='mayfair'?<Mayfair initialScreen={view}/>:<Camden initialScreen={view}/>}</div></ZdxAppearanceContext.Provider>;
}

'use client';
import {useEffect,useState} from 'react';
import {ZdxAppearanceContext} from './zdx-runtime';
import ZdxCanvas from './ZdxCanvas';
import type {StudioTheme} from '@/lib/theme-registry';
import {getDirection} from '@/lib/storefront-theme-directions';
import {customColours} from '@/lib/theme-colours';
export default function ZdxStudioPreview({theme,brand,palette,font,motion,view,colours}:{theme:StudioTheme;brand:string;palette:string;font:string;motion:string;view:string;colours:Record<string,string>}){
 const [device,setDevice]=useState(''),[ready,setReady]=useState(false);
 useEffect(()=>{const query=matchMedia('(max-width: 999px)');const update=()=>{setDevice(query.matches?'mobile':'desktop');setReady(true);};update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 const definition=getDirection(theme.directionFamily!);if(!definition)return null;
 const presets:Record<string,Record<string,string>>={light:{canvas:'#f9fafb',ink:'#1d2936',accent:'#263d57'},dark:{canvas:'#171c22',ink:'#f5f7fa',accent:'#e1e8ed'},forest:{canvas:'#eef4ed',ink:'#203e2d',accent:'#28523a'}};
 const custom=palette==='custom'||Boolean(presets[palette]);const chosen=customColours(palette==='custom'?colours:presets[palette],theme);
 const replacements:Record<string,string>={};if(custom){for(const [key,value] of Object.entries(definition.defaultColours))replacements[value.toLowerCase()]=['text','ink'].includes(key)?chosen.ink:['accent','primary','leaf'].includes(key)?chosen.accent:chosen.canvas;replacements['#ffffff']=chosen.canvas;replacements['#fff']=chosen.canvas;}
 const appearance={brand:brand.slice(0,80),replacements,colours:custom?chosen:null,font:font==='serif'?'Georgia,serif':font==='sans'?'Arial,sans-serif':null};
 if(!ready)return <p role="status" style={{padding:24}}>Preparing the responsive design…</p>;
 return <ZdxAppearanceContext.Provider value={appearance}><div className={`zdx-responsive ${motion==='off'?'zdx-motion-off':''} ${appearance.font?'zdx-font-override':''}`} style={{'--zdx-font':appearance.font||'inherit'} as React.CSSProperties}><style>{`.zdx-responsive .zdx-root>div{width:100%!important}.zdx-motion-off *{animation:none!important;transition:none!important;scroll-behavior:auto!important}.zdx-font-override .zdx-root *{font-family:var(--zdx-font)!important}`}</style><ZdxCanvas family={theme.directionFamily!} device={device} screen={view}/></div></ZdxAppearanceContext.Provider>;
}

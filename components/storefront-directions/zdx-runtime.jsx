"use client";
import React from 'react';
export const ZdxAppearanceContext=React.createContext(/** @type {{brand:string,replacements:Record<string,string>,colours:null|{canvas:string,ink:string,accent:string,accentInk:string},font:string|null}} */ ({brand:'',replacements:{},colours:null,font:null}));
export class DCLogic extends React.Component {static contextType=ZdxAppearanceContext;}
// Parses trusted, checked-in design style values. No merchant HTML/CSS or runtime source execution.
export function css(text,appearance){
 if(!text||typeof text!=='string')return {};
 const result=Object.fromEntries(text.split(';').map(s=>s.trim()).filter(Boolean).map(s=>{const at=s.indexOf(':');if(at<0)return null;let key=s.slice(0,at).trim();key=key.replace(/-([a-z])/g,(_,x)=>x.toUpperCase());return [key,s.slice(at+1).trim()];}).filter(Boolean));
 if(result.position==='absolute'&&result.transition?.includes('top ')){const top=result.top;result.top='0px';result.transform=`translateY(${top}) ${result.transform||''}`;let depth=0,part='',parts=[];for(const c of result.transition){if(c==='(')depth++;if(c===')')depth--;if(c===','&&depth===0){parts.push(part);part='';}else part+=c;}parts.push(part);result.transition=parts.filter(t=>!/^\s*top /.test(t)).join(',');}
 if(appearance?.colours){for(const key of Object.keys(result)){if(typeof result[key]==='string')result[key]=result[key].replace(/#[0-9a-f]{3,6}\b/gi,value=>appearance.replacements[value.toLowerCase()]||value);}if(result.background===appearance.colours.accent||result.backgroundColor===appearance.colours.accent)result.color=appearance.colours.accentInk;}
 return result;
}

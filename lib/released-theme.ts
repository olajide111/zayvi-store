import {validateThemeDraft} from './theme-draft';
export function previewThemeStorefrontEnabled(env:Record<string,string|undefined>){return env.VERCEL_ENV==='preview'&&env.ZAYVI_PREVIEW_THEME_STOREFRONT==='enabled';}
export function resolveReleasedTheme(value:unknown){
 if(!value||typeof value!=='object')return null;
 const v=value as {enabled?:unknown;current?:unknown;design?:{themeId?:unknown;draft?:unknown}};
 if(v.enabled!==true||typeof v.current!=='string'||!v.design)return null;
 try{return {...validateThemeDraft({themeId:v.design.themeId,draft:v.design.draft,baseVersion:0}),releaseId:v.current};}catch{return null;}
}

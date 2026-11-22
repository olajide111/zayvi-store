import {ALL_STUDIO_THEMES} from './theme-registry';
import {customColours,contrastRatio} from './theme-colours';
export function validateThemeDraft(input:unknown){
 if(!input||typeof input!=='object')throw new Error('A design draft is required.');
 const v=input as Record<string,unknown>;
 const theme=ALL_STUDIO_THEMES.find(t=>t.id===v.themeId);
 if(!theme)throw new Error('Unknown theme.');
 const d=v.draft as Record<string,unknown>;
 if(!d||typeof d!=='object')throw new Error('Design settings are required.');
 if(typeof d.brand!=='string'||d.brand.length>80||typeof d.headline!=='string'||d.headline.length>160)throw new Error('Invalid brand or headline.');
 if(!['theme','sans','serif'].includes(String(d.font))||!['theme','light','dark','forest','custom'].includes(String(d.palette))||!['off','subtle','expressive'].includes(String(d.motion)))throw new Error('Unsupported design option.');
 const c=d.colours as Record<string,unknown>;
 if(!c||!['canvas','ink','accent'].every(k=>typeof c[k]==='string'&&/^#[0-9a-f]{6}$/i.test(c[k] as string)))throw new Error('Invalid colours.');
 const colours=customColours(c,theme);
 if(d.palette==='custom'&&contrastRatio(colours.canvas,colours.ink)<4.5)throw new Error('Custom text colours need at least 4.5:1 contrast.');
 if(!Number.isSafeInteger(v.baseVersion)||Number(v.baseVersion)<0)throw new Error('A valid base version is required.');
 return {theme,baseVersion:Number(v.baseVersion),config:{kind:'studio-draft',themeId:theme.id,draft:{brand:d.brand,headline:d.headline,font:String(d.font),palette:String(d.palette),motion:String(d.motion),colours}}};
}

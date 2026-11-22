import type { StudioTheme } from './theme-registry';
import { buttonTextColour, contrastRatio, type ThemeColours } from './theme-colours';
export const THEME_FONTS = [
  {id:'theme',label:'Theme signature'},
  {id:'sans',label:'Modern sans'},
  {id:'serif',label:'Editorial serif'},
] as const;
export type ThemeAppearance = {palette:'signature'|'paper'|'night'|'custom';font:'theme'|'sans'|'serif';colours:ThemeColours};
export function themePalettes(theme:StudioTheme){
 return [
  {id:'signature' as const,label:'Theme signature',colours:{canvas:theme.canvas,ink:theme.ink,accent:theme.accent,accentInk:buttonTextColour(theme.accent)}},
  {id:'paper' as const,label:'Paper & signature accent',colours:{canvas:'#ffffff',ink:'#171717',accent:theme.accent,accentInk:buttonTextColour(theme.accent)}},
  {id:'night' as const,label:'Night & signature accent',colours:{canvas:'#171717',ink:'#ffffff',accent:theme.accent,accentInk:buttonTextColour(theme.accent)}},
 ];
}
export function validateAppearance(raw:unknown,theme:StudioTheme):ThemeAppearance {
 if(raw===undefined)return {palette:'signature',font:'theme',colours:themePalettes(theme)[0].colours};
 if(!raw||typeof raw!=='object')throw new Error('Choose a valid appearance.');
 const a=raw as Record<string,unknown>;
 if(!['theme','sans','serif'].includes(String(a.font)))throw new Error('Choose a supported font.');
 if(!['signature','paper','night','custom'].includes(String(a.palette)))throw new Error('Choose a supported palette.');
 let colours;
 if(a.palette==='custom'){
  const c=a.colours as Record<string,unknown>|undefined;
  if(!c||!['canvas','ink','accent'].every(k=>typeof c[k]==='string'&&/^#[0-9a-f]{6}$/i.test(c[k] as string)))throw new Error('Use six-digit colour values.');
  colours={canvas:c.canvas as string,ink:c.ink as string,accent:c.accent as string,accentInk:buttonTextColour(c.accent as string)};
 }else colours=themePalettes(theme).find(p=>p.id===a.palette)!.colours;
 if(contrastRatio(colours.canvas,colours.ink)<4.5)throw new Error('Background and text need at least 4.5:1 contrast.');
 return {palette:a.palette as ThemeAppearance['palette'],font:a.font as ThemeAppearance['font'],colours};
}
export function appearanceQuery(appearance:ThemeAppearance,brand:string){
 return new URLSearchParams({brand,font:appearance.font,palette:'custom',canvas:appearance.colours.canvas,ink:appearance.colours.ink,accent:appearance.colours.accent}).toString();
}

export type ThemeColours={canvas:string;ink:string;accent:string;accentInk:string};
export function hexColour(value:unknown,fallback:string):string{return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():fallback;}
function luminance(hex:string){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
export function contrastRatio(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function buttonTextColour(accent:string){return contrastRatio(accent,'#ffffff')>=contrastRatio(accent,'#111111')?'#ffffff':'#111111';}
export function customColours(raw:unknown,fallback:ThemeColours):ThemeColours{const r=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};const accent=hexColour(r.accent,fallback.accent);return {canvas:hexColour(r.canvas,fallback.canvas),ink:hexColour(r.ink,fallback.ink),accent,accentInk:buttonTextColour(accent)};}

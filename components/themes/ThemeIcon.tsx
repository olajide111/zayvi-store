import {ArrowLeft,ArrowRight,ArrowUpRight,Check,Menu,Minus,Plus,Sparkles,X,type LucideIcon} from 'lucide-react';
import type {CSSProperties} from 'react';
const icons={left:ArrowLeft,right:ArrowRight,external:ArrowUpRight,check:Check,menu:Menu,minus:Minus,plus:Plus,sparkle:Sparkles,close:X} satisfies Record<string,LucideIcon>;
/** Theme marks inherit the current text size/colour while remaining actual SVG. */
export default function ThemeIcon({name,style}:{name:keyof typeof icons;style?:CSSProperties}){
  const Icon=icons[name];
  return <Icon aria-hidden="true" focusable="false" size="1em" strokeWidth={1.8} style={{display:'inline-block',verticalAlign:'-.125em',flexShrink:0,...style}}/>;
}

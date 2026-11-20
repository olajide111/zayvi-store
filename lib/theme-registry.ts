import {THEME_DESIGNS,type ThemeDesign} from './theme-designs';
import {DIRECTION_CATALOGUE,type DirectionFamily} from './storefront-theme-directions';
export type StudioTheme=ThemeDesign&{directionFamily?:DirectionFamily;reviewOnly?:boolean;signatureFamily?:'mayfair'|'camden'};
const industries:Record<DirectionFamily,string[]>={
 'fashion-showroom':['Fashion','Bags & accessories'], 'african-editorial':['Fashion','Art','Home'],
 'modern-marketplace':['General retail','Lifestyle','Gifts'], 'atelier-minimal':['Fashion','Beauty','Home'],
 'fresh-market':['Food','General retail'], 'spec-sheet':['Electronics','Equipment','Trade'],
};
export const ADDITIONAL_STUDIO_THEMES:StudioTheme[]=DIRECTION_CATALOGUE.map(d=>({
 id:d.family,name:d.name,family:d.baseFamily,directionFamily:d.family,reviewOnly:true,
 collection:'Signature',description:d.description,industries:industries[d.family],layout:d.family==='fashion-showroom'?'poster':d.family==='modern-marketplace'?'tiles':d.family==='spec-sheet'?'catalogue':'gallery',
 canvas:d.defaultColours.floor||d.defaultColours.paper||d.defaultColours.surface||d.defaultColours.ivory||d.defaultColours.cream||'#fff9ec',
 ink:d.defaultColours.text||d.defaultColours.ink||'#22251c',accent:d.family==='fresh-market'?d.defaultColours.leaf:d.family==='atelier-minimal'?'#1E6378':d.defaultColours.primary||d.defaultColours.accent||d.defaultColours.ink||'#111111',accentInk:'#ffffff',
 serif:['african-editorial','atelier-minimal'].includes(d.family),headline:d.name,
}));
export const LONDON_SIGNATURE_THEMES:StudioTheme[]=[
 {id:'mayfair',name:'Mayfair',signatureFamily:'mayfair',family:'editorial',collection:'Signature',free:true,description:'A London-inspired wardrobe house in oyster, claret and brass: refined tailoring, architectural spacing and a considered weekday edit.',industries:['Fashion','Lifestyle','Bags & accessories','Footwear'],layout:'gallery',canvas:'#F0EBE3',ink:'#302A2A',accent:'#6B343D',accentInk:'#FFFFFF',serif:true,headline:'Every day, considered.'},
 {id:'camden',name:'Camden',signatureFamily:'camden',family:'editorial',collection:'Expressive',free:true,description:'A London-inspired streetwear shop in signal red, asphalt and chalk: graphic campaigns, a switchable style edit and bold shopping cards.',industries:['Fashion','Art','Lifestyle','Bags & accessories','Footwear'],layout:'poster',canvas:'#F1F0EC',ink:'#232326',accent:'#C82F3D',accentInk:'#FFFFFF',serif:false,headline:'Wear your own way.'},
];
export const ALL_STUDIO_THEMES:StudioTheme[]=[...THEME_DESIGNS,...ADDITIONAL_STUDIO_THEMES,...LONDON_SIGNATURE_THEMES];

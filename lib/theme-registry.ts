import {THEME_DESIGNS,type ThemeDesign} from './theme-designs';
import {DIRECTION_CATALOGUE,type DirectionFamily} from './storefront-theme-directions';
export type StudioTheme=ThemeDesign&{directionFamily?:DirectionFamily;reviewOnly?:boolean;signatureFamily?:'mayfair'|'camden'|'soho'|'canvas'};
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
 {id:'mayfair',name:'Mayfair',signatureFamily:'mayfair',family:'general-commerce',collection:'Signature',free:true,description:'A London-inspired department store in ink teal, parchment and copper: a full-width discovery campaign, shop-by-department hall and curated gifts, fashion, beauty and home.',industries:['General retail','Fashion','Beauty','Home','Lifestyle','Gifts'],layout:'tiles',canvas:'#F7F5EE',ink:'#203A43',accent:'#B8492E',accentInk:'#FFFFFF',serif:false,headline:'More to discover.'},
 {id:'camden',name:'Camden',signatureFamily:'camden',family:'editorial',collection:'Expressive',free:true,description:'A London-inspired streetwear shop in signal red, asphalt and chalk: graphic campaigns, a switchable style edit and bold shopping cards.',industries:['Fashion','Art','Lifestyle','Bags & accessories','Footwear'],layout:'poster',canvas:'#F1F0EC',ink:'#232326',accent:'#C82F3D',accentInk:'#FFFFFF',serif:false,headline:'Wear your own way.'},
 {id:'soho',name:'Soho',signatureFamily:'soho',family:'home-furniture',collection:'Expressive',free:true,description:'A London-inspired design-object shop in violet, pale lilac and paper: sculptural shelves, switchable room edits and a playful collection of lighting, ceramics and workspace pieces.',industries:['Home','Art','Lifestyle','Gifts'],layout:'gallery',canvas:'#F5F4FA',ink:'#28263F',accent:'#5146A0',accentInk:'#FFFFFF',serif:false,headline:'Objects with a point of view.'},
];
export const ESSENTIAL_THEMES:StudioTheme[]=[
 {id:'canvas',name:'Canvas',signatureFamily:'canvas',family:'general-commerce',collection:'Signature',free:true,description:'A clean white, product-first storefront with black typography, light borders, clear collections and an uncomplicated shopping flow.',industries:['General retail','Fashion','Home','Lifestyle','Bags & accessories'],layout:'catalogue',canvas:'#FFFFFF',ink:'#171717',accent:'#171717',accentInk:'#FFFFFF',serif:false,headline:'Good things. Simply.'},
];
export const ORIGINAL_THEME:StudioTheme={id:'original',name:'Zayvi Original',family:'general-commerce',collection:'Signature',free:true,description:'Our flagship everyday shop: a product montage, clear categories and a considered collection. Make it your own with colours and typography.',industries:['General retail','Fashion','Beauty','Home','Lifestyle','Gifts'],layout:'tiles',canvas:'#FAFAF6',ink:'#172B23',accent:'#203E31',accentInk:'#FFFFFF',serif:true,headline:'Good finds. For real life.'};
export const ALL_STUDIO_THEMES:StudioTheme[]=[ORIGINAL_THEME,...THEME_DESIGNS,...ADDITIONAL_STUDIO_THEMES,...LONDON_SIGNATURE_THEMES,...ESSENTIAL_THEMES];

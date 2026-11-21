import type {StudioTheme} from '@/lib/theme-registry';
export const THEME_GALLERY_GROUPS=[
 {id:'original',title:'Start with Zayvi Original',note:'Our free flagship. A versatile starting point, with your colours, fonts and collection.',ids:['original']},
 {id:'african',title:'African signatures',note:'Attire houses, city markets and expressive everyday shops.',ids:['adire','accra','african-editorial','modern-marketplace','fresh-market']},
 {id:'london',title:'London signatures',note:'Three sides of the city: department-store discovery, independent street style and design-led living. Available for either market.',ids:['mayfair','camden','soho']},
 {id:'fashion',title:'Fashion & considered spaces',note:'From a single-piece showcase to a complete clothing collection.',ids:['atelier-minimal','fashion-showroom','atelier','studio','monolith','pulse']},
 {id:'immersive',title:'Immersive & premium previews',note:'Campaigns, rooms and interactive ways to discover products.',ids:['cinema','muse','maison','prism','terra','district']},
 {id:'everyday',title:'Everyday retail & home',note:'Flexible stores for familiar essentials and unexpected finds.',ids:['canvas','horizon','habitat','pantry','bazaar','playroom']},
 {id:'technical',title:'Equipment & trade',note:'Structured detail, comparison and clear product ranges.',ids:['spec-sheet','circuit','trade','orbit']},
] as const;
export function groupedThemes(themes:StudioTheme[]){return THEME_GALLERY_GROUPS.map(group=>({...group,themes:group.ids.flatMap(id=>{const t=themes.find(t=>t.id===id);return t?[t]:[]})})).filter(group=>group.themes.length);}

/** Every row fills its available width; no placeholder themes or duplicated cards. */
export function balancedThemeRows(count:number,maxColumns:number){
 if(count<=0)return [];
 const rows=Math.ceil(count/Math.max(1,maxColumns)),base=Math.floor(count/rows),extra=count%rows;
 return Array.from({length:rows},(_,i)=>base+(i<extra?1:0));
}

export function themeCardSpan(count:number,index:number,maxColumns:number){
 let offset=0;
 for(const size of balancedThemeRows(count,maxColumns)){if(index<offset+size)return 12/size;offset+=size;}
 return 12;
}

import type {StudioTheme} from '@/lib/theme-registry';
export const THEME_GALLERY_GROUPS=[
 {id:'african',title:'African signatures',note:'Attire houses, city markets and expressive everyday shops.',ids:['adire','accra','african-editorial','modern-marketplace','fresh-market']},
 {id:'fashion',title:'Fashion & considered spaces',note:'From a single-piece showcase to a complete clothing collection.',ids:['atelier-minimal','fashion-showroom','atelier','studio','monolith','pulse']},
 {id:'immersive',title:'Immersive & premium previews',note:'Campaigns, rooms and interactive ways to discover products.',ids:['cinema','muse','maison','prism','terra','district']},
 {id:'everyday',title:'Everyday retail & home',note:'Flexible stores for familiar essentials and unexpected finds.',ids:['horizon','habitat','pantry','bazaar','playroom']},
 {id:'technical',title:'Equipment & trade',note:'Structured detail, comparison and clear product ranges.',ids:['spec-sheet','circuit','trade','orbit']},
] as const;
export function groupedThemes(themes:StudioTheme[]){return THEME_GALLERY_GROUPS.map(group=>({...group,themes:group.ids.flatMap(id=>{const t=themes.find(t=>t.id===id);return t?[t]:[]})})).filter(group=>group.themes.length);}

import type {StudioTheme} from './theme-registry';
/** Data previews use the registered shared layouts until campaign adapters are released. */
export function themePreviewEngine(theme:StudioTheme,source:string){
 if(source==='store')return 'catalogue' as const;
 if(theme.signatureFamily)return 'signature' as const;
 if(theme.directionFamily)return 'direction' as const;
 return 'catalogue' as const;
}
export function usesSharedCatalogue(theme:StudioTheme){return Boolean(theme.signatureFamily||theme.directionFamily);}

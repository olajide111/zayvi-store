import type {StudioTheme} from './theme-registry';
import {validateThemeDraft} from './theme-draft';
import {validateStoreSetup} from './store-setup';
export type StudioDraft=ReturnType<typeof validateThemeDraft>['config']['draft'];
export function resolveStudioInitial(theme:StudioTheme,history:unknown,setup:unknown):{draft?:StudioDraft;source:string}{
 const h=history as {latestVersions?:Array<{themeId?:unknown;draft?:unknown;version?:unknown}>;versions?:Array<{themeId?:unknown;draft?:unknown;version?:unknown}>}|null;
 const versions=Array.isArray(h?.latestVersions)?h.latestVersions:Array.isArray(h?.versions)?h.versions:[];
 for(const version of versions){
  if(version.themeId!==theme.id)continue;
  try{return {draft:validateThemeDraft({themeId:theme.id,draft:version.draft,baseVersion:0}).config.draft,source:`Store design version ${version.version}`};}catch{}
 }
 try{
  const profile=validateStoreSetup((setup as {profile?:unknown}|null)?.profile);
  if(profile.themeId===theme.id&&profile.appearance){
   return {draft:validateThemeDraft({themeId:theme.id,baseVersion:0,draft:{brand:profile.name,headline:theme.headline,font:profile.appearance.font,palette:'custom',motion:'subtle',colours:profile.appearance.colours}}).config.draft,source:'Saved onboarding appearance'};
  }
 }catch{}
 return {source:'Theme defaults or browser draft'};
}

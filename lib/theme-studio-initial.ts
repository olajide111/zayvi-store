import type {StudioTheme} from './theme-registry';
import {validateThemeDraft} from './theme-draft';
import {validateStoreSetup} from './store-setup';
export type StudioDraft=ReturnType<typeof validateThemeDraft>['config']['draft'];
type InitialDesign={draft:StudioDraft;source:string};

export function resolveStudioInitial(theme:StudioTheme,history:unknown,setup:unknown,preferSetup=false):{draft?:StudioDraft;source:string}{
 let onboarding:InitialDesign|undefined;
 try{
  const profile=validateStoreSetup((setup as {profile?:unknown}|null)?.profile);
  if(profile.themeId===theme.id&&profile.appearance){
   onboarding={draft:validateThemeDraft({themeId:theme.id,baseVersion:0,draft:{brand:profile.name,headline:theme.headline,font:profile.appearance.font,palette:'custom',motion:'subtle',colours:profile.appearance.colours}}).config.draft,source:'Saved onboarding appearance'};
  }
 }catch{}
 const h=history as {latestVersions?:Array<{themeId?:unknown;draft?:unknown;version?:unknown}>;versions?:Array<{themeId?:unknown;draft?:unknown;version?:unknown}>}|null;
 const versions=Array.isArray(h?.latestVersions)?h.latestVersions:Array.isArray(h?.versions)?h.versions:[];
 let stored:InitialDesign|undefined;
 for(const version of versions){
  if(version.themeId!==theme.id)continue;
  try{stored={draft:validateThemeDraft({themeId:theme.id,draft:version.draft,baseVersion:0}).config.draft,source:`Store design version ${version.version}`};break;}catch{}
 }
 if(preferSetup&&onboarding){
  // Setup edits branding and appearance, not the saved campaign's headline or motion.
  return {draft:{...onboarding.draft,headline:stored?.draft.headline??onboarding.draft.headline,motion:stored?.draft.motion??onboarding.draft.motion},source:'Saved setup appearance (existing studio versions unchanged)'};
 }
 if(stored)return stored;
 if(onboarding)return onboarding;
 return {source:'Theme defaults or browser draft'};
}

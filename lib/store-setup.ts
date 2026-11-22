import {validateAppearance,type ThemeAppearance} from './theme-appearance';
import { BUSINESS_TYPES } from './theme-studio';
import { ALL_STUDIO_THEMES } from './theme-registry';
export type StoreSetup = { name: string; industry: string; otherIndustry: string; style: 'Signature' | 'Expressive' | 'Either'; themeId: string; appearance?: ThemeAppearance };
export function validateStoreSetup(value: unknown): StoreSetup {
  if (!value || typeof value !== 'object') throw new Error('Store details are required.');
  const v = value as Record<string, unknown>;
  if (typeof v.name !== 'string' || !v.name.trim() || v.name.trim().length > 80) throw new Error('Enter a store name of up to 80 characters.');
  if (!BUSINESS_TYPES.includes(v.industry as typeof BUSINESS_TYPES[number])) throw new Error('Choose a business category.');
  if (!['Signature', 'Expressive', 'Either'].includes(String(v.style))) throw new Error('Choose a visual direction.');
  if (typeof v.otherIndustry !== 'string' || v.otherIndustry.length > 100 || (v.industry === 'Other' && !v.otherIndustry.trim())) throw new Error('Describe your business in up to 100 characters.');
  if (typeof v.themeId !== 'string' || (v.themeId && !ALL_STUDIO_THEMES.some(t => t.id === v.themeId))) throw new Error('Choose a registered theme.');
  const theme = ALL_STUDIO_THEMES.find(t=>t.id===v.themeId);
  const appearance = theme ? validateAppearance(v.appearance,theme) : undefined;
  return { appearance, name: v.name.trim(), industry: v.industry as string, otherIndustry: v.otherIndustry.trim(), style: v.style as StoreSetup['style'], themeId: v.themeId };
}

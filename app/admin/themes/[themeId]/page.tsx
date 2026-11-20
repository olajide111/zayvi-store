import {notFound} from 'next/navigation';
import ThemeStudio from '@/components/themes/ThemeStudio';
import {THEME_DESIGNS} from '@/lib/theme-designs';
export default async function Page({params}:{params:Promise<{themeId:string}>}){const {themeId}=await params;const theme=THEME_DESIGNS.find(t=>t.id===themeId);if(!theme)notFound();return <ThemeStudio theme={theme}/>;}

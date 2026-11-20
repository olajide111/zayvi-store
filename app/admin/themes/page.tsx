import ThemeGallery from '@/components/themes/ThemeGallery';
import {BUSINESS_TYPES} from '@/lib/theme-studio';
export default async function ThemesPage({searchParams}:{searchParams:Promise<{industry?:string;style?:string}>}){
 const q=await searchParams;
 return <ThemeGallery initialIndustry={BUSINESS_TYPES.includes(q.industry as typeof BUSINESS_TYPES[number])?q.industry:'All'} initialStyle={q.style==='Signature'||q.style==='Expressive'?q.style:'All'}/>;
}

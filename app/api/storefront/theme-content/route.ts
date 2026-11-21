import {NextResponse} from 'next/server';
import {callZayviAwsApi} from '@/lib/aws-api';
import {storefrontApiMarket} from '@/lib/storefront-market-server';
import {themeMerchantContent} from '@/lib/theme-merchant-content';
export async function GET(request:Request){
 const selection=await storefrontApiMarket(new URL(request.url).searchParams.get('market'));
 if(selection.error)return selection.error;
 const market=selection.market;
 const results=await Promise.allSettled([callZayviAwsApi(`/published-content?market=${market}&slug=about`),callZayviAwsApi('/storefront-social-links')]);
 const [about,social]=results.map(r=>r.status==='fulfilled'?r.value:{ok:false,status:503,data:null});
 return NextResponse.json(themeMerchantContent(market,about,social),{headers:{'Cache-Control':'no-store'}});
}

import Link from 'next/link';
import {hammyHref} from '@/lib/hammy-navigation';
import {hammyCareHref} from '@/lib/hammy-customer-care';
import s from './hammy-shop.module.css';
export default function HammyStoreFooter(){
 return <footer className={s.storeFooter} aria-label="Hammy Store footer"><div className={s.storeFooterInner}>
  <div className={s.storeFooterTop}>
   <div className={s.storeFooterBrand}><Link href={hammyHref('home')} aria-label="Hammy Store home">HAMMY<span>STORE</span></Link><p>Everyday fashion.<br/>Every generation.</p></div>
   <nav aria-label="Footer shop"><h2>Shop</h2><Link href={hammyHref('collection')}>All fashion</Link><Link href={hammyHref('collection','Women')}>Women</Link><Link href={hammyHref('collection','Men')}>Men</Link><Link href={hammyHref('collection','Kids')}>Kids & children</Link><Link href={hammyHref('collection','Sportswear')}>Sportswear</Link></nav>
   <nav aria-label="Footer customer care"><h2>Customer care</h2><Link href={hammyCareHref('delivery')}>Delivery</Link><Link href={hammyCareHref('returns')}>Returns & refunds</Link><Link href={hammyCareHref('sizing')}>Size guide</Link><Link href={hammyCareHref('contact')}>Contact us</Link></nav>
   <nav aria-label="Footer information"><h2>Information</h2><Link href={hammyCareHref('privacy')}>Privacy</Link><Link href={hammyCareHref('terms')}>Terms of use</Link><Link href={hammyHref('bag')}>Your basket</Link></nav>
  </div>
  <div className={s.storeFooterBottom}><p>© {new Date().getFullYear()} Hammy Store</p><p>Powered by Zayvi</p></div>
  <details className={s.storeFooterPreview}><summary>About this preview</summary><p>Sample products, options and prices. Photos are illustrative. Checkout is unavailable.</p></details>
 </div></footer>;
}

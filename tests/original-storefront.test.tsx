import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import Hero from '../components/Hero';
import ProductCard from '../components/ProductCard';
import CategoryGrid from '../components/CategoryGrid';
import Newsletter from '../components/Newsletter';
import Header from '../components/Header';
import QuickView from '../components/QuickView';
import CartDrawer from '../components/CartDrawer';
import type {StorefrontProduct} from '../lib/storefront-products';
const p:StorefrontProduct={id:'one',name:'Handmade bowl',slug:'bowl',canonicalCode:'BOWL',image:'/bowl.jpg',price:25,currency:'GBP',marketCode:'GB',category:'Ceramics',emoji:'',desc:'',longDesc:'',features:[],colors:[],sizes:['Small','Large'],status:'active',lifecycleStatus:'active',publicationStatus:'published',availabilityStatus:'available'};
const noop=()=>{};
test('hero and categories use actual products and do not invent empty departments',()=>{
 const hero=renderToStaticMarkup(<Hero products={[p]} onShopAll={noop} onBestSellers={noop}/>);
 assert.match(hero,/Handmade bowl/);assert.doesNotMatch(hero,/unsplash.com/);
 const cats=renderToStaticMarkup(<CategoryGrid products={[p]} onSelect={noop}/>);
 assert.match(cats,/Ceramics/);assert.match(cats,/1 product/);assert.doesNotMatch(cats,/Recovery/);
 assert.equal(renderToStaticMarkup(<CategoryGrid products={[]} onSelect={noop}/>),'');
});
test('variant products offer explicit options and quick view is always rendered',()=>{
 const card=renderToStaticMarkup(<ProductCard product={p} onView={noop} onAdd={noop}/>);
 assert.match(card,/Choose options/);assert.match(card,/Quick view/);assert.match(card,/£25.00/);
 assert.doesNotMatch(card,/Add to cart \+/);
});
test('help replaces inactive subscription and unsupported discount promises',()=>{
 const html=renderToStaticMarkup(<Newsletter market="NG"/>);
 assert.doesNotMatch(html,/<form|10%|type="email"/);assert.match(html,/market=NG/);assert.match(html,/Returns/);
});
test('navigation exposes the real categories rather than fixed example categories',()=>{
 const html=renderToStaticMarkup(<Header categories={['Ceramics']} market="GB" cartCount={0} onCartOpen={noop} onSearch={noop} onShopAll={noop} onBestSellers={noop} onCategory={noop} scrolled={false}/>);
 assert.match(html,/Ceramics/);assert.doesNotMatch(html,/Recovery|Best sellers/);
});

test('quick view is absent when closed and has named dialog controls when open',()=>{
 assert.equal(renderToStaticMarkup(<QuickView product={p} open={false} onClose={noop} onAdd={noop}/>),'');
 const html=renderToStaticMarkup(<QuickView product={p} open={true} onClose={noop} onAdd={noop}/>);
 assert.match(html,/role="dialog"/);assert.match(html,/aria-modal="true"/);assert.match(html,/aria-labelledby=/);assert.match(html,/Close quick view/);assert.match(html,/Increase quantity/);
});
test('closed cart is inert and hidden from assistive technology',()=>{
 const html=renderToStaticMarkup(<CartDrawer cart={[]} open={false} onClose={noop} onQty={noop} onRemove={noop} onCreateDraftOrder={async()=>{throw new Error('unused')}} verifiedSubtotal={null} pricingState="idle" marketCode="GB"/>);
 assert.match(html,/aria-hidden="true"/);assert.match(html,/inert=""/);
});

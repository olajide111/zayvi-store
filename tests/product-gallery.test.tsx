import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {productGallerySources} from '../lib/product-gallery';
import ProductGallery from '../components/ProductGallery';
const {galleryFields,storefrontGallery}=require('../infra/lambda/product-gallery');
const primary='https://images.example/primary.webp',second='https://images.example/second.webp';
test('gallery writes validate all images, deduplicate and enforce a combined 20 image limit',()=>{
 assert.deepEqual(galleryFields({image:primary,images:[second,primary]}),{image:primary,images:[primary,second]});
 assert.equal(galleryFields({image:primary,images:Array.from({length:19},(_,i)=>`/photos/${i}.webp`)}).images.length,20);
 assert.throws(()=>galleryFields({image:primary,images:Array.from({length:20},(_,i)=>`/photos/${i}.webp`)}),/at most 20/);
 for(const url of ['javascript:alert(1)','//evil.example/image.webp','https://user:password@example.com/image.webp','/\\evil.example/image.webp','https://example.com/a\n.jpg'])assert.throws(()=>galleryFields({image:primary,images:[url]}),/Gallery/);
 assert.throws(()=>galleryFields({images:'not an array'}),/array/);
});
test('partial updates preserve gallery metadata and explicit clearing removes all images',()=>{
 const current={image:primary,images:[primary,second]};
 assert.deepEqual(galleryFields({},current),current);
 assert.deepEqual(galleryFields({image:'',images:[]},current),{image:'',images:[]});
 assert.deepEqual(galleryFields({images:[second]},{}),{image:second,images:[second]});
 assert.deepEqual(current.images,[primary,second]);
});
test('supplier galleries enforce exact image and market rights rather than approving extra photos',()=>{
 const supplier={image:primary,images:[second],discoverySource:'supplier_feed',imageRights:{scope:'storefront',marketCode:'NG',sourceUrl:primary}};
 assert.deepEqual(storefrontGallery(supplier,'NG'),[primary]);
 assert.deepEqual(storefrontGallery(supplier,'GB'),[]);
 assert.deepEqual(storefrontGallery({...supplier,imageRights:null},'NG'),[]);
 assert.deepEqual(storefrontGallery({...supplier,image:second},'NG'),[]);
 assert.deepEqual(storefrontGallery({image:primary,images:[second]},'GB'),[primary,second]);
});
test('storefront gallery handles legacy single images and rejects unsafe client URLs',()=>{
 assert.deepEqual(productGallerySources(primary),[primary]);
 assert.deepEqual(productGallerySources(primary,['javascript:alert(1)',second,primary]),[primary,second]);
 const single=renderToStaticMarkup(<ProductGallery image={primary} name="Cotton shirt"/>);
 assert.match(single,/Cotton shirt, image 1 of 1/);assert.doesNotMatch(single,/Next image/);
 const multi=renderToStaticMarkup(<ProductGallery image={primary} images={[second]} name="Cotton shirt"/>);
 assert.match(multi,/Next image of Cotton shirt/);assert.match(multi,/View Cotton shirt image 2/);
 const empty=renderToStaticMarkup(<ProductGallery image="" name="Cotton shirt"/>);assert.match(empty,/Image unavailable/);
});

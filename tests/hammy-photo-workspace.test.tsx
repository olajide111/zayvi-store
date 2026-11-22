import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {selectHammyPhotos,moveHammyPhoto,uploadHammyPhoto,HAMMY_PHOTO_BYTES} from '../lib/hammy-photo-workspace';
import HammyPhotoWorkspace from '../components/pilots/HammyPhotoWorkspace';
const file={name:'shirt.jpg',size:1024,type:'image/jpeg',lastModified:1};
test('photo selection accepts supported files, rejects bad sizes/types and prevents duplicate selection',()=>{
 const result=selectHammyPhotos([file],[file,{...file,name:'front.png',type:'image/png'},{...file,name:'bad.svg',type:'image/svg+xml'},{...file,name:'large.jpg',size:HAMMY_PHOTO_BYTES+1},{...file,name:'empty.jpg',size:0}]);
 assert.deepEqual(result.accepted.map(item=>item.name),['front.png']);assert.equal(result.rejected.length,4);
 const boundary=selectHammyPhotos([],[{...file,size:HAMMY_PHOTO_BYTES}]);assert.equal(boundary.accepted.length,1);
});
test('selection caps the entire gallery at twenty and rejects duplicates within one batch',()=>{
 const current=Array.from({length:19},(_,i)=>({...file,name:`${i}.jpg`}));
 const result=selectHammyPhotos(current,[file,{...file,name:'other.jpg'}]);assert.equal(result.accepted.length,1);assert.equal(result.rejected.length,1);
 assert.equal(selectHammyPhotos([],[file,file]).accepted.length,1);
});
test('reordering keeps every photo exactly once and leaves the original array intact',()=>{
 const original=['front','back','detail'];assert.deepEqual(moveHammyPhoto(original,2,0),['detail','front','back']);assert.deepEqual(original,['front','back','detail']);
 assert.equal(moveHammyPhoto(original,-1,0),original);assert.equal(moveHammyPhoto(original,0,4),original);
});
test('uploads use the authenticated existing endpoint and accept only a complete image response',async()=>{
 const photo=new File(['photo'],'shirt.jpg',{type:'image/jpeg'}),signal=new AbortController().signal;
 const request=(async(url,init)=>{assert.equal(url,'/api/admin/product-images');assert.equal(init?.credentials,'include');assert.equal(init?.signal,signal);assert((init?.body as FormData).get('file') instanceof File);return Response.json({success:true,key:'products/abc-123.jpg',url:'https://cdn.example/products/abc-123.jpg'},{status:201});}) as typeof fetch;
 assert.deepEqual(await uploadHammyPhoto(photo,signal,request),{key:'products/abc-123.jpg',url:'https://cdn.example/products/abc-123.jpg'});
});
test('authentication and incomplete/unsafe upload responses never become confirmed gallery URLs',async()=>{
 const photo=new File(['photo'],'shirt.jpg',{type:'image/jpeg'}),signal=new AbortController().signal;
 await assert.rejects(()=>uploadHammyPhoto(photo,signal,(async()=>Response.json({},{status:401})) as typeof fetch),(error:unknown)=>(error as {status:number}).status===401);
 for(const data of [{url:'https://cdn.example/x.jpg'},{success:true,key:'products/abc.jpg',url:'javascript:alert(1)'},{success:true,key:'products/abc.jpg',url:'https://cdn.example/products/different.jpg'}])await assert.rejects(()=>uploadHammyPhoto(photo,signal,(async()=>Response.json(data,{status:201})) as typeof fetch));
 await assert.rejects(()=>uploadHammyPhoto(photo,signal,(async()=>Response.json({error:'Storage unavailable.'},{status:500})) as typeof fetch),/Storage unavailable/);
});
test('photo workspace starts without publishing or copying an incomplete gallery',()=>{
 const html=renderToStaticMarkup(<HammyPhotoWorkspace/>);assert.match(html,/multiple=""/);assert.match(html,/Select photos first/);assert.match(html,/does not save a product/);assert.match(html,/Copy gallery URLs/);assert.doesNotMatch(html,/Publish product/);
});

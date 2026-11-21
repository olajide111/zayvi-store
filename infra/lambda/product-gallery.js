const { storefrontImage } = require('./supplier-image-rights');
const MAX_PRODUCT_IMAGES = 20;
function validImageUrl(value) {
 if(typeof value !== 'string' || !value || value.length>2048 || /[\s\\\u0000-\u001f]/.test(value))return false;
 try{const url=new URL(value,'https://zayvi.invalid');return !url.username&&!url.password&&url.protocol==='https:'&&(value.startsWith('https://')||/^\/(?!\/)/.test(value));}catch{return false;}
}
function galleryFields(input,current={}) {
 const fail=message=>{throw Object.assign(new Error(message),{statusCode:400});};
 if(input.image===undefined&&input.images===undefined)return {image:current.image||'',images:Array.isArray(current.images)?current.images:[]};
 const image=input.image===undefined?current.image||'':input.image;
 if(typeof image!=='string'||(image&&!validImageUrl(image)))fail('Use an HTTPS or site-relative primary image URL.');
 const additional=input.images===undefined?(Array.isArray(current.images)?current.images:[]):input.images;
 if(!Array.isArray(additional)||additional.length>MAX_PRODUCT_IMAGES)fail('Provide an image URL array with at most 20 images.');
 if(additional.some(value=>!validImageUrl(value)))fail('Gallery images must be HTTPS or site-relative URLs without credentials.');
 const images=[...new Set([image,...additional].filter(Boolean))];
 if(images.length>MAX_PRODUCT_IMAGES)fail('A product can have at most 20 images including its primary image.');
 return {image:images[0]||'',images};
}
function storefrontGallery(attributes,market) {
 const primary=storefrontImage(attributes,market);
 // Supplier-feed rights currently authorise one exact image for one market.
 // Extra images never inherit that approval implicitly.
 const values=attributes.discoverySource==='supplier_feed'?[primary]:[primary,...(Array.isArray(attributes.images)?attributes.images:[])];
 return [...new Set(values.filter(validImageUrl))].slice(0,MAX_PRODUCT_IMAGES);
}
module.exports={MAX_PRODUCT_IMAGES,validImageUrl,galleryFields,storefrontGallery};

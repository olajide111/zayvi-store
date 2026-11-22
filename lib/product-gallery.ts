/** UI defence only: storefront API is responsible for supplier-image authorisation. */
export function productGallerySources(image:string,images?:unknown):string[]{
 return [...new Set([image,...(Array.isArray(images)?images:[])].filter((value):value is string=>{
  if(typeof value!=='string'||!value||value.length>2048||/[\s\\\u0000-\u001f]/.test(value))return false;
  try{const url=new URL(value,'https://zayvi.invalid');return url.protocol==='https:'&&!url.username&&!url.password&&(value.startsWith('https://')||/^\/(?!\/)/.test(value));}catch{return false;}
 }))].slice(0,20);
}

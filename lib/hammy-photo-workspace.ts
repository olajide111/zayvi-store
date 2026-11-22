export const HAMMY_PHOTO_LIMIT=20;
export const HAMMY_PHOTO_BYTES=5*1024*1024;
export const HAMMY_PHOTO_TYPES=['image/jpeg','image/png','image/webp','image/avif'];
export type PhotoFile={name:string;size:number;type:string;lastModified:number};
export type PhotoUpload={key:string;url:string};
export function photoIdentity(file:PhotoFile){return JSON.stringify([file.name,file.size,file.type,file.lastModified]);}
export function selectHammyPhotos<T extends PhotoFile>(current:PhotoFile[],files:T[]){
 const accepted:T[]=[],rejected:string[]=[],known=new Set(current.map(photoIdentity));
 for(const file of files){
  if(!HAMMY_PHOTO_TYPES.includes(file.type)||!Number.isSafeInteger(file.size)||file.size<1||file.size>HAMMY_PHOTO_BYTES){rejected.push(`${file.name}: use JPEG, PNG, WebP or AVIF up to 5 MB.`);continue;}
  const identity=photoIdentity(file);
  if(known.has(identity)){rejected.push(`${file.name}: already selected.`);continue;}
  if(current.length+accepted.length>=HAMMY_PHOTO_LIMIT){rejected.push(`${file.name}: the gallery limit is 20 photos.`);continue;}
  accepted.push(file);known.add(identity);
 }
 return {accepted,rejected};
}
export function moveHammyPhoto<T>(items:T[],from:number,to:number):T[]{
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=items.length||to>=items.length)return items;
 const next=[...items], [item]=next.splice(from,1);next.splice(to,0,item);return next;
}
export async function uploadHammyPhoto(file:File,signal:AbortSignal,request:typeof fetch=fetch):Promise<PhotoUpload>{
 const form=new FormData();form.append('file',file);
 const response=await request('/api/admin/product-images',{method:'POST',body:form,credentials:'include',signal});
 if(response.status===401)throw Object.assign(new Error('Sign in again, then retry the remaining photos.'),{status:401});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:'Upload failed. Retry this photo.');
 if(data?.success!==true||typeof data.key!=='string'||!/^products\/[a-zA-Z0-9-]+\.(jpg|png|webp|avif)$/.test(data.key)||typeof data.url!=='string')throw new Error('The upload response was incomplete. No confirmed URL was saved.');
 const url=new URL(data.url);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!==`/${data.key}`)throw new Error('The upload returned an invalid image URL.');
 return {key:data.key,url:url.href};
}

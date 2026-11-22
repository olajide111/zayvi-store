/** Trusted server navigation settings; these do not grant tenant/store ownership. */
export type OwnerLoginContext={key:string;defaultPath:string;allowedPaths:readonly string[]};
const path=/^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/;
/** Copy configuration once; never derive an allowlist or key from request parameters. */
export function createOwnerLoginContext(value:OwnerLoginContext){
  if(!value||typeof value.key!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(value.key)||!Array.isArray(value.allowedPaths)||
    !value.allowedPaths.length||value.allowedPaths.length>16||value.allowedPaths.some(item=>typeof item!=='string'||!path.test(item))||
    !path.test(value.defaultPath)||!value.allowedPaths.includes(value.defaultPath))throw new Error('A trusted owner login context is required.');
  const key=value.key,defaultPath=value.defaultPath,allowed=new Set(value.allowedPaths);
  return Object.freeze({key,defaultPath,allows:(destination:string)=>allowed.has(destination)});
}

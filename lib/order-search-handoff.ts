/** Short-lived UI search intent only. Never an identity, store binding or permission. */
export function createOrderSearchHandoff(now:()=>number=Date.now){
  let pending:{email:string;expiresAt:number}|null=null;
  return {
    prepare(email:string){
      pending=null;
      if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email.trim()))return false;
      pending={email:email.trim().toLowerCase(),expiresAt:now()+60000};return true;
    },
    take(){const value=pending;pending=null;return value&&value.expiresAt>now()?value.email:null;},
    clear(){pending=null;},
  };
}
export function matchesOrderEmail(email:string,query:string){return email.trim().toLowerCase()===query.trim().toLowerCase();}

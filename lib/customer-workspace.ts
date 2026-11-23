export type CustomerRecord={id:string;name:string;email:string;phone?:string|null;status:string;orderCount:number;firstOrderAt?:string|null;lastOrderAt?:string|null;createdAt:string};
export type CustomerSegment='all'|'repeat'|'single'|'none';
export type CustomerSort='recent'|'orders'|'name';
const timestamp=(value:string|null|undefined)=>{const date=value?Date.parse(value):NaN;return Number.isFinite(date)?date:0;};
export function customerSegment(customer:CustomerRecord):Exclude<CustomerSegment,'all'>{return customer.orderCount>1?'repeat':customer.orderCount===1?'single':'none';}
export function selectCustomers(customers:readonly CustomerRecord[],input:{query?:string;segment?:CustomerSegment;status?:string;sort?:CustomerSort}){
  const query=(input.query||'').trim().toLocaleLowerCase('en-GB');
  return customers.filter(customer=>(!query||[customer.name,customer.email,customer.phone].some(value=>value?.toLocaleLowerCase('en-GB').includes(query)))&&
    (!input.segment||input.segment==='all'||customerSegment(customer)===input.segment)&&(!input.status||input.status==='all'||customer.status===input.status))
    .sort((a,b)=>input.sort==='name'?(a.name||a.email).localeCompare(b.name||b.email):input.sort==='orders'?b.orderCount-a.orderCount||a.id.localeCompare(b.id):
      timestamp(b.lastOrderAt||b.createdAt)-timestamp(a.lastOrderAt||a.createdAt)||a.id.localeCompare(b.id));
}
export function customerDate(value:string|null|undefined){
  if(!value||!Number.isFinite(Date.parse(value)))return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'}).format(new Date(value!));
}

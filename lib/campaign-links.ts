export type CampaignLinkInput={destination:string;source:string;medium:string;campaign:string;content?:string};
/** A URL creation tool only; does not send messages, publish campaigns or measure attribution. */
export function buildCampaignLink(input:CampaignLinkInput){
  let url:URL;try{url=new URL(input.destination.trim());}catch{throw new Error('Enter a complete public store URL beginning with https://.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname==='localhost'||
    !url.hostname.includes('.')||url.pathname.startsWith('/admin')||url.pathname.startsWith('/api'))throw new Error('Use a public HTTPS store page without sign-in details or admin/API paths.');
  if(input.destination.length>2048)throw new Error('The store URL is too long.');
  const values={utm_source:input.source,utm_medium:input.medium,utm_campaign:input.campaign,utm_content:input.content||''};
  for(const [key,raw] of Object.entries(values)){
    const value=raw.trim();
    if((key!=='utm_content'&&!value)||value.length>80||/[\u0000-\u001f\u007f]/.test(value))throw new Error('Enter source, medium and campaign names of up to 80 characters.');
    url.searchParams.delete(key);if(value)url.searchParams.set(key,value);
  }
  return url.toString();
}

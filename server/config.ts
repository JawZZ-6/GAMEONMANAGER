// Browsers send Origin as scheme://host[:port] with no path, so GAMEON_ORIGIN must reduce to exactly that.
export function normaliseOrigin(value:string):string{
  let url:URL;
  try{url=new URL(value);}
  catch{throw new Error(`GAMEON_ORIGIN must be a full URL such as https://gameon.example.com (received "${value}").`);}
  if(!['http:','https:'].includes(url.protocol)||url.pathname!=='/'||url.search||url.hash||url.username||url.password)
    throw new Error(`GAMEON_ORIGIN must contain only the scheme, host and optional port, for example https://gameon.example.com (received "${value}").`);
  return url.origin;
}

export function parseTrustProxy(value:string|undefined):number{
  if(value===undefined||value.trim()==='')return 0;
  const hops=Number(value);
  if(!Number.isInteger(hops)||hops<0||hops>5)throw new Error('GAMEON_TRUST_PROXY must be the number of reverse proxies in front of GameON (0 to 5), for example 1 for Caddy.');
  return hops;
}

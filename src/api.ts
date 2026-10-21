export class ApiError extends Error {constructor(message:string,public status:number){super(message);}}
export async function api<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{const response=await fetch(`/api/${path}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
  // A proxy or outage can answer with an HTML page instead of this API's JSON.
  const data=await response.json().catch(e=>{if(signal?.aborted)throw e;return null;});
  if(!response.ok)throw new ApiError(data?.error||(response.status===429?'Too many requests. Please wait a minute and try again.':response.status>=500?'The server is busy or restarting. Please try again shortly.':'The request could not be completed'),response.status);
  if(data===null)throw new ApiError('The server sent an unexpected response. Please try again.',response.status);
  return data;}

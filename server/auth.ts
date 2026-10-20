import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile, open } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { AppError } from '../shared/domain';
const passwordSchema=z.string().min(12,'Use at least 12 characters').max(128,'Use at most 128 characters');
export class Auth {
  private sessions=new Map<string,number>();
  private attempts=new Map<string,{count:number;expires:number}>();
  constructor(private dir:string){}
  private async credentials(){try{return z.object({salt:z.string(),hash:z.string().length(128)}).parse(JSON.parse(await readFile(join(this.dir,'auth.json'),'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw new Error('Invalid auth.json. Restore credentials from a secure backup.');}}
  async configured(){return (await this.credentials())!==null;}
  async setup(password:unknown){const valid=passwordSchema.parse(password),salt=randomBytes(32).toString('hex');const data={salt,hash:scryptSync(valid,salt,64).toString('hex')};let file;try{file=await open(join(this.dir,'auth.json'),'wx',0o600);}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')throw new AppError('An organiser password has already been set',409);throw e;}try{await file.writeFile(JSON.stringify(data));await file.sync();}finally{await file.close();}}
  throttle(ip:string){const time=Date.now();for(const [key,v] of this.attempts)if(v.expires<time)this.attempts.delete(key);const record=this.attempts.get(ip)||{count:0,expires:time+15*60000};record.count++;this.attempts.set(ip,record);if(record.count>10)throw new AppError('Too many sign-in attempts. Try again in 15 minutes.',429);}
  async login(password:unknown){const data=await this.credentials();if(!data)throw new AppError('Set up an organiser password on this computer first',409);if(typeof password!=='string'||password.length>128||!timingSafeEqual(scryptSync(password,data.salt,64),Buffer.from(data.hash,'hex')))throw new AppError('Incorrect password',401);}
  createSession(){const token=randomBytes(32).toString('hex');const time=Date.now();for(const [key,expiry] of this.sessions)if(expiry<time)this.sessions.delete(key);this.sessions.set(token,time+8*60*60000);return token;}
  authorised(token?:string){if(!token)return false;const expiry=this.sessions.get(token);if(!expiry||expiry<Date.now()){this.sessions.delete(token);return false;}return true;}
  logout(token?:string){if(token)this.sessions.delete(token);}
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { JsonStore } from '../server/store';
import { Auth } from '../server/auth';
import { createApp } from '../server/app';
import { normaliseOrigin, parseTrustProxy } from '../server/config';
import { api, ApiError } from '../src/api';

const dirs:string[]=[];const stores:JsonStore[]=[];
const origin='http://localhost';const password='test-password-12345';
async function tempDir(){const dir=await mkdtemp(join(tmpdir(),'gameon-hosting-'));dirs.push(dir);return dir;}
async function app(options:{trustProxy?:number;registrationLimit?:number}={}){const dir=await tempDir();const store=await JsonStore.open(dir);stores.push(store);const auth=new Auth(dir);await auth.setup(password);return {dir,store,app:createApp({store,auth,origin,...options})};}
async function deadPid(){const child=spawn(process.execPath,['-e','']);const pid=child.pid!;await new Promise(resolve=>child.once('exit',resolve));return pid;}
afterEach(async()=>{vi.unstubAllGlobals();vi.restoreAllMocks();for(const s of stores.splice(0))await s.close();for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});

describe('stale server.lock recovery',()=>{
  it('starts after a crash left a lock for a process that no longer exists',async()=>{
    const dir=await tempDir();vi.spyOn(console,'warn').mockImplementation(()=>{});
    await writeFile(join(dir,'server.lock'),JSON.stringify({pid:await deadPid(),startedAt:'2026-10-21T00:00:00Z'}));
    const store=await JsonStore.open(dir);stores.push(store);
    expect(JSON.parse(await readFile(join(dir,'server.lock'),'utf8')).pid).toBe(process.pid);
  });
  it('treats a lock from an earlier run with a reused process ID as stale',async()=>{
    const dir=await tempDir();vi.spyOn(console,'warn').mockImplementation(()=>{});
    await writeFile(join(dir,'server.lock'),JSON.stringify({pid:process.pid,instance:'an-earlier-run'}));
    stores.push(await JsonStore.open(dir));
  });
  it('still refuses a directory owned by a running server',async()=>{
    const dir=await tempDir();
    await writeFile(join(dir,'server.lock'),JSON.stringify({pid:process.ppid}));
    await expect(JsonStore.open(dir)).rejects.toThrow(/Another server owns/);
    expect(JSON.parse(await readFile(join(dir,'server.lock'),'utf8')).pid).toBe(process.ppid);
  });
  it('keeps a freshly written unreadable lock but clears an old one',async()=>{
    const dir=await tempDir();vi.spyOn(console,'warn').mockImplementation(()=>{});
    await writeFile(join(dir,'server.lock'),'');
    await expect(JsonStore.open(dir)).rejects.toThrow(/Another server owns/);
    const old=new Date(Date.now()-60000);await utimes(join(dir,'server.lock'),old,old);
    stores.push(await JsonStore.open(dir));
  });
});

describe('deployment configuration',()=>{
  it('accepts a trailing slash and normalises case, but rejects paths and non-URLs',()=>{
    expect(normaliseOrigin('https://GameOn.Example.com/')).toBe('https://gameon.example.com');
    expect(normaliseOrigin('https://gameon.example.com:443')).toBe('https://gameon.example.com');
    expect(normaliseOrigin('http://127.0.0.1:4310')).toBe('http://127.0.0.1:4310');
    for(const bad of ['gameon.example.com','https://gameon.example.com/register','https://gameon.example.com/?x=1','ftp://gameon.example.com',''])expect(()=>normaliseOrigin(bad),bad).toThrow(/GAMEON_ORIGIN/);
  });
  it('reads the number of trusted proxies strictly',()=>{
    expect(parseTrustProxy(undefined)).toBe(0);expect(parseTrustProxy('')).toBe(0);expect(parseTrustProxy('1')).toBe(1);
    for(const bad of ['yes','-1','1.5','99'])expect(()=>parseTrustProxy(bad),bad).toThrow(/GAMEON_TRUST_PROXY/);
  });
  it('separates visitors by the forwarded address only when a proxy is trusted',async()=>{
    const bad={name:''};
    const trusted=await app({trustProxy:1,registrationLimit:2});
    for(let i=0;i<3;i++)await request(trusted.app).post('/api/register').set('Origin',origin).set('X-Forwarded-For','203.0.113.1').send(bad);
    await request(trusted.app).post('/api/register').set('Origin',origin).set('X-Forwarded-For','203.0.113.1').send(bad).expect(429);
    await request(trusted.app).post('/api/register').set('Origin',origin).set('X-Forwarded-For','203.0.113.2').send(bad).expect(400);
    const direct=await app({registrationLimit:2});
    for(let i=0;i<3;i++)await request(direct.app).post('/api/register').set('Origin',origin).set('X-Forwarded-For',`203.0.113.${i}`).send(bad);
    await request(direct.app).post('/api/register').set('Origin',origin).set('X-Forwarded-For','203.0.113.99').send(bad).expect(429);
  });
  it('allows well over 60 registration attempts per minute by default',async()=>{
    const {app:server}=await app();
    for(let i=0;i<100;i++)await request(server).post('/api/register').set('Origin',origin).send({}).expect(400);
  });
});

describe('organiser sign-in lockout',()=>{
  it('locks out only after ten wrong passwords, and a correct sign-in resets the count',async()=>{
    const {app:server}=await app();const login=(p:string)=>request(server).post('/api/login').set('Origin',origin).send({password:p});
    for(let i=0;i<9;i++)await login('wrong-password-123').expect(401);
    await login(password).expect(200);
    for(let i=0;i<10;i++)await login('wrong-password-123').expect(401);
    await login(password).expect(429);await login('wrong-password-123').expect(429);
  });
  it('does not count successful sign-ins toward the limit',async()=>{
    const {app:server}=await app();
    for(let i=0;i<15;i++)await request(server).post('/api/login').set('Origin',origin).send({password}).expect(200);
  });
  it('rejects a login request without a body instead of crashing',async()=>{
    const {app:server}=await app();
    await request(server).post('/api/login').set('Origin',origin).expect(401);
  });
});

describe('request error handling',()=>{
  it('answers malformed and oversized JSON with client errors, not server errors',async()=>{
    const {app:server}=await app();const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    const bad=await request(server).post('/api/register').set('Origin',origin).set('Content-Type','application/json').send('{bad').expect(400);
    expect(bad.body.error).toMatch(/not valid JSON/);
    await request(server).post('/api/register').set('Origin',origin).set('Content-Type','application/json').send(JSON.stringify({pad:'x'.repeat(1_100_000)})).expect(413);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('browser API client',()=>{
  const respond=(body:BodyInit,status:number,type='text/html')=>vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(body,{status,headers:{'Content-Type':type}})));
  it('explains proxy error pages instead of exposing a JSON parse error',async()=>{
    respond('<html>Bad gateway</html>',502);
    await expect(api('registration')).rejects.toMatchObject({status:502,message:expect.stringMatching(/busy or restarting/)});
    respond('<html>Too many</html>',429);
    await expect(api('register',{})).rejects.toMatchObject({status:429,message:expect.stringMatching(/wait a minute/)});
  });
  it('still surfaces the server error message and returns successful data',async()=>{
    respond(JSON.stringify({error:'This email is already registered.'}),409,'application/json');
    await expect(api('register',{})).rejects.toThrow(ApiError);
    await expect(api('register',{})).rejects.toThrow('This email is already registered.');
    respond(JSON.stringify({open:true}),200,'application/json');
    await expect(api('registration')).resolves.toEqual({open:true});
  });
  it('rejects a successful response that is not JSON',async()=>{
    respond('<html>captive portal</html>',200);
    await expect(api('registration')).rejects.toThrow(/unexpected response/);
  });
});

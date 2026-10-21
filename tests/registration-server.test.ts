import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { JsonStore } from '../server/store';
import { Auth } from '../server/auth';
import { createApp } from '../server/app';
import { createEvent } from '../shared/domain';
import { createHash } from 'node:crypto';

const dirs:string[]=[];const stores:JsonStore[]=[];
const origin='http://localhost';
const input=(extra={})=>({requestId:crypto.randomUUID(),name:'API Player',email:'api@example.test',department:'Technology',phone:'0779999999',bundleId:'social',gameIds:['game-1','game-4','game-5'],expectedPrice:1200,consent:true,website:'',...extra});
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'gameon-registration-'));dirs.push(dir);const initial=createEvent();initial.settings.registrationDeadline='2099-12-31';const store=await JsonStore.open(dir,initial);stores.push(store);return {dir,store,app:createApp({store,auth:new Auth(dir),origin})};}
afterEach(async()=>{for(const s of stores.splice(0))await s.close();for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});

describe('public registration API',()=>{
  it('accepts individual selections, snapshots the option price, and protects player IDs',async()=>{
    const {app,store}=await fixture();const body=input({registrationType:'individual',bundleId:'',gameIds:['game-1'],selections:[{gameId:'game-1',optionId:'game-1-single'}],expectedPrice:500});
    const result=await request(app).post('/api/register').set('Origin',origin).send(body).expect(201);
    expect(result.body).toMatchObject({registrationType:'individual',amount:500});expect(result.body.lineItems[0]).toMatchObject({gameName:'UNO',price:500});expect(result.body.lineItems[0]).not.toHaveProperty('participantIds');
    const retry=await request(app).post('/api/register').set('Origin',origin).send(body).expect(201);expect(retry.body).toEqual(result.body);expect(store.read().ledger).toHaveLength(1);
  });
  it('shares the last place atomically between individual and bundle registrations',async()=>{
    const {store}=await fixture();await store.transact(0,{type:'game.save',payload:{...store.read().games[0],capacity:2}});
    await store.transact(1,{type:'participant.save',payload:{name:'Existing',gameIds:['game-1']}});
    const results=await Promise.allSettled([store.register(input()),store.register(input({email:'individual@example.test',registrationType:'individual',bundleId:'',gameIds:['game-1'],selections:[{gameId:'game-1',optionId:'game-1-single'}],expectedPrice:500}))]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(store.read().ledger).toHaveLength(1);
  });
  it('recovers an individual roster and purchased prices after catalogue edits, closure and restart',async()=>{
    const {dir,store}=await fixture();
    const body={...input(),registrationType:'individual',bundleId:'',gameIds:['game-1','game-7'],selections:[{gameId:'game-1',optionId:'game-1-single'},{gameId:'game-7',optionId:'game-7-team',companions:['Sam Player'],teamName:'API Duo'}],expectedPrice:1700};
    const receipt=await store.register(body);
    const option=store.read().entryOptions.find(option=>option.id==='game-7-team')!;
    await store.transact(store.read().revision,{type:'entryOption.save',payload:{...option,price:1500,duration:30}});
    await store.transact(store.read().revision,{type:'settings.save',payload:{registrationOpen:false}});
    await store.close();
    const reopened=await JsonStore.open(dir);stores.push(reopened);
    expect(await reopened.register({...body,gameIds:[...body.gameIds].reverse(),selections:[...body.selections].reverse()})).toEqual(receipt);
    const saved=reopened.read();
    expect(saved.participants).toHaveLength(2);expect(saved.teams).toHaveLength(1);expect(saved.ledger).toHaveLength(1);
    expect(saved.registrations[0].lineItems[1]).toMatchObject({price:1200,duration:0,teamName:'API Duo'});
    expect(saved.entryOptions.find(current=>current.id==='game-7-team')).toMatchObject({price:1500,duration:30,version:2});
    await expect(reopened.register({...body,selections:[body.selections[0],{...body.selections[1],companions:['Different Player']}]})).rejects.toThrow(/different|submitted|request/i);
    expect(reopened.read().ledger).toHaveLength(1);
  });
  it('keeps legacy bundle request hashes stable after upgrading and when type is explicit',async()=>{
    const {dir,store}=await fixture();const body=input();const first=await store.register(body);await store.close();
    const raw=JSON.parse(await readFile(join(dir,'event.json'),'utf8'));
    raw.registrations[0].requestHash=createHash('sha256').update(JSON.stringify({...body,gameIds:[...body.gameIds].sort()})).digest('hex');
    delete raw.registrations[0].registrationType;delete raw.registrations[0].lineItems;delete raw.entryOptions;delete raw.individualRegistrationVersion;
    await writeFile(join(dir,'event.json'),JSON.stringify(raw));const reopened=await JsonStore.open(dir);stores.push(reopened);
    expect(await reopened.register({...body,registrationType:'bundle',selections:[]})).toEqual(first);expect(reopened.read().ledger).toHaveLength(1);
  });
  it('accepts a public registration while protecting private records and exports',async()=>{
    const {app,store}=await fixture();const response=await request(app).post('/api/register').set('Origin',origin).send(input()).expect(201);
    expect(response.body).toMatchObject({amount:1200,bundleName:'Social Bundle'});
    for(const secret of ['email','phone','participantId','requestId','requestHash','ledger'])expect(response.body).not.toHaveProperty(secret);
    expect(store.read().registrations).toHaveLength(1);
    const catalogue=await request(app).get('/api/registration').expect(200);expect(catalogue.headers['cache-control']).toBe('no-store');
    const live=await request(app).get('/api/live').expect(200);
    expect(JSON.stringify([catalogue.body,live.body])).not.toContain('api@example.test');
    await request(app).get('/api/export/registrations').expect(401);
    const agent=request.agent(app);await agent.post('/api/setup').set('Origin',origin).send({password:'registration-test-only'}).expect(200);
    const csv=await agent.get('/api/export/registrations').expect(200);expect(csv.text).toContain('api@example.test');expect(csv.text).toContain('Social Bundle');
  });
  it('rejects wrong origins, malformed fields, honeypots and forged prices',async()=>{
    const {app,store}=await fixture();
    await request(app).post('/api/register').set('Origin','https://other.test').send(input()).expect(403);
    for(const extra of [{email:'invalid'},{consent:false},{website:'spam'},{amount:1},{expectedPrice:1},{gameIds:['game-1','game-1','game-1']}]){
      const response=await request(app).post('/api/register').set('Origin',origin).send(input(extra));expect([400,409]).toContain(response.status);
    }
    expect(store.read().participants).toHaveLength(0);
  });
  it('replays one receipt on simultaneous retries and after restart, even when registration closes',async()=>{
    const {dir,store}=await fixture();const body=input();
    const receipts=await Promise.all([store.register(body),store.register({...body,gameIds:[...body.gameIds].reverse()})]);
    expect(receipts[0]).toEqual(receipts[1]);expect(store.read().revision).toBe(1);expect(store.read().ledger).toHaveLength(1);
    await store.transact(1,{type:'settings.save',payload:{registrationOpen:false}});await store.close();
    const reopened=await JsonStore.open(dir);stores.push(reopened);expect(await reopened.register(body)).toEqual(receipts[0]);expect(reopened.read().ledger).toHaveLength(1);
    await expect(reopened.register({...body,name:'Changed name'})).rejects.toThrow(/request|retry|submitted/i);
  });
  it('serialises different people competing for the last place',async()=>{
    const {store}=await fixture();const game=store.read().games[0];await store.transact(0,{type:'game.save',payload:{...game,capacity:2}});
    await store.transact(1,{type:'participant.save',payload:{name:'Existing',gameIds:[game.id]}});
    const outcomes=await Promise.allSettled([store.register(input()),store.register(input({email:'second@example.test'}))]);
    expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);expect(store.read().participants).toHaveLength(2);expect(store.read().ledger).toHaveLength(1);
  });
  it('does not save a participant or charge when a disk write fails, and allows retry',async()=>{
    const {dir,store}=await fixture();const body=input();await mkdir(join(dir,'event.json.tmp'));
    await expect(store.register(body)).rejects.toThrow();expect(store.read().participants).toHaveLength(0);expect(store.read().ledger).toHaveLength(0);
    expect(JSON.parse(await readFile(join(dir,'event.json'),'utf8')).participants).toHaveLength(0);
    await rm(join(dir,'event.json.tmp'),{recursive:true});await store.register(body);expect(store.read().ledger).toHaveLength(1);
  });
  it('migrates old disk data without replacing participants or modified settings',async()=>{
    const {dir,store}=await fixture();await store.transact(0,{type:'participant.save',payload:{name:'Old player',contact:'original'}});await store.close();
    const old=JSON.parse(await readFile(join(dir,'event.json'),'utf8'));delete old.bundles;delete old.registrations;old.settings.venue='My venue';old.games=old.games.filter((g:{name:string})=>g.name!=='Chess');
    await writeFile(join(dir,'event.json'),JSON.stringify(old));const reopened=await JsonStore.open(dir);stores.push(reopened);
    expect(reopened.read().bundles).toHaveLength(5);expect(reopened.read().games.find(g=>g.name==='Chess')).toBeTruthy();expect(reopened.read().participants[0].contact).toBe('original');expect(reopened.read().settings.venue).toBe('My venue');
  });
  it('limits repeated public submission attempts',async()=>{
    const {app}=await fixture();let status=0;
    for(let i=0;i<61;i++)status=(await request(app).post('/api/register').set('Origin',origin).send({})).status;
    expect(status).toBe(429);
  });
});

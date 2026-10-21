import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { JsonStore } from '../server/store';
import { Auth } from '../server/auth';
import { createApp } from '../server/app';
import { createEvent, applyCommand, publicEvent } from '../shared/domain';
import { eventSchema } from '../shared/model';
import { registrationCatalogue } from '../shared/registration';
import { parseEmails } from '../src/pages/EmailAllowlist';

const dirs:string[]=[];const stores:JsonStore[]=[];
const origin='http://localhost';
const input=(extra={})=>({requestId:crypto.randomUUID(),name:'Invited Player',email:'invited@example.test',department:'Technology',phone:'',bundleId:'social',gameIds:['game-1','game-4','game-5'],expectedPrice:1200,consent:true,website:'',...extra});
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'gameon-allowlist-'));dirs.push(dir);const initial=createEvent();initial.settings.registrationDeadline='2099-12-31';const store=await JsonStore.open(dir,initial);stores.push(store);return {dir,store,app:createApp({store,auth:new Auth(dir),origin})};}
afterEach(async()=>{for(const s of stores.splice(0))await s.close();for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});

describe('registration email allowlist',()=>{
  it('is off for existing saves, so current registration keeps working',()=>{
    const old=JSON.parse(JSON.stringify(createEvent()));delete old.emailAllowlist;
    expect(eventSchema.parse(old).emailAllowlist).toEqual({enabled:false,emails:[]});
  });
  it('normalises, de-duplicates and validates organiser input',()=>{
    const s=createEvent();
    applyCommand(s,{type:'emailAllowlist.save',payload:{enabled:true,emails:[' A@Example.test ','a@example.test','b@example.test','']}});
    expect(s.emailAllowlist).toEqual({enabled:true,emails:['a@example.test','b@example.test']});
    expect(()=>applyCommand(s,{type:'emailAllowlist.save',payload:{enabled:true,emails:['ok@example.test','not-an-email']}})).toThrow(/not-an-email/);
    expect(()=>applyCommand(s,{type:'emailAllowlist.save',payload:{enabled:true,emails:[]}})).toThrow(/at least one email/);
    expect(parseEmails('One@x.test, two@x.test;\nthree@x.test\tone@x.test')).toEqual(['one@x.test','two@x.test','three@x.test']);
  });
  it('accepts invited emails once and rejects uninvited and reused emails on the server',async()=>{
    const {app,store}=await fixture();
    await store.transact(0,{type:'emailAllowlist.save',payload:{enabled:true,emails:['invited@example.test','second@example.test']}});
    const denied=await request(app).post('/api/register').set('Origin',origin).send(input({email:'stranger@example.test'})).expect(403);
    expect(denied.body.error).toMatch(/invitation list/);
    await request(app).post('/api/register').set('Origin',origin).send(input({email:'INVITED@example.test'})).expect(201);
    const reused=await request(app).post('/api/register').set('Origin',origin).send(input({name:'Someone Else'})).expect(409);
    expect(reused.body.error).toMatch(/already registered/);
    expect(store.read().registrations).toHaveLength(1);
  });
  it('checks the allowlist before revealing whether an address has registered',async()=>{
    const {app,store}=await fixture();
    await store.register(input({email:'taken@example.test'}));
    await store.transact(store.read().revision,{type:'emailAllowlist.save',payload:{enabled:true,emails:['invited@example.test']}});
    await request(app).post('/api/register').set('Origin',origin).send(input({email:'taken@example.test'})).expect(403);
  });
  it('never publishes invited addresses',async()=>{
    const {app,store}=await fixture();
    await store.transact(0,{type:'emailAllowlist.save',payload:{enabled:true,emails:['secret@example.test']}});
    const catalogue=await request(app).get('/api/registration').expect(200);
    expect(catalogue.body.inviteOnly).toBe(true);
    expect(JSON.stringify(catalogue.body)).not.toContain('secret@example.test');
    expect(JSON.stringify((await request(app).get('/api/live').expect(200)).body)).not.toContain('secret@example.test');
    expect(JSON.stringify(registrationCatalogue(store.read()))).not.toContain('secret@example.test');
    expect(JSON.stringify(publicEvent(store.read()))).not.toContain('secret@example.test');
    await request(app).get('/api/state').expect(401);
  });
});

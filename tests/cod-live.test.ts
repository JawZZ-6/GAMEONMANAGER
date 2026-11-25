import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import request from 'supertest';
import { JsonStore } from '../server/store';
import { Auth } from '../server/auth';
import { createApp } from '../server/app';
import { applyCodChanges, codSchema } from '../shared/cod';

const origin='http://localhost';const password='test-password-12345';
const dirs:string[]=[];const stores:JsonStore[]=[];const servers:Server[]=[];
afterEach(async()=>{for(const s of servers.splice(0)){s.closeAllConnections();await new Promise(r=>s.close(r));}for(const s of stores.splice(0))await s.close();for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'gameon-cod-'));dirs.push(dir);const store=await JsonStore.open(dir);stores.push(store);const auth=new Auth(dir);await auth.setup(password);return {dir,store,app:createApp({store,auth,origin})};}
async function organiser(app:ReturnType<typeof createApp>){const agent=request.agent(app);await agent.post('/api/login').set('Origin',origin).send({password}).expect(200);return agent;}
const ffa={op:'result',id:'CODF-01',value:{pl:{'Aqeela Raban':1,'Uresh Hettiarachchi':2},k:{'Aqeela Raban':7}}};
const boot=(html:string)=>JSON.parse(/window\.COD_BOOT=(.*?);<\/script>/.exec(html)![1]);

describe('COD live scorecard page',()=>{
  it('serves the scorecard at /live with current results inlined, read-only for spectators',async()=>{
    const {app,store}=await fixture();await store.updateCod({changes:[ffa]});
    const res=await request(app).get('/live').expect(200).expect('Content-Type',/html/).expect('Cache-Control','no-store');
    expect(res.text).toContain('COD Showdown');expect(res.text).not.toContain('<!--COD-BOOT-->');
    expect(boot(res.text)).toEqual({cod:{r:{'CODF-01':ffa.value},fin:{},rules:{},reveal:{}},edit:false});
    await request(app).get('/live/').expect(200).expect('Content-Type',/html/);
  });
  it('marks signed-in organisers as editors',async()=>{
    const {app}=await fixture();const agent=await organiser(app);
    expect(boot((await agent.get('/live').expect(200)).text).edit).toBe(true);
  });
  it('escapes results so a name cannot close the inline script',async()=>{
    const {app,store}=await fixture();
    await store.updateCod({changes:[{op:'finalists',ev:'ffa',names:['</script><script>alert(1)</script>']}]});
    const html=(await request(app).get('/live')).text;
    expect(html).not.toContain('</script><script>alert(1)');
    expect(boot(html).cod.fin.ffa).toEqual(['</script><script>alert(1)</script>']);
  });
});

describe('COD results API',()=>{
  it('lets anyone read results but only organisers save them',async()=>{
    const {app}=await fixture();
    expect((await request(app).get('/api/cod').expect(200)).body).toEqual({r:{},fin:{},rules:{},reveal:{}});
    await request(app).post('/api/cod').set('Origin',origin).send({changes:[ffa]}).expect(401);
    const agent=await organiser(app);
    await agent.post('/api/cod').set('Origin','https://evil.test').send({changes:[ffa]}).expect(403);
    const saved=(await agent.post('/api/cod').set('Origin',origin).send({changes:[ffa]}).expect(200)).body;
    expect(saved.r['CODF-01']).toEqual(ffa.value);
    expect((await request(app).get('/api/cod')).body.r['CODF-01']).toEqual(ffa.value);
  });
  it('saves per match, so organisers scoring different matches do not overwrite each other',async()=>{
    const {app,store}=await fixture();const a=await organiser(app),b=await organiser(app);
    await a.post('/api/cod').set('Origin',origin).send({changes:[ffa]}).expect(200);
    await b.post('/api/cod').set('Origin',origin).send({changes:[{op:'result',id:'COD2-01',value:{s:[3,1]}}]}).expect(200);
    const cod=store.read().cod;expect(Object.keys(cod.r).sort()).toEqual(['COD2-01','CODF-01']);
    await a.post('/api/cod').set('Origin',origin).send({changes:[{op:'result',id:'CODF-01',value:null},{op:'rules',rules:{win:4}},{op:'finalists',ev:'t2',names:['Team A','Team B']}]}).expect(200);
    expect(store.read().cod).toEqual({r:{'COD2-01':{s:[3,1]}},fin:{t2:['Team A','Team B']},rules:{win:4},reveal:{}});
  });
  it('is not blocked by registrations or other edits that bump the event revision',async()=>{
    const {app,store}=await fixture();const agent=await organiser(app);
    await store.transact(store.read().revision,{type:'participant.save',payload:{name:'Someone'}});
    await agent.post('/api/cod').set('Origin',origin).send({changes:[ffa]}).expect(200);
  });
  it('rejects malformed results without changing anything',async()=>{
    const {app,store,dir}=await fixture();const agent=await organiser(app);
    for(const changes of [[],[{op:'result',id:'../x',value:null}],[{op:'result',id:'CODF-01',value:{pl:{A:99}}}],[{op:'result',id:'COD2-01',value:{s:[1,2],extra:true}}],[{op:'rules',rules:{ffaAdv:1}}],[{op:'reveal',key:'e3',on:true}],[{op:'reveal',key:'duel',on:'yes'}],[{op:'nuke'}]])
      await agent.post('/api/cod').set('Origin',origin).send({changes}).expect(400);
    expect(store.read().cod).toEqual({r:{},fin:{},rules:{},reveal:{}});
    expect(JSON.parse(await readFile(join(dir,'event.json'),'utf8')).cod).toEqual({r:{},fin:{},rules:{},reveal:{}});
  });
  it('pushes saved results to live viewers',async()=>{
    const {app,store}=await fixture();const server=app.listen(0,'127.0.0.1');servers.push(server);await new Promise(r=>server.once('listening',r));
    const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;const controller=new AbortController();
    const res=await fetch(`${url}/api/live/stream`,{signal:controller.signal});const reader=res.body!.getReader();const decoder=new TextDecoder();
    let text='';const frames=async(n:number)=>{while(text.split('\n\n').filter(f=>f.includes('data: ')).length<n){const {value}=await reader.read();text+=decoder.decode(value,{stream:true});}};
    await frames(1);await store.updateCod({changes:[ffa]});await frames(2);controller.abort();
    const last=JSON.parse(text.split('\n\n').filter(f=>f.includes('data: '))[1].split('data: ')[1]);
    expect(last.cod.r['CODF-01']).toEqual(ffa.value);
  });
});

describe('COD results data',()=>{
  it('fills in empty results for events saved before the scorecard existed',async()=>{
    const {dir,store}=await fixture();await store.close();stores.splice(0);
    const file=join(dir,'event.json');const saved=JSON.parse(await readFile(file,'utf8'));delete saved.cod;await writeFile(file,JSON.stringify(saved));
    const reopened=await JsonStore.open(dir);stores.push(reopened);
    expect(reopened.read().cod).toEqual({r:{},fin:{},rules:{},reveal:{}});
  });
  it('stores Challenger lobbies, the play-in score and a locked play-in line-up',async()=>{
    const {app,store}=await fixture();const agent=await organiser(app);
    await agent.post('/api/cod').set('Origin',origin).send({changes:[{op:'result',id:'CHF-01',value:{pl:{'New One':2,'Jawahar Jegathananthan':1},k:{}}},{op:'result',id:'F-PLAYIN',value:{s:[10,12]}},{op:'finalists',ev:'ch',names:['Viraj Madhusanka','New One']}]}).expect(200);
    expect(store.read().cod).toMatchObject({r:{'CHF-01':{pl:{'New One':2}},'F-PLAYIN':{s:[10,12]}},fin:{ch:['Viraj Madhusanka','New One']}});
  });
  it('saves organiser reveals of classified events for everyone, and can hide them again',async()=>{
    const {app,store}=await fixture();
    await request(app).post('/api/cod').set('Origin',origin).send({changes:[{op:'reveal',key:'duel',on:true}]}).expect(401);
    const agent=await organiser(app);
    await agent.post('/api/cod').set('Origin',origin).send({changes:[{op:'reveal',key:'duel',on:true}]}).expect(200);
    expect(store.read().cod.reveal).toEqual({duel:true});
    expect(boot((await request(app).get('/live')).text).cod.reveal).toEqual({duel:true});
    await agent.post('/api/cod').set('Origin',origin).send({changes:[{op:'reveal',key:'duel',on:false}]}).expect(200);
    expect(store.read().cod.reveal).toEqual({duel:false});
  });
  it('applies forfeits and clears final line-ups',()=>{
    const cod=codSchema.parse({fin:{ffa:['A','B']}});
    applyCodChanges(cod,[{op:'result',id:'COD2-02',value:{ff:1}},{op:'finalists',ev:'ffa',names:null}]);
    expect(cod).toEqual({r:{'COD2-02':{ff:1}},fin:{},rules:{},reveal:{}});
  });
});

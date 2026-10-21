import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { JsonStore } from '../server/store';
import { Auth } from '../server/auth';
import { createApp } from '../server/app';
import { demoEvent } from '../server/demo';
import { applyCommand, publicEvent } from '../shared/domain';
import type { PublicEvent } from '../shared/model';

const dirs:string[]=[];const stores:JsonStore[]=[];const servers:Server[]=[];
async function fixture(liveStreamLimit?:number){const dir=await mkdtemp(join(tmpdir(),'gameon-live-'));dirs.push(dir);const store=await JsonStore.open(dir,demoEvent());stores.push(store);const app=createApp({store,auth:new Auth(dir),origin:'http://localhost',liveStreamLimit});const server=app.listen(0,'127.0.0.1');servers.push(server);await new Promise(r=>server.once('listening',r));return {store,app,url:`http://127.0.0.1:${(server.address() as AddressInfo).port}`};}
afterEach(async()=>{for(const s of servers.splice(0)){s.closeAllConnections();await new Promise(r=>s.close(r));}for(const s of stores.splice(0))await s.close();for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
async function stream(url:string){const controller=new AbortController();const response=await fetch(`${url}/api/live/stream`,{signal:controller.signal});const reader=response.body!.getReader();const decoder=new TextDecoder();let buffer='';
  const next=async():Promise<PublicEvent>=>{for(;;){const frame=buffer.split('\n\n');if(frame.length>1){buffer=frame.slice(1).join('\n\n');const data=frame[0].split('\n').find(l=>l.startsWith('data: '));if(data)return JSON.parse(data.slice(6));continue;}const {value,done}=await reader.read();if(done)throw new Error('stream ended');buffer+=decoder.decode(value,{stream:true});}};
  return {response,next,close:()=>controller.abort()};}

describe('spectator roster',()=>{
  it('lists each competitor with their games and who is playing right now, without contact details',()=>{
    const s=demoEvent();s.participants[0].email='alex@example.test';s.participants[0].phone='0771234567';
    const live=publicEvent(s);
    expect(live.players.find(p=>p.name==='Alex Perera')).toMatchObject({gameIds:['game-7'],checkedIn:true});
    expect(live.nowPlaying).toEqual([expect.objectContaining({kind:'match',gameId:'game-7',sides:['Alex Perera','Taylor Jay']})]);
    const text=JSON.stringify(live);expect(text).not.toContain('alex@example.test');expect(text).not.toContain('0771234567');
    for(const p of live.players)expect(Object.keys(p).sort()).toEqual(['checkedIn','gameIds','id','name','teams']);
  });
  it('shows free-play sessions and waiting groups, and hides matches from unpublished tournaments',()=>{
    const s=demoEvent();const game=s.games.find(g=>g.mode==='free-play')!;const station=s.stations.find(x=>x.available&&!s.matches.some(m=>m.status==='live'&&m.stationId===x.id))!;const busy=new Set(publicEvent(s).nowPlaying.flatMap(p=>p.playerIds));const [a,b,c]=s.participants.filter(p=>!busy.has(p.id));
    applyCommand(s,{type:'queue.add',payload:{gameId:game.id,participantIds:[a.id,b.id]}});applyCommand(s,{type:'queue.add',payload:{gameId:game.id,participantIds:[c.id]}});
    applyCommand(s,{type:'session.start',payload:{queueId:s.queue[0].id,stationId:station.id,duration:20}});
    const live=publicEvent(s);
    expect(live.nowPlaying).toContainEqual(expect.objectContaining({kind:'free-play',gameId:game.id,stationId:station.id,playerIds:[a.id,b.id],sides:[a.name,b.name]}));
    expect(live.waiting).toEqual([{gameId:game.id,groups:1}]);
    for(const t of s.tournaments)t.published=false;
    expect(publicEvent(s).nowPlaying.every(p=>p.kind==='free-play')).toBe(true);
  });
});

describe('live stream',()=>{
  it('sends the public board on connect and again after every saved change',async()=>{
    const {store,url}=await fixture();const live=await stream(url);
    expect(live.response.headers.get('content-type')).toContain('text/event-stream');
    const first=await live.next();expect(first.revision).toBe(store.read().revision);
    const s=store.read();await store.transact(s.revision,{type:'announcement.save',payload:{title:'Finals start soon',body:'Head to the main stage'}});
    const second=await live.next();expect(second.revision).toBe(first.revision+1);expect(second.announcements.map(a=>a.title)).toContain('Finals start soon');
    live.close();
  });
  it('turns extra viewers away once the cap is reached so they fall back to polling',async()=>{
    const {url}=await fixture(1);const first=await stream(url);await first.next();
    const second=await fetch(`${url}/api/live/stream`);expect(second.status).toBe(503);
    expect((await fetch(`${url}/api/live`)).status).toBe(200);first.close();
  });
  it('ends open streams when the server shuts down',async()=>{
    const {app,url}=await fixture();const live=await stream(url);await live.next();
    app.locals.closeLiveViewers();await expect(live.next()).rejects.toThrow(/ended/);
  });
});

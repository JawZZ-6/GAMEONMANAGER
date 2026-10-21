import { describe, expect, it } from 'vitest';
import { applyCommand, createEvent, moneySummary } from '../shared/domain';
import { applyRegistration, registrationCatalogue } from '../shared/registration';

const date=new Date('2026-10-20T10:00:00Z');
const input=(extra={})=>({requestId:crypto.randomUUID(),name:'Alex Player',email:'alex@example.test',department:'Finance',phone:'',registrationType:'individual',bundleId:'',gameIds:['game-1'],selections:[{gameId:'game-1',optionId:'game-1-single',companions:[],teamName:''}],expectedPrice:500,consent:true,website:'',...extra});
describe('individual entry options',()=>{
  it('rejects changed play terms even when the price and player count are unchanged',()=>{
    const s=createEvent();const game=s.games.find(g=>g.name==='FC 26'&&g.mode==='free-play')!;const option=s.entryOptions.find(o=>o.gameId===game.id&&o.players===1)!;
    const submitted=input({gameIds:[game.id],selections:[{gameId:game.id,optionId:option.id,optionVersion:1}],expectedPrice:400});
    expect(applyRegistration(structuredClone(s),submitted,'original',date).lineItems[0].duration).toBe(60);
    applyCommand(s,{type:'entryOption.save',payload:{...option,duration:30}});
    expect(()=>applyRegistration(s,submitted,'hash',date)).toThrow(/changed|review/i);expect(s.ledger).toHaveLength(0);
    const updated=applyRegistration(s,{...submitted,selections:[{gameId:game.id,optionId:option.id,optionVersion:2}]},'reviewed',date);
    expect(updated.lineItems[0].duration).toBe(30);
  });
  it('lets organisers edit option prices without changing existing purchases',()=>{
    const s=createEvent();const r=applyRegistration(s,input(),'hash',date);const option=s.entryOptions.find(o=>o.id==='game-1-single')!;
    applyCommand(s,{type:'entryOption.save',payload:{...option,price:600}});
    expect(s.entryOptions.find(o=>o.id===option.id)?.price).toBe(600);expect(r.lineItems[0].price).toBe(500);
    expect(()=>applyCommand(s,{type:'entryOption.save',payload:{...option,players:2,priceBasis:'person'}})).toThrow(/person|player/i);
  });
  it('offers the supplied tournament and free-play prices with separate platforms',()=>{
    const s=createEvent();const c=registrationCatalogue(s,date);
    expect(c.entryOptions.filter(o=>o.gameId==='game-1').map(o=>o.price)).toEqual([500]);
    expect(c.entryOptions.filter(o=>o.gameId==='game-7').map(o=>o.price)).toEqual([700,1200]);
    expect(c.entryOptions.filter(o=>o.gameId==='game-9').map(o=>o.price)).toEqual([300,1000]);
    const consoleGame=c.games.find(g=>g.name==='Watch Dogs: Legion'&&g.mode==='free-play')!;
    expect(consoleGame.platform).toBe('console');
    expect(c.entryOptions.filter(o=>o.gameId===consoleGame.id).map(o=>[o.price,o.players,o.duration])).toEqual([[400,1,60],[700,2,60],[1000,4,60]]);
    const pcGame=c.games.find(g=>g.name==='God of War Ragnarök')!;
    expect(pcGame.platform).toBe('pc');expect(c.entryOptions.find(o=>o.gameId===pcGame.id)).toMatchObject({price:350,players:1,duration:60});
  });
  it('registers one board game with an unpaid charge and immutable price breakdown',()=>{
    const s=createEvent();const r=applyRegistration(s,input(),'hash',date);
    expect(r).toMatchObject({registrationType:'individual',bundleName:'Individual games',amount:500});
    expect(r.lineItems[0]).toMatchObject({gameId:'game-1',gameName:'UNO',price:500,players:1});
    expect(s.participants[0].gameIds).toEqual(['game-1']);expect(moneySummary(s)).toMatchObject({outstanding:500,receipts:0});
    s.entryOptions.find(o=>o.id==='game-1-single')!.price=900;expect(r.lineItems[0].price).toBe(500);
  });
  it('totals multiple games including free play and enrolls companions without charging each one again',()=>{
    const s=createEvent();const free=s.games.find(g=>g.name==='FC 26'&&g.mode==='free-play')!;
    const r=applyRegistration(s,input({gameIds:['game-1',free.id],selections:[{gameId:'game-1',optionId:'game-1-single'},{gameId:free.id,optionId:`${free.id}-head-to-head`,companions:['Sam Player']}],expectedPrice:1200}),'hash',date);
    expect(r.amount).toBe(1200);expect(s.participants).toHaveLength(2);expect(s.ledger).toHaveLength(1);
    expect(s.participants[1].gameIds).toEqual([free.id]);expect(r.lineItems[1]).toMatchObject({duration:60,price:700,players:2});
  });
  it('creates one two-player team with the per-team tournament charge',()=>{
    const s=createEvent();const r=applyRegistration(s,input({gameIds:['game-9'],selections:[{gameId:'game-9',optionId:'game-9-team',companions:['Sam Player'],teamName:'Finance Duo'}],expectedPrice:1000}),'hash',date);
    expect(s.teams).toHaveLength(1);expect(s.teams[0]).toMatchObject({name:'Finance Duo',gameIds:['game-9']});expect(s.teams[0].memberIds).toHaveLength(2);
    expect(r.lineItems[0]).toMatchObject({teamName:'Finance Duo',priceBasis:'team',price:1000});expect(moneySummary(s).outstanding).toBe(1000);
  });
  it('rejects missing/foreign/disabled options, duplicates, wrong totals and invalid group rosters atomically',()=>{
    const variants=[{gameIds:[],selections:[],expectedPrice:0},{selections:[]},{selections:[{gameId:'game-1',optionId:'game-7-single'}]},
      {expectedPrice:1},{gameIds:['game-1','game-1']},{selections:[{gameId:'game-1',optionId:'game-1-single',companions:['Sam']}]},
      {gameIds:['game-7'],selections:[{gameId:'game-7',optionId:'game-7-team',companions:[],teamName:'Duo'}],expectedPrice:1200},
      {gameIds:['game-7'],selections:[{gameId:'game-7',optionId:'game-7-team',companions:['Alex Player'],teamName:'Duo'}],expectedPrice:1200},
      {gameIds:['game-7'],selections:[{gameId:'game-7',optionId:'game-7-team',companions:['Sam']}],expectedPrice:1200}];
    for(const v of variants){const s=createEvent();expect(()=>applyRegistration(s,input(v),'hash',date)).toThrow();expect(s.participants).toHaveLength(0);expect(s.ledger).toHaveLength(0);}
    for(const change of ['inactive','zero'] as const){const s=createEvent();const option=s.entryOptions.find(o=>o.id==='game-1-single')!;if(change==='inactive')option.active=false;else option.price=0;expect(()=>applyRegistration(s,input(),'hash',date)).toThrow();}
  });
  it('reserves a place for every group member and refuses a group larger than remaining capacity',()=>{
    const s=createEvent();s.games.find(g=>g.id==='game-7')!.capacity=2;
    s.participants.push({id:'existing',name:'Existing',department:'',contact:'',email:'',phone:'',checkedIn:false,gameIds:['game-7']});
    expect(()=>applyRegistration(s,input({gameIds:['game-7'],selections:[{gameId:'game-7',optionId:'game-7-team',companions:['Sam'],teamName:'Duo'}],expectedPrice:1200}),'hash',date)).toThrow(/places|capacity|full/i);
    expect(s.participants).toHaveLength(1);expect(s.teams).toHaveLength(0);
  });
  it('reuses the same named companion across selections within one registration',()=>{
    const s=createEvent();applyRegistration(s,input({gameIds:['game-7','game-8'],selections:[{gameId:'game-7',optionId:'game-7-team',companions:['Sam Player'],teamName:'Duo'},{gameId:'game-8',optionId:'game-8-team',companions:[' Sam Player '],teamName:'Duo'}],expectedPrice:2400}),'hash',date);
    expect(s.participants).toHaveLength(2);expect(s.participants[1].gameIds).toEqual(['game-7','game-8']);expect(s.teams).toHaveLength(1);expect(s.teams[0].gameIds).toEqual(['game-7','game-8']);
  });
});

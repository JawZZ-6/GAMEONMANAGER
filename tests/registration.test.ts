import { describe, expect, it } from 'vitest';
import { createEvent, applyCommand, moneySummary, publicEvent } from '../shared/domain';
import { eventSchema } from '../shared/model';
import { addRegistrationDefaults, applyRegistration, registrationCatalogue } from '../shared/registration';

const date = new Date('2026-10-20T12:00:00Z');
const input = (overrides = {}) => ({requestId:crypto.randomUUID(),name:'Alex Perera',email:'alex@example.test',department:'Finance',phone:'0771234567',bundleId:'social',gameIds:['game-1','game-4','game-5'],expectedPrice:1200,consent:true as const,website:'',...overrides});

describe('participant bundles', () => {
  it('provides all five offers with the requested prices and adds Chess once', () => {
    const s=createEvent();
    expect(s.bundles.map(b=>[b.id,b.price])).toEqual([['social',1200],['brainpower',1200],['arcade',1600],['both-worlds',1400],['ultimate',1600]]);
    expect(s.games.filter(g=>g.name==='Chess')).toHaveLength(1);
    expect(registrationCatalogue(s,date).bundles.every(b=>b.available)).toBe(true);
  });
  it('upgrades legacy saves using their game IDs and preserves all existing data', () => {
    const s=createEvent();applyCommand(s,{type:'participant.save',payload:{name:'Existing',contact:'private'}});
    const old=JSON.parse(JSON.stringify(s));delete old.bundles;delete old.registrations;
    old.games=old.games.filter((g:{name:string})=>g.name!=='Chess');old.games[0].id='custom-uno';
    const upgraded=addRegistrationDefaults(eventSchema.parse(old));
    expect(upgraded.participants).toEqual(s.participants);
    expect(upgraded.bundles[0].fixedGameIds).toContain('custom-uno');
    expect(addRegistrationDefaults(upgraded)).toEqual(upgraded);
    expect(upgraded.settings).toEqual(s.settings);
  });
  it('creates enrolments and exactly one unpaid charge using a purchase snapshot', () => {
    const s=createEvent();const registration=applyRegistration(s,input(),'hash',date);
    expect(s.participants[0]).toMatchObject({name:'Alex Perera',email:'alex@example.test',gameIds:['game-1','game-4','game-5'],checkedIn:false});
    expect(registration).toMatchObject({bundleName:'Social Bundle',amount:1200,gameNames:['UNO','Pictionary','Charades']});
    expect(s.ledger).toHaveLength(1);expect(s.ledger[0]).toMatchObject({kind:'charge',amount:1200,participantId:s.participants[0].id});
    expect(moneySummary(s)).toMatchObject({receipts:0,outstanding:1200});
    applyCommand(s,{type:'bundle.save',payload:{id:'social',name:'Social new',price:1300,active:true}});
    expect(registration.amount).toBe(1200);expect(registration.bundleName).toBe('Social Bundle');
  });
  it.each([
    ['brainpower',1200,['game-chess','game-2','game-6']],
    ['arcade',1600,['game-7','game-8','game-9']],
    ['both-worlds',1400,['game-1','game-2','game-7']],
    ['ultimate',1600,['game-1','game-7','game-8']],
  ])('accepts %s with its exact mix', (bundleId,expectedPrice,gameIds) => {
    const s=createEvent();expect(applyRegistration(s,input({bundleId,expectedPrice,gameIds}),'hash',date).amount).toBe(expectedPrice);
  });
  it('rejects invalid game selections and client price changes without partial changes', () => {
    for(const overrides of [
      {gameIds:['game-1','game-2','game-3']}, {gameIds:['game-1','game-4','game-4']}, {gameIds:['game-1']},
      {expectedPrice:1}, {bundleId:'unknown'},
      {bundleId:'arcade',expectedPrice:1600,gameIds:['game-1','game-7','game-8']},
      {bundleId:'both-worlds',expectedPrice:1400,gameIds:['game-1','game-7','game-8']},
      {bundleId:'ultimate',expectedPrice:1600,gameIds:['game-1','game-2','game-7']},
    ]){const s=createEvent();expect(()=>applyRegistration(s,input(overrides),'hash',date)).toThrow();expect(s.participants).toHaveLength(0);expect(s.ledger).toHaveLength(0);}
  });
  it('honours close switches, deadline at midnight Sri Lanka, archives and tournament modes', () => {
    const s=createEvent();expect(registrationCatalogue(s,new Date('2026-10-30T18:29:59Z')).open).toBe(true);
    expect(()=>applyRegistration(s,input(),'hash',new Date('2026-10-30T18:30:00Z'))).toThrow(/closed/i);
    s.settings.registrationOpen=false;expect(()=>applyRegistration(s,input(),'hash',date)).toThrow(/closed/i);
    s.settings.registrationOpen=true;s.bundles[0].active=false;expect(()=>applyRegistration(s,input(),'hash',date)).toThrow(/available/i);
    s.bundles[0].active=true;s.games[0].archived=true;expect(()=>applyRegistration(s,input(),'hash',date)).toThrow(/available/i);
    s.games[0].archived=false;s.games[0].mode='free-play';expect(()=>applyRegistration(s,input(),'hash',date)).toThrow(/available/i);
  });
  it('counts people across enrolments and teams once and enforces capacity', () => {
    const s=createEvent();s.games[0].capacity=2;
    applyCommand(s,{type:'participant.save',payload:{id:'p1',name:'First',gameIds:['game-1']}});
    applyCommand(s,{type:'participant.save',payload:{id:'p2',name:'Second'}});
    applyCommand(s,{type:'team.save',payload:{id:'t1',name:'Pair',memberIds:['p1','p2'],gameIds:['game-1']}});
    expect(registrationCatalogue(s,date).games.find(g=>g.id==='game-1')?.remaining).toBe(0);
    expect(()=>applyRegistration(s,input(),'hash',date)).toThrow(/full|capacity/i);
    expect(s.participants).toHaveLength(2);expect(s.ledger).toHaveLength(0);
  });
  it('rejects duplicate email case-insensitively and protects private registration details', () => {
    const s=createEvent();applyRegistration(s,input(),'hash',date);
    expect(()=>applyRegistration(s,input({email:' ALEX@EXAMPLE.TEST '}),'other',date)).toThrow(/already|organiser/i);
    const json=JSON.stringify([publicEvent(s),registrationCatalogue(s,date)]);
    for(const secret of ['alex@example.test','0771234567','requestId','requestHash','participantId','ledger','registrations'])expect(json).not.toContain(secret);
  });
});

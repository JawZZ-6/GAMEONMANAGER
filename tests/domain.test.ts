import { describe, it, expect } from 'vitest';
import { createEvent, applyCommand, standings, moneySummary, publicEvent } from '../shared/domain';

function eventWithPeople(n = 4) {
  const s = createEvent();
  for (let i=0; i<n; i++) applyCommand(s, {type:'participant.save',payload:{id:`p${i}`,name:`Player ${i}`,department:'Internal',contact:'private@example.test',checkedIn:true}});
  return s;
}
function tournament(n=4,format='elimination') {
  const s = eventWithPeople(n);
  applyCommand(s,{type:'tournament.save',payload:{id:'t',name:'Cup',gameId:s.games[0].id,format,entryType:'individual',entrantIds:s.participants.map(p=>p.id),published:true}});
  applyCommand(s,{type:'tournament.generate',payload:{id:'t'}}); return s;
}
describe('event operations',()=>{
  it('rejects restoring a cancelled match into a newly occupied booking',()=>{
    const s=tournament(4,'round-robin');applyCommand(s,{type:'station.save',payload:{id:'desk',name:'Desk',available:true}});const [a,b]=s.matches;
    applyCommand(s,{type:'match.schedule',payload:{id:a.id,stationId:'desk',scheduledAt:'2026-11-16T10:00:00+05:30',duration:30}});applyCommand(s,{type:'match.status',payload:{id:a.id,status:'cancelled'}});
    applyCommand(s,{type:'match.schedule',payload:{id:b.id,stationId:'desk',scheduledAt:'2026-11-16T10:00:00+05:30',duration:30}});
    expect(()=>applyCommand(s,{type:'match.status',payload:{id:a.id,status:'scheduled'}})).toThrow(/conflict/i);
  });
  it('flags participant conflicts newly introduced by bracket advancement',()=>{
    const s=tournament(4);applyCommand(s,{type:'tournament.save',payload:{id:'other',name:'Other',gameId:s.games[0].id,format:'round-robin',entryType:'individual',entrantIds:['p0','p1']}});applyCommand(s,{type:'tournament.generate',payload:{id:'other'}});
    const final=s.matches.find(m=>m.tournamentId==='t'&&m.round===2)!,other=s.matches.find(m=>m.tournamentId==='other')!;
    for(const m of [final,other])applyCommand(s,{type:'match.schedule',payload:{id:m.id,stationId:'',scheduledAt:'2026-11-16T10:00:00+05:30',duration:30}});
    const semi=s.matches.find(m=>m.tournamentId==='t'&&m.a==='p0')!;
    expect(()=>applyCommand(s,{type:'match.result',payload:{id:semi.id,scoreA:1,scoreB:0,winnerId:'p0'}})).toThrow(/conflict/i);
  });
  it('starts with banner defaults and no invented attendance or money',()=>{const s=createEvent(); expect(s.settings.startDate).toBe('2026-11-16');expect(s.participants).toEqual([]);expect(s.ledger).toEqual([]);});
  it('creates a three-player bracket with one explicit bye and advances winners',()=>{
    const s=tournament(3); expect(s.matches).toHaveLength(3); expect(s.matches.filter(m=>m.bye)).toHaveLength(1);
    const match=s.matches.find(m=>m.round===1&&!m.bye)!;
    applyCommand(s,{type:'match.result',payload:{id:match.id,scoreA:2,scoreB:0,winnerId:match.a}});
    const final=s.matches.find(m=>m.round===2)!;expect(final.a).toBeTruthy();expect(final.b).toBeTruthy();
  });
  it('generates every round-robin pair once and gives exact ties shared ranks',()=>{const s=tournament(4,'round-robin');expect(s.matches).toHaveLength(6);const ranks=standings(s,'t');expect(ranks.map(r=>r.rank)).toEqual([1,1,1,1]);});
  it('does not allow editing frozen entrants or overlapping team members',()=>{
    const s=tournament();expect(()=>applyCommand(s,{type:'tournament.save',payload:{...s.tournaments[0],entrantIds:['p0','p1']}})).toThrow(/reset/i);
    applyCommand(s,{type:'team.save',payload:{id:'a',name:'A',memberIds:['p0','p1']}});applyCommand(s,{type:'team.save',payload:{id:'b',name:'B',memberIds:['p0','p2']}});
    expect(()=>applyCommand(s,{type:'tournament.save',payload:{name:'Teams',gameId:s.games[0].id,format:'elimination',entryType:'team',entrantIds:['a','b']}})).toThrow(/member/i);
  });
  it('blocks station schedule overlaps and starting two matches for the same player',()=>{
    const s=tournament(3,'round-robin');applyCommand(s,{type:'station.save',payload:{id:'desk',name:'Desk',available:true}});
    const [a,b]=s.matches;applyCommand(s,{type:'match.schedule',payload:{id:a.id,stationId:'desk',scheduledAt:'2026-11-16T10:00:00+05:30',duration:30}});
    expect(()=>applyCommand(s,{type:'match.schedule',payload:{id:b.id,stationId:'desk',scheduledAt:'2026-11-16T10:15:00+05:30',duration:30}})).toThrow(/conflict/i);
    applyCommand(s,{type:'match.status',payload:{id:a.id,status:'live'}});expect(()=>applyCommand(s,{type:'match.status',payload:{id:b.id,status:'live'}})).toThrow(/conflict/i);
  });
  it('requires confirmed downstream reset when a later match has started',()=>{
    const s=tournament(4);for(const m of s.matches.filter(m=>m.round===1))applyCommand(s,{type:'match.result',payload:{id:m.id,scoreA:1,scoreB:0,winnerId:m.a}});
    const final=s.matches.find(m=>m.round===2)!;applyCommand(s,{type:'match.status',payload:{id:final.id,status:'live'}});
    const first=s.matches[0];expect(()=>applyCommand(s,{type:'match.result',payload:{id:first.id,scoreA:0,scoreB:1,winnerId:first.b}})).toThrow(/downstream/i);
    applyCommand(s,{type:'match.result',payload:{id:first.id,scoreA:0,scoreB:1,winnerId:first.b,resetDownstream:true}});expect(final.status).toBe('scheduled');expect(s.audit.at(-1)?.action).toContain('match.result');
  });
  it('accounts for receipts, refunds, expenses and transfers without counting charges as cash',()=>{
    const s=eventWithPeople(1);for(const [kind,amount] of [['charge',500],['payment',500],['donation',200],['refund',100],['expense',50],['transfer',300]] as const)applyCommand(s,{type:'ledger.add',payload:{kind,amount,participantId:'p0',note:'Test'}});
    expect(moneySummary(s)).toMatchObject({receipts:700,refunds:100,expenses:50,transferred:300,available:250,outstanding:100});
  });
  it('supports free-play queue, calling and completed sessions',()=>{
    const s=eventWithPeople(1);applyCommand(s,{type:'game.save',payload:{id:'free',name:'Free play',category:'retro',mode:'free-play',capacity:4,fee:0}});applyCommand(s,{type:'station.save',payload:{id:'desk',name:'Table 1',available:true}});
    applyCommand(s,{type:'queue.add',payload:{gameId:'free',participantIds:['p0']}});const q=s.queue[0];applyCommand(s,{type:'queue.call',payload:{id:q.id}});expect(q.status).toBe('called');
    applyCommand(s,{type:'session.start',payload:{queueId:q.id,stationId:'desk',duration:30}});expect(s.sessions[0].status).toBe('live');applyCommand(s,{type:'session.end',payload:{id:s.sessions[0].id}});expect(s.sessions[0].status).toBe('completed');
  });
  it('publishes only explicitly public fields and published tournaments',()=>{const s=tournament();const p=publicEvent(s);expect(JSON.stringify(p)).not.toContain('private@example');expect(p).not.toHaveProperty('ledger');expect(p).not.toHaveProperty('audit');s.tournaments[0].published=false;expect(publicEvent(s).tournaments).toEqual([]);});
});

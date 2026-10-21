import { z } from 'zod';
import { participantSchema,entryOptionSchema,emailAllowlistSchema,teamSchema,gameSchema,tournamentSchema,stationSchema,settingsSchema,announcementSchema,ledgerSchema,eventSchema, type EventState,type Match,type Command,type PublicEvent,type Standing,type Tournament } from './model';
import { addRegistrationDefaults } from './registration';
import { AppError } from './errors';
export { AppError } from './errors';

export const uid = () => globalThis.crypto.randomUUID();
const now = () => new Date().toISOString();
function requireValue(condition:unknown,message:string):asserts condition {if(!condition)throw new AppError(message);}
function find<T extends {id:string}>(items:T[],id:unknown):T {const value=items.find(x=>x.id===id);requireValue(value,'Record not found');return value;}
function save<T extends {id:string}>(items:T[],item:T) {const i=items.findIndex(x=>x.id===item.id);if(i<0)items.push(item);else items[i]=item;}
const withId = (p:Record<string,unknown>) => ({...p,id:p.id||uid()});
const roundMoney = (n:number) => Math.round(n*100)/100;

export function createEvent():EventState {
  return addRegistrationDefaults(eventSchema.parse({schemaVersion:1,revision:0,updatedAt:now(),settings:{name:'Retro & Cyber GameON',venue:'CISI · Venue to be confirmed',startDate:'2026-11-16',endDate:'2026-11-27',registrationDeadline:'2026-10-30',finalNight:'To be confirmed',charityName:'For charity',charityTarget:0,currency:'LKR',timezone:'Asia/Colombo',retroFee:500,cyberFee:300},participants:[],teams:[],games:['UNO','Scrabble','Carrom','Pictionary','Charades','Omi','FC 26','Mortal Kombat','Call of Duty'].map((name,i)=>({id:`game-${i+1}`,name,category:i<6?'retro':'cyber',mode:'tournament',fee:0,capacity:32,rules:'',location:'',archived:false})),tournaments:[],matches:[],stations:[],queue:[],sessions:[],ledger:[],announcements:[],audit:[]}));
}
export function entrantName(s:Pick<EventState,'participants'|'teams'>,id:string|null) {return id ? s.participants.find(p=>p.id===id)?.name||s.teams.find(t=>t.id===id)?.name||'Unknown entrant' : 'To be decided';}
export function members(s:EventState,t:Tournament,id:string|null):string[] {return !id?[]:t.entryType==='individual'?[find(s.participants,id).id]:find(s.teams,id).memberIds;}
function matchMembers(s:EventState,m:Match) {const t=find(s.tournaments,m.tournamentId);return [...members(s,t,m.a),...members(s,t,m.b)];}
function validateEntrants(s:EventState,t:Tournament) {
  const game=find(s.games,t.gameId);requireValue(!game.archived,'This game is archived');requireValue(game.mode==='tournament','Choose a tournament game');
  requireValue(t.entrantIds.length<=game.capacity,'Game capacity exceeded');
  if(t.format==='round-robin')requireValue(t.entrantIds.length<=32,'Round robin supports up to 32 entrants');
  const seen=new Set<string>();for(const id of t.entrantIds)for(const member of members(s,t,id)){requireValue(!seen.has(member),'A team member cannot enter the same tournament twice');seen.add(member);}
}
function validTime(value:string) {requireValue(!value||Number.isFinite(Date.parse(value)),'Invalid scheduled time');}
function conflicts(s:EventState,candidate:{id:string;stationId:string;people:string[];time:string;duration:number;live:boolean}) {
  const others=[...s.matches.filter(m=>!m.bye&&!['cancelled','completed'].includes(m.status)).map(m=>({id:m.id,stationId:m.stationId,people:matchMembers(s,m),time:m.scheduledAt,duration:m.duration,live:m.status==='live'})),...s.sessions.filter(x=>x.status==='live').map(x=>({id:x.id,stationId:x.stationId,people:x.participantIds,time:x.startedAt,duration:x.duration,live:true}))];
  for(const other of others){if(other.id===candidate.id)continue;
    const timeOverlap=candidate.time&&other.time&&Date.parse(candidate.time)<Date.parse(other.time)+other.duration*60000&&Date.parse(other.time)<Date.parse(candidate.time)+candidate.duration*60000;
    if((candidate.live&&other.live)||timeOverlap){
      requireValue(!(candidate.stationId&&candidate.stationId===other.stationId),'Schedule conflict: station is already booked');
      requireValue(!candidate.people.some(p=>other.people.includes(p)),'Schedule conflict: a participant or team member is already playing');
    }
  }
}
function checkMatch(s:EventState,m:Match) {if(m.stationId)requireValue(find(s.stations,m.stationId).available,'Station is unavailable');conflicts(s,{id:m.id,stationId:m.stationId,people:matchMembers(s,m),time:m.scheduledAt,duration:m.duration,live:m.status==='live'});}
function refreshBracket(s:EventState,tournamentId:string) {
  const matches=s.matches.filter(m=>m.tournamentId===tournamentId).sort((a,b)=>a.round-b.round);
  for(const m of matches){if(m.sourceA)m.a=find(matches,m.sourceA).winnerId;if(m.sourceB)m.b=find(matches,m.sourceB).winnerId;}
}
function descendants(s:EventState,id:string):Match[] {const immediate=s.matches.filter(m=>m.sourceA===id||m.sourceB===id);return immediate.flatMap(m=>[m,...descendants(s,m.id)]);}
function resetResults(matches:Match[]) {for(const m of matches){m.status='scheduled';m.winnerId=null;m.scoreA=null;m.scoreB=null;m.forfeit=false;}}
function generate(s:EventState,t:Tournament) {
  requireValue(!t.generated,'Reset the tournament before generating new fixtures');requireValue(t.entrantIds.length>=2,'At least two entrants are required');validateEntrants(s,t);
  const base=(round:number,position:number,a:string|null,b:string|null):Match=>({id:uid(),tournamentId:t.id,round,position,a,b,status:'scheduled',winnerId:null,scoreA:null,scoreB:null,bye:false,forfeit:false,stationId:'',scheduledAt:'',duration:30});
  if(t.format==='round-robin'){
    const players:(string|null)[]=[...t.entrantIds];if(players.length%2)players.push(null);
    for(let round=1;round<players.length;round++){for(let i=0;i<players.length/2;i++){const a=players[i],b=players[players.length-1-i];if(a&&b)s.matches.push(base(round,i,a,b));}players.splice(1,0,players.pop()!);}
  }else{
    let seeds=[1,2];const size=2**Math.ceil(Math.log2(t.entrantIds.length));while(seeds.length<size){const next=seeds.length*2+1;seeds=seeds.flatMap(x=>[x,next-x]);}
    let previous:Match[]=[];for(let i=0;i<size;i+=2){const m=base(1,i/2,t.entrantIds[seeds[i]-1]||null,t.entrantIds[seeds[i+1]-1]||null);if(!m.a||!m.b){m.bye=true;m.status='completed';m.winnerId=m.a||m.b;}previous.push(m);s.matches.push(m);}
    let round=2;while(previous.length>1){const next:Match[]=[];for(let i=0;i<previous.length;i+=2){const m=base(round,i/2,null,null);m.sourceA=previous[i].id;m.sourceB=previous[i+1].id;s.matches.push(m);next.push(m);}previous=next;round++;}
    refreshBracket(s,t.id);
  }t.generated=true;
}
export function applyCommand(s:EventState,command:Command):void {
  const {type,payload:p}=command;
  switch(type){
    case 'entryOption.save':{const option=entryOptionSchema.parse(withId(p));const game=find(s.games,option.gameId);requireValue(option.priceBasis!=='person'||option.players===1,'Per-person entry options must include one player');requireValue(option.priceBasis!=='team'||option.players>=2,'A team option must include at least two players');requireValue(game.mode!=='free-play'||option.duration>0,'Free-play options require a duration');option.version=(s.entryOptions.find(o=>o.id===option.id)?.version||0)+1;save(s.entryOptions,option);break;}
    case 'bundle.save':{const v=z.object({id:z.string(),name:z.string().trim().min(1).max(120),price:z.number().finite().positive().max(100000000).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001,'Use at most two decimal places'),active:z.boolean()}).strict().parse(p);Object.assign(find(s.bundles,v.id),v);break;}
    case 'participant.save':{const person=participantSchema.parse(withId(p));for(const g of person.gameIds)find(s.games,g);save(s.participants,person);break;}
    case 'team.save':{const team=teamSchema.parse(withId(p));for(const id of team.memberIds)find(s.participants,id);for(const id of team.gameIds)find(s.games,id);const old=s.teams.find(t=>t.id===team.id);if(old&&JSON.stringify(old.memberIds)!==JSON.stringify(team.memberIds))requireValue(!s.tournaments.some(t=>t.generated&&t.entryType==='team'&&t.entrantIds.includes(team.id)),'Reset generated tournaments before changing team members');save(s.teams,team);break;}
    case 'game.save':{const game=gameSchema.parse(withId(p));requireValue(!s.tournaments.some(t=>t.gameId===game.id&&t.generated&&game.mode!=='tournament'),'Cannot change mode while tournaments exist');save(s.games,game);break;}
    case 'station.save':{const station=stationSchema.parse(withId(p));if(!station.available)requireValue(!s.matches.some(m=>m.stationId===station.id&&m.status==='live')&&!s.sessions.some(x=>x.stationId===station.id&&x.status==='live'),'End the live session before marking this station unavailable');save(s.stations,station);break;}
    case 'settings.save':{const settings=settingsSchema.parse({...s.settings,...p});requireValue(settings.endDate>=settings.startDate,'End date must be after start date');s.settings=settings;break;}
    case 'emailAllowlist.save':{const v=z.object({enabled:z.boolean(),emails:z.array(z.string()).max(5000)}).strict().parse(p);const emails=[...new Set(v.emails.map(e=>e.trim().toLowerCase()).filter(Boolean))];const invalid=emails.filter(e=>!z.string().email().max(254).safeParse(e).success);requireValue(!invalid.length,`These are not valid email addresses: ${invalid.slice(0,5).join(', ')}${invalid.length>5?` and ${invalid.length-5} more`:''}`);requireValue(!v.enabled||emails.length,'Add at least one email before turning on the allowlist');s.emailAllowlist=emailAllowlistSchema.parse({enabled:v.enabled,emails});break;}
    case 'announcement.save':save(s.announcements,announcementSchema.parse(withId(p)));break;
    case 'tournament.save':{
      const old=s.tournaments.find(t=>t.id===p.id);const t=tournamentSchema.parse({...withId(p),generated:old?.generated||false});
      if(old?.generated){for(const key of ['entrantIds','entryType','format','gameId','winPoints','drawPoints','lossPoints'] as const)requireValue(JSON.stringify(t[key])===JSON.stringify(old[key]),'Reset the tournament before changing entrants or rules');}
      validateEntrants(s,t);save(s.tournaments,t);break;
    }
    case 'tournament.generate':generate(s,find(s.tournaments,p.id));break;
    case 'tournament.reset':{const t=find(s.tournaments,p.id);requireValue(!s.matches.some(m=>m.tournamentId===t.id&&!m.bye&&(m.status==='live'||m.status==='completed')),'A tournament with played matches cannot be reset; correct its match results instead');s.matches=s.matches.filter(m=>m.tournamentId!==t.id);t.generated=false;break;}
    case 'match.schedule':{const m=find(s.matches,p.id);requireValue(!m.bye&&m.status!=='completed','Cannot schedule a completed match or bye');const v=z.object({stationId:z.string(),scheduledAt:z.string(),duration:z.number().int().min(1).max(480)}).parse(p);validTime(v.scheduledAt);const candidate={...m,...v};checkMatch(s,candidate);Object.assign(m,v);break;}
    case 'match.status':{const m=find(s.matches,p.id);const status=z.enum(['scheduled','live','cancelled']).parse(p.status);requireValue(!m.bye&&m.status!=='completed','Use result correction for completed matches');if(status==='live')requireValue(m.a&&m.b,'Both entrants must be decided before starting');if(status==='live'||(m.status==='cancelled'&&status==='scheduled'))checkMatch(s,{...m,status});m.status=status;break;}
    case 'match.result':{
      const m=find(s.matches,p.id);requireValue(!m.bye&&m.a&&m.b,'Both entrants are required to record a result');const t=find(s.tournaments,m.tournamentId);
      const r=z.object({scoreA:z.number().int().min(0).max(100000),scoreB:z.number().int().min(0).max(100000),winnerId:z.string().nullable().optional(),forfeit:z.boolean().default(false),resetDownstream:z.boolean().default(false)}).parse(p);
      let winner=r.winnerId||null;requireValue(!winner||winner===m.a||winner===m.b,'Winner must be an entrant in this match');
      if(r.forfeit)requireValue(winner,'A forfeit requires an explicit winner');
      else if(r.scoreA!==r.scoreB){const scoredWinner=r.scoreA>r.scoreB?m.a:m.b;requireValue(!winner||winner===scoredWinner,'Winner does not match the score');winner=scoredWinner;}
      else if(t.format==='round-robin'){requireValue(!winner,'Round-robin ties must be recorded as draws');}
      else requireValue(winner,'Choose a winner for a tied knockout score');
      const downstream=descendants(s,m.id);const changed=m.winnerId!==winner;
      if(changed){requireValue(r.resetDownstream||!downstream.some(x=>x.status==='live'||x.status==='completed'),'A downstream match has started: confirm resetting affected downstream results');resetResults(downstream);}
      Object.assign(m,{scoreA:r.scoreA,scoreB:r.scoreB,winnerId:winner,forfeit:r.forfeit,status:'completed'});refreshBracket(s,t.id);for(const next of descendants(s,m.id)){if(next.status==='scheduled'||next.status==='live'){try{checkMatch(s,next);}catch(error){throw new AppError('Advancement creates a schedule conflict. Reschedule the affected later match before saving this result. '+(error as Error).message);}}}break;
    }
    case 'queue.add':{const v=z.object({gameId:z.string(),participantIds:z.array(z.string()).min(1).max(256)}).parse(p);const g=find(s.games,v.gameId);requireValue(g.mode==='free-play'&&!g.archived,'Choose an active free-play game');requireValue(new Set(v.participantIds).size===v.participantIds.length,'Duplicate queue participants');requireValue(v.participantIds.length<=g.capacity,'Game capacity exceeded');for(const id of v.participantIds)find(s.participants,id);requireValue(!s.queue.some(q=>q.gameId===v.gameId&&['waiting','called','playing'].includes(q.status)&&q.participantIds.some(id=>v.participantIds.includes(id))),'Participant is already queued for this game');s.queue.push({id:uid(),...v,status:'waiting',createdAt:now()});break;}
    case 'queue.call':{const q=find(s.queue,p.id);requireValue(q.status==='waiting','Only waiting groups can be called');q.status='called';break;}
    case 'queue.cancel':{const q=find(s.queue,p.id);requireValue(q.status==='waiting'||q.status==='called','Only waiting or called groups can be cancelled');q.status='cancelled';break;}
    case 'session.start':{const v=z.object({queueId:z.string(),stationId:z.string(),duration:z.number().int().min(1).max(480)}).parse(p);const q=find(s.queue,v.queueId);requireValue(q.status==='waiting'||q.status==='called','This queue entry is no longer available');requireValue(find(s.stations,v.stationId).available,'Station is unavailable');const session={id:uid(),...v,gameId:q.gameId,participantIds:q.participantIds,startedAt:now(),endedAt:'',status:'live' as const};conflicts(s,{id:session.id,stationId:v.stationId,people:q.participantIds,time:session.startedAt,duration:v.duration,live:true});s.sessions.push(session);q.status='playing';break;}
    case 'session.end':{const x=find(s.sessions,p.id);requireValue(x.status==='live','Session already ended');x.status='completed';x.endedAt=now();find(s.queue,x.queueId).status='completed';break;}
    case 'ledger.add':{const entry=ledgerSchema.parse({...withId(p),createdAt:now(),voided:false});if(entry.participantId)find(s.participants,entry.participantId);if(['charge','payment','refund'].includes(entry.kind))requireValue(entry.participantId,'Choose a participant for charges, payments and refunds');s.ledger.push(entry);break;}
    case 'ledger.void':{const entry=find(s.ledger,p.id);requireValue(p.confirm===true,'Confirm voiding this entry');entry.voided=true;break;}
    default:throw new AppError('Unknown operation');
  }
  s.audit.push({id:uid(),at:now(),action:type,detail:JSON.stringify({id:p.id||'',resetDownstream:p.resetDownstream||false})});
}
export function standings(s:EventState,tournamentId:string):Standing[]{
  const t=find(s.tournaments,tournamentId);const rows=t.entrantIds.map(id=>({id,name:entrantName(s,id),rank:1,played:0,won:0,drawn:0,lost:0,for:0,against:0,points:0}));
  for(const m of s.matches.filter(m=>m.tournamentId===t.id&&m.status==='completed'&&!m.bye)){
    const a=find(rows,m.a),b=find(rows,m.b);a.played++;b.played++;a.for+=m.scoreA||0;a.against+=m.scoreB||0;b.for+=m.scoreB||0;b.against+=m.scoreA||0;
    if(!m.winnerId){a.drawn++;b.drawn++;a.points+=t.drawPoints;b.points+=t.drawPoints;}
    else {const winner=m.winnerId===a.id?a:b,loser=winner===a?b:a;winner.won++;loser.lost++;winner.points+=t.winPoints;loser.points+=t.lossPoints;}
  }
  rows.sort((a,b)=>b.points-a.points||(b.for-b.against)-(a.for-a.against)||b.for-a.for||a.name.localeCompare(b.name));
  rows.forEach((row,i)=>{const previous=rows[i-1];row.rank=previous&&row.points===previous.points&&row.for-row.against===previous.for-previous.against&&row.for===previous.for?previous.rank:i+1;});return rows;
}
export function moneySummary(s:EventState){
  const sum=(kind:string,person?:string)=>roundMoney(s.ledger.filter(e=>!e.voided&&e.kind===kind&&(person===undefined||e.participantId===person)).reduce((total,e)=>total+e.amount,0));
  const balances=s.participants.map(p=>({id:p.id,name:p.name,balance:roundMoney(sum('charge',p.id)-sum('payment',p.id)+sum('refund',p.id))}));
  const receipts=roundMoney(sum('payment')+sum('donation')),refunds=sum('refund'),expenses=sum('expense'),transferred=sum('transfer');
  return {receipts,refunds,expenses,transferred,net:roundMoney(receipts-refunds-expenses),available:roundMoney(receipts-refunds-expenses-transferred),outstanding:roundMoney(balances.reduce((n,p)=>n+Math.max(0,p.balance),0)),balances};
}
export function publicEvent(s:EventState):PublicEvent{
  const tournaments=s.tournaments.filter(t=>t.published);const publicIds=new Set(tournaments.map(t=>t.id));const entrantIds=new Set(tournaments.flatMap(t=>t.entrantIds));
  return {revision:s.revision,updatedAt:s.updatedAt,settings:{...s.settings},games:s.games.filter(g=>!g.archived).map(({id,name,category,mode,rules})=>({id,name,category,mode,rules})),tournaments:tournaments.map(t=>({...t})),matches:s.matches.filter(m=>publicIds.has(m.tournamentId)).map(m=>({...m})),stations:s.stations.map(({id,name,available})=>({id,name,available})),entrants:[...s.participants,...s.teams].filter(x=>entrantIds.has(x.id)).map(({id,name})=>({id,name})),announcements:s.announcements.filter(a=>a.published).map(a=>({...a})),ladders:Object.fromEntries(tournaments.filter(t=>t.format==='round-robin').map(t=>[t.id,standings(s,t.id)])),...spectators(s,tournaments)};
}
function spectators(s:EventState,tournaments:EventState['tournaments']):Pick<PublicEvent,'players'|'nowPlaying'|'waiting'>{
  const games=new Set(s.games.filter(g=>!g.archived).map(g=>g.id));const members=(id:string|null)=>!id?[]:s.teams.find(t=>t.id===id)?.memberIds||[id];const name=(id:string|null)=>id?entrantName(s,id):'To be decided';
  const players=s.participants.map(p=>{const teams=s.teams.filter(t=>t.memberIds.includes(p.id));const ids=new Set([...p.gameIds,...teams.flatMap(t=>t.gameIds),...tournaments.filter(t=>t.entrantIds.some(id=>members(id).includes(p.id))).map(t=>t.gameId)]);return {id:p.id,name:p.name,gameIds:[...ids].filter(id=>games.has(id)),teams:teams.map(t=>t.name),checkedIn:p.checkedIn};}).filter(p=>p.gameIds.length>0).sort((a,b)=>a.name.localeCompare(b.name));
  const matches=s.matches.filter(m=>m.status==='live'&&!m.bye).flatMap(m=>{const t=tournaments.find(t=>t.id===m.tournamentId);return t?[{id:m.id,kind:'match' as const,gameId:t.gameId,tournamentId:t.id,stationId:m.stationId,startedAt:m.scheduledAt,duration:m.duration,playerIds:[...members(m.a),...members(m.b)],sides:[name(m.a),name(m.b)]}]:[];});
  const sessions=s.sessions.filter(x=>x.status==='live'&&games.has(x.gameId)).map(x=>({id:x.id,kind:'free-play' as const,gameId:x.gameId,tournamentId:'',stationId:x.stationId,startedAt:x.startedAt,duration:x.duration,playerIds:[...x.participantIds],sides:x.participantIds.map(name)}));
  const waiting=[...games].map(gameId=>({gameId,groups:s.queue.filter(q=>q.gameId===gameId&&(q.status==='waiting'||q.status==='called')).length})).filter(w=>w.groups>0);
  return {players,nowPlaying:[...matches,...sessions],waiting};
}

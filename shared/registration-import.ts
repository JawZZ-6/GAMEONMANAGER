import { z } from 'zod';
import { AppError } from './errors';
import { participantSchema, type EventState, type Registration } from './model';

// Imports people who registered through an earlier form (for example a Microsoft Forms export).
// The CSV is read in the organiser's browser; only the matched rows below are sent to the server.
export type ImportSelection={gameId:string;optionId:string};
export type ImportRow={line:number;reference:string;name:string;email:string;createdAt:string;selections:ImportSelection[];status:'new'|'duplicate'|'invalid';problems:string[]};

const clean=(v:string)=>v.replace(/[ \s]+/g,' ').trim();
const key=(v:string)=>clean(v).toLowerCase();

/** Excel saves "CSV" in the Windows code page unless "CSV UTF-8" is chosen, so fall back to Windows-1252. */
export function decodeCsv(bytes:ArrayBuffer|Uint8Array):string {
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^﻿/,'');}
  catch{return new TextDecoder('windows-1252').decode(bytes);}
}

export function parseCsv(text:string):string[][] {
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
    else if(c==='"')quoted=true;
    else if(c===','){row.push(cell);cell='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  return rows.filter(r=>r.some(c=>c.trim()));
}

/** Form times such as "10/21/2026 13:38" are local event time (Asia/Colombo, UTC+05:30). */
export function formTime(value:string):string {
  const m=clean(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if(!m)return '';
  const [month,day,year,hour,minute,second]=m.slice(1).map(n=>Number(n||0));
  return new Date(Date.UTC(year,month-1,day,hour,minute,second)-330*60000).toISOString();
}

/** Matches one form answer, such as "FC 26 (2 vs 2) - LKR 1,200 per team", to a tournament game and its play option. */
function matchEntry(s:EventState,answer:string):ImportSelection|string {
  const text=key(answer);
  const game=s.games.filter(g=>!g.archived&&g.mode==='tournament'&&text.startsWith(key(g.name))).sort((a,b)=>b.name.length-a.name.length)[0];
  if(!game)return `"${clean(answer)}" does not match a tournament game`;
  const options=s.entryOptions.filter(o=>o.gameId===game.id&&o.active);
  const team=/\b2\s*vs\s*2\b|\bteam\b|multiplayer/.test(text);
  const option=team?options.find(o=>o.priceBasis==='team'):options.find(o=>o.players===1&&o.priceBasis!=='booking');
  return option?{gameId:game.id,optionId:option.id}:`${game.name}: no active ${team?'team':'single-player'} play option`;
}

export function readRegistrationForm(s:EventState,text:string):ImportRow[] {
  const [header=[],...lines]=parseCsv(text);
  const col=(pattern:RegExp)=>header.findIndex(h=>pattern.test(clean(h)));
  const email=col(/^e-?mail( address)?$/i),fullName=col(/^name$/i),ownName=col(/^your name$/i),id=col(/^id$/i),done=col(/^completion time$|^timestamp$/i);
  // "Which Board Game(s) / Tournament(s) would you like to enter?" questions; yes/no and activity questions are ignored.
  const entryColumns=header.map((h,i)=>/^which .*(game|tournament).*enter/i.test(clean(h))?i:-1).filter(i=>i>=0);
  if(email<0||(fullName<0&&ownName<0))throw new AppError('This file needs an Email column and a Name or Your Name column.');
  if(!entryColumns.length)throw new AppError('This file has no "Which … would you like to enter?" columns.');
  const registered=new Set(s.participants.flatMap(p=>[p.email,p.contact]).map(key).filter(Boolean));
  const rows=lines.map((cells,i):ImportRow=>{
    const problems:string[]=[],selections:ImportSelection[]=[];
    // The signed-in account name is the full name; the typed name is often a first name or nickname.
    const name=clean(cells[fullName]||'')||clean(cells[ownName]||'');
    const address=key(cells[email]||'');
    if(!name)problems.push('No name');
    if(!z.string().email().max(254).safeParse(address).success)problems.push('No valid email address');
    for(const c of entryColumns)for(const answer of (cells[c]||'').split(';').filter(a=>clean(a))){
      const match=matchEntry(s,answer);
      if(typeof match==='string')problems.push(match);
      else if(!selections.some(x=>x.optionId===match.optionId))selections.push(match);
    }
    return {line:i+2,reference:clean(cells[id]||''),name,email:address,createdAt:formTime(cells[done]||''),selections,status:problems.length?'invalid':registered.has(address)?'duplicate':'new',problems:problems.length?problems:registered.has(address)?['Already registered']:[]};
  });
  // A person who submitted the form twice is imported once, from their latest submission.
  for(const row of rows)if(row.status==='new'&&rows.some(r=>r.line>row.line&&r.email===row.email&&r.status!=='invalid')){row.status='duplicate';row.problems=['Replaced by a later submission'];}
  return rows;
}

const importSchema=z.object({rows:z.array(z.object({reference:z.string().max(100).default(''),name:z.string().trim().min(1).max(120),email:z.string().trim().toLowerCase().email().max(254),createdAt:z.string().max(40).default(''),selections:z.array(z.object({gameId:z.string(),optionId:z.string()}).strict()).max(64)}).strict()).min(1).max(2000)}).strict();

/** Adds already-registered people as participants with registrations and charges, as if they had used /register. */
export function applyRegistrationImport(s:EventState,payload:unknown,now=new Date()):void {
  const {rows}=importSchema.parse(payload);
  const taken=new Set(s.participants.flatMap(p=>[p.email,p.contact]).map(key).filter(Boolean));
  const clash=rows.filter((r,i)=>taken.has(r.email)||rows.findIndex(x=>x.email===r.email)!==i).map(r=>r.email);
  if(clash.length)throw new AppError(`These emails are already registered: ${[...new Set(clash)].slice(0,5).join(', ')}${clash.length>5?' and more':''}. Reload the file and import again.`,409);
  for(const row of rows){
    const createdAt=row.createdAt&&!Number.isNaN(Date.parse(row.createdAt))?new Date(row.createdAt).toISOString():now.toISOString();
    const lineItems=row.selections.map(sel=>{
      const game=s.games.find(g=>g.id===sel.gameId&&!g.archived);
      const option=s.entryOptions.find(o=>o.id===sel.optionId&&o.gameId===sel.gameId&&o.active);
      if(!game||!option)throw new AppError(`${row.name}: a selected game or play option is no longer available. Reload the file and import again.`,409);
      // Team partners were not asked for on the form, so the team is completed at the venue.
      return {gameId:game.id,gameName:game.name,optionId:option.id,optionName:option.name,format:option.format,price:option.price,priceBasis:option.priceBasis,players:option.players,duration:option.duration,participantIds:[''],teamName:''};
    });
    const gameIds=[...new Set(lineItems.map(i=>i.gameId))];
    const participant=participantSchema.parse({id:crypto.randomUUID(),name:row.name,email:row.email,gameIds});
    for(const item of lineItems)item.participantIds=[participant.id];
    s.participants.push(participant);
    if(!lineItems.length)continue;
    const registration:Registration={id:crypto.randomUUID(),requestId:crypto.randomUUID(),requestHash:'import',participantId:participant.id,bundleId:'',bundleName:'Individual games',amount:Math.round(lineItems.reduce((sum,i)=>sum+i.price,0)*100)/100,gameIds,gameNames:gameIds.map(id=>lineItems.find(i=>i.gameId===id)!.gameName),chargeId:crypto.randomUUID(),createdAt,registrationType:'individual',lineItems};
    s.registrations.push(registration);
    if(registration.amount>0)s.ledger.push({id:registration.chargeId,kind:'charge',amount:registration.amount,participantId:participant.id,note:`${registration.bundleName} · imported registration ${registration.id.slice(0,8)}${row.reference?` · form #${row.reference}`:''}`,createdAt,voided:false});
  }
  s.audit.push({id:crypto.randomUUID(),at:now.toISOString(),action:'registration.import',detail:JSON.stringify({people:rows.length})});
}

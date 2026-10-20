import { AppError } from './errors';
import { bundleSchema, gameSchema, participantSchema, registrationInputSchema, type EventState, type Registration, type RegistrationCatalogue, type RegistrationReceipt } from './model';

export function addRegistrationDefaults(s:EventState):EventState {
  if(s.bundles.length) return s;
  if(!s.games.some(g=>g.name.trim().toLowerCase()==='chess')) {
    s.games.push(gameSchema.parse({id:s.games.some(g=>g.id==='game-chess')?crypto.randomUUID():'game-chess',name:'Chess',category:'board',mode:'tournament'}));
  }
  const gameIds=(names:string[])=>names.map(name=>s.games.find(g=>g.name.trim().toLowerCase()===name.toLowerCase())?.id||`missing-${name.toLowerCase()}`);
  s.bundles=[
    {id:'social',name:'Social Bundle',price:1200,fixedGameIds:gameIds(['UNO','Pictionary','Charades']),boardCount:3,consoleCount:0},
    {id:'brainpower',name:'Brainpower Bundle',price:1200,fixedGameIds:gameIds(['Chess','Scrabble','Omi']),boardCount:3,consoleCount:0},
    {id:'arcade',name:'Arcade Bundle',price:1600,boardCount:0,consoleCount:3},
    {id:'both-worlds',name:'Best of Both Worlds Bundle',price:1400,boardCount:2,consoleCount:1},
    {id:'ultimate',name:'Ultimate Gamer Bundle',price:1600,boardCount:1,consoleCount:2},
  ].map(b=>bundleSchema.parse(b));
  return s;
}

function remainingPlaces(s:EventState,gameId:string,capacity:number) {
  const people=new Set(s.participants.filter(p=>p.gameIds.includes(gameId)).map(p=>p.id));
  for(const team of s.teams.filter(t=>t.gameIds.includes(gameId)))for(const id of team.memberIds)people.add(id);
  for(const tournament of s.tournaments.filter(t=>t.gameId===gameId)) {
    for(const id of tournament.entrantIds) {
      if(tournament.entryType==='individual')people.add(id);
      else for(const member of s.teams.find(t=>t.id===id)?.memberIds||[])people.add(member);
    }
  }
  return Math.max(0,capacity-people.size);
}

export function registrationCatalogue(s:EventState,now=new Date()):RegistrationCatalogue {
  const {name,venue,startDate,endDate,registrationDeadline,timezone}=s.settings;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const open=s.settings.registrationOpen&&today<=registrationDeadline;
  const games=s.games.filter(g=>!g.archived&&g.mode==='tournament').map(g=>({id:g.id,name:g.name,category:g.category,rules:g.rules,remaining:remainingPlaces(s,g.id,g.capacity)}));
  const bundles=s.bundles.map(b=>{
    let unavailableReason='';
    if(!b.active)unavailableReason='This bundle is currently unavailable.';
    else if(b.fixedGameIds.length) {
      if(b.fixedGameIds.length!==3||b.fixedGameIds.some(id=>!games.some(g=>g.id===id)))unavailableReason='One or more included games are unavailable.';
      else if(b.fixedGameIds.some(id=>games.find(g=>g.id===id)!.remaining===0))unavailableReason='An included game is full.';
    } else if(games.filter(g=>g.remaining>0&&g.category!=='cyber').length<b.boardCount||games.filter(g=>g.remaining>0&&g.category==='cyber').length<b.consoleCount)unavailableReason='Not enough games have available places for this bundle.';
    return {...b,available:!unavailableReason,unavailableReason};
  });
  return {settings:{name,venue,startDate,endDate,registrationDeadline,timezone},open,closeReason:open?'':`Registration is closed. Please contact an event organiser.`,games,bundles};
}

export function applyRegistration(s:EventState,value:unknown,requestHash:string,now=new Date()):Registration {
  const input=registrationInputSchema.parse(value);
  const catalogue=registrationCatalogue(s,now);
  if(!catalogue.open)throw new AppError(catalogue.closeReason,409);
  const bundle=catalogue.bundles.find(b=>b.id===input.bundleId);
  if(!bundle)throw new AppError('Choose an available bundle');
  if(!bundle.available)throw new AppError(bundle.unavailableReason,409);
  if(bundle.price!==input.expectedPrice)throw new AppError('The bundle price has changed. Refresh the offers and review the new total before submitting.',409);
  if(s.participants.some(p=>p.email.toLowerCase()===input.email||p.contact.trim().toLowerCase()===input.email))throw new AppError('This email is already registered. Contact an organiser to update the entry.',409);
  const games=input.gameIds.map(id=>{
    const game=catalogue.games.find(g=>g.id===id);
    if(!game)throw new AppError('A selected game is no longer available. Refresh the offers.',409);
    if(game.remaining===0)throw new AppError(`${game.name} is full. Please choose another game.`,409);
    return game;
  });
  if(bundle.fixedGameIds.length) {
    if(!bundle.fixedGameIds.every(id=>input.gameIds.includes(id)))throw new AppError('Select exactly the games included in this bundle');
  } else if(games.filter(g=>g.category==='cyber').length!==bundle.consoleCount||games.filter(g=>g.category!=='cyber').length!==bundle.boardCount) {
    throw new AppError(`Choose ${bundle.boardCount} board games and ${bundle.consoleCount} console games for this bundle`);
  }
  const participant=participantSchema.parse({id:crypto.randomUUID(),name:input.name,email:input.email,phone:input.phone,department:input.department,gameIds:input.gameIds});
  const registration:Registration={id:crypto.randomUUID(),requestId:input.requestId,requestHash,participantId:participant.id,bundleId:bundle.id,bundleName:bundle.name,amount:bundle.price,gameIds:[...input.gameIds],gameNames:games.map(g=>g.name),chargeId:crypto.randomUUID(),createdAt:now.toISOString()};
  s.participants.push(participant);
  s.registrations.push(registration);
  s.ledger.push({id:registration.chargeId,kind:'charge',amount:bundle.price,participantId:participant.id,note:`${bundle.name} · registration ${registration.id.slice(0,8)}`,createdAt:registration.createdAt,voided:false});
  s.audit.push({id:crypto.randomUUID(),at:registration.createdAt,action:'registration.create',detail:JSON.stringify({id:registration.id})});
  return registration;
}

export function registrationReceipt(r:Registration):RegistrationReceipt {
  return {id:r.id,bundleName:r.bundleName,amount:r.amount,gameNames:[...r.gameNames],createdAt:r.createdAt};
}

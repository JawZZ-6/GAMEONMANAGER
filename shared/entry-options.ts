import { entryOptionSchema, gameSchema, type EventState, type Game } from './model';

/** Add the agreed play catalogue once; retain existing IDs, records and later edits. */
export function addIndividualDefaults(s:EventState):EventState {
  if(s.individualRegistrationVersion===1)return s;
  for(const game of s.games)game.platform??=game.category!=='cyber'?'board':/call of duty/i.test(game.name)?'pc':'console';
  const freeplay={
    console:['FC 26','Watch Dogs: Legion','Red Dead Redemption 2','Assassin’s Creed Valhalla','GTA: San Andreas','Need for Speed Heat'],
    pc:['Dying Light 1','Dying Light 2','Call of Duty: Modern Warfare (2019–2023)','Red Dead Redemption 2','Forza Horizon 6','God of War (2018)','God of War Ragnarök'],
  };
  for(const platform of ['console','pc'] as const)for(const name of freeplay[platform]) {
    if(s.games.some(g=>g.platform===platform&&g.mode==='free-play'&&g.name.toLowerCase()===name.toLowerCase()))continue;
    const base=`${platform}-free-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
    const id=s.games.some(g=>g.id===base)?crypto.randomUUID():base;
    s.games.push(gameSchema.parse({id,name,platform,category:'cyber',mode:'free-play',capacity:32,fee:platform==='console'?400:350}));
  }
  const add=(g:Game,suffix:string,name:string,format:string,price:number,priceBasis:'person'|'team'|'booking',players:number,duration=0)=>{
    const id=`${g.id}-${suffix}`;
    if(!s.entryOptions.some(o=>o.id===id))s.entryOptions.push(entryOptionSchema.parse({id,gameId:g.id,name,format,price,priceBasis,players,duration}));
  };
  for(const g of s.games){
    if(g.category!=='cyber'){add(g,'single','Single entry','Per person',500,'person',1);if(!g.fee)g.fee=500;}
    else if(g.mode==='free-play'&&g.platform==='console'){
      add(g,'single','Single play · 1 hour','1 player',400,'booking',1,60);
      add(g,'head-to-head','Head-to-head · 1 hour','1 vs 1 · 2 players total',700,'booking',2,60);
      add(g,'team','Team play · 1 hour','2 vs 2 · 4 players total',1000,'booking',4,60);
    }else if(g.mode==='free-play'&&g.platform==='pc')add(g,'single','Single play · 1 hour','1 player',350,'booking',1,60);
    else if(g.mode==='tournament'&&g.platform==='console'&&['fc 26','mortal kombat'].includes(g.name.toLowerCase())){
      add(g,'single','Single play','1 vs 1 · entry for one player',700,'person',1);
      add(g,'team','Multiplayer','2 vs 2 · entry for one 2-player team',1200,'team',2);if(!g.fee)g.fee=700;
    }else if(g.mode==='tournament'&&g.platform==='pc'&&/call of duty/i.test(g.name)){
      add(g,'single','Free-for-all','Per person',300,'person',1);
      add(g,'team','Multiplayer','2 vs 2 · entry for one 2-player team',1000,'team',2);if(!g.fee)g.fee=300;
    }
  }
  s.individualRegistrationVersion=1;
  return s;
}

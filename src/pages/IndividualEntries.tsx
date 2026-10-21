import { useState } from 'react';
import { CheckCircle2, Gamepad2 } from 'lucide-react';
import { amount } from '../components';
import type { IndividualSelection, RegistrationCatalogue } from '../../shared/model';

export const entryGroups=[{id:'board',label:'Board games'},{id:'console-tournament',label:'Console tournaments'},{id:'pc-tournament',label:'PC tournaments'},{id:'console-free-play',label:'Console free play'},{id:'pc-free-play',label:'PC free play'}];
export function entryGroup(game:RegistrationCatalogue['games'][number]){return game.category!=='cyber'?'board':`${game.platform||'console'}-${game.mode}`;}
export const priceBasisLabel=(basis:string)=>basis==='team'?'per team':basis==='booking'?'per booking':'per person';

export default function IndividualEntries({catalogue,selections,onChange,disabled}:{catalogue:RegistrationCatalogue;selections:IndividualSelection[];onChange:(next:IndividualSelection[])=>void;disabled:boolean}) {
  const [group,setGroup]=useState('board');
  const update=(gameId:string,changes:Partial<IndividualSelection>)=>onChange(selections.map(s=>s.gameId===gameId?{...s,...changes}:s));
  return <fieldset className="individual-entries" disabled={disabled}><legend><span>02</span> Choose your games</legend><p className="registration-help">Pick one or more games. Select a play option for each; group prices cover the whole team or booking.</p>
    <div className="entry-group-tabs" aria-label="Game categories">{entryGroups.map(g=><button type="button" key={g.id} aria-pressed={group===g.id} className={group===g.id?'active':''} onClick={()=>setGroup(g.id)}>{g.label}</button>)}</div>
    <p className="selection-count" aria-live="polite">{selections.length} game{selections.length===1?'':'s'} selected across all categories</p>
    <div className="individual-game-list">{catalogue.games.filter(g=>entryGroup(g)===group).map(game=>{
      const selection=selections.find(s=>s.gameId===game.id);
      const options=catalogue.entryOptions.filter(o=>o.gameId===game.id);
      const available=options.filter(o=>o.active&&o.price>0&&o.players<=game.remaining);
      const option=options.find(o=>o.id===selection?.optionId);
      const label=entryGroups.find(g=>g.id===group)!.label;
      return <article className={`individual-game ${selection?'selected':''}`} key={game.id}>
        <label className="individual-game-toggle"><input type="checkbox" aria-label={`Select ${game.name} · ${label}`} checked={!!selection} disabled={!selection&&!available.length} onChange={e=>{
          if(!e.target.checked){onChange(selections.filter(s=>s.gameId!==game.id));return;}
          const first=available[0];onChange([...selections,{gameId:game.id,optionId:first.id,optionVersion:first.version,companions:Array(first.players-1).fill(''),teamName:''}]);
        }}/><span><strong>{game.name}</strong><small>{game.remaining} player places left</small></span>{selection?<CheckCircle2 size={20}/>:<Gamepad2 size={20}/>}</label>
        {!selection&&<p className="individual-starting-price">{available.length?`From ${amount(Math.min(...available.map(o=>o.price)))}`:game.remaining===0?'Full':options.some(o=>o.active&&o.price>0)?'Not enough places for the available options':'Price to be confirmed'}</p>}
        {selection&&<div className="individual-option-fields">
          <div className="field"><label htmlFor={`option-${game.id}`}>Play option for {game.name}</label><select id={`option-${game.id}`} value={selection.optionId} onChange={e=>{const next=options.find(o=>o.id===e.target.value)!;update(game.id,{optionId:next.id,optionVersion:next.version,companions:Array(next.players-1).fill(''),teamName:''});}}>
            {options.map(o=><option key={o.id} value={o.id} disabled={!o.active||o.price<=0||o.players>game.remaining}>{o.name} · {amount(o.price)} {priceBasisLabel(o.priceBasis)}{!o.active||o.price<=0?' · unavailable':o.players>game.remaining?' · not enough places':''}</option>)}
          </select></div>
          {option&&<><p className="option-format">{option.format}{option.duration>0?` · ${option.duration} minutes`:''}<strong>{amount(option.price)} {priceBasisLabel(option.priceBasis)}</strong></p>
            {selection.optionVersion!==option.version&&<div className="notice" role="status">This play option has changed. Check the updated terms above before continuing. <button className="button" type="button" aria-label={`Review updated option for ${game.name}`} disabled={!available.some(o=>o.id===option.id)} onClick={()=>update(game.id,{optionVersion:option.version,companions:Array(option.players-1).fill(''),teamName:''})}>Use updated option</button></div>}
            {option.players>1&&<p className="registration-help">Your details count as the first player. Enter the other {option.players-1} player{option.players>2?'s':''} joining you.</p>}
            {option.priceBasis==='team'&&<div className="field"><label htmlFor={`team-${game.id}`}>Team name for {game.name}</label><input id={`team-${game.id}`} required maxLength={120} value={selection.teamName} onChange={e=>update(game.id,{teamName:e.target.value})}/></div>}
            {selection.companions.map((name,i)=><div className="field" key={i}><label htmlFor={`companion-${game.id}-${i}`}>Other player {i+1} for {game.name}</label><input id={`companion-${game.id}-${i}`} required maxLength={120} autoComplete="off" value={name} onChange={e=>update(game.id,{companions:selection.companions.map((n,j)=>i===j?e.target.value:n)})}/></div>)}
          </>}
        </div>}
      </article>;
    })}</div>
  </fieldset>;
}

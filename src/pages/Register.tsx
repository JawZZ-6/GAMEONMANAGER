import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Brain, Check, CheckCircle2, Dice5, Flame, Gamepad2, Heart, LoaderCircle, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import { api, ApiError } from '../api';
import { amount } from '../components';
import type { Bundle, RegistrationCatalogue, RegistrationInput, RegistrationReceipt } from '../../shared/model';
import { registrationInputSchema } from '../../shared/model';

const icons={social:Dice5,brainpower:Brain,arcade:Gamepad2,'both-worlds':Flame,ultimate:Zap};
export function bundleDescription(bundle:Bundle,games:{id:string;name:string}[]) {
  if(bundle.fixedGameIds.length)return bundle.fixedGameIds.map(id=>games.find(g=>g.id===id)?.name||'Unavailable game').join(' + ');
  return [bundle.boardCount?`${bundle.boardCount} board game${bundle.boardCount>1?'s':''}`:'',bundle.consoleCount?`${bundle.consoleCount} console game${bundle.consoleCount>1?'s':''}`:''].filter(Boolean).join(' + ');
}

export default function Register() {
  const [catalogue,setCatalogue]=useState<RegistrationCatalogue|null>(null),[error,setError]=useState('');
  const refresh=async()=>{const next=await api<RegistrationCatalogue>('registration',undefined,AbortSignal.timeout(15000));setCatalogue(next);setError('');};
  useEffect(()=>{void refresh().catch(()=>setError('Could not load the registration offers. Please try again.'));},[]);
  return <div className="registration-page">
    <a className="skip-link" href="#registration-content">Skip to registration</a>
    <header className="live-header"><a className="brand" href="/register"><span className="brand-icon"><Gamepad2 size={27}/></span><span>GAME<span className="orange-text">ON</span><small>RETRO & CYBER · CISI</small></span></a><a className="button" href="/live">Live games <ArrowUpRight size={16}/></a></header>
    <main id="registration-content" className="registration-main">
      <header className="registration-hero"><div><p className="eyebrow">PICK YOUR GAMES. PLAY FOR GOOD.</p><h1>Make your move.<br/><span>Make a difference.</span></h1><p>Bring your competitive side to {catalogue?.settings.name||'GameON'}. Three games, one bundle, a good cause.</p></div><div className="registration-cause"><Heart size={25}/><strong>A little competition.<br/>A lasting contribution.</strong>{catalogue&&<span>Register by {new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Colombo'}).format(new Date(`${catalogue.settings.registrationDeadline}T12:00:00+05:30`))}<small>End of day · Sri Lanka time</small></span>}</div></header>
      {error&&<div className="form-error" role="alert">{error} <button className="button" onClick={()=>void refresh().catch(()=>setError('Still unable to connect. Please try again.'))}>Try again</button></div>}
      {catalogue?<RegistrationForm catalogue={catalogue} onRefresh={refresh} onSubmit={input=>api<RegistrationReceipt>('register',input,AbortSignal.timeout(15000))}/>:!error&&<p role="status">Loading registration offers…</p>}
      <footer className="live-footer"><span>RETRO & CYBER GAMEON · FOR CHARITY BY CISI</span><a href="/admin">Organiser area <ArrowUpRight size={14}/></a></footer>
    </main>
  </div>;
}

export function RegistrationForm({catalogue,onSubmit,onRefresh}:{catalogue:RegistrationCatalogue;onSubmit:(input:RegistrationInput)=>Promise<RegistrationReceipt>;onRefresh:()=>Promise<unknown>}) {
  const [bundleId,setBundleId]=useState(''),[gameIds,setGameIds]=useState<string[]>([]);
  const [details,setDetails]=useState({name:'',email:'',department:'',phone:'',website:''}),[consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<RegistrationReceipt|null>(null);
  const [pending,setPending]=useState<RegistrationInput|null>(null);
  const attempt=useRef({signature:'',id:''}),submitting=useRef(false),feedback=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(error||receipt)feedback.current?.focus();},[error,receipt]);
  const bundle=catalogue.bundles.find(b=>b.id===bundleId);
  const selected=catalogue.games.filter(g=>gameIds.includes(g.id));
  const boardSelected=selected.filter(g=>g.category!=='cyber').length,consoleSelected=selected.filter(g=>g.category==='cyber').length;
  const valid=!!bundle&&bundle.available&&gameIds.length===3&&selected.length===3&&selected.every(g=>g.remaining>0)&&(bundle.fixedGameIds.length?bundle.fixedGameIds.every(id=>gameIds.includes(id)):boardSelected===bundle.boardCount&&consoleSelected===bundle.consoleCount);
  const chooseBundle=(b:RegistrationCatalogue['bundles'][number])=>{setBundleId(b.id);setGameIds([...b.fixedGameIds]);setError('');};
  const refresh=async()=>{setRefreshing(true);try{await onRefresh();}catch{setError('Could not refresh the offers. Your details are still here; please retry.');}finally{setRefreshing(false);}};
  const send=async(input:RegistrationInput)=>{
    if(submitting.current)return;
    submitting.current=true;setBusy(true);setError('');
    try{setReceipt(await onSubmit(input));setPending(null);}
    catch(e){
      const rejected=e instanceof ApiError&&e.status>=400&&e.status<500;
      setPending(rejected?null:input);
      setError(e instanceof Error&&e.name!=='TimeoutError'?e.message:'The connection timed out. Check your previous registration to retrieve its result.');
      if(e instanceof ApiError&&e.status===409)await refresh();
    }
    finally{submitting.current=false;setBusy(false);}
  };
  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(pending||submitting.current||!catalogue.open||!valid||!bundle||!consent)return;
    const values={...details,bundleId,gameIds,expectedPrice:bundle.price,consent:true as const};
    const signature=JSON.stringify(values);
    if(attempt.current.signature!==signature)attempt.current={signature,id:crypto.randomUUID()};
    const parsed=registrationInputSchema.safeParse({...values,requestId:attempt.current.id});
    if(!parsed.success){setError(parsed.error.issues.map(e=>e.message).join('; '));return;}
    await send(parsed.data);
  };

  if(receipt)return <div className="registration-receipt" role="status" tabIndex={-1} ref={feedback}><CheckCircle2 size={52}/><p className="eyebrow">YOU’RE ON THE LIST</p><h2>You’re registered!</h2><p>Save this reference and show it to an event organiser.</p><strong className="receipt-reference">{receipt.id}</strong><div className="receipt-details"><h3>{receipt.bundleName}</h3><p>{receipt.gameNames.join(' · ')}</p><strong>{amount(receipt.amount)}</strong><span className="badge orange">Payment pending</span></div><p>No payment has been collected online. Contact an organiser to arrange payment. Fixtures and team assignments are managed by the organisers.</p><div className="actions"><button className="button" onClick={()=>window.print()}>Print / save receipt</button><a className="button primary" href="/live">See the live games <ArrowUpRight size={16}/></a></div></div>;

  return <form className="registration-form" onSubmit={submit}>
    {!catalogue.open&&<div className="notice registration-wide">{catalogue.closeReason}</div>}
    {error&&<div className="form-error registration-wide" role="alert" tabIndex={-1} ref={feedback}>{error}</div>}
    {pending&&<div className="notice registration-wide">Your last request may have been saved. Check it before starting another registration. <button className="button" type="button" disabled={busy} onClick={()=>void send(pending)}>{busy?'Checking…':'Check previous registration'}</button></div>}
    <div className="registration-choices">
      <fieldset className="bundle-options" disabled={!catalogue.open||busy||refreshing||!!pending}><legend><span>01</span> Choose your bundle</legend><p className="registration-help">One bundle per participant. All prices are in Sri Lankan rupees.</p><div className="bundle-grid">
        {catalogue.bundles.map(b=>{const Icon=icons[b.id as keyof typeof icons]||Gamepad2;return <label key={b.id} className={`bundle-card ${bundleId===b.id?'selected':''} ${!b.available?'unavailable':''}`}>
          <input type="radio" name="bundle" aria-label={b.name} checked={bundleId===b.id} disabled={!b.available} onChange={()=>chooseBundle(b)}/>
          <span className="bundle-card-top"><Icon size={23} aria-hidden="true"/><span className="bundle-check">{bundleId===b.id&&<Check size={15}/>}</span></span>
          <strong>{b.name}</strong><span className="bundle-description">{bundleDescription(b,catalogue.games)}</span><span className="bundle-price">{amount(b.price)}<small>per person</small></span>{!b.available&&<span className="bundle-unavailable">{b.unavailableReason}</span>}
        </label>;})}
      </div></fieldset>
      <section className="registration-games"><h2><span>02</span> Your game lineup</h2>{!bundle?<p className="registration-help">Choose a bundle above to see your games.</p>:bundle.fixedGameIds.length?<><p className="registration-help">These three games are included in your bundle.</p><div className="included-games">{bundle.fixedGameIds.map(id=><div key={id}><CheckCircle2 size={18}/><strong>{catalogue.games.find(g=>g.id===id)?.name||'Unavailable game'}</strong><span>{catalogue.games.find(g=>g.id===id)?.remaining??0} places left</span></div>)}</div></>:<>
        <p className="registration-help">Choose three different games. Board games include card and party games; console choices are video game tournaments.</p>
        {(['board','console'] as const).map(kind=>{
          const limit=kind==='board'?bundle.boardCount:bundle.consoleCount;if(!limit)return null;
          const count=kind==='board'?boardSelected:consoleSelected;
          return <fieldset className="game-options" key={kind} disabled={!catalogue.open||busy||refreshing||!!pending}><legend>{kind==='board'?'Board, card & party games':'Console tournaments'} <span>{count} of {limit} selected</span></legend>
            {catalogue.games.filter(g=>(g.category==='cyber')===(kind==='console')).map(g=>{const checked=gameIds.includes(g.id);return <label key={g.id} className={checked?'selected':''}><input type="checkbox" checked={checked} disabled={!checked&&(g.remaining===0||count>=limit)} onChange={e=>setGameIds(ids=>e.target.checked?[...ids,g.id]:ids.filter(id=>id!==g.id))}/><span><strong>{g.name}</strong>{g.rules&&<small>{g.rules}</small>}</span><small>{g.remaining?`${g.remaining} places`:'Full'}</small></label>;})}
          </fieldset>;
        })}
      </>}
      <button className="text-button refresh-offers" type="button" disabled={refreshing||busy} onClick={()=>void refresh()}><RefreshCw size={14}/>{refreshing?'Refreshing…':'Refresh available places'}</button></section>
    </div>
    <aside className="registration-details"><fieldset disabled={!catalogue.open||busy||refreshing||!!pending}><legend><span>03</span> A little about you</legend><p className="registration-help">Your contact details are visible to event organisers only.</p>
      {([{key:'name',label:'Full name',type:'text',auto:'name',max:120},{key:'email',label:'Email address',type:'email',auto:'email',max:254},{key:'department',label:'Department / organisation',type:'text',auto:'organization',max:120},{key:'phone',label:'Phone number (optional)',type:'tel',auto:'tel',max:40}] as const).map(f=><div className="field" key={f.key}><label htmlFor={`register-${f.key}`}>{f.label}</label><input id={`register-${f.key}`} type={f.type} autoComplete={f.auto} maxLength={f.max} required={f.key!=='phone'} value={details[f.key]} onChange={e=>setDetails(d=>({...d,[f.key]:e.target.value}))}/></div>)}
      <div className="registration-trap" aria-hidden="true"><label htmlFor="register-website">Leave this field empty</label><input id="register-website" name="website" autoComplete="off" tabIndex={-1} value={details.website} onChange={e=>setDetails(d=>({...d,website:e.target.value}))}/></div>
      <div className="registration-total" aria-live="polite"><span>{bundle?.name||'Choose your bundle'}</span><strong>{bundle?amount(bundle.price):'—'}</strong><small>{gameIds.length} of 3 games selected · Pay through an organiser</small></div>
      <label className="registration-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I agree to organisers using these details to run the event. My name may appear on published fixtures and results.</span></label>
      <button className="button primary full" type="submit" disabled={!catalogue.open||!valid||!consent||busy||refreshing}>{busy?<><LoaderCircle className="spin" size={18}/>Saving registration…</>:'Confirm registration'}</button>
      <p className="registration-help payment-help"><ShieldCheck size={15}/> No payment is collected on this page.</p>
    </fieldset></aside>
  </form>;
}

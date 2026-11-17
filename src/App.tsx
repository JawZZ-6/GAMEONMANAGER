import { useEffect,useRef,useState } from 'react';
import { Gamepad2,LayoutDashboard,Users,Trophy,CalendarDays,Joystick,Wallet,Settings,LogOut,ArrowUpRight,RefreshCw,Heart,Menu,X,ShieldCheck } from 'lucide-react';
import { api,ApiError } from './api';
import { EditorForm,type Run } from './components';
import type { EventState } from '../shared/model';
import ArenaArt from './ArenaArt';
import { Brand, MotionToggle } from './SiteChrome';
import Overview from './pages/Overview';
import { People,Games,Settings as EventSettings } from './pages/Manage';
import Tournaments from './pages/Tournaments';
import { Schedule,FreePlay,Money } from './pages/Operations';
import Live from './pages/Live';
import Rules from './pages/Rules';
import Register from './pages/Register';
import Registrations from './pages/Registrations';
const pages=[{id:'overview',label:'Overview',icon:LayoutDashboard},{id:'registrations',label:'Registrations & bundles',icon:Users},{id:'people',label:'People & teams',icon:Users},{id:'games',label:'The games',icon:Gamepad2},{id:'tournaments',label:'Tournaments',icon:Trophy},{id:'schedule',label:'Schedule & stations',icon:CalendarDays},{id:'free-play',label:'Free play',icon:Joystick},{id:'money',label:'Money & charity',icon:Wallet},{id:'settings',label:'Event settings',icon:Settings}];
type Session={authenticated:boolean;configured:boolean;setupAllowed:boolean};
export default function App(){if(location.pathname.startsWith('/register'))return <Register/>;if(location.pathname.startsWith('/live/rules'))return <Rules/>;if(location.pathname.startsWith('/live'))return <Live/>;return <Admin/>;}
function Admin(){const [session,setSession]=useState<Session|null>(null),[state,setState]=useState<EventState|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[mobile,setMobile]=useState(false),[page,setPage]=useState(location.pathname.split('/')[2]||'overview');
const menuButton=useRef<HTMLButtonElement>(null),sidebar=useRef<HTMLElement>(null),workspace=useRef<HTMLDivElement>(null);
useEffect(()=>{
  if(!mobile)return;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  workspace.current?.setAttribute('inert','');
  const focusable=()=>Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')||[]);
  focusable()[0]?.focus();
  const keydown=(event:KeyboardEvent)=>{
    if(event.key==='Escape'){event.preventDefault();setMobile(false);}
    if(event.key==='Tab'){
      const items=focusable(),first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  };
  const onResize=()=>{if(window.innerWidth>800)setMobile(false);};
  document.addEventListener('keydown',keydown);window.addEventListener('resize',onResize);
  return()=>{document.body.style.overflow=previousOverflow;workspace.current?.removeAttribute('inert');document.removeEventListener('keydown',keydown);window.removeEventListener('resize',onResize);menuButton.current?.focus();};
},[mobile]);
useEffect(()=>{document.title=`${pages.find(p=>p.id===page)?.label||'Overview'} · GameON`;},[page]);
async function load(){try{const current=await api<Session>('session');setSession(current);if(current.authenticated)setState(await api<EventState>('state'));}catch(e){setError((e as Error).message);}}
useEffect(()=>{void load();const pop=()=>setPage(location.pathname.split('/')[2]||'overview');window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3000);return()=>clearTimeout(timer);},[notice]);
const run:Run=async(type,payload,revision)=>{if(!state)throw new Error('Event has not loaded');setError('');try{setState(await api<EventState>('command',{revision:revision??state.revision,type,payload}));setNotice('Changes saved');}catch(e){if(e instanceof ApiError&&e.status===409){setState(await api<EventState>('state'));setError('Another organiser changed the event. Close and reopen this editor (or reload Settings values) to review the latest data.');}else if(e instanceof ApiError&&e.status===401){setSession(v=>v?{...v,authenticated:false}:v);setState(null);}else setError((e as Error).message);throw e;}};
if(!session)return <main className="loading-screen"><Gamepad2 size={40}/><h1>{error?'Could not connect':'Opening GameON…'}</h1><p>{error}</p>{error&&<button className="button" onClick={()=>void load()}>Try again</button>}</main>;
if(!session.authenticated)return <div className="login-page"><div className="login-story"><Brand href="/live"/><div><p className="eyebrow hero-kicker">CISI · RETRO & CYBER GAMEON</p><h1>BEHIND EVERY<br/>GREAT <span>GAME.</span></h1><p>One event. Every game. All for a good cause.</p></div><ArenaArt compact/><div className="login-story-footer"><span>THE ORGANISER WORKSPACE</span><MotionToggle/></div></div><main className="login-form"><span className="login-shield"><ShieldCheck size={26}/></span><p className="eyebrow">ORGANISER ACCESS</p><h2>{session.configured?'Welcome back.':'Let’s get GameON ready.'}</h2><p className="muted">{session.configured?'Sign in to manage your event.':'Create the shared organiser password for this event. Use at least 12 characters.'}</p>{session.configured||session.setupAllowed?<EditorForm fields={[{name:'password',label:session.configured?'Organiser password':'Create organiser password',type:'password',required:true}]} submitLabel={session.configured?'Sign in to GameON':'Set password & open GameON'} onSubmit={async p=>{await api(session.configured?'login':'setup',p);await load();}}/>:<p className="notice">Set up the organiser password on the server’s localhost address first.</p>}<div className="login-divider"/><a className="text-link" href="/live">Just here for the games? Open live view <ArrowUpRight size={16}/></a><p className="login-footnote">CISI internal event · Retro & Cyber GameON for Charity</p></main></div>;
if(!state)return <main className="loading-screen"><h1>Loading your event…</h1>{error&&<p role="alert">{error}</p>}<button className="button" onClick={()=>void load()}>Retry</button></main>;
const props={state,run};const Page=({overview:Overview,registrations:Registrations,people:People,games:Games,tournaments:Tournaments,schedule:Schedule,'free-play':FreePlay,money:Money,settings:EventSettings} as const)[page as 'overview']||Overview;
return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a>{mobile&&<button className="sidebar-overlay" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}<aside ref={sidebar} id="main-sidebar" className={`sidebar ${mobile?'open':''}`}><div className="sidebar-brand"><Brand href="/admin"/><button className="icon-button sidebar-close" aria-label="Close navigation" onClick={()=>setMobile(false)}><X size={20}/></button></div><div className="event-switch"><span className="event-square">26</span><div><strong>CISI Charity Games</strong><small>{new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'Asia/Colombo'}).format(new Date(state.settings.startDate+'T12:00:00+05:30'))}</small></div><span className="tiny-dot"/></div><span className="nav-label">EVENT WORKSPACE</span><nav aria-label="Main navigation">{pages.map(item=><a key={item.id} href={`/admin/${item.id}`} className={page===item.id?'active':''} aria-current={page===item.id?'page':undefined} onClick={e=>{e.preventDefault();history.pushState({},'',`/admin/${item.id}`);setPage(item.id);setMobile(false);setError('');}}><item.icon size={19}/>{item.label}{item.id==='tournaments'&&state.tournaments.length>0&&<span className="nav-count">{state.tournaments.length}</span>}</a>)}</nav><div className="sidebar-bottom"><div className="cause-note"><Heart size={19}/><strong>Play with purpose.</strong><p>Good games. Great company.<br/>A lasting contribution.</p></div><a href="/live" target="_blank" rel="noreferrer" className="button full">Open live view <ArrowUpRight size={16}/></a><div className="organiser"><span className="avatar">CI</span><div><strong>Event organiser</strong><small>CISI · Admin</small></div><button aria-label="Sign out" className="icon-button" onClick={async()=>{await api('logout',{});setState(null);await load();}}><LogOut size={17}/></button></div></div></aside><div ref={workspace} className="workspace"><header className="topbar"><div className="row"><button ref={menuButton} className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobile} aria-controls="main-sidebar" onClick={()=>setMobile(true)}><Menu size={22}/></button><span className="breadcrumb">Event workspace <span>/</span> <strong>{pages.find(p=>p.id===page)?.label||'Overview'}</strong></span></div><div className="topbar-meta"><MotionToggle/><span><span className="tiny-dot"/> Event preparation</span><button className="icon-button" aria-label="Refresh event data" onClick={()=>{void load();setNotice('Event refreshed');}}><RefreshCw size={16}/></button><span className="avatar small-avatar">CI</span></div></header><main id="main-content" className="main-content">{state.settings.name.includes('Demo')&&<div className="notice">DEMO EVENT · Sample data for exploring. The real event is stored separately.</div>}{error&&<div className="error-banner" role="alert"><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={()=>setError('')}><X size={17}/></button></div>}<Page key={page} {...props}/><footer className="app-footer"><span>RETRO & CYBER GAMEON <span>·</span> FOR CHARITY BY CISI</span><span>All times Asia/Colombo</span></footer></main></div>{notice&&<div className="toast" role="status"><span className="tiny-dot"/>{notice}</div>}</div>;
}

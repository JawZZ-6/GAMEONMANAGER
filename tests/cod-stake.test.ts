import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// jsdom ships without type declarations here, so describe just the part these tests use.
type Win = {eval(code:string):unknown; close():void};
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {JSDOM:new (html:string, options:{runScripts:string; pretendToBeVisual:boolean; url:string; beforeParse(w:object):void}) => {window:Win}};

// Runs the real /live scorecard script with the given results.
const page = readFileSync(new URL('../server/live/cod.html', import.meta.url), 'utf8');
function load(cod:object){
  const html = page.replace('<!--COD-BOOT-->', `<script>window.COD_BOOT=${JSON.stringify({cod, edit:false})};</script>`);
  const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true, url:'http://localhost/live', beforeParse(w){
    Object.assign(w, {fetch:() => new Promise(() => {}), matchMedia:() => ({matches:false, addEventListener(){}, addListener(){}}), scrollTo(){}});
  }});
  const run = <T>(code:string) => dom.window.eval(code) as T;
  return {run, close:() => dom.window.close()};
}

// The live results on 25 Nov 2026: 17 of 20 FFA lobbies and 6 of 10 2v2 games played.
type Res = {r:Record<string, unknown>; fin:object; rules:object};
const LIVE = JSON.parse(readFileSync(new URL('./fixtures/cod-results-2026-11-25.json', import.meta.url), 'utf8')) as Res;
// The race for 4th only matters once the Duel (FFA #4 vs the Challenger #1) is revealed.
const DUEL = {...LIVE, reveal:{duel:true}};
type Chaser = {n:string; pts:number; id:string; need:string};
type Spot = {pos:number; kind:string; holder:{n:string; pts:number; left:number}; chasers:Chaser[]};
type FFA = {left:number; locked:string[]; spots:Spot[]};
type Team = {n:string; pts:number; left:number; state:string; txt:string; next:string|null};

describe('COD what’s at stake', () => {
  it('shows who is through, who holds each FFA cut-off spot, and what each chaser needs', () => {
    const p = load(DUEL);
    const s = p.run<FFA>('stakeFFA()');
    expect(s.left).toBe(3);
    // Nobody can reach Viraj’s 19, so the top two are through.
    expect(s.locked).toEqual(['Jawahar Jegathananthan', 'Viraj Madhusanka']);
    const [third, fourth] = s.spots;
    expect(third).toMatchObject({pos:3, kind:'final', holder:{n:'Aqeela Raban', pts:17, left:0}});
    // Malith ties on 17 with a third win, which beats Aqeela’s two; Harin ties on wins too, so kills decide.
    expect(third.chasers).toEqual([
      {n:'Malith Silva', pts:13, id:'CODF-18', need:'a win'},
      {n:'Harin Goonathilake', pts:13, id:'CODF-17', need:'a win with 13+ kills'},
    ]);
    expect(fourth).toMatchObject({pos:4, kind:'playin', holder:{n:'Abilash Devaneson', pts:14, left:0}});
    expect(fourth.chasers.map(c => [c.n, c.need])).toEqual([
      ['Malith Silva', 'any finish'],
      ['Harin Goonathilake', 'top 3, or 4th with 33+ kills'],
      ['Andrew Saliheen', 'top 3'],
    ]);
    p.close();
  });

  it('says what each 2v2 team needs for a Final spot', () => {
    const p = load(LIVE);
    const t = Object.fromEntries(p.run<Team[]>('stakeT2().teams').map(x => [x.n.split(' ')[0], x]));
    expect(t.Harin).toMatchObject({state:'seal', txt:'1 more win seals a Final spot', next:'COD2-08'});
    expect(t.Tharindu).toMatchObject({state:'seal', txt:'Win and they’re in', next:'COD2-07'});
    expect(t.Buddhika).toMatchObject({state:'wait', left:0});
    expect(t.Janith).toMatchObject({state:'seal', txt:'Win all 3 to seal a Final spot'});
    expect(t.Pasindu).toMatchObject({state:'help'});
    p.close();
  });

  it('moves on as results come in', () => {
    // Malith wins CODF-18: 17 points and a third win take 3rd, so Aqeela now defends the play-in spot.
    const r = {...LIVE.r, 'CODF-18':{pl:{'Malith Silva':1, 'Janith Fernando':2, 'Uresh Hettiarachchi':3, 'Chris Demotte':4}, k:{'Malith Silva':60}}};
    const p = load({...DUEL, r});
    const s = p.run<FFA>('stakeFFA()');
    expect(s.locked).toEqual(['Jawahar Jegathananthan', 'Viraj Madhusanka', 'Malith Silva']);
    expect(s.spots).toHaveLength(1);
    expect(s.spots[0]).toMatchObject({pos:4, holder:{n:'Aqeela Raban'}});
    expect(s.spots[0].chasers).toEqual([{n:'Harin Goonathilake', pts:13, id:'CODF-17', need:'a win with 13+ kills'}]);
    // Tharindu & Viraj beat Janith & Uresh: through. Janith & Uresh can only reach 6, so they need help.
    const r2 = {...LIVE.r, 'COD2-07':{s:[300, 700]}};
    const q = load({...LIVE, r:r2});
    const t = Object.fromEntries(q.run<Team[]>('stakeT2().teams').map(x => [x.n.split(' ')[0], x.state]));
    expect(t).toMatchObject({Tharindu:'in', Janith:'help', Harin:'seal'});
    // Once a team can't catch two others on points, it is out.
    const r3 = {...r2, 'COD2-08':{s:[700, 300]}, 'COD2-09':{s:[700, 300]}};
    const z = load({...LIVE, r:r3});
    const u = Object.fromEntries(z.run<Team[]>('stakeT2().teams').map(x => [x.n.split(' ')[0], x.state]));
    expect(u).toMatchObject({Harin:'in', Tharindu:'in', Janith:'out', Pasindu:'out', Buddhika:'out'});
    z.close();
    p.close(); q.close();
  });

  it('shows the card on the overview and next to each table, and hides it before any result', () => {
    const p = load(LIVE);
    const ov = p.run<string>('viewOverview()');
    expect(ov).toContain('What’s at stake');
    expect(p.run<string>('viewEvent("ffa")')).toContain('class="match card stake"');
    expect(p.run<string>('viewEvent("t2")')).toContain('class="match card stake"');
    p.close();
    const e = load({r:{}, fin:{}, rules:{}});
    expect(e.run('stakeFFA()')).toBeNull();
    expect(e.run('stakeT2()')).toBeNull();
    expect(e.run<string>('viewOverview()')).not.toContain('What’s at stake');
    e.close();
  });
});

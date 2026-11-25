import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// jsdom ships without type declarations here, so describe just the part these tests use.
type Win = {eval(code:string):unknown; close():void};
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {JSDOM:new (html:string, options:{runScripts:string; pretendToBeVisual:boolean; url:string; beforeParse(w:object):void}) => {window:Win}};

// Runs the real /live scorecard script with the given results.
const page = readFileSync(new URL('../server/live/cod.html', import.meta.url), 'utf8');
function load(cod:object, now = 0){
  const html = page.replace('<!--COD-BOOT-->', `<script>window.COD_BOOT=${JSON.stringify({cod, edit:false})};</script>`);
  const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true, url:'http://localhost/live', beforeParse(w){
    Object.assign(w, {fetch:() => new Promise(() => {}), matchMedia:() => ({matches:false, addEventListener(){}, addListener(){}}), scrollTo(){}});
    // Freeze the page clock when a test asks for a time of day.
    if (now){
      const Real = (w as {Date:DateConstructor}).Date;
      class Fixed extends Real { constructor(...a:[]){ super(...(a.length ? a : [now] as unknown as [])); } static now(){ return now; } }
      (w as {Date:DateConstructor}).Date = Fixed as DateConstructor;
    }
  }});
  const run = <T>(code:string) => dom.window.eval(code) as T;
  return {run, close:() => dom.window.close()};
}
type HL = {key:string; names:string[]; stat:string; note:string};
const highlights = (p:ReturnType<typeof load>) => Object.fromEntries(p.run<HL[]>('highlights()').map(h => [h.key, h]));

// The real schedule, so results line up with the shipped line-ups.
const boot = load({r:{}, fin:{}, rules:{}});
const FFA = boot.run<{id:string; p:string[]}[]>('IDS.ffa.map(id => ({id, p:MI[id].p}))');
const T2 = boot.run<{id:string; p:string[]}[]>('IDS.t2.map(id => ({id, p:MI[id].p}))');
boot.close();

// One player wins their first three lobbies with 10 kills each. In the first of those, the player who
// finishes 4th still takes 12 kills. Two 2v2 games: a 10–2 rout and a 6–5 thriller.
const star = FFA[0].p[0];
const mine = FFA.filter(m => m.p.includes(star)).slice(0, 3);
const unlucky = mine[0].p.filter(n => n !== star)[2];
const r:Record<string, unknown> = {};
mine.forEach((m, i) => {
  const rest = m.p.filter(n => n !== star), pl:Record<string, number> = {[star]:1}, k:Record<string, number> = {[star]:10};
  rest.forEach((n, j) => { pl[n] = j + 2; k[n] = i === 0 && n === unlucky ? 12 : 1; });
  r[m.id] = {pl, k};
});
r[T2[0].id] = {s:[10, 2]};
r[T2[1].id] = {s:[6, 5]};

describe('COD highlights', () => {
  it('shows nothing before any results are in', () => {
    const p = load({r:{}, fin:{}, rules:{}});
    expect(p.run('highlights()')).toEqual([]);
    expect(p.run('viewOverview()')).not.toContain('Highlights');
    p.close();
  });

  it('awards kills, wins, streaks and averages from FFA league lobbies', () => {
    const p = load({r, fin:{}, rules:{}});
    const h = highlights(p);
    expect(h.fragger).toMatchObject({names:[star], stat:'30'});
    expect(h.king).toMatchObject({names:[star], stat:'3'});
    expect(h.fire).toMatchObject({names:[star], stat:'3'});
    expect(h.day).toMatchObject({names:[star]});
    expect(h.sharp).toMatchObject({names:[star], stat:'10.0'});
    expect(h.steady).toMatchObject({names:[star], stat:'1.0'});
    expect(h.lobby).toMatchObject({names:[unlucky], stat:'12'});
    expect(h.lobby.note).toContain(mine[0].id);
    expect(h.unlucky).toMatchObject({names:[unlucky], stat:'12'});
    p.close();
  });

  it('picks the biggest and the closest 2v2 win, and needs two games for an unbeaten team', () => {
    const p = load({r, fin:{}, rules:{}});
    const h = highlights(p);
    expect(h.blowout).toMatchObject({names:[T2[0].p[0]], stat:'10–2'});
    expect(h.close).toMatchObject({names:[T2[1].p[0]], stat:'6–5'});
    expect(h.unbeaten).toBeUndefined();
    expect(h.rising).toBeUndefined(); // no Challenger lobbies are drawn yet
    p.close();
  });

  it('counts a lobby played ahead of its slot as played today for Player of the Day', () => {
    // On Wed 25 Nov, CODF-16 (Wed) and CODF-19 (scheduled Fri 27, played early) are both in.
    const live = JSON.parse(readFileSync(new URL('./fixtures/cod-results-2026-11-25.json', import.meta.url), 'utf8'));
    const p = load(live, new Date(2026, 10, 25, 15, 0).getTime());
    const h = highlights(p);
    expect(h.day).toMatchObject({names:['Jawahar Jegathananthan'], stat:'117', note:'top fragger on Wednesday 25'});
    expect(h.lobby.note).toBe('CODF-16 · Wed 25');
    p.close();
  });

  it('shares an award when players tie, and leaves averages out until 3 lobbies are played', () => {
    const one = FFA[0], [a, b, c, d] = one.p;
    const p = load({r:{[one.id]:{pl:{[a]:1, [b]:2, [c]:3, [d]:4}, k:{[a]:5, [b]:5}}}, fin:{}, rules:{}});
    const h = highlights(p);
    expect(h.fragger.names.sort()).toEqual([a, b].sort());
    expect(h.sharp).toBeUndefined();
    expect(h.steady).toBeUndefined();
    expect(h.fire).toBeUndefined(); // one win is not a streak
    expect(p.run('viewOverview()')).toContain('Highlights');
    p.close();
  });
});

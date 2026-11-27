import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// jsdom ships without type declarations here, so describe just the part these tests use.
type Win = {eval(code:string):unknown; close():void};
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {JSDOM:new (html:string, options:{runScripts:string; pretendToBeVisual:boolean; url:string; beforeParse(w:object):void}) => {window:Win}};

const page = readFileSync(new URL('../server/live/cod.html', import.meta.url), 'utf8');
function load(cod:object){
  const html = page.replace('<!--COD-BOOT-->', `<script>window.COD_BOOT=${JSON.stringify({cod, edit:false})};</script>`);
  const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true, url:'http://localhost/live', beforeParse(w){
    Object.assign(w, {fetch:() => new Promise(() => {}), matchMedia:() => ({matches:false, addEventListener(){}, addListener(){}}), scrollTo(){}});
  }});
  const run = <T>(code:string) => dom.window.eval(code) as T;
  return {run, close:() => dom.window.close()};
}
type Res = {r:Record<string, unknown>; fin:object; rules:object};
const fixture = (d:string) => JSON.parse(readFileSync(new URL(`./fixtures/cod-results-${d}.json`, import.meta.url), 'utf8')) as Res;
// 25 Nov: leagues still running. 27 Nov: every league match played.
const NOV25 = fixture('2026-11-25'), NOV27 = fixture('2026-11-27');
const at = (reveal:object, r:object = {}) => ({...NOV27, r:{...NOV27.r, ...r}, reveal});
const text = `(() => { const d = document.createElement('div'); d.innerHTML = viewOverview(); return d.textContent.replace(/\\s+/g, ' '); })()`;
const tiles = `(() => { const d = document.createElement('div'); d.innerHTML = viewOverview(); return [...d.querySelectorAll('.ftile')].map(t => ({k:t.dataset.final, locked:t.classList.contains('locked'), href:t.getAttribute('href'), txt:t.textContent.replace(/\\s+/g, ' ')})); })()`;
type Tile = {k:string; locked:boolean; href:string; txt:string};

describe('COD overview on Finals Day', () => {
  it('keeps the league overview while league matches are still to play', () => {
    const p = load(NOV25);
    expect(p.run('FINALS()')).toBe(false);
    expect(p.run<string>(text)).toContain('Highlights');
    expect(p.run<Tile[]>(tiles)).toEqual([]);
    p.close();
  });

  it('shows only the finals once every league match is in, with both secret events still locked', () => {
    const p = load(at({}));
    expect(p.run('FINALS()')).toBe(true);
    const t = p.run<Tile[]>(tiles);
    expect(t.map(x => [x.k, x.locked])).toEqual([['sd', true], ['ffa', false], ['t2', false], ['coc', true]]);
    expect(t[0].href).toBe('#/classified');
    expect(t[0].txt).toContain('Someone thought they were out.');
    expect(t[3].txt).toContain('Not everything on Game Night is on the schedule.');
    const v = p.run<string>(text);
    expect(v).not.toMatch(/showdown|champion of champions|duel|play-in|12 PM|Harin Goonathilake · |Aqeela Raban ·/i);
    expect(v).not.toMatch(/Results in|What’s at stake|Highlights|Waiting for a result/);
    expect(v).toContain('from 6 PM');
    // While the Showdown is secret, the Challenger #1 is in the FFA Grand Final.
    expect(t[1].txt).toContain('Tharindu Nuwan');
    expect(t[2].txt).toMatch(/Harin & Jawahar.*Tharindu & Viraj/);
    p.close();
  });

  it('shows the Showdown line-up once revealed, and no game times beyond 12 PM and 6 PM', () => {
    const p = load(at({duel:true}));
    const t = p.run<Tile[]>(tiles);
    expect(t[0]).toMatchObject({k:'sd', locked:false, href:'#/classified'});
    for (const n of ['Harin', 'Aqeela', 'Tharindu', 'Pasindu']) expect(t[0].txt).toContain(n);
    expect(t[1].txt).toContain('Showdown winner');
    expect(t[1].href).toBe('#/ffa');
    expect(t[2].href).toBe('#/2v2');
    expect([...new Set(p.run<string>(text).match(/\b\d{1,2}(:\d\d)? ?[AP]M/g))].sort()).toEqual(['12 PM', '6 PM']);
    expect(p.run<string>(text)).not.toMatch(/champion of champions/i);
    p.close();
  });

  it('follows the Showdown scores, then puts the winner in the FFA Grand Final', () => {
    const [H, A, T, P] = ['Harin Goonathilake', 'Aqeela Raban', 'Tharindu Nuwan', 'Pasindu Herath'];
    const g1 = {pl:{[H]:1, [A]:2, [T]:3, [P]:4}, k:{}};
    const half = load(at({duel:true}, {'F-PLAYIN':g1}));
    expect(half.run<Tile[]>(tiles)[0].txt).toContain('After game 1 of 2');
    half.close();
    const full = load(at({duel:true}, {'F-PLAYIN':g1, 'F-PLAYIN-2':g1}));
    const t = full.run<Tile[]>(tiles);
    expect(t[0].txt).toContain('Through: Harin Goonathilake');
    expect(t[1].txt).not.toContain('Showdown winner');
    expect(t[1].txt).toContain('Harin Goonathilake');
    full.close();
  });

  it('shows Champion of Champions once revealed and crowns its winner on the champions wall', () => {
    const p = load(at({duel:true, e2:true}));
    const t = p.run<Tile[]>(tiles);
    expect(t[3]).toMatchObject({k:'coc', locked:false, href:'#/classified'});
    expect(t[3].txt).toContain('Andrew & Miran');
    expect(t[3].txt).toContain('2v2 champions');
    p.close();
    // The 2v2 final and both Champion of Champions games played.
    const [Ha, J, An, Mi] = ['Harin Goonathilake', 'Jawahar Jegathananthan', 'Andrew Saliheen', 'Miran Tennakoon'];
    const g = {pl:{[Mi]:1, [Ha]:2, [J]:3, [An]:4}, k:{}};
    const q = load(at({duel:true, e2:true}, {'F-2V2':{s:[500, 300]}, 'F-COC-1':g, 'F-COC-2':g}));
    expect(q.run('champion("coc")')).toBe(Mi);
    const wall = q.run<string>(`(() => { const d = document.createElement('div'); d.innerHTML = viewOverview(); return d.querySelector('.wall').textContent.replace(/\\s+/g, ' '); })()`);
    expect(wall).toContain('Champion of Champions');
    expect(wall).toContain(Mi);
    expect(wall).toContain('Andrew & Miran');
    q.close();
  });

  it('counts down to the next part of Finals Day', () => {
    const p = load(at({duel:true}));
    const c = (d:string) => p.run<{big:string; t:number | null}>(`(() => { const x = finalsClock(new Date(${d})); return {big:x.big, t:x.t}; })()`);
    expect(c('2026, 10, 30, 9')).toMatchObject({big:'The Showdown · Tue 1 Dec · 12 PM'});
    expect(c('2026, 11, 1, 13')).toMatchObject({big:'Game Night · Tue 1 Dec · from 6 PM'});
    expect(c('2026, 11, 1, 19')).toEqual({big:'Game Night is on', t:null});
    p.close();
    // With the Showdown still secret, the countdown goes straight to Game Night.
    const s = load(at({}));
    expect(s.run<string>('finalsClock(new Date(2026, 10, 30, 9)).big')).toBe('Game Night · Tue 1 Dec · from 6 PM');
    s.close();
  });
});

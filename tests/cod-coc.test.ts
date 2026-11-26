import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// jsdom ships without type declarations here, so describe just the part these tests use.
type Win = {eval(code:string):unknown; close():void};
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {JSDOM:new (html:string, options:{runScripts:string; pretendToBeVisual:boolean; url:string; beforeParse(w:object):void}) => {window:Win}};

// Runs the real /live scorecard script with the given results, as a spectator or an organiser.
const page = readFileSync(new URL('../server/live/cod.html', import.meta.url), 'utf8');
function load(cod:object, edit = false){
  const html = page.replace('<!--COD-BOOT-->', `<script>window.COD_BOOT=${JSON.stringify({cod, edit})};</script>`);
  const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true, url:'http://localhost/live', beforeParse(w){
    Object.assign(w, {fetch:() => new Promise(() => {}), matchMedia:() => ({matches:false, addEventListener(){}, addListener(){}}), scrollTo(){}});
  }});
  const run = <T>(code:string) => dom.window.eval(code) as T;
  return {run, close:() => dom.window.close()};
}
type Res = {r:Record<string, unknown>; reveal:object};
// 26 Nov: the 2v2 league is over (final not played), and 1 of 3 Challenger 2v2 games is in.
const NOW = JSON.parse(readFileSync(new URL('./fixtures/cod-results-2026-11-26.json', import.meta.url), 'utf8')) as Res;
const T = 'Tharindu Nuwan', V = 'Viraj Madhusanka', A = 'Andrew Saliheen', M = 'Miran Tennakoon';
// Tharindu & Viraj win the 2v2 Grand Final; Andrew & Miran win the Challenger 2v2 (2–0).
const DECIDED = {...NOW, r:{...NOW.r, 'F-2V2':{s:[700, 820]}, 'CH2-01':{s:[700, 300]}, 'CH2-02':{s:[300, 700]}}};
const OPEN = {...DECIDED, reveal:{e2:true}};
const OUTSIDE = `[viewOverview(), viewEvent('ffa'), viewEvent('t2'), viewEvent('ch'), viewEvent('ch', '2v2'), viewSchedule(), viewPlayers(), standingsText()].join(' ')`;
const cls = (p:ReturnType<typeof load>) => p.run<{text:string; locked:number; cards:string[]; open:number; board:string}>(`(() => {
  const d = document.createElement('div'); d.innerHTML = viewClassified();
  return {text:d.textContent.replace(/\\s+/g, ' '), locked:d.querySelectorAll('.dossier.locked').length,
    cards:[...d.querySelectorAll('.match.card.final[id^="card-F-COC"]')].map(c => c.id),
    open:d.querySelectorAll('[id^="card-F-COC"] button[data-act="pl"]:not([disabled])').length,
    board:(d.querySelector('.coc-board') || {}).textContent || ''};
})()`);

describe('COD Classified Event 02: Champion of Champions', () => {
  it('stays locked, and out of every other page, until it is revealed', () => {
    const p = load(DECIDED);
    const v = cls(p);
    expect(v.locked).toBe(2);
    expect(v.text).not.toContain('Champion of Champions');
    expect(p.run<string>(OUTSIDE)).not.toContain('Champion of Champions');
    p.close();
    // Organisers can reveal it now, as well as the Duel.
    const e = load(DECIDED, true);
    expect(e.run<string[]>(`(() => { const d = document.createElement('div'); d.innerHTML = viewClassified(); return [...d.querySelectorAll('[data-act="reveal"]')].map(b => b.dataset.key); })()`)).toEqual(['duel', 'e2']);
    e.close();
  });

  it('once revealed, waits for both champions before the games can be scored', () => {
    const p = load({...NOW, reveal:{e2:true}}, true);
    const v = cls(p);
    expect(v.locked).toBe(1); // the Duel is still locked
    expect(v.text).toContain('Champion of Champions');
    expect(v.text).toContain('To be decided');
    expect(v.text).toContain('Tue 1 Dec');
    expect(v.cards).toEqual(['card-F-COC-1', 'card-F-COC-2']);
    expect(v.open).toBe(0);
    expect(p.run<string[]>('finalists("coc").names')).toEqual([]);
    p.close();
  });

  it('puts the 2v2 champions and the Challenger 2v2 champions in one free-for-all', () => {
    const p = load(OPEN, true);
    expect(p.run<string[]>('finalists("coc").names')).toEqual([T, V, A, M]);
    const v = cls(p);
    expect(v.text).toContain('Tharindu & Viraj');
    expect(v.text).toContain('Andrew & Miran');
    expect(v.open).toBe(2 * 4 * 5); // two games, 4 players, 4 places + DNS each
    p.close();
  });

  it('adds up place points over the two games, then wins, kills and the game 2 finish', () => {
    const g1 = {pl:{[T]:1, [V]:2, [A]:3, [M]:4}, k:{[T]:20, [A]:25}};
    const g2 = {pl:{[A]:1, [M]:2, [T]:3, [V]:4}, k:{}};
    // After one game: no champion yet, Tharindu leads.
    const p = load({...OPEN, r:{...OPEN.r, 'F-COC-1':g1}});
    expect(p.run('cocTable().played')).toBe(1);
    expect(p.run('champion("coc")')).toBeNull();
    expect(cls(p).board).toContain('After game 1 of 2');
    p.close();
    // Tharindu and Andrew both finish on 6 points with one win each: Andrew has more kills.
    const q = load({...OPEN, r:{...OPEN.r, 'F-COC-1':g1, 'F-COC-2':g2}});
    expect(q.run<{n:string; pts:number}[]>('cocTable().rows').map(x => [x.n, x.pts])).toEqual([[A, 6], [T, 6], [M, 4], [V, 4]]);
    expect(q.run('champion("coc")')).toBe(A);
    expect(cls(q).text).toContain('Andrew Saliheen');
    q.close();
    // Level on kills too: Andrew’s 1st in game 2 beats Tharindu’s 3rd.
    const z = load({...OPEN, r:{...OPEN.r, 'F-COC-1':{...g1, k:{}}, 'F-COC-2':g2}});
    expect(z.run('champion("coc")')).toBe(A);
    z.close();
  });

  it('lets organisers reveal it, with its own message, saved as one change', () => {
    const p = load(DECIDED, true);
    p.run(`location.hash = '#/classified'; render()`);
    p.run(`document.querySelector('[data-act="reveal"][data-key="e2"]').click()`);
    const sub = p.run<string>(`document.getElementById('modal').textContent`);
    expect(sub).toContain('Champion of Champions');
    expect(sub).not.toMatch(/Duel/);
    p.run(`[...document.querySelectorAll('#modal [data-act="modal-a"]')].find(b => /Reveal/.test(b.textContent)).click()`);
    expect(p.run<object[]>('pending()')).toEqual([{op:'reveal', key:'e2', on:true}]);
    p.close();
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// jsdom ships without type declarations here, so describe just the part these tests use.
type Win = {eval(code:string):unknown; close():void};
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {JSDOM:new (html:string, options:{runScripts:string; pretendToBeVisual:boolean; url:string; beforeParse(w:object):void}) => {window:Win}};

// Runs the real /live scorecard script with the given results.
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
const fixture = (day:string) => JSON.parse(readFileSync(new URL(`./fixtures/cod-results-2026-11-${day}.json`, import.meta.url), 'utf8')) as Res;
// 26 Nov: 19 of 20 FFA lobbies played. The last (CODF-20) can't change the top 3. 25 Nov: 17 of 20.
const NOW = fixture('26'), MID = fixture('25');
const DUEL = {...NOW, reveal:{duel:true}};
// The FFA page as a DOM, to read what a visitor sees.
const view = (p:ReturnType<typeof load>) => p.run<{banner:string; seats:string[]; header:boolean; strip:string; exp:string|null; grid:boolean; finals:number; scorecard:boolean}>(`(() => {
  const d = document.createElement('div'); d.innerHTML = viewEvent('ffa');
  const b = d.querySelector('.ffb'), s = d.querySelector('.lgdone'), t = e => e.textContent.replace(/\\s+/g, ' ').trim();
  return {banner:b ? t(b) : '', seats:[...d.querySelectorAll('.ffb-seat')].map(t), header:!!d.querySelector('.ghead:not(.ffb)'),
    strip:s ? t(s) : '', exp:s && s.getAttribute('aria-expanded'), grid:!!d.querySelector('.evgrid'),
    finals:d.querySelectorAll('#card-F-FFA').length, scorecard:!!d.querySelector('.match.card.final')};
})()`);

describe('COD FFA Grand Final banner', () => {
  it('takes over the FFA header once the top 3 can no longer be caught', () => {
    const p = load(NOW);
    const v = view(p);
    expect(v.banner).toContain('FFA Grand Final');
    expect(v.header).toBe(false);
    expect(v.seats).toHaveLength(4);
    expect(v.seats[0]).toContain('Jawahar Jegathananthan');
    expect(v.seats[0]).toContain('#1 · 20 pts · 5 wins');
    expect(v.seats[1]).toContain('Viraj Madhusanka');
    expect(v.seats[2]).toContain('Malith Silva');
    // While the Duel is secret, the last seat is the Challenger #1’s, and nothing hints at FFA #4.
    expect(v.seats[3]).toContain('Challenger #1');
    expect(v.banner).not.toMatch(/Duel|Harin/);
    // The last lobby is still to play, and the strip says so.
    expect(v.strip).toContain('Top 3 settled');
    expect(v.strip).toContain('1 lobby left');
    // The banner is the final, so the sidebar doesn’t repeat it.
    expect(v.finals).toBe(1);
    expect(v.scorecard).toBe(false);
    p.close();
  });

  it('shows the Duel in the last seat once it is revealed', () => {
    const p = load(DUEL);
    const v = view(p);
    expect(v.seats[3]).toContain('Duel winner');
    expect(v.seats[3]).toContain('Harin vs Challenger #1');
    p.close();
  });

  it('keeps the usual header while the top 3 can still change', () => {
    const p = load(MID);
    const v = view(p);
    expect(v.banner).toBe('');
    expect(v.header).toBe(true);
    p.close();
  });

  it('folds the leaderboard and lobbies away, on their own from the 2v2', () => {
    const p = load(NOW);
    expect(view(p)).toMatchObject({grid:false, exp:'false'});
    p.run(`location.hash = '#/ffa'; render()`);
    p.run(`document.querySelector('.lgdone').click()`);
    expect(view(p)).toMatchObject({grid:true, exp:'true'});
    expect(view(p).strip).toContain('Hide league');
    // Opening the FFA league leaves the 2v2 one folded.
    expect(p.run<boolean>(`(() => { const d = document.createElement('div'); d.innerHTML = viewEvent('t2'); return !!d.querySelector('.evgrid'); })()`)).toBe(false);
    p.close();
  });

  it('gives organisers the Grand Final scorecards under the banner, outside the fold', () => {
    const e = load(NOW, true);
    const v = view(e);
    expect(v.banner).toContain('FFA Grand Final');
    expect(v.grid).toBe(false);
    expect(v.scorecard).toBe(true);
    expect(v.finals).toBe(1);
    e.close();
  });
});

// The Grand Final is a best of 3: three games, place points added up.
const J = 'Jawahar Jegathananthan', V = 'Viraj Madhusanka', M = 'Malith Silva', T = 'Tharindu Nuwan';
const SET = {...NOW, fin:{ffa:[J, V, M, T]}}; // line-up locked in, so the final can be scored
const game = (pl:Record<string, number>, k:Record<string, number> = {}) => ({pl, k});
type Row = {n:string; pts:number; w:number; k:number; pl:(number|null)[]};
const seats = (p:ReturnType<typeof load>) => p.run<string[]>(`[...(() => { const d = document.createElement('div'); d.innerHTML = viewEvent('ffa'); return d.querySelectorAll('.ffb-seat'); })()].map(s => s.className + ' | ' + s.textContent.replace(/\\s+/g, ' ').trim())`);

describe('COD FFA Grand Final, best of 3', () => {
  it('adds up place points over the games, and crowns no one until all three are in', () => {
    const r = {...SET.r, 'F-FFA':game({[J]:2, [V]:1, [M]:3, [T]:4}), 'F-FFA-2':game({[J]:1, [V]:3, [M]:2, [T]:4})};
    const p = load({...SET, r});
    expect(p.run<Row[]>('ffaFinal().rows').map(x => [x.n, x.pts, x.pl])).toEqual([
      [J, 7, [2, 1, null]], [V, 6, [1, 3, null]], [M, 5, [3, 2, null]], [T, 2, [4, 4, null]],
    ]);
    expect(p.run('ffaFinal().played')).toBe(2);
    expect(p.run('champion("ffa")')).toBeNull();
    const s = seats(p);
    expect(s[0]).toContain('lead');
    expect(s[0]).toContain('7 pts');
    expect(s[0]).toMatch(/G1 2nd.*G2 1st/);
    expect(view(p).banner).toContain('After game 2 of 3');
    p.close();
    // Game 3 turns it round: Viraj wins it and the title.
    const q = load({...SET, r:{...r, 'F-FFA-3':game({[J]:3, [V]:1, [M]:2, [T]:4})}});
    expect(q.run('champion("ffa")')).toBe(V);
    expect(view(q).banner).toContain('FFA champion');
    const t = seats(q);
    expect(t[1]).toContain('win');
    expect(t[0]).toContain('lose');
    q.close();
  });

  it('breaks a tie on points with most final wins, then kills', () => {
    // Jawahar, Viraj and Malith all finish on 8; Malith has no win, and Viraj has the most kills.
    const r = {...SET.r,
      'F-FFA':game({[J]:1, [M]:2, [V]:3, [T]:4}, {[J]:30, [V]:25}),
      'F-FFA-2':game({[V]:1, [J]:2, [M]:3, [T]:4}, {[V]:15}),
      'F-FFA-3':game({[T]:1, [M]:2, [V]:3, [J]:4})};
    const p = load({...SET, r});
    expect(p.run<Row[]>('ffaFinal().rows').map(x => [x.n, x.pts, x.w, x.k])).toEqual([
      [V, 8, 1, 40], [J, 8, 1, 30], [M, 8, 0, 0], [T, 6, 1, 0],
    ]);
    expect(p.run('champion("ffa")')).toBe(V);
    p.close();
  });

  it('gives organisers a scorecard for each game', () => {
    const e = load(SET, true);
    const c = e.run<{ids:string[]; heads:string[]; open:number}>(`(() => { const d = document.createElement('div'); d.innerHTML = viewEvent('ffa');
      const cs = [...d.querySelectorAll('.match.card.final')];
      return {ids:cs.map(c => c.id), heads:cs.map(c => c.querySelector('.mh').textContent), open:d.querySelectorAll('.match.card.final button[data-act="pl"]:not([disabled])').length}; })()`);
    expect(c.ids).toEqual(['card-F-FFA', 'card-F-FFA-2', 'card-F-FFA-3']);
    expect(c.heads[0]).toContain('Game 1 of 3');
    expect(c.heads[2]).toContain('Tue 1 Dec');
    expect(c.open).toBe(3 * 4 * 5); // 4 players, 4 places + DNS each
    e.close();
  });
});

describe('COD Game Night dates', () => {
  it('puts Game Night on Tue 1 Dec, and the Duel at 12 PM that day only once it is revealed', () => {
    const p = load(NOW);
    expect(view(p).banner).toContain('Tue 1 Dec');
    const hidden = p.run<string>(`viewOverview() + viewEvent('ffa') + viewEvent('t2') + viewEvent('ch') + viewClassified()`);
    expect(hidden).not.toContain('12 PM');
    p.close();
    const q = load(DUEL);
    const open = q.run<string>(`viewClassified()`);
    expect(open).toContain('Tuesday 1 Dec at 12 PM in the Paradise Room');
    expect(open).toContain('Tue 1 Dec · 12 PM');
    expect(open).not.toContain('day before');
    expect(open).not.toContain('just before the final');
    q.close();
  });
});

describe('COD FFA banner line-up', () => {
  it('puts the locked-in fourth finalist in the last seat', () => {
    const p = load(SET);
    expect(seats(p)[3]).toContain('Tharindu Nuwan');
    expect(seats(p)[3]).toContain('Challenger #1');
    p.close();
  });
});

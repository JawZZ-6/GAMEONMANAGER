import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// jsdom ships without type declarations here, so describe just the part these tests use.
type Win = {eval(code:string):unknown; close():void; location:{hash:string}};
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

// The live results on 25 Nov 2026: FFA #4 is Abilash, and Pasindu leads the Challenger table.
type Res = {r:Record<string, unknown>; fin:object; rules:object};
const LIVE = JSON.parse(readFileSync(new URL('./fixtures/cod-results-2026-11-25.json', import.meta.url), 'utf8')) as Res;
const REVEALED = {...LIVE, reveal:{duel:true}};
// Every page outside the Classified tab, plus the copyable standings.
const OUTSIDE = `[viewOverview(), viewEvent('ffa'), viewEvent('t2'), viewEvent('ch'), viewEvent('ch', '2v2'), viewSchedule(), viewPlayers(), standingsText()].join(' ')`;

describe('COD Classified tab', () => {
  it('has its own tab, with both events locked and nothing given away', () => {
    const p = load(LIVE);
    expect(p.run<string[][]>('TABS').map(t => t[1])).toContain('#/classified');
    const v = p.run<string>('viewClassified()');
    expect(v).toContain('Event 01');
    expect(v).toContain('Event 02');
    expect(v).toContain('Someone thought they were out.');
    expect(v).not.toMatch(/duel|showdown|play-in|Abilash|Pasindu/i);
    expect(v).not.toContain('data-act="reveal"'); // spectators can't reveal
    p.close();
  });

  it('keeps the Showdown secret everywhere else: the Challenger #1 goes straight to the Grand Final', () => {
    const p = load(LIVE);
    expect(p.run<string>(OUTSIDE)).not.toMatch(/play-in|wildcard|duel|showdown/i);
    expect(p.run<string>(OUTSIDE)).toContain('Challenger #1 takes the last Grand Final seat');
    expect(p.run<string>(OUTSIDE)).not.toMatch(/Shipment|Search & Destroy/);
    expect(p.run<string[]>('finalists("ffa").names')).toEqual(['Jawahar Jegathananthan', 'Viraj Madhusanka', 'Aqeela Raban', 'Pasindu Herath']);
    // Only the top 3 are marked as going through on the leaderboard, and the race only covers 3rd.
    expect(p.run<number>(`(() => { const d = document.createElement('div'); d.innerHTML = standCard('ffa'); return d.querySelectorAll('tr.adv').length; })()`)).toBe(3);
    expect(p.run<number[]>('stakeFFA().spots.map(s => s.pos)')).toEqual([3]);
    expect(p.run<string[]>('stakeFFA().playin')).toEqual([]);
    p.close();
  });

  it('shows the Showdown once revealed: FFA #4 and #5 vs the Challenger #1 and #2 for the last seat', () => {
    const p = load(REVEALED);
    const v = p.run<string>('viewClassified()');
    expect(v).toContain('The Showdown');
    // FFA #4 and #5, then the Challenger #1 and #2, all provisional while their leagues are still going.
    const seats = p.run<string[]>(`(() => { const d = document.createElement('div'); d.innerHTML = viewClassified(); return [...d.querySelectorAll('.ds-four .ds-side')].map(s => s.querySelector('b').textContent + ' | ' + s.querySelector('small').textContent); })()`);
    expect(seats).toEqual(['Abilash Devaneson | FFA leaderboard #4 · for now', 'Malith Silva | FFA leaderboard #5 · for now', 'Pasindu Herath | Challenger #1 · for now', 'Sasanka Edirisinghe | Challenger #2 · for now']);
    expect(v).toContain('id="card-F-PLAYIN"');
    expect(v).toContain('id="card-F-PLAYIN-2"');
    // The format: two regular 10-minute free-for-all games, place points added up.
    const txt = p.run<string>(`(() => { const d = document.createElement('div'); d.innerHTML = viewClassified(); return d.textContent.replace(/\\s+/g, ' '); })()`);
    expect(txt).toContain('Two 10-minute free-for-all games, played like the league lobbies');
    expect(txt).toContain('Place points add up (4 / 3 / 2 / 1)');
    expect(txt).toContain('The top scorer takes the last Grand Final seat');
    expect(txt).toContain('THE SHOWDOWN · Game 2 of 2');
    expect(txt).not.toMatch(/Search & Destroy|best of 13|Shipment|[Pp]istols/);
    expect(v).toContain('Someone thought they were out.'); // the teaser for Event 02 is different, so this is the Duel's
    expect(p.run<number>(`(() => { const d = document.createElement('div'); d.innerHTML = viewClassified(); return d.querySelectorAll('.dossier.locked').length; })()`)).toBe(1); // Event 02 stays locked
    // The rest of the site switches to the Duel.
    expect(p.run<string[]>('finalists("ffa").names')).toEqual(['Jawahar Jegathananthan', 'Viraj Madhusanka', 'Aqeela Raban']);
    expect(p.run<boolean>('finalists("ffa").wait')).toBe(true);
    expect(p.run<number[]>('stakeFFA().spots.map(s => s.pos)')).toEqual([3, 5]);
    expect(p.run<string>('stakeCard("ffa")')).toContain('Last Showdown spot');
    expect(p.run<string>(OUTSIDE)).not.toMatch(/play-in|wildcard|duel/i);
    expect(p.run<string>('viewEvent("ffa")')).toContain('Showdown winner');
    // The Challenger table marks its top 2 for the Showdown.
    expect(p.run<number>(`(() => { const d = document.createElement('div'); d.innerHTML = standCard('ch'); return d.querySelectorAll('tr.adv').length; })()`)).toBe(2);
    p.close();
  });

  it('lets organisers reveal the Showdown and hide it again, saved as one change', () => {
    const p = load(LIVE, true);
    p.run(`location.hash = '#/classified'; render()`);
    expect(p.run<number>(`document.querySelectorAll('[data-act="reveal"]').length`)).toBe(2); // the Showdown and Event 02
    p.run(`document.querySelector('[data-act="reveal"]').click()`);
    p.run(`[...document.querySelectorAll('#modal [data-act="modal-a"]')].find(b => /Reveal/.test(b.textContent)).click()`);
    expect(p.run<boolean>('S.reveal.duel')).toBe(true);
    expect(p.run<object[]>('pending()')).toEqual([{op:'reveal', key:'duel', on:true}]);
    expect(p.run<string>(`document.getElementById('app').innerHTML`)).toContain('The Showdown');
    p.run(`document.querySelector('[data-act="hide"]').click()`);
    p.run(`[...document.querySelectorAll('#modal [data-act="modal-a"]')].find(b => /Hide/.test(b.textContent)).click()`);
    expect(p.run<boolean>('S.reveal.duel')).toBe(false);
    expect(p.run<object[]>('pending()')).toEqual([]);
    p.close();
  });

  it('gives organisers a four-player scorecard for each game once the line-up is locked', () => {
    const L = ['Abilash Devaneson', 'Malith Silva', 'Pasindu Herath', 'Sasanka Edirisinghe'];
    const p = load({...REVEALED, fin:{ch:L}}, true);
    const c = p.run<{ids:string[]; rows:string[]; open:number}>(`(() => { const d = document.createElement('div'); d.innerHTML = finalCard('ch');
      return {ids:[...d.querySelectorAll('.match.card.final')].map(c => c.id), rows:[...d.querySelectorAll('#card-F-PLAYIN .sc-r small')].map(s => s.textContent), open:d.querySelectorAll('button[data-act="pl"]:not([disabled])').length}; })()`);
    expect(c.ids).toEqual(['card-F-PLAYIN', 'card-F-PLAYIN-2']);
    expect(c.rows).toEqual(['FFA leaderboard #4', 'FFA leaderboard #5', 'Challenger #1', 'Challenger #2']);
    expect(c.open).toBe(2 * 4 * 5); // two games, 4 players, 4 places + DNS each
    p.close();
  });

  it('adds up place points over the two games, then wins, kills and the game 2 finish', () => {
    const [A, M, P, S] = ['Abilash Devaneson', 'Malith Silva', 'Pasindu Herath', 'Sasanka Edirisinghe'];
    const g1 = {pl:{[A]:1, [M]:2, [P]:3, [S]:4}, k:{[A]:20, [P]:25}};
    const g2 = {pl:{[P]:1, [S]:2, [A]:3, [M]:4}, k:{}};
    const base = {...REVEALED, fin:{ch:[A, M, P, S]}};
    // After game 1: a running table, and no winner yet.
    const p = load({...base, r:{...base.r, 'F-PLAYIN':g1}});
    expect(p.run('champion("ch")')).toBeNull();
    expect(p.run<string>(`(() => { const d = document.createElement('div'); d.innerHTML = viewClassified(); return d.querySelector('.coc-board').textContent; })()`)).toContain('After game 1 of 2');
    p.close();
    // Abilash and Pasindu both finish on 6 points with a win each: Pasindu has more kills, and takes the seat.
    const q = load({...base, r:{...base.r, 'F-PLAYIN':g1, 'F-PLAYIN-2':g2}});
    expect(q.run<{n:string; pts:number}[]>('sdTable().rows').map(x => [x.n, x.pts])).toEqual([[P, 6], [A, 6], [S, 4], [M, 4]]);
    expect(q.run('champion("ch")')).toBe(P);
    expect(q.run<string[]>('finalists("ffa").names')[3]).toBe(P);
    q.close();
    // Level on kills too: Pasindu’s 1st in game 2 beats Abilash’s 3rd.
    const z = load({...base, r:{...base.r, 'F-PLAYIN':{...g1, k:{}}, 'F-PLAYIN-2':g2}});
    expect(z.run('champion("ch")')).toBe(P);
    z.close();
  });
});

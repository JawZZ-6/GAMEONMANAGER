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
    expect(v).not.toMatch(/duel|play-in|Abilash|Pasindu/i);
    expect(v).not.toContain('data-act="reveal"'); // spectators can't reveal
    p.close();
  });

  it('keeps the Duel secret everywhere else: the Challenger #1 goes straight to the Grand Final', () => {
    const p = load(LIVE);
    expect(p.run<string>(OUTSIDE)).not.toMatch(/play-in|wildcard|duel/i);
    expect(p.run<string>(OUTSIDE)).toContain('Challenger #1 takes the last Grand Final seat');
    expect(p.run<string>(OUTSIDE)).not.toMatch(/Shipment|Search & Destroy/);
    expect(p.run<string[]>('finalists("ffa").names')).toEqual(['Jawahar Jegathananthan', 'Viraj Madhusanka', 'Aqeela Raban', 'Pasindu Herath']);
    // Only the top 3 are marked as going through on the leaderboard, and the race only covers 3rd.
    expect(p.run<number>(`(() => { const d = document.createElement('div'); d.innerHTML = standCard('ffa'); return d.querySelectorAll('tr.adv').length; })()`)).toBe(3);
    expect(p.run<number[]>('stakeFFA().spots.map(s => s.pos)')).toEqual([3]);
    expect(p.run<string[]>('stakeFFA().playin')).toEqual([]);
    p.close();
  });

  it('shows the Duel once revealed: FFA #4 vs the Challenger #1 for the last seat', () => {
    const p = load(REVEALED);
    const v = p.run<string>('viewClassified()');
    expect(v).toContain('The Duel');
    expect(v).toContain('Abilash Devaneson');
    expect(v).toContain('Pasindu Herath');
    expect(v).toContain('id="card-F-PLAYIN"');
    // The format: Search & Destroy on Shipment, pistols only, best of 13 rounds.
    const txt = p.run<string>(`(() => { const d = document.createElement('div'); d.innerHTML = viewClassified(); return d.textContent.replace(/\\s+/g, ' '); })()`);
    expect(txt).toContain('Search & Destroy on Shipment, pistols only, and no bomb plants');
    expect(txt).toContain('first to 7 rounds takes the last Grand Final seat');
    expect(txt).toContain('Pistols only · best of 13');
    expect(v).toContain('Someone thought they were out.'); // the teaser for Event 02 is different, so this is the Duel's
    expect(p.run<number>(`(() => { const d = document.createElement('div'); d.innerHTML = viewClassified(); return d.querySelectorAll('.dossier.locked').length; })()`)).toBe(1); // Event 02 stays locked
    // The rest of the site switches to the Duel.
    expect(p.run<string[]>('finalists("ffa").names')).toEqual(['Jawahar Jegathananthan', 'Viraj Madhusanka', 'Aqeela Raban']);
    expect(p.run<boolean>('finalists("ffa").wait')).toBe(true);
    expect(p.run<number[]>('stakeFFA().spots.map(s => s.pos)')).toEqual([3, 4]);
    expect(p.run<string>('stakeCard("ffa")')).toContain('The Duel vs the Challenger #1');
    expect(p.run<string>(OUTSIDE)).not.toMatch(/play-in|wildcard/i);
    expect(p.run<string>('viewEvent("ffa")')).toContain('Duel winner');
    p.close();
  });

  it('lets organisers reveal the Duel and hide it again, saved as one change', () => {
    const p = load(LIVE, true);
    p.run(`location.hash = '#/classified'; render()`);
    expect(p.run<number>(`document.querySelectorAll('[data-act="reveal"]').length`)).toBe(2); // the Duel and Event 02
    p.run(`document.querySelector('[data-act="reveal"]').click()`);
    p.run(`[...document.querySelectorAll('#modal [data-act="modal-a"]')].find(b => /Reveal/.test(b.textContent)).click()`);
    expect(p.run<boolean>('S.reveal.duel')).toBe(true);
    expect(p.run<object[]>('pending()')).toEqual([{op:'reveal', key:'duel', on:true}]);
    expect(p.run<string>(`document.getElementById('app').innerHTML`)).toContain('The Duel');
    p.run(`document.querySelector('[data-act="hide"]').click()`);
    p.run(`[...document.querySelectorAll('#modal [data-act="modal-a"]')].find(b => /Hide/.test(b.textContent)).click()`);
    expect(p.run<boolean>('S.reveal.duel')).toBe(false);
    expect(p.run<object[]>('pending()')).toEqual([]);
    p.close();
  });
});

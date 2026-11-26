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
const fixture = (day:string) => JSON.parse(readFileSync(new URL(`./fixtures/cod-results-2026-11-${day}.json`, import.meta.url), 'utf8')) as {r:Record<string, unknown>};
// 26 Nov: all 10 league 2v2 games played. 25 Nov: 6 of 10.
const DONE = fixture('26'), MID = fixture('25');
// The 2v2 page as a DOM, to read what a visitor sees.
const view = (p:ReturnType<typeof load>) => p.run<{banner:string; header:boolean; strip:string; finals:number; inputs:number; side:string[]}>(`(() => {
  const d = document.createElement('div'); d.innerHTML = viewEvent('t2');
  const b = d.querySelector('.gfb');
  return {banner:b ? b.textContent.replace(/\\s+/g, ' ') : '', header:!!d.querySelector('.ghead:not(.gfb)'), strip:(d.querySelector('.lgdone') || {}).textContent || '',
    finals:d.querySelectorAll('#card-F-2V2').length, inputs:d.querySelectorAll('input[data-s="F-2V2"]').length,
    side:[...d.querySelectorAll('.gfb-side')].map(s => s.className)};
})()`);

describe('COD 2v2 Grand Final banner', () => {
  it('takes over the 2v2 header once the league is complete', () => {
    const p = load(DONE);
    const v = view(p);
    expect(v.banner).toContain('2v2 Grand Final');
    expect(v.banner).toMatch(/Harin & Jawahar.*VS.*Tharindu & Viraj/);
    expect(v.banner).toContain('#1 seed · 4–0 · +1870');
    expect(v.banner).toContain('#2 seed · 3–1 · +570');
    // They met once in the league.
    expect(v.banner).toContain('League meeting: Harin & Jawahar won 880–470 (COD2-05)');
    expect(v.header).toBe(false);
    expect(v.strip).toContain('League stage complete');
    // The banner is the Grand Final card, so the sidebar doesn’t repeat it.
    expect(v.finals).toBe(1);
    p.close();
  });

  it('keeps the usual header while league games are still to play', () => {
    const p = load(MID);
    const v = view(p);
    expect(v.banner).toBe('');
    expect(v.header).toBe(true);
    p.close();
  });

  it('lets organisers type the final scores on the banner, then crowns the winners', () => {
    const e = load(DONE, true);
    expect(view(e).inputs).toBe(2);
    e.close();
    const p = load({...DONE, r:{...DONE.r, 'F-2V2':{s:[700, 820]}}});
    const v = view(p);
    expect(v.banner).toContain('2v2 champions');
    expect(v.banner).toMatch(/Tharindu & Viraj/);
    expect(v.side[0]).toContain('lose');
    expect(v.side[1]).toContain('win');
    expect(view(p).inputs).toBe(0); // viewers see the scores, not inputs
    p.close();
  });

  it('folds the league away under the banner, opening on a tap or a link to a league game', () => {
    const p = load(DONE);
    const league = () => p.run<{grid:boolean; game:boolean; exp:string|null; label:string}>(`(() => {
      const d = document.createElement('div'); d.innerHTML = viewEvent('t2'); const b = d.querySelector('.lgdone');
      return {grid:!!d.querySelector('.evgrid'), game:!!d.querySelector('#card-COD2-05'), exp:b && b.getAttribute('aria-expanded'), label:b ? b.textContent : ''};
    })()`);
    expect(league()).toMatchObject({grid:false, game:false, exp:'false'});
    expect(league().label).toContain('Show league');
    // Tapping the strip opens it.
    p.run(`(() => { document.getElementById('app').innerHTML = viewEvent('t2'); document.querySelector('.lgdone').click(); })()`);
    expect(league()).toMatchObject({grid:true, game:true, exp:'true'});
    expect(league().label).toContain('Hide league');
    p.close();
    // A link straight to a league game opens it too, so the game can be found.
    const q = load(DONE);
    q.run(`location.hash = '#/2v2?m=COD2-05'; render()`);
    expect(q.run<boolean>(`!!document.querySelector('#card-COD2-05')`)).toBe(true);
    q.close();
  });

  it('keeps the 2v2 league scores read-only for organisers, while the Grand Final stays open', () => {
    const p = load(DONE, true);
    p.run('UI.lg.t2 = true'); // open the league section
    const v = p.run<{open:string[]; shut:number; acts:number; lockPills:number}>(`(() => {
      const d = document.createElement('div'); d.innerHTML = viewEvent('t2');
      const ins = [...d.querySelectorAll('input[data-s]')];
      return {open:ins.filter(i => !i.disabled).map(i => i.dataset.s), shut:ins.filter(i => i.disabled).length,
        acts:d.querySelectorAll('[data-act="clear"][data-id^="COD2-"],[data-act="ff"][data-id^="COD2-"]').length,
        lockPills:d.querySelectorAll('.match .pill.locked').length};
    })()`);
    expect(v.open).toEqual(['F-2V2', 'F-2V2']);
    expect(v.shut).toBe(20);
    expect(v.acts).toBe(0);
    expect(v.lockPills).toBe(10);
    // Even a stray edit to a league game is ignored.
    const before = p.run<string>('JSON.stringify(S.r["COD2-05"])');
    p.run(`(() => { const i = document.createElement('input'); i.dataset.s = 'COD2-05'; i.dataset.i = '0'; i.value = '1'; document.body.appendChild(i); i.dispatchEvent(new Event('input', {bubbles:true})); })()`);
    expect(p.run<string>('JSON.stringify(S.r["COD2-05"])')).toBe(before);
    p.close();
  });
});

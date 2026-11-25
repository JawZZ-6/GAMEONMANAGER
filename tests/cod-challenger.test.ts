import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// jsdom ships without type declarations here, so describe just the part these tests use.
type Win = {eval(code:string):unknown; close():void};
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {JSDOM:new (html:string, options:{runScripts:string; pretendToBeVisual:boolean; url:string; beforeParse(w:object):void}) => {window:Win}};

// Runs the real /live scorecard script, then reads its tables.
const page = readFileSync(new URL('../server/live/cod.html', import.meta.url), 'utf8');
function load(cod:object, {challenger = true, lobbies = true, now = 0} = {}){
  let html = page.replace('<!--COD-BOOT-->', `<script>window.COD_BOOT=${JSON.stringify({cod, edit:false})};</script>`);
  // Before the draw the page had no Challenger matches: strip them to see the line-up-only page.
  if (!lobbies || !challenger) html = html.replace(/,\{"id":"CH2?-\d+"[^}]*\}/g, '');
  // Without newcomers the Challenger group must disappear completely.
  if (!challenger) html = html.replace(/"ch":\[[^\]]*\],"chTeams":\[[^\]]*\],/, '"ch":[],"chTeams":[],');
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
// Every lobby finished in line-up order, so the tables are predictable.
const inOrder = (lineups:Record<string, string[]>) => Object.fromEntries(Object.entries(lineups).map(([id, p]) => [id, {pl:Object.fromEntries(p.map((n, i) => [n, i + 1])), k:{}}]));
const lineups = (p:ReturnType<typeof load>, ev:string) => p.run<Record<string, string[]>>(`Object.fromEntries(IDS.${ev}.map(id => [id, MI[id].p]))`);

describe('COD Challenger group', () => {
  it('stays hidden without newcomers, so the page is unchanged', () => {
    const p = load({r:{}, fin:{}, rules:{}}, {challenger:false});
    expect(p.run('CHON')).toBe(false);
    expect(p.run('TABS.map(t => t[0])')).toEqual(['home', 'ffa', 't2', 'schedule', 'players']);
    p.close();
  });

  it('shows only the registered line-up before any lobbies are drawn, and leaves the FFA final alone', () => {
    const p = load({r:{}, fin:{}, rules:{}}, {lobbies:false});
    expect(p.run('[CHON, CHREG]')).toEqual([false, true]);
    expect(p.run('TABS.map(t => t[0])')).toEqual(['home', 'ffa', 't2', 'ch', 'schedule', 'players']);
    expect(p.run('EVS')).toEqual(['ffa', 't2']);
    const reg = p.run<string[]>(`[...D.ch, ...D.chTeams.flatMap(t => t.split(' & '))]`);
    const cards = p.run<{n:string; tags:string}[]>(`(() => { const d = document.createElement('div'); d.innerHTML = viewChallengers(); return [...d.querySelectorAll('.chcard')].map(c => ({n:c.querySelector('h3').textContent, tags:c.querySelector('.chc-tags').textContent})); })()`);
    expect(cards.map(c => c.n)).toEqual(reg);
    expect(cards.find(c => c.n === 'Aqeela Raban')?.tags).toContain('2v2 · with Malith');
    expect(cards.find(c => c.n === 'Sasanka Edirisinghe')?.tags).toContain('FFA');
    expect(p.run('PLAYERS.some(x => x.ch)')).toBe(false);
    expect(p.run('finalists("ffa").wait')).toBeUndefined();
    p.close();
  });

  it('counts down to the 6 PM draw, and says when registration has closed', () => {
    const at = (h:number, m = 0) => new Date(2026, 10, 20, h, m).getTime();
    const view = (now:number) => {
      const p = load({r:{}, fin:{}, rules:{}}, {lobbies:false, now});
      const v = p.run<{badge:string; text:string; cd:{t:number; days:boolean} | null}>(`(() => { const d = document.createElement('div'); d.innerHTML = viewChallengers(); const c = d.querySelector('#cd');
        return {badge:d.querySelector('.badge').textContent, text:d.querySelector('.drawb').textContent, cd:c && {t:+c.dataset.t, days:!!c.querySelector('[data-u="d"]')}}; })()`);
      p.close();
      return v;
    };
    const before = view(at(14));
    expect(before.badge).toContain('registration open');
    expect(before.text).toContain('Registration closes at 3 PM today');
    expect(before.cd).toEqual({t:at(18), days:false}); // same-day countdown: hours, minutes, seconds

    const closed = view(at(16, 30));
    expect(closed.badge).toContain('registration closed');
    expect(closed.cd).not.toBeNull();

    const after = view(at(18, 5));
    expect(after.cd).toBeNull();
    expect(after.text).toContain('being finalised');
  });

  it('draws 7 newcomer-only lobbies: 4 each, and every pair of newcomers meets exactly twice', () => {
    const p = load({r:{}, fin:{}, rules:{}});
    const ch = p.run<string[]>('D.ch'), L = Object.values(lineups(p, 'ch'));
    expect(ch).toHaveLength(7);
    expect(ch).not.toContain('Pravini K');
    expect(L).toHaveLength(7);
    for (const x of L){ expect(x).toHaveLength(4); expect(x.every(n => ch.includes(n))).toBe(true); }
    for (const n of ch) expect(L.filter(x => x.includes(n))).toHaveLength(4);
    for (const a of ch) for (const b of ch) if (a < b) expect(L.filter(x => x.includes(a) && x.includes(b))).toHaveLength(2);
    // The lobby the organisers asked for.
    expect([...p.run<string[]>('MI["CH-01"].p')].sort()).toEqual(['Joseph Silvester', 'Manthi Fernando', 'Pasindu Herath', 'Sasanka Edirisinghe']);
    p.close();
  });

  it('shows no dates or times for Challenger matches anywhere', () => {
    const p = load({r:{}, fin:{}, rules:{}});
    expect(p.run('[...IDS.ch, ...IDS.c2].every(id => MI[id].w === null && !MI[id].date)')).toBe(true);
    expect(p.run('status("CH-01").t')).toBe('To play');
    const v = p.run<{when:string[]; heads:string[]; sched:string; bo3:boolean; tog:string[]}>(`(() => { const d = document.createElement('div'); d.innerHTML = viewEvent('ch');
      const s = document.createElement('div'); UI.sev = 'ch'; s.innerHTML = schedList(); UI.sev = 'all';
      return {when:[...d.querySelectorAll('.match:not(.final):not(.league) .when')].map(x => x.textContent), heads:[...d.querySelectorAll('.day-h')].map(x => x.firstChild.textContent), sched:s.textContent,
        bo3:!!d.querySelector('.bo3'), tog:[...d.querySelectorAll('.chtog a')].map(a => a.getAttribute('href') + (a.hasAttribute('aria-current') ? ' *' : ''))}; })()`);
    expect(v.when.length).toBe(7);
    expect(v.when.every(t => t === '')).toBe(true);
    // The FFA view holds only the lobbies; the toggle leads to the 2v2 view.
    expect(v.heads).toEqual(['Challenger FFA lobbies']);
    expect(v.bo3).toBe(false);
    expect(v.tog).toEqual(['#/challenger *', '#/challenger/2v2']);
    expect(v.sched).toContain('Challenger league');
    expect(v.sched).not.toMatch(/Nov|PM/);
    p.close();
  });

  it('ranks newcomers by place on their own table and leaves the FFA leaderboard alone', () => {
    const p0 = load({r:{}, fin:{}, rules:{}}), L = lineups(p0, 'ch')['CH-01']; p0.close();
    const r = {'CH-01':{pl:{[L[0]]:1, [L[1]]:2, [L[2]]:3, [L[3]]:4}, k:{[L[0]]:12}}};
    const p = load({r, fin:{}, rules:{}});
    expect(p.run('CHON')).toBe(true);
    expect(p.run<{p:number}[]>('table("ffa").rows').every(x => x.p === 0)).toBe(true);
    const ch = p.run<{n:string; pts:number; k:number}[]>('table("ch").rows');
    expect(ch[0]).toMatchObject({n:L[0], pts:4, k:12});
    expect(ch.find(x => x.n === L[3])).toMatchObject({pts:1});
    expect(p.run(`myRes(MI["CH-01"], ${JSON.stringify(L[1])})`)).toBe('2nd · 0 kills · 3 pts');
    p.close();
  });

  it('plays the Challenger 2v2 as a round robin of 3 teams, on its own view', () => {
    const A = 'Aqeela Raban & Malith Silva', B = 'Lochana Fernando & Prathibha Gayawansha', C = 'Andrew Saliheen & Miran Tennakoon';
    const view = (p:ReturnType<typeof load>) => p.run<{cards:string[]; ring:string; ffa:boolean; crown:string}>(`(() => { const d = document.createElement('div'); d.innerHTML = viewEvent('ch', '2v2');
      return {cards:[...d.querySelectorAll('.match:not(.league) .mid')].map(x => x.textContent), ring:d.querySelector('.ring b').textContent, ffa:!!d.querySelector('#card-CH-01'), crown:d.querySelector('.ghead .meta').textContent}; })()`);
    const p0 = load({r:{}, fin:{}, rules:{}});
    expect(p0.run('D.chTeams')).toEqual([A, B, C]);
    // Every pair of teams meets exactly once.
    const games = p0.run<string[][]>('IDS.c2.map(id => MI[id].p)');
    expect(games).toEqual([[A, B], [B, C], [C, A]]);
    expect(new Set(games.map(g => [...g].sort().join('|'))).size).toBe(3);
    expect(view(p0)).toMatchObject({cards:['CH2-01', 'CH2-02', 'CH2-03'], ring:'0/3', ffa:false});
    expect(p0.run('champion("c2")')).toBeNull();
    expect(p0.run('EV.c2.path')).toBe('challenger/2v2');
    p0.close();

    // A beats B, B beats C, A beats C: A tops the table and takes the title.
    const p = load({r:{'CH2-01':{s:[10, 6]}, 'CH2-02':{s:[10, 8]}, 'CH2-03':{s:[7, 10]}}, fin:{}, rules:{}});
    expect(p.run('table("c2").rows.map(r => [r.n, r.w, r.l, r.pts])')).toEqual([[A, 2, 0, 6], [B, 1, 1, 3], [C, 0, 2, 0]]);
    expect(p.run('champion("c2")')).toBe(A);
    expect(view(p)).toMatchObject({ring:'3/3'});
    expect(view(p).crown).toContain('Aqeela & Malith');
    expect(p.run('myRes(MI["CH2-02"], "Miran Tennakoon")')).toBe('Lost 8–10 vs Lochana & Prathibha');
    expect(p.run('PLAYERS.find(x => x.n === "Andrew Saliheen")')).toMatchObject({ffa:true, c2:C});
    p.close();

    // Each team wins once with equal margins: level at the top, so no champion until a tiebreaker.
    const t = load({r:{'CH2-01':{s:[10, 8]}, 'CH2-02':{s:[10, 8]}, 'CH2-03':{s:[10, 8]}}, fin:{}, rules:{}});
    expect(t.run('champion("c2")')).toBeNull();
    t.close();
  });

  it('keeps the last Grand Final seat for the play-in winner', () => {
    const boot = load({r:{}, fin:{}, rules:{}});
    const r:Record<string, unknown> = {...inOrder(lineups(boot, 'ffa')), ...inOrder(lineups(boot, 'ch'))};
    boot.close();

    const before = load({r, fin:{}, rules:{}});
    const top = before.run<string[]>('table("ffa").rows.slice(0, 4).map(r => r.n)');
    const chTop = before.run<string>('table("ch").rows[0].n');
    expect(before.run('finalists("ch").names')).toEqual([top[3], chTop]);
    expect(before.run('finalists("ffa")')).toMatchObject({names:top.slice(0, 3), wait:true, prov:true});
    before.close();

    // The Challenger #1 wins the play-in and takes the 4th seat; the FFA #4 drops out.
    const after = load({r:{...r, 'F-PLAYIN':{s:[10, 12]}}, fin:{}, rules:{}});
    expect(after.run('finalists("ffa")')).toMatchObject({names:[...top.slice(0, 3), chTop], prov:false});
    after.close();
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// jsdom ships without type declarations here, so describe just the part these tests use.
type Win = {eval(code:string):unknown; close():void};
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {JSDOM:new (html:string, options:{runScripts:string; pretendToBeVisual:boolean; url:string; beforeParse(w:object):void}) => {window:Win}};

// Runs the real /live scorecard script, then reads its tables.
const page = readFileSync(new URL('../server/live/cod.html', import.meta.url), 'utf8');

function load(cod:object, {challenger = true} = {}){
  let html = page.replace('<!--COD-BOOT-->', `<script>window.COD_BOOT=${JSON.stringify({cod, edit:false})};</script>`);
  // Without newcomers the Challenger group must disappear completely.
  if (!challenger) html = html.replace(/"ch":\[[^\]]*\],/, '"ch":[],');
  const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true, url:'http://localhost/live', beforeParse(w){
    Object.assign(w, {fetch:() => new Promise(() => {}), matchMedia:() => ({matches:false, addEventListener(){}, addListener(){}}), scrollTo(){}});
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

  it('gives every newcomer 3 lobbies, meets each other newcomer once, and uses only FFA players as hosts', () => {
    const p = load({r:{}, fin:{}, rules:{}});
    const ch = p.run<string[]>('D.ch'), ffa = p.run<string[]>('D.ffa'), L = Object.values(lineups(p, 'ch'));
    expect(L).toHaveLength(6);
    for (const n of ch) expect(L.filter(x => x.includes(n))).toHaveLength(3);
    const pairs = L.map(x => x.filter(n => ch.includes(n)).sort().join('+'));
    expect(new Set(pairs).size).toBe(6);
    for (const x of L) expect(x.filter(n => !ch.includes(n)).every(n => ffa.includes(n))).toBe(true);
    p.close();
  });

  it('ranks newcomers by place across the whole lobby and gives hosts nothing on either table', () => {
    const r = {'CHF-01':{pl:{'Aqeela Raban':1, 'Tharindu Nuwan':2, 'Andrew Saliheen':3, 'Anoshan N':4}, k:{'Aqeela Raban':30, 'Tharindu Nuwan':20}}};
    const p = load({r, fin:{}, rules:{}});
    expect(p.run('CHON')).toBe(true);
    const ffa = p.run<{n:string; pts:number; p:number}[]>('table("ffa").rows');
    expect(ffa.find(x => x.n === 'Aqeela Raban')).toMatchObject({pts:0, p:0});
    expect(ffa.find(x => x.n === 'Andrew Saliheen')).toMatchObject({pts:0, p:0});
    const ch = p.run<{n:string; pts:number; k:number}[]>('table("ch").rows');
    expect(ch.map(x => x.n)).not.toContain('Aqeela Raban');
    expect(ch[0]).toMatchObject({n:'Tharindu Nuwan', pts:3, k:20});
    expect(ch.find(x => x.n === 'Anoshan N')).toMatchObject({pts:1});
    expect(p.run('myRes(MI["CHF-01"], "Aqeela Raban")')).toBe('Hosted · 1st · not counted');
    p.close();
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

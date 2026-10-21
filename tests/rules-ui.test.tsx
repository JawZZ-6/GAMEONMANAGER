// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Live from '../src/pages/Live';
import Rules from '../src/pages/Rules';
import { ruleTiles } from '../src/rules';
import { demoEvent } from '../server/demo';
import { publicEvent } from '../shared/domain';
afterEach(()=>{cleanup();vi.unstubAllGlobals();history.replaceState(null,'','/');});
it('shows a rules banner at the top of the live board',async()=>{
  const board=publicEvent(demoEvent());vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(board),{status:200,headers:{'Content-Type':'application/json'}})));
  render(<Live/>);const banner=await screen.findByRole('link',{name:/check rules and regulations/i});
  expect(banner.getAttribute('href')).toBe('/live/rules');expect(document.querySelector('.live-main')!.firstElementChild).toBe(banner);
});
it('lists a collapsible tile per game with only the general rules open at first',()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(<Rules/>);
  const tiles=[...document.querySelectorAll<HTMLDetailsElement>('details.rules-tile')];
  expect(tiles.map(t=>t.id)).toEqual(['general','fc26','mortal-kombat','cod-ffa','cod-2v2']);
  expect(tiles.filter(t=>t.open).map(t=>t.id)).toEqual(['general']);
  expect(screen.getByText(/2 minutes of extra time, then penalties/i)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Expand all'}));expect(tiles.every(t=>t.open)).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Collapse all'}));expect(tiles.some(t=>t.open)).toBe(false);
  expect(fetch).not.toHaveBeenCalled();expect(document.querySelector('a[href^="/admin"]')).toBeNull();
});
it('opens the tile named in the link',()=>{
  history.replaceState(null,'','/live/rules#cod-2v2');render(<Rules/>);
  expect(document.querySelectorAll<HTMLDetailsElement>('details[open]')).toHaveLength(1);expect((document.getElementById('cod-2v2') as HTMLDetailsElement).open).toBe(true);
  expect(ruleTiles.every(t=>t.sections.every(s=>s.items.length>0))).toBe(true);
});

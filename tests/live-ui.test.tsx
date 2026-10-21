// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Live from '../src/pages/Live';
import { demoEvent } from '../server/demo';
import { publicEvent } from '../shared/domain';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function serve(){const board=publicEvent(demoEvent());const fetch=vi.fn(async(_url:string,_init?:RequestInit)=>new Response(JSON.stringify(board),{status:200,headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',fetch);return {board,fetch};}
it('lets visitors browse competitors and live play, with no way into the organiser area',async()=>{
  const {fetch}=serve();render(<Live/>);
  expect(await screen.findByRole('heading',{name:/who’s competing/i})).toBeTruthy();
  expect(screen.queryByRole('link',{name:/organiser/i})).toBeNull();
  expect(document.querySelector('a[href^="/admin"]')).toBeNull();
  const alex=screen.getByText('Alex Perera',{selector:'.player-card strong'}).closest('li')!;
  expect(alex.textContent).toContain('Playing');expect(alex.className).toContain('is-playing');
  expect(fetch.mock.calls.every(([url,init])=>String(url).startsWith('/api/live')&&!(init as RequestInit|undefined)?.body)).toBe(true);
});
it('filters the roster by name',async()=>{
  serve();render(<Live/>);await screen.findByRole('heading',{name:/who’s competing/i});
  fireEvent.change(screen.getByRole('searchbox',{name:/find a player/i}),{target:{value:'casey'}});
  expect(document.querySelectorAll('.player-card')).toHaveLength(1);expect(screen.getByText('Casey Lee',{selector:'.player-card strong'})).toBeTruthy();
});

// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../src/App';
import Live from '../src/pages/Live';
import { demoEvent } from '../server/demo';
import { publicEvent } from '../shared/domain';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); history.replaceState({}, '', '/'); });

it('exposes the selected game filter and display mode to assistive technology', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(publicEvent(demoEvent())))));
  render(<Live />);
  const all = await screen.findByRole('button', { name: 'All games' });
  expect(all.getAttribute('aria-pressed')).toBe('true');
  const game = screen.getByRole('button', { name: 'UNO' });
  fireEvent.click(game);
  expect(game.getAttribute('aria-pressed')).toBe('true');
  expect(all.getAttribute('aria-pressed')).toBe('false');
  const display = screen.getByRole('button', { name: 'Display mode' });
  fireEvent.click(display);
  expect(screen.getByRole('button', { name: 'Exit display' }).getAttribute('aria-pressed')).toBe('true');
});

it('closes the organiser drawer with Escape and restores focus to its trigger', async () => {
  history.replaceState({}, '', '/admin');
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith('/session') ? { authenticated: true, configured: true, setupAllowed: false } : demoEvent()
  ))));
  render(<App />);
  const trigger = await screen.findByRole('button', { name: 'Open navigation' });
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
});

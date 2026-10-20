// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegistrationForm } from '../src/pages/Register';
import Registrations from '../src/pages/Registrations';
import { createEvent } from '../shared/domain';
import { applyRegistration, registrationCatalogue } from '../shared/registration';
import { ApiError } from '../src/api';

afterEach(cleanup);
const date=new Date('2026-10-20T10:00:00Z');
const catalogue=()=>registrationCatalogue(createEvent(),date);
function fillDetails(){for(const [label,value] of [['Full name','Alex Test'],['Email address','alex@example.test'],['Department / organisation','Finance']])fireEvent.change(screen.getByLabelText(label),{target:{value}});fireEvent.click(screen.getByLabelText(/I agree/));}

it('submits a fixed bundle with contact information and shows an unpaid receipt',async()=>{
  const submit=vi.fn().mockResolvedValue({id:'abcdef12-test',bundleName:'Social Bundle',amount:1200,gameNames:['UNO','Pictionary','Charades'],createdAt:date.toISOString()});
  render(<RegistrationForm catalogue={catalogue()} onSubmit={submit} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('radio',{name:'Social Bundle'}));fillDetails();fireEvent.click(screen.getByRole('button',{name:'Confirm registration'}));
  await waitFor(()=>expect(submit).toHaveBeenCalledOnce());
  expect(submit.mock.calls[0][0]).toMatchObject({name:'Alex Test',email:'alex@example.test',department:'Finance',bundleId:'social',gameIds:['game-1','game-4','game-5'],expectedPrice:1200,consent:true});
  expect(await screen.findByText('You’re registered!')).toBeTruthy();expect(screen.getByText(/Payment pending/)).toBeTruthy();
});
it('enforces game counts and clears choices when changing bundles',()=>{
  render(<RegistrationForm catalogue={catalogue()} onSubmit={vi.fn()} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('radio',{name:'Best of Both Worlds Bundle'}));
  fireEvent.click(screen.getByRole('checkbox',{name:/UNO/}));fireEvent.click(screen.getByRole('checkbox',{name:/Scrabble/}));fireEvent.click(screen.getByRole('checkbox',{name:/FC 26/}));
  expect((screen.getByRole('checkbox',{name:/Carrom/}) as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole('checkbox',{name:/Mortal Kombat/}) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('radio',{name:'Arcade Bundle'}));
  expect((screen.getByRole('checkbox',{name:/FC 26/}) as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole('button',{name:'Confirm registration'}) as HTMLButtonElement).disabled).toBe(true);
});
it('preserves fields and request ID after a rejected request, but changes ID when details change',async()=>{
  const submit=vi.fn().mockRejectedValue(new ApiError('Please check the details.',400));
  render(<RegistrationForm catalogue={catalogue()} onSubmit={submit} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('radio',{name:'Social Bundle'}));fillDetails();
  fireEvent.click(screen.getByRole('button',{name:'Confirm registration'}));await screen.findByRole('alert');
  expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Alex Test');
  fireEvent.click(screen.getByRole('button',{name:'Confirm registration'}));await waitFor(()=>expect(submit).toHaveBeenCalledTimes(2));
  expect(submit.mock.calls[0][0].requestId).toBe(submit.mock.calls[1][0].requestId);
  await waitFor(()=>expect((screen.getByRole('button',{name:'Confirm registration'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'New name'}});
  fireEvent.click(screen.getByRole('button',{name:'Confirm registration'}));await waitFor(()=>expect(submit).toHaveBeenCalledTimes(3));
  expect(submit.mock.calls[2][0].requestId).not.toBe(submit.mock.calls[0][0].requestId);
});
it('can recover the exact submitted receipt after response loss even when the catalogue closes',async()=>{
  const receipt={id:'receipt',bundleName:'Social Bundle',amount:1200,gameNames:['UNO','Pictionary','Charades'],createdAt:date.toISOString()};
  const submit=vi.fn().mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValue(receipt);
  const view=render(<RegistrationForm catalogue={catalogue()} onSubmit={submit} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('radio',{name:'Social Bundle'}));fillDetails();fireEvent.click(screen.getByRole('button',{name:'Confirm registration'}));await screen.findByRole('alert');
  const closed=catalogue();closed.open=false;closed.closeReason='Registration is closed.';closed.bundles[0].available=false;
  view.rerender(<RegistrationForm catalogue={closed} onSubmit={submit} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Check previous registration'}));
  await screen.findByText('You’re registered!');expect(submit.mock.calls[1][0]).toEqual(submit.mock.calls[0][0]);
});
it('disables submission when closed and keeps the closure explanation visible',()=>{
  const data=catalogue();data.open=false;data.closeReason='Registration is closed.';
  render(<RegistrationForm catalogue={data} onSubmit={vi.fn()} onRefresh={vi.fn()}/>);
  expect(screen.getByText('Registration is closed.')).toBeTruthy();expect((screen.getByRole('button',{name:'Confirm registration'}) as HTMLButtonElement).disabled).toBe(true);
});
it('shows organiser registration details, balances and controls',()=>{
  const s=createEvent();applyRegistration(s,{requestId:crypto.randomUUID(),name:'Alex',email:'alex@example.test',department:'Finance',bundleId:'social',gameIds:['game-1','game-4','game-5'],expectedPrice:1200,consent:true},'hash',date);
  render(<Registrations state={s} run={vi.fn()}/>);
  expect(screen.getByText('alex@example.test')).toBeTruthy();expect(screen.getByRole('button',{name:'Record payment'})).toBeTruthy();
  expect(screen.getByRole('link',{name:/Export registrations/}).getAttribute('href')).toBe('/api/export/registrations');
  fireEvent.click(screen.getByRole('button',{name:/Bundle offers/}));expect(screen.getAllByRole('button',{name:/Edit/})).toHaveLength(5);
});

// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegistrationForm } from '../src/pages/Register';
import Registrations from '../src/pages/Registrations';
import { createEvent } from '../shared/domain';
import { applyRegistration, registrationCatalogue, registrationReceipt } from '../shared/registration';
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
it('allows one individual board game and clears the selection when changing registration mode',async()=>{
  const submit=vi.fn().mockResolvedValue({id:'individual',bundleName:'Individual games',amount:500,gameNames:['UNO'],createdAt:date.toISOString()});
  render(<RegistrationForm catalogue={catalogue()} onSubmit={submit} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Individual games'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Select UNO · Board games'}));fillDetails();
  fireEvent.click(screen.getByRole('button',{name:'Confirm registration'}));await waitFor(()=>expect(submit).toHaveBeenCalledOnce());
  expect(submit.mock.calls[0][0]).toMatchObject({registrationType:'individual',gameIds:['game-1'],bundleId:'',expectedPrice:500,selections:[{gameId:'game-1',optionId:'game-1-single',companions:[],teamName:''}]});
});
it('collects a team roster and shows the total once for the team',async()=>{
  const submit=vi.fn().mockResolvedValue({id:'team',bundleName:'Individual games',amount:1200,gameNames:['FC 26'],createdAt:date.toISOString()});
  render(<RegistrationForm catalogue={catalogue()} onSubmit={submit} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Individual games'}));fireEvent.click(screen.getByRole('button',{name:'Console tournaments'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Select FC 26 · Console tournaments'}));
  fireEvent.change(screen.getByLabelText('Play option for FC 26'),{target:{value:'game-7-team'}});
  fireEvent.change(screen.getByLabelText('Team name for FC 26'),{target:{value:'Finance Duo'}});fireEvent.change(screen.getByLabelText('Other player 1 for FC 26'),{target:{value:'Sam Player'}});fillDetails();
  fireEvent.click(screen.getByRole('button',{name:'Confirm registration'}));await waitFor(()=>expect(submit).toHaveBeenCalledOnce());
  expect(submit.mock.calls[0][0]).toMatchObject({expectedPrice:1200,selections:[{gameId:'game-7',optionId:'game-7-team',teamName:'Finance Duo',companions:['Sam Player']}]});
});
it('preserves contact details but resets bundle and individual choices on mode switch',()=>{
  render(<RegistrationForm catalogue={catalogue()} onSubmit={vi.fn()} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('radio',{name:'Social Bundle'}));fillDetails();fireEvent.click(screen.getByRole('button',{name:'Individual games'}));
  expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Alex Test');
  expect((screen.getByRole('button',{name:'Confirm registration'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Bundles'}));expect((screen.getByRole('radio',{name:'Social Bundle'}) as HTMLInputElement).checked).toBe(false);
});
it('requires review after selected play terms change and submits the reviewed version',async()=>{
  const state=createEvent();
  const submit=async(value:unknown)=>applyRegistration(state,value,'ui-version',date);
  const view=render(<RegistrationForm catalogue={registrationCatalogue(state,date)} onSubmit={submit} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Individual games'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Select UNO · Board games'}));fillDetails();
  const option=state.entryOptions.find(o=>o.id==='game-1-single')!;
  Object.assign(option,{version:2,format:'One timed round'});
  view.rerender(<RegistrationForm catalogue={registrationCatalogue(state,date)} onSubmit={submit} onRefresh={vi.fn()}/>);
  expect((screen.getByRole('button',{name:'Confirm registration'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Review updated option for UNO'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm registration'}));
  await screen.findByText('You’re registered!');
  expect(state.registrations[0].lineItems[0].format).toBe('One timed round');
});
it('prevents selecting unpriced, disabled and full individual games',()=>{
  const data=catalogue();
  data.entryOptions.find(option=>option.gameId==='game-1')!.price=0;
  data.entryOptions.find(option=>option.gameId==='game-2')!.active=false;
  data.games.find(game=>game.id==='game-3')!.remaining=0;
  render(<RegistrationForm catalogue={data} onSubmit={vi.fn()} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Individual games'}));
  for(const name of ['UNO','Scrabble','Carrom'])expect((screen.getByRole('checkbox',{name:`Select ${name} · Board games`}) as HTMLInputElement).disabled).toBe(true);
  expect(screen.getAllByText('Price to be confirmed')).toHaveLength(2);
  expect(screen.getByText('Full')).toBeTruthy();
});
it('totals individual games across categories and shows their purchased receipt breakdown',async()=>{
  const state=createEvent();
  const submit=vi.fn(async(value:unknown)=>applyRegistration(state,value,'multi-game',date));
  render(<RegistrationForm catalogue={registrationCatalogue(state,date)} onSubmit={submit} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Individual games'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Select UNO · Board games'}));
  fireEvent.click(screen.getByRole('button',{name:'PC free play'}));
  const game=state.games.find(game=>game.name==='God of War (2018)')!;
  fireEvent.click(screen.getByRole('checkbox',{name:`Select ${game.name} · PC free play`}));
  fillDetails();fireEvent.click(screen.getByRole('button',{name:'Confirm registration'}));
  await screen.findByText('You’re registered!');
  expect(submit.mock.calls[0][0]).toMatchObject({gameIds:['game-1',game.id],expectedPrice:850});
  expect(document.querySelectorAll('.receipt-line-item')).toHaveLength(2);
  expect(screen.getByText('LKR 500 per person')).toBeTruthy();
  expect(screen.getByText('LKR 350 per booking')).toBeTruthy();
  expect(screen.getByText('LKR 850')).toBeTruthy();
});
it('locks mode changes after an uncertain individual submission and recovers the exact roster',async()=>{
  const state=createEvent();
  const submit=vi.fn(async(value:unknown)=>{
    if(submit.mock.calls.length===1){applyRegistration(state,value,'recovered-team',date);throw new Error('Connection interrupted');}
    return registrationReceipt(state.registrations[0]);
  });
  const view=render(<RegistrationForm catalogue={registrationCatalogue(state,date)} onSubmit={submit} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Individual games'}));fireEvent.click(screen.getByRole('button',{name:'Console tournaments'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'Select FC 26 · Console tournaments'}));
  fireEvent.change(screen.getByLabelText('Play option for FC 26'),{target:{value:'game-7-team'}});
  fireEvent.change(screen.getByLabelText('Team name for FC 26'),{target:{value:'Finance Duo'}});
  fireEvent.change(screen.getByLabelText('Other player 1 for FC 26'),{target:{value:'Sam Player'}});
  fillDetails();fireEvent.click(screen.getByRole('button',{name:'Confirm registration'}));await screen.findByRole('alert');
  expect(screen.getByRole('button',{name:'Bundles'}).matches(':disabled')).toBe(true);
  const updated=registrationCatalogue(state,date);updated.entryOptions.find(option=>option.id==='game-7-team')!.price=1500;
  view.rerender(<RegistrationForm catalogue={updated} onSubmit={submit} onRefresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Check previous registration'}));
  await screen.findByText('You’re registered!');
  expect(submit.mock.calls[1][0]).toEqual(submit.mock.calls[0][0]);
  expect(state.participants).toHaveLength(2);expect(state.ledger).toHaveLength(1);
});
it('shows individual purchase snapshots and rosters to organisers alongside current play options',()=>{
  const state=createEvent();
  applyRegistration(state,{requestId:crypto.randomUUID(),name:'Alex',email:'alex@example.test',department:'Finance',registrationType:'individual',bundleId:'',gameIds:['game-7'],selections:[{gameId:'game-7',optionId:'game-7-team',companions:['Sam Player'],teamName:'Finance Duo'}],expectedPrice:1200,consent:true},'organiser-team',date);
  state.entryOptions.find(option=>option.id==='game-7-team')!.price=1500;
  render(<Registrations state={state} run={vi.fn()}/>);
  const breakdown=screen.getByText(/LKR 1,200 per team/);
  expect(breakdown.textContent).toContain('Team: Finance Duo');
  expect(breakdown.textContent).toContain('Players: Alex, Sam Player');
  fireEvent.click(screen.getByRole('button',{name:'Individual play options'}));
  expect(screen.getByRole('button',{name:/Edit FC 26 .*Multiplayer/i})).toBeTruthy();
  expect(screen.getByText('LKR 1,500')).toBeTruthy();
});

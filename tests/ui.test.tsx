// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorForm, MatchCard } from '../src/components';
afterEach(cleanup);
it('keeps a form bound to its original revision until the organiser explicitly reloads it',async()=>{
  const submit=vi.fn().mockResolvedValue(undefined);const fields=[{name:'venue',label:'Venue'}];
  const view=render(<EditorForm fields={fields} initial={{venue:'Original'}} revision={0} onSubmit={submit}/>);
  view.rerender(<EditorForm fields={fields} initial={{venue:'New venue'}} revision={1} onSubmit={submit}/>);
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await waitFor(()=>expect(submit).toHaveBeenCalledWith({venue:'Original'},0));
  fireEvent.click(screen.getByRole('button',{name:'Reload latest values'}));expect((screen.getByLabelText('Venue') as HTMLInputElement).value).toBe('New venue');
});
it('submits labelled fields and preserves values when the server rejects a save',async()=>{
  const submit=vi.fn().mockRejectedValue(new Error('Another organiser changed this record'));
  render(<EditorForm fields={[{name:'name',label:'Display name',required:true}]} initial={{name:'Alex'}} onSubmit={submit}/>);
  fireEvent.change(screen.getByRole('textbox',{name:'Display name'}),{target:{value:'Sam'}});fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Another organiser'));
  expect((screen.getByRole('textbox',{name:'Display name'}) as HTMLInputElement).value).toBe('Sam');expect(submit.mock.calls[0][0]).toEqual({name:'Sam'});
});
it('converts money and multi-select values into typed payloads',async()=>{
  const submit=vi.fn().mockResolvedValue(undefined);render(<EditorForm fields={[{name:'amount',label:'Amount',type:'number'},{name:'ids',label:'Entrants',type:'multi',options:[{value:'p1',label:'Alex'}]}]} initial={{amount:500,ids:[]}} onSubmit={submit}/>);
  fireEvent.click(screen.getByLabelText('Alex'));fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await waitFor(()=>expect(submit).toHaveBeenCalledWith({amount:500,ids:['p1']}));
});
it('shows a bye explicitly and does not invent an opponent or a scheduled time',()=>{render(<MatchCard match={{id:'m',tournamentId:'t',round:1,position:0,a:'p1',b:null,status:'completed',winnerId:'p1',scoreA:null,scoreB:null,bye:true,forfeit:false,stationId:'',scheduledAt:'',duration:30}} nameOf={id=>id==='p1'?'Alex':'To be decided'}/>);expect(screen.getByText('Bye · automatic advancement')).toBeTruthy();expect(screen.queryByText('vs')).toBeNull();});

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { createEvent, applyCommand, publicEvent, moneySummary } from '../shared/domain';
import { eventSchema } from '../shared/model';
import { applyRegistration } from '../shared/registration';
import { decodeCsv, formTime, parseCsv, readRegistrationForm } from '../shared/registration-import';
import RegistrationImport from '../src/pages/RegistrationImport';

// Same shape as a Microsoft Forms export saved from Excel, including the no-break spaces Forms adds.
const header='Id,Start time,Completion time,Email,Name,Your Name,Which activity would you like to participate in,Which Board Game(s) would you like to enter?,Which Tournament(s) would you like to enter? ,Do you like to register for the Video Game Tournament as well?,Which Tournament(s) would you like to enter? 1,Do you like to register for the Board Game Tournament as well?,Which Board Game(s) would you like to enter?1,Free Play Information';
const csv=[header,
  '1,10/19/2026 12:24,10/19/2026 12:25,Ada@Example.test,Ada Lovelace,Ada,Board Game Tournament,Omi;Carrom;,,Yes,"FC 26 (1 vs 1) - LKR 700 per player;Call of Duty - PC Tournament 2 vs 2  - LKR 1000;",,,',
  '2,10/20/2026 9:08,10/20/2026 9:30,grace@example.test,Grace Hopper,Grace,Video Game Tournament,,"FC 26 (1 vs 1) - LKR 700 per player;FC 26 (2 vs 2) - LKR 1,200 per team;",,,Yes,Chess;,',
  '3,10/20/2026 9:31,10/20/2026 9:39,free@example.test,Free Player,Free,Free Play Gaming,,,,,,,',
  '4,10/20/2026 9:40,10/20/2026 9:41,bad@example.test,Bad Entry,Bad,Board Game Tournament,Tiddlywinks;,,,,,,',
  '5,10/21/2026 9:31,10/21/2026 9:33,GRACE@example.test,Grace Hopper,Grace,Video Game Tournament,,Mortal Kombat (1 vs 1) - LKR 700 per player;,,,,,',
].join('\r\n');
const state=()=>{const s=createEvent();s.settings.registrationDeadline='2099-12-31';return s;};
const payload=(rows:ReturnType<typeof readRegistrationForm>)=>({rows:rows.filter(r=>r.status==='new').map(({reference,name,email,createdAt,selections})=>({reference,name,email,createdAt,selections}))});

describe('registration form import',()=>{
  it('reads Excel CSV in Windows-1252 or UTF-8 and quoted cells',()=>{
    expect(decodeCsv(new Uint8Array([0x41,0xa0,0x42]))).toBe('A B');
    expect(decodeCsv(new TextEncoder().encode('﻿é'))).toBe('é');
    expect(parseCsv('a,"b, ""c""",d\r\n\r\n1,2,3\n')).toEqual([['a','b, "c"','d'],['1','2','3']]);
    expect(formTime('10/21/2026 13:38')).toBe('2026-10-21T08:08:00.000Z');
  });
  it('matches answers to games and play options, and flags duplicates and unknown games',()=>{
    const s=state();const rows=readRegistrationForm(s,csv);
    const option=(gameName:string,id:string)=>{const g=s.games.find(g=>g.name===gameName)!;return {gameId:g.id,optionId:`${g.id}-${id}`};};
    expect(rows.map(r=>r.status)).toEqual(['new','duplicate','new','invalid','new']);
    expect(rows[0]).toMatchObject({name:'Ada Lovelace',email:'ada@example.test',reference:'1',createdAt:'2026-10-19T06:55:00.000Z',selections:[option('Omi','single'),option('Carrom','single'),option('FC 26','single'),option('Call of Duty','team')]});
    expect(rows[1].problems).toEqual(['Replaced by a later submission']);
    expect(rows[2].selections).toEqual([]);
    expect(rows[3].problems[0]).toMatch(/Tiddlywinks/);
    expect(rows[4].selections).toEqual([option('Mortal Kombat','single')]);
    expect(()=>readRegistrationForm(s,'Id,Name\n1,A')).toThrow(/Email column/);
  });
  it('imports people with their entries and charges, and they cannot register again',()=>{
    const s=state();applyCommand(s,{type:'registration.import',payload:payload(readRegistrationForm(s,csv))});
    eventSchema.parse(s);
    expect(s.participants.map(p=>p.name)).toEqual(['Ada Lovelace','Free Player','Grace Hopper']);
    expect(s.registrations).toHaveLength(2);
    const ada=s.registrations[0];
    expect(ada).toMatchObject({registrationType:'individual',amount:500+500+700+1000,createdAt:'2026-10-19T06:55:00.000Z',gameNames:['Omi','Carrom','FC 26','Call of Duty']});
    expect(moneySummary(s).balances.find(b=>b.id===ada.participantId)?.balance).toBe(2700);
    expect(readRegistrationForm(s,csv).filter(r=>r.status==='new')).toEqual([]);
    expect(()=>applyCommand(s,{type:'registration.import',payload:{rows:[{name:'Ada',email:'ada@example.test',selections:[]}]}})).toThrow(/already registered/);
    expect(()=>applyRegistration(s,{requestId:crypto.randomUUID(),name:'Ada L',email:'ada@example.test',department:'Tech',bundleId:'social',gameIds:['game-1','game-4','game-5'],expectedPrice:1200,consent:true},'h')).toThrow(/already registered/);
    expect(JSON.stringify(publicEvent(s))).not.toMatch(/example\.test/);
  });
  it('previews the file and sends only importable rows',async()=>{
    const s=state();const calls:unknown[]=[];
    render(<RegistrationImport state={s} run={async(type,p)=>{calls.push([type,p]);}}/>);
    fireEvent.change(screen.getByLabelText('Registration form CSV'),{target:{files:[new File([csv],'form.csv',{type:'text/csv'})]}});
    await screen.findByText('3 to import');
    expect(screen.getByText('Replaced by a later submission')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:/Import 3 people/}));
    await waitFor(()=>expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual(['registration.import',payload(readRegistrationForm(s,csv))]);
  });
});

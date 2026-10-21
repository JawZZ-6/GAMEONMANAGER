import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Badge, Panel, amount, timeLabel, type PageProps } from '../components';
import { decodeCsv, readRegistrationForm, type ImportRow } from '../../shared/registration-import';

const statusLabel={new:'Will be imported',duplicate:'Skipped',invalid:'Needs attention'};
const statusTone={new:'green',duplicate:'muted',invalid:'orange'};

export default function RegistrationImport({state:s,run}:PageProps){
  const [file,setFile]=useState(''),[text,setText]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(''),[busy,setBusy]=useState(false);
  let rows:ImportRow[]=[],readError='';
  // Re-read against the current event, so people imported a moment ago now show as already registered.
  if(text)try{rows=readRegistrationForm(s,text);}catch(e){readError=(e as Error).message;}
  const ready=rows.filter(r=>r.status==='new');
  const choose=async(f?:File)=>{setError('');setDone('');setText('');setFile(f?.name||'');if(f)setText(decodeCsv(await f.arrayBuffer()));};
  const entry=(r:ImportRow)=>r.selections.map(sel=>{const g=s.games.find(g=>g.id===sel.gameId),o=s.entryOptions.find(o=>o.id===sel.optionId);return {label:`${g?.name} · ${o?.name}`,price:o?.price||0};});
  const importRows=async()=>{if(busy||!ready.length)return;setBusy(true);setError('');try{await run('registration.import',{rows:ready.map(({reference,name,email,createdAt,selections})=>({reference,name,email,createdAt,selections}))});setDone(`Imported ${ready.length} ${ready.length===1?'person':'people'}. They now appear under Registrations and cannot register again.`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  return <Panel title="Import earlier registrations" subtitle="Add people who already registered through another form, such as a Microsoft Forms export saved as CSV. Each person is added once, with their games, play options and charges, and their email counts as registered.">
    <div className="editor-form">
      <div className="field"><label htmlFor="import-file">Registration form CSV</label><input id="import-file" type="file" accept=".csv,text/csv" onChange={e=>choose(e.target.files?.[0])}/><p className="field-help">Needs Email and Name columns, plus the "Which … would you like to enter?" questions. Answers are matched to tournament games and play options by name; "2 vs 2" answers use the team option. The file is read in this browser and is not stored.</p></div>
      {(readError||error)&&<p className="form-error" role="alert">{readError||error}</p>}
      {done&&<p className="notice" role="status">{done}</p>}
    </div>
    {rows.length>0&&<>
      <div className="import-summary"><span><strong>{file}</strong></span><Badge tone="green">{ready.length} to import</Badge><Badge>{rows.filter(r=>r.status==='duplicate').length} skipped</Badge><Badge tone="orange">{rows.filter(r=>r.status==='invalid').length} need attention</Badge><button className="button primary" type="button" disabled={busy||!ready.length} onClick={importRows}><Upload size={16}/>{busy?'Importing…':`Import ${ready.length} ${ready.length===1?'person':'people'}`}</button></div>
      <div className="table-wrap"><table><thead><tr><th>Row</th><th>Person</th><th>Entries</th><th>Status</th></tr></thead><tbody>{rows.map(r=>{const items=entry(r);return <tr key={r.line}>
        <td>{r.line}{r.reference&&<small className="registration-cell-note">Form #{r.reference}</small>}</td>
        <td><strong>{r.name||'—'}</strong><small className="registration-cell-note">{r.email||'No email'}</small>{r.createdAt&&<small className="registration-cell-note">{timeLabel(r.createdAt)}</small>}</td>
        <td>{items.length?items.map((i,n)=><small className="registration-cell-note" key={n}>{i.label} · {amount(i.price)}</small>):<small className="registration-cell-note">No tournament entries</small>}{items.length>0&&<small className="registration-cell-note"><strong>{amount(items.reduce((t,i)=>t+i.price,0))}</strong></small>}</td>
        <td><Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>{r.problems.map((p,n)=><small className="registration-cell-note" key={n}>{p}</small>)}</td>
      </tr>;})}</tbody></table></div>
    </>}
  </Panel>;
}

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Badge, Panel, type PageProps } from '../components';

// Accepts one address per line or a pasted spreadsheet column/comma-separated list.
export const parseEmails=(text:string)=>[...new Set(text.split(/[\s,;]+/).map(e=>e.trim().toLowerCase()).filter(Boolean))];

export default function EmailAllowlist({state:s,run}:PageProps){
  const [enabled,setEnabled]=useState(s.emailAllowlist.enabled),[text,setText]=useState(s.emailAllowlist.emails.join('\n'));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState('');
  const registered=new Set(s.participants.map(p=>p.email.toLowerCase()).filter(Boolean));
  const draft=parseEmails(text),saved=s.emailAllowlist.emails;
  const changed=enabled!==s.emailAllowlist.enabled||draft.join('\n')!==saved.join('\n');
  const used=saved.filter(e=>registered.has(e)).length;
  const list=saved.filter(e=>e.includes(query.toLowerCase()));
  const save=async()=>{if(busy)return;setBusy(true);setError('');try{await run('emailAllowlist.save',{enabled,emails:draft});setText(draft.join('\n'));}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  return <div className="two-columns">
    <Panel title="Invited emails" subtitle="When the allowlist is on, only these addresses can register, and each address can register once. The list is private and is never shown on the public registration page.">
      <div className="editor-form">
        <div className="field check-field"><input id="allowlist-enabled" type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/><label htmlFor="allowlist-enabled">Only allow invited emails to register</label><p className="field-help">Turn this off to let anyone with the link register. Already-registered emails are always rejected.</p></div>
        <div className="field"><label htmlFor="allowlist-emails">Email addresses</label><textarea id="allowlist-emails" rows={12} spellCheck={false} placeholder={'one@example.com\ntwo@example.com'} value={text} onChange={e=>setText(e.target.value)}/><p className="field-help">One per line, or paste a column from a spreadsheet. Commas also work. {draft.length} unique address{draft.length===1?'':'es'}.</p></div>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <div className="form-footer"><button className="button primary" type="button" disabled={busy||!changed} onClick={save}>{busy?'Saving…':'Save allowlist'}</button></div>
      </div>
    </Panel>
    <Panel title="Invitation status" subtitle={`${saved.length} invited · ${used} registered · ${saved.length-used} not yet registered`} action={<Badge tone={s.emailAllowlist.enabled?'green':'muted'}>{s.emailAllowlist.enabled?'Allowlist on':'Allowlist off · anyone can register'}</Badge>}>
      {saved.length?<><label className="search allowlist-search"><Search size={17}/><input aria-label="Search invited emails" placeholder="Search emails…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <div className="table-wrap"><table><thead><tr><th>Email</th><th>Status</th></tr></thead><tbody>{list.map(e=><tr key={e}><td>{e}</td><td><Badge tone={registered.has(e)?'green':'muted'}>{registered.has(e)?'Registered':'Not registered yet'}</Badge></td></tr>)}</tbody></table></div></>
        :<p className="panel-copy muted">No invited emails saved yet.</p>}
    </Panel>
  </div>;
}

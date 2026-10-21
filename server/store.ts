import { open, mkdir, readFile, rename, copyFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { eventSchema, registrationInputSchema, type EventState, type Command, type RegistrationReceipt } from '../shared/model';
import { createEvent, applyCommand, AppError } from '../shared/domain';
import { addRegistrationDefaults, applyRegistration, registrationReceipt } from '../shared/registration';

export class JsonStore {
  private state!:EventState;
  private queue:Promise<unknown>=Promise.resolve();
  private closed=false;
  private constructor(public readonly dir:string){}
  static async open(dir:string,initial=createEvent()):Promise<JsonStore>{
    await mkdir(dir,{recursive:true});const store=new JsonStore(dir);
    try {const lock=await open(join(dir,'server.lock'),'wx',0o600);await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));await lock.close();}
    catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')throw new AppError('Another server owns this data directory, or a stale server.lock needs manual removal.',409);throw e;}
    try {
      try{store.state=addRegistrationDefaults(eventSchema.parse(JSON.parse(await readFile(join(dir,'event.json'),'utf8'))));}
      catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Event data is corrupt or invalid. Restore a verified backup; the original file was preserved.',{cause:e});store.state=eventSchema.parse(initial);await store.write(store.state,false);}
      return store;
    }catch(e){await store.close();throw e;}
  }
  read():EventState{return structuredClone(this.state);}
  register(value:unknown):Promise<RegistrationReceipt>{
    const task=this.queue.then(async()=>{
      if(this.closed)throw new AppError('The server is closing',503);
      const input=registrationInputSchema.parse(value);
      const {registrationType,selections,...legacyInput}=input;
      // Keep the pre-individual bundle serialization identical for saved retry IDs.
      const canonical=registrationType==='individual'?{...legacyInput,registrationType,selections:[...selections!].sort((a,b)=>a.gameId.localeCompare(b.gameId))}:legacyInput;
      const requestHash=createHash('sha256').update(JSON.stringify({...canonical,gameIds:[...input.gameIds].sort()})).digest('hex');
      const previous=this.state.registrations.find(r=>r.requestId===input.requestId);
      if(previous){
        if(previous.requestHash!==requestHash)throw new AppError('This request was already submitted with different details. Start a new registration attempt.',409);
        return registrationReceipt(previous);
      }
      const next=structuredClone(this.state);
      const registration=applyRegistration(next,input,requestHash);
      next.revision++;next.updatedAt=new Date().toISOString();
      const valid=eventSchema.parse(next);await this.write(valid,true);this.state=valid;
      return registrationReceipt(registration);
    });this.queue=task.catch(()=>{});return task;
  }
  transact(revision:number,command:Command):Promise<EventState>{
    const task=this.queue.then(async()=>{
      if(this.closed)throw new AppError('The server is closing',503);
      if(revision!==this.state.revision)throw new AppError('This event changed in another window. Refresh and try again; your changes were not saved.',409);
      const next=structuredClone(this.state);applyCommand(next,command);next.revision++;next.updatedAt=new Date().toISOString();const valid=eventSchema.parse(next);await this.write(valid,true);this.state=valid;return this.read();
    });this.queue=task.catch(()=>{});return task;
  }
  private async write(next:EventState,backup:boolean){
    const active=join(this.dir,'event.json'),temp=join(this.dir,'event.json.tmp');
    const file=await open(temp,'w',0o600);
    try{await file.writeFile(JSON.stringify(next,null,2));await file.sync();}finally{await file.close();}
    if(backup){await mkdir(join(this.dir,'backups'),{recursive:true});await copyFile(active,join(this.dir,'event.last-good.json'));await copyFile(active,join(this.dir,'backups',`${String(this.state.revision).padStart(8,'0')}-${Date.now()}.json`));}
    await rename(temp,active);
    // Retention failures must not report an already committed transaction as failed.
    if(backup)try{const files=(await readdir(join(this.dir,'backups'))).filter(f=>f.endsWith('.json')).sort();for(const f of files.slice(0,-50))await unlink(join(this.dir,'backups',f));}catch(e){console.warn('Backup retention needs attention:',(e as Error).message);}
  }
  async close(){if(this.closed)return;await this.queue;this.closed=true;await unlink(join(this.dir,'server.lock')).catch(()=>{});}
}

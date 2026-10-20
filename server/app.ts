import express, { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { Auth } from './auth';
import { JsonStore } from './store';
import { AppError, publicEvent, entrantName } from '../shared/domain';

function token(req:Request){return req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('gameon_session='))?.slice(15);}
function csv(rows:unknown[][]){return '\uFEFF'+rows.map(row=>row.map(cell=>{let s=String(cell??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
export function createApp({store,auth,origin}:{store:JsonStore;auth:Auth;origin:string}){
  const app=express();app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin'});next();});
  app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});app.use(express.json({limit:'1mb'}));
  const privateOnly=(req:Request,_res:Response,next:NextFunction)=>auth.authorised(token(req))?next():next(new AppError('Please sign in to the organiser area',401));
  app.use('/api',(req,_res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!==origin)return next(new AppError('Request origin was not accepted',403));next();});
  const session=(res:Response)=>{res.cookie('gameon_session',auth.createSession(),{httpOnly:true,sameSite:'strict',secure:origin.startsWith('https:'),maxAge:8*60*60000,path:'/'});res.json({authenticated:true});};
  app.get('/api/session',async(req,res)=>res.json({authenticated:auth.authorised(token(req)),configured:await auth.configured(),setupAllowed:['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname)}));
  app.post('/api/setup',async(req,res)=>{if(!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname))throw new AppError('Initial password setup must be performed on localhost',403);auth.throttle(req.ip||'local');await auth.setup(req.body.password);session(res);});
  app.post('/api/login',async(req,res)=>{auth.throttle(req.ip||'local');await auth.login(req.body.password);session(res);});
  app.post('/api/logout',(req,res)=>{auth.logout(token(req));res.clearCookie('gameon_session',{path:'/'});res.json({ok:true});});
  app.get('/api/live',(_req,res)=>res.json(publicEvent(store.read())));
  app.get('/api/state',privateOnly,(_req,res)=>res.json(store.read()));
  app.post('/api/command',privateOnly,async(req,res)=>{const command=z.object({revision:z.number().int().min(0),type:z.string().max(100),payload:z.record(z.unknown())}).parse(req.body);res.json(await store.transact(command.revision,command));});
  app.get('/api/backup',privateOnly,(_req,res)=>{res.attachment(`gameon-backup-${new Date().toISOString().slice(0,10)}.json`);res.type('application/json').send(JSON.stringify(store.read(),null,2));});
  app.get('/api/export/:kind',privateOnly,(req,res)=>{const s=store.read();let rows:unknown[][];switch(req.params.kind){case 'participants':rows=[['Name','Department','Contact','Checked in'],...s.participants.map(p=>[p.name,p.department,p.contact,p.checkedIn?'Yes':'No'])];break;case 'matches':rows=[['Tournament','Round','Entrant A','Entrant B','Status','Score A','Score B','Winner','Scheduled time','Station'],...s.matches.map(m=>[s.tournaments.find(t=>t.id===m.tournamentId)?.name,m.round,entrantName(s,m.a),entrantName(s,m.b),m.bye?'bye':m.status,m.scoreA,m.scoreB,m.winnerId?entrantName(s,m.winnerId):'',m.scheduledAt,s.stations.find(x=>x.id===m.stationId)?.name])];break;case 'ledger':rows=[['Date','Type','Amount (LKR)','Participant','Description','Voided'],...s.ledger.map(e=>[e.createdAt,e.kind,e.amount,e.participantId?entrantName(s,e.participantId):'',e.note,e.voided?'Yes':'No'])];break;default:throw new AppError('Unknown export',404);}res.attachment(`gameon-${req.params.kind}.csv`).type('text/csv').send(csv(rows));});
  app.use('/api',(_req,_res,next)=>next(new AppError('API route not found',404)));
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{if(error instanceof z.ZodError){res.status(400).json({error:error.issues.map(e=>`${e.path.join('.')}: ${e.message}`).join('; ')});return;}const status=error instanceof AppError?error.status:500;if(status===500)console.error(error);res.status(status).json({error:status===500?'The operation could not be saved. Your previous data is preserved. Check the server log.':(error as Error).message});});
  return app;
}
